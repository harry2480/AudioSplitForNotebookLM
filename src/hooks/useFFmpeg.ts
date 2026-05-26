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

    // Helper to detect video files
    const isVideoFile = (f: File | Blob): boolean => {
      const name = f instanceof File ? f.name.toLowerCase() : '';
      const videoMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo',
        'video/x-matroska', 'video/webm', 'video/mpeg', 'video/3gpp',
        'video/x-flv', 'video/x-ms-wmv'];
      return videoMimes.includes(f.type) || /\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv)$/i.test(name);
    };

    // Use a working file variable since the parameter is const
    let workingFile: File | Blob = file;

    // Extract audio from video files
    if (isVideoFile(file)) {
      console.log('Video detected, extracting audio as MP3...');
      try {
        const ffmpeg = await loadFFmpeg();
        const videoName = file instanceof File ? file.name : 'input.mp4';
        const inputExt = videoName.substring(videoName.lastIndexOf('.'));
        const inputName = 'input_video' + inputExt;

        await ffmpeg.writeFile(inputName, await fetchFile(file));
        await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'libmp3lame',
          '-ab', '128k', 'extracted.mp3']);
        await ffmpeg.deleteFile(inputName);  // Free memory immediately

        const mp3Data = await ffmpeg.readFile('extracted.mp3');
        await ffmpeg.deleteFile('extracted.mp3');
        const baseName = videoName.replace(/\.[^/.]+$/, '');
        workingFile = new File([mp3Data as ArrayBuffer],
          `${baseName}_extracted.mp3`, { type: 'audio/mpeg' });
        setProgress(40);  // Extraction complete: 40% → split: 40-100%
        console.log('Audio extraction complete, file size:', workingFile.size);
      } catch (extractionError) {
        console.error('Video extraction failed:', extractionError);
        setIsLoading(false);
        throw new Error(`動画から音声を抽出できませんでした: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
      }
    }

    // Check if it's an MP3 or other compressed format
    const fileName = workingFile instanceof File ? workingFile.name : 'audio';
    const isMP3 = fileName.toLowerCase().endsWith('.mp3') || workingFile.type === 'audio/mpeg';
    const isMp4 = fileName.toLowerCase().endsWith('.mp4') || workingFile.type === 'audio/mp4';
    
    console.log('Split request:', { fileName, isMP3, isMp4, fileType: file.type, fileSize: file.size });
    
    // For MP3 and other compressed formats, use FFmpeg directly
    if (isMP3 || isMp4) {
      console.log('MP3/MP4 detected, using FFmpeg directly');
      try {
        const ffmpeg = await loadFFmpeg();
        const inputFileName = 'input' + fileName.substring(fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);

        console.log('Writing file to FFmpeg:', inputFileName);
        await ffmpeg.writeFile(inputFileName, await fetchFile(workingFile));

        console.log('Getting audio duration...');
        const duration = await getDuration(ffmpeg, inputFileName);
        console.log('Audio duration:', duration, 'seconds');

        const results: Blob[] = [];

        if (mode === 'size' && options.maxSize) {
          const maxSizeBytes = options.maxSize * 1024 * 1024;
          const fileSize = workingFile.size;
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
                  results.push(new Blob([dataArray], { type: workingFile.type }));
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
                  results.push(new Blob([dataArray], { type: workingFile.type }));
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
    const isSmallFile = (workingFile instanceof File || workingFile instanceof Blob) && workingFile.size < 100 * 1024 * 1024;
    const isWav = (workingFile instanceof File ? workingFile.name : '').toLowerCase().endsWith('.wav');

    if (isSmallFile && isWav) {
      try {
        console.log('Using Web Audio API...');
        const result = await splitAudioFile(workingFile, mode, options, (progress) => {
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
      console.log(`Skipping Web Audio API (size: ${((workingFile instanceof Blob ? workingFile.size : 0) / 1024 / 1024).toFixed(1)}MB, wav: ${isWav}) to prevent memory crash (Error Code 5)`);
    }

    try {
      // Use FFmpeg directly for larger files or compressed formats
      console.log('Using FFmpeg.wasm directly for stability...');
      const ffmpeg = await loadFFmpeg();
      console.log('FFmpeg loaded successfully');

      const fileNameForFFmpeg = workingFile instanceof File ? workingFile.name : 'audio.wav';
      const inputFileName = 'input' + fileNameForFFmpeg.substring(fileNameForFFmpeg.lastIndexOf('.'));
      const extension = fileNameForFFmpeg.substring(fileNameForFFmpeg.lastIndexOf('.') + 1);

      console.log('Writing file to FFmpeg:', inputFileName);
      await ffmpeg.writeFile(inputFileName, await fetchFile(workingFile));

      // Get actual duration
      console.log('Getting audio duration...');
      const duration = await getDuration(ffmpeg, inputFileName);
      console.log('Audio duration:', duration, 'seconds');

      const results: Blob[] = [];

      if (mode === 'size' && options.maxSize) {
        const maxSizeBytes = options.maxSize * 1024 * 1024;
        const fileSize = workingFile.size;
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
                results.push(new Blob([dataArray], { type: workingFile.type }));
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
                results.push(new Blob([dataArray], { type: workingFile.type }));
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
      console.error('Both Web Audio API and FFmpeg.wasm failed:', ffmpegError);
      setIsLoading(false);
      const ffmpegErrorMessage = ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError);
      throw new Error(`音声ファイルの分割に失敗しました。ブラウザがサポートしていない可能性があります。\nエラー: ${ffmpegErrorMessage}`);
    }
  }, [loadFFmpeg]);

  return {
    splitAudio,
    isLoading,
    progress
  };
};