import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { splitAudioFile } from '../utils/audioSplitter';
import { getFFmpeg } from '../utils/ffmpegLoader';
import { convertToMp3, isMp3 } from '../utils/mp3Converter';

export const useFFmpeg = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  // FFmpeg 自身の進捗(0-100)を全体進捗のどの範囲に割り当てるか。
  // 例: MP3変換フェーズは 0-40%、分割フェーズは 40-100%。
  const progressRangeRef = useRef({ start: 0, end: 100 });

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    setIsLoading(true);
    try {
      const ffmpeg = await getFFmpeg();

      // Throttle progress updates to reduce UI stuttering
      let lastProgressUpdate = 0;
      ffmpeg.on('progress', ({ progress }) => {
        const now = Date.now();
        const ratio = Math.min(1, Math.max(0, progress));
        const { start, end } = progressRangeRef.current;
        const progressValue = Math.round(start + ratio * (end - start));

        // Update progress at most every 100ms or for significant changes
        if (now - lastProgressUpdate > 100 || progressValue === 100) {
          lastProgressUpdate = now;
          setProgress(progressValue);
        }
      });

      ffmpegRef.current = ffmpeg;
      return ffmpeg;
    } finally {
      setIsLoading(false); // ハング/失敗時にローディング状態を必ず解除
    }
  }, []);

  const getDuration = async (ffmpeg: FFmpeg, fileName: string): Promise<number> => {
    let duration = 0;
    
    // Capture FFmpeg logs to extract duration
    const logs: string[] = [];
    const collectLog = ({ message }: { message: string }) => {
      logs.push(message);
    };
    ffmpeg.on('log', collectLog);

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

    // Clear the log listener（共有インスタンスなのでリスナーを残さない）
    ffmpeg.off('log', collectLog);

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
    progressRangeRef.current = { start: 0, end: 100 };

    // Use a working file variable since the parameter is const
    let workingFile: File | Blob = file;

    // 出力を MP3 に統一するため、MP3/WAV 以外（動画・webm・ogg・m4a 等）は
    // 分割前に MP3 へ変換する。NotebookLM は webm を扱えないため。
    const sourceName = file instanceof File ? file.name.toLowerCase() : '';
    const isWavSource = sourceName.endsWith('.wav') || file.type === 'audio/wav' || file.type === 'audio/x-wav';

    if (!isMp3(file) && !isWavSource) {
      console.log('Non-MP3 input detected, converting to MP3...');
      try {
        await loadFFmpeg();
        // 変換は全体の 0-40%、分割は 40-100% に割り当てる。
        progressRangeRef.current = { start: 0, end: 40 };
        workingFile = await convertToMp3(file);
        setProgress(40);
        console.log('MP3 conversion complete, file size:', workingFile.size);
      } catch (conversionError) {
        progressRangeRef.current = { start: 0, end: 100 };
        console.error('MP3 conversion failed:', conversionError);
        setIsLoading(false);
        throw new Error(`音声をMP3に変換できませんでした: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
      }
    }

    // 以降の FFmpeg 進捗は分割フェーズ（40-100%）として扱う。
    progressRangeRef.current = workingFile === file ? { start: 0, end: 100 } : { start: 40, end: 100 };

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