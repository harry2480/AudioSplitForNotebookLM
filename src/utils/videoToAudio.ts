import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

export class VideoToAudioExtractor {
  private ffmpeg: FFmpeg | null = null;

  async extractAudio(file: File, progressCallback?: (progress: number) => void): Promise<File> {
    if (!this.isVideoFile(file)) {
      throw new Error('選択されたファイルは動画ファイルではありません');
    }

    try {
      // Initialize FFmpeg
      if (!this.ffmpeg) {
        this.ffmpeg = new FFmpeg();
        
        if (progressCallback) {
          this.ffmpeg.on('progress', ({ progress }) => {
            progressCallback(Math.round(progress * 100));
          });
        }

        // Use single-threaded version for compatibility
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }

      const inputFileName = 'input' + this.getFileExtension(file.name);
      const outputFileName = 'output.wav';

      // Write input file to FFmpeg filesystem
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(file));

      // Extract audio as WAV for maximum compatibility
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // PCM 16-bit little-endian
        '-ar', '44100', // Sample rate 44.1kHz
        '-ac', '2', // Stereo
        outputFileName
      ]);

      // Read the output file
      const data = await this.ffmpeg.readFile(outputFileName);
      const audioBlob = new Blob([data], { type: 'audio/wav' });

      // Create a new File object with appropriate name
      const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
      const extractedAudioFile = new File([audioBlob], `${originalName}_extracted.wav`, {
        type: 'audio/wav',
        lastModified: Date.now()
      });

      return extractedAudioFile;
    } catch (error) {
      console.error('Audio extraction failed:', error);
      throw new Error(`動画からの音声抽出に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  private isVideoFile(file: File): boolean {
    const videoMimeTypes = [
      'video/mp4',
      'video/quicktime', // .mov
      'video/x-msvideo', // .avi
      'video/x-matroska', // .mkv
      'video/webm'
    ];

    const videoExtensions = [
      '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp', '.flv', '.wmv'
    ];

    return videoMimeTypes.includes(file.type.toLowerCase()) ||
           videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
  }

  public cleanup(): void {
    if (this.ffmpeg) {
      // FFmpeg cleanup is handled internally
      this.ffmpeg = null;
    }
  }
}

export const extractAudioFromVideo = async (
  file: File,
  progressCallback?: (progress: number) => void
): Promise<File> => {
  const extractor = new VideoToAudioExtractor();
  
  try {
    const audioFile = await extractor.extractAudio(file, progressCallback);
    return audioFile;
  } finally {
    extractor.cleanup();
  }
};