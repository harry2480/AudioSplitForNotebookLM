import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { splitAudioFile } from '../utils/audioSplitter';

export const useFFmpeg = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    setIsLoading(true);
    const ffmpeg = new FFmpeg();
    
    // Create a function to get absolute paths for assets
    const getAssetURL = (path: string) => {
      // If running on GitHub Pages, the base path is /AudioSplitForNotebookLM/
      const base = import.meta.env.BASE_URL || '/';
      return `${base}${path.startsWith('/') ? path.slice(1) : path}`;
    };

    // Throttle progress updates to reduce UI stuttering
    let lastProgressUpdate = 0;
    ffmpeg.on('progress', ({ progress }) => {
      const now = Date.now();
      const progressValue = Math.round(progress * 100);
      
      // Update progress at most every 100ms or for significant changes
      if (now - lastProgressUpdate > 100 || progressValue === 100) {
        lastProgressUpdate = now;
        setProgress(progressValue);
      }
    });

    // Capture logs for debugging production issues
    ffmpeg.on('log', ({ message }) => {
      if (message.includes('Error') || message.includes('failed')) {
        console.error('FFmpeg Log:', message);
      }
    });

    // Use specific version and allow fallback
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    } catch (loadError) {
      console.error('Failed to load FFmpeg from unpkg, trying local fallback...', loadError);
      // Fallback or re-throw
      throw loadError;
    }

    ffmpegRef.current = ffmpeg;
    setIsLoading(false);
    return ffmpeg;
  }, []);

  const getDuration = async (ffmpeg: FFmpeg, fileName: string): Promise<number> => {
    let duration = 0;
    
    // Capture FFmpeg logs to extract duration
    const logs: string[] = [];
    ffmpeg.on('log', ({ message }) => {
      logs.push(message);
    });

    try {
      // Run ffmpeg -i to get file info (this will "fail" but give us metadata)
      await ffmpeg.exec(['-i', fileName]);
    } catch {
      // Expected to fail, but logs will contain duration info
    }

    // Parse duration from logs
    for (const log of logs) {
      const durationMatch = log.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseInt(durationMatch[3]);
        const milliseconds = parseInt(durationMatch[4]);
        duration = hours * 3600 + minutes * 60 + seconds + milliseconds / 100;
        break;
      }
    }

    // Clear the log listener
    ffmpeg.off('log', () => {});

    if (duration > 0) {
      return duration;
    }

    // Fallback: estimate based on typical audio bitrates
    console.warn('Could not determine duration, using estimation');
    return 3600; // Default to 1 hour
  };

  const splitAudio = useCallback(async (
    file: File | Blob,
    mode: 'size' | 'count',
    options: { maxSize?: number; count?: number }
  ): Promise<Blob[]> => {
    setIsLoading(true);
    setProgress(0);
    
    // Check if it's an MP3 or other compressed format
    const fileName = file instanceof File ? file.name : 'audio';
    const isMP3 = fileName.toLowerCase().endsWith('.mp3') || file.type === 'audio/mpeg';
    const isMp4 = fileName.toLowerCase().endsWith('.mp4') || file.type === 'audio/mp4';
    
    console.log('Split request:', { fileName, isMP3, isMp4, fileType: file.type, fileSize: file.size });
    
    // For MP3 and other compressed formats, use FFmpeg directly
    if (isMP3 || isMp4) {
      console.log('MP3/MP4 detected, using FFmpeg directly');
      try {
        const ffmpeg = await loadFFmpeg();
        const inputFileName = 'input' + fileName.substring(fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        
        console.log('Writing file to FFmpeg:', inputFileName);
        await ffmpeg.writeFile(inputFileName, await fetchFile(file));
        
        console.log('Getting audio duration...');
        const duration = await getDuration(ffmpeg, inputFileName);
        console.log('Audio duration:', duration, 'seconds');
        
        const results: Blob[] = [];
        
        if (mode === 'size' && options.maxSize) {
          const maxSizeBytes = options.maxSize * 1024 * 1024;
          const fileSize = file.size;
          const numParts = Math.ceil(fileSize / maxSizeBytes);
          const partDuration = duration / numParts;
          
          console.log('Splitting into', numParts, 'parts');
          
          for (let i = 0; i < numParts; i++) {
            const outputFile = `output_${i + 1}.${extension}`;
            const startTime = i * partDuration;
            const endTime = Math.min((i + 1) * partDuration, duration);
            const actualDuration = endTime - startTime;
            
            if (actualDuration > 0) {
              try {
                await ffmpeg.exec([
                  '-i', inputFileName,
                  '-ss', startTime.toString(),
                  '-t', actualDuration.toString(),
                  '-c', 'copy',
                  '-avoid_negative_ts', 'make_zero',
                  outputFile
                ]);
                
                const data = await ffmpeg.readFile(outputFile);
                const dataArray = new Uint8Array(data as ArrayBuffer);
                if (dataArray.byteLength > 0) {
                  results.push(new Blob([dataArray], { type: file.type }));
                  console.log(`Part ${i + 1} created, size:`, dataArray.byteLength);
                  setProgress(40 + (i + 1) / numParts * 60);
                }
              } catch (error) {
                console.error(`Error creating part ${i + 1}:`, error);
              }
            }
          }
        } else if (mode === 'count' && options.count) {
          const numParts = options.count;
          const partDuration = duration / numParts;
          
          console.log('Splitting into', numParts, 'parts');
          
          for (let i = 0; i < numParts; i++) {
            const outputFile = `output_${i + 1}.${extension}`;
            const startTime = i * partDuration;
            const endTime = Math.min((i + 1) * partDuration, duration);
            const actualDuration = endTime - startTime;
            
            if (actualDuration > 0) {
              try {
                await ffmpeg.exec([
                  '-i', inputFileName,
                  '-ss', startTime.toString(),
                  '-t', actualDuration.toString(),
                  '-c', 'copy',
                  '-avoid_negative_ts', 'make_zero',
                  outputFile
                ]);
                
                const data = await ffmpeg.readFile(outputFile);
                const dataArray = new Uint8Array(data as ArrayBuffer);
                if (dataArray.byteLength > 0) {
                  results.push(new Blob([dataArray], { type: file.type }));
                  console.log(`Part ${i + 1} created, size:`, dataArray.byteLength);
                  setProgress(40 + (i + 1) / numParts * 60);
                }
              } catch (error) {
                console.error(`Error creating part ${i + 1}:`, error);
              }
            }
          }
        }
        
        console.log('FFmpeg split completed, total parts:', results.length);
        setIsLoading(false);
        return results;
      } catch (ffmpegError) {
        console.error('FFmpeg error:', ffmpegError);
        setIsLoading(false);
        throw ffmpegError;
      }
    }
    
    // For WAV and other uncompressed formats, try Web Audio API first
    // BUT only if file size is small enough to avoid memory crashes (Error Code 5)
    const isSmallFile = (file instanceof File || file instanceof Blob) && file.size < 100 * 1024 * 1024;
    const isWav = (file instanceof File ? file.name : '').toLowerCase().endsWith('.wav');

    if (isSmallFile && isWav) {
      try {
        console.log('Using Web Audio API...');
        const result = await splitAudioFile(file, mode, options, (progress) => {
          console.log('Split progress:', progress);
          setProgress(progress);
        });
        
        console.log('Web Audio API split completed:', result.length, 'parts');
        setIsLoading(false);
        return result;
      } catch (webAudioError) {
        console.warn('Web Audio API failed, trying FFmpeg.wasm...', webAudioError);
        // Fall through to FFmpeg
      }
    } else {
      console.log(`Skipping Web Audio API (size: ${((file instanceof Blob ? file.size : 0) / 1024 / 1024).toFixed(1)}MB, wav: ${isWav}) to prevent memory crash (Error Code 5)`);
    }

    try {
      // Use FFmpeg directly for larger files or compressed formats
      console.log('Using FFmpeg.wasm directly for stability...');
      const ffmpeg = await loadFFmpeg();
      console.log('FFmpeg loaded successfully');
        
        const fileName = file instanceof File ? file.name : 'audio.wav';
        const inputFileName = 'input' + fileName.substring(fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        
        console.log('Writing file to FFmpeg:', inputFileName);
        await ffmpeg.writeFile(inputFileName, await fetchFile(file));
        
        // Get actual duration
        console.log('Getting audio duration...');
        const duration = await getDuration(ffmpeg, inputFileName);
        console.log('Audio duration:', duration, 'seconds');
        
        const results: Blob[] = [];
        
        if (mode === 'size' && options.maxSize) {
          const maxSizeBytes = options.maxSize * 1024 * 1024;
          const fileSize = file.size;
          const numParts = Math.ceil(fileSize / maxSizeBytes);
          const partDuration = duration / numParts;
          
          console.log('Splitting into', numParts, 'parts of', partDuration, 'seconds each');
          
          for (let i = 0; i < numParts; i++) {
            const outputFile = `output_${i + 1}.${extension}`;
            const startTime = i * partDuration;
            const endTime = Math.min((i + 1) * partDuration, duration);
            const actualDuration = endTime - startTime;
            
            console.log(`Part ${i + 1}: ${startTime}s to ${endTime}s (${actualDuration}s)`);
            
            if (actualDuration > 0) {
              try {
                await ffmpeg.exec([
                  '-i', inputFileName,
                  '-ss', startTime.toString(),
                  '-t', actualDuration.toString(),
                  '-c', 'copy',
                  '-avoid_negative_ts', 'make_zero',
                  outputFile
                ]);
                
                const data = await ffmpeg.readFile(outputFile);
                const dataArray = new Uint8Array(data as ArrayBuffer);
                if (dataArray.byteLength > 0) {
                  results.push(new Blob([dataArray], { type: file.type }));
                  console.log(`Part ${i + 1} created, size:`, dataArray.byteLength);
                }
              } catch (error) {
                console.error(`Error creating part ${i + 1}:`, error);
              }
            }
          }
        } else if (mode === 'count' && options.count) {
          const numParts = options.count;
          const partDuration = duration / numParts;
          
          console.log('Splitting into', numParts, 'parts of', partDuration, 'seconds each');
          
          for (let i = 0; i < numParts; i++) {
            const outputFile = `output_${i + 1}.${extension}`;
            const startTime = i * partDuration;
            const endTime = Math.min((i + 1) * partDuration, duration);
            const actualDuration = endTime - startTime;
            
            console.log(`Part ${i + 1}: ${startTime}s to ${endTime}s (${actualDuration}s)`);
            
            if (actualDuration > 0) {
              try {
                await ffmpeg.exec([
                  '-i', inputFileName,
                  '-ss', startTime.toString(),
                  '-t', actualDuration.toString(),
                  '-c', 'copy',
                  '-avoid_negative_ts', 'make_zero',
                  outputFile
                ]);
                
                const data = await ffmpeg.readFile(outputFile);
                const dataArray = new Uint8Array(data as ArrayBuffer);
                if (dataArray.byteLength > 0) {
                  results.push(new Blob([dataArray], { type: file.type }));
                  console.log(`Part ${i + 1} created, size:`, dataArray.byteLength);
                }
              } catch (error) {
                console.error(`Error creating part ${i + 1}:`, error);
              }
            }
          }
        }
        
        console.log('FFmpeg split completed, total parts:', results.length);
        setIsLoading(false);
        return results;
      } catch (ffmpegError) {
        console.error('Both Web Audio API and FFmpeg.wasm failed:', ffmpegError);
        setIsLoading(false);
        const ffmpegErrorMessage = ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError);
        throw new Error(`音声ファイルの分割に失敗しました。ブラウザがサポートしていない可能性があります。\nエラー: ${ffmpegErrorMessage}`);
      }
    }
  }, [loadFFmpeg]);

  return {
    splitAudio,
    isLoading,
    progress
  };
};