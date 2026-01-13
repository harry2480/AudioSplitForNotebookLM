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

    // Use single-threaded version for compatibility with GitHub Pages
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

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
    
    try {
      // First try Web Audio API approach (more compatible)
      console.log('Attempting Web Audio API splitting...');
      const result = await splitAudioFile(file, mode, options, (progress) => {
        setProgress(progress);
      });
      
      setIsLoading(false);
      return result;
    } catch (webAudioError) {
      console.warn('Web Audio API failed, trying FFmpeg.wasm...', webAudioError);
      
      try {
        // Fallback to FFmpeg.wasm
        const ffmpeg = await loadFFmpeg();
        const fileName = file instanceof File ? file.name : 'audio.wav';
        const inputFileName = 'input' + fileName.substring(fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        
        await ffmpeg.writeFile(inputFileName, await fetchFile(file));
        
        // Get actual duration
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
                }
              } catch (error) {
                console.error(`Error creating part ${i + 1}:`, error);
              }
            }
          }
        }
        
        setIsLoading(false);
        return results;
      } catch (ffmpegError) {
        console.error('Both Web Audio API and FFmpeg.wasm failed:', ffmpegError);
        setIsLoading(false);
        throw new Error('音声ファイルの分割に失敗しました。ブラウザがサポートしていない可能性があります。');
      }
    }
  }, [loadFFmpeg]);

  return {
    splitAudio,
    isLoading,
    progress
  };
};