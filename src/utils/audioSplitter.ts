
/**
 * UIのフリーズを防ぐためのメインスレッド解放ユーティリティ
 */
const yieldToMain = () => {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve(null);
    };
    channel.port2.postMessage(null);
  });
};

export class WebAudioSplitter {
  private audioContext: AudioContext | null = null;

  async splitAudioBySize(file: File | Blob, maxSizeMB: number, onProgress?: (progress: number) => void): Promise<Blob[]> {
    return this.splitAudio(file, "size", { maxSize: maxSizeMB }, onProgress);
  }

  async splitAudioByCount(file: File | Blob, count: number, onProgress?: (progress: number) => void): Promise<Blob[]> {
    return this.splitAudio(file, "count", { count }, onProgress);
  }

  private async splitAudio(
    file: File | Blob, 
    mode: "size" | "count", 
    options: { maxSize?: number; count?: number },
    onProgress?: (progress: number) => void
  ): Promise<Blob[]> {
    let arrayBuffer: ArrayBuffer | null = null;
    let audioBuffer: AudioBuffer | null = null;
    
    try {
      console.log("=== Starting audio splitting process ===");
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log("AudioContext created:", this.audioContext.state);
      
      onProgress?.(5);
      await yieldToMain();

      console.log("Reading file...");
      const arrayBufferRaw = await file.arrayBuffer();
      arrayBuffer = arrayBufferRaw;
      console.log("File size:", arrayBuffer.byteLength, "bytes");
      onProgress?.(15);
      await yieldToMain();

      // デコード処理（ここが最も重い）
      console.log("Decoding audio data...");
      try {
        // Promise-based API (modern browsers)
        audioBuffer = await this.audioContext.decodeAudioData(arrayBufferRaw);
        console.log("Audio decoded successfully:", {
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          length: audioBuffer.length
        });
      } catch (decodeError: any) {
        console.log("Promise-based decodeAudioData failed, trying callback-based API:", decodeError?.message);
        
        // Try callback-based API (for older browsers)
        try {
          audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.error("DecodeAudioData callback timed out");
              reject(new Error("DecodeAudioData timeout"));
            }, 30000); // 30秒のタイムアウト
            
            (this.audioContext as AudioContext).decodeAudioData(
              arrayBufferRaw, // Use original since decodeAudioData might transfer bits
              (decoded) => {
                clearTimeout(timeout);
                console.log("Audio decoded with callback API");
                resolve(decoded);
              },
              (error) => {
                clearTimeout(timeout);
                console.error("DecodeAudioData callback error:", error?.message || error?.code || error);
                reject(error);
              }
            );
          });
        } catch (callbackError: any) {
          const errorMessage = `Web Audio APIデコード失敗: ${callbackError?.message || decodeError?.message || '不明なエラー'}`;
          console.error(errorMessage, { decodeError, callbackError });
          throw new Error(errorMessage);
        }
      }
      onProgress?.(40);
      await yieldToMain();
      
      // 自動モノラル化 + サンプルレート低減（ブラウザ負荷軽減）
      let sampleRate = audioBuffer.sampleRate;
      let numberOfChannels = audioBuffer.numberOfChannels;
      const TARGET_SR = 22050;
      const TARGET_CHANNELS = 1;

      if (sampleRate > TARGET_SR || numberOfChannels > TARGET_CHANNELS) {
        try {
          const offline = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
            TARGET_CHANNELS,
            Math.ceil(audioBuffer.duration * TARGET_SR),
            TARGET_SR
          );

          const src = offline.createBufferSource();
          // If original channels > target channels, create a merged buffer
          const tmpBuf = offline.createBuffer(numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
          for (let ch = 0; ch < numberOfChannels; ch++) tmpBuf.copyToChannel(audioBuffer.getChannelData(ch), ch);
          src.buffer = tmpBuf;
          // Connect through channel merger/matrix if necessary
          src.connect(offline.destination);
          src.start(0);

          const rendered = await offline.startRendering();
          audioBuffer = rendered;
          sampleRate = audioBuffer.sampleRate;
          numberOfChannels = audioBuffer.numberOfChannels;
        } catch (e) {
          console.warn('Resample failed, proceeding with original buffer', e);
        }
      }
      const duration = audioBuffer.duration;
      const totalSamples = audioBuffer.length;
      
      let numParts: number;
      if (mode === "size" && options.maxSize) {
        const maxSizeBytes = options.maxSize * 1024 * 1024;
        const estimatedWavSize = (sampleRate * numberOfChannels * duration * 1) + 44;
        const bufferFactor = 1.05; 
        numParts = Math.max(Math.ceil((estimatedWavSize * bufferFactor) / maxSizeBytes), 2);
      } else if (mode === "count" && options.count) {
        numParts = options.count;
      } else {
        throw new Error("Invalid split parameters");
      }
      
      const baseSamplesPerPart = Math.floor(totalSamples / numParts);

      // Prepare channel buffers and hand off heavy encoding to a Web Worker
      // We copy each channel into a contiguous ArrayBuffer and transfer ownership to the worker.
      const channelBuffers: ArrayBuffer[] = [];
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const chData = audioBuffer.getChannelData(channel);
        // create a fresh copy with contiguous buffer
        const copy = chData.slice();
        channelBuffers.push(copy.buffer);
        // allow UI to update between allocations
        await yieldToMain();
      }

      // Instantiate worker (Vite-friendly URL import)
      const worker = new Worker(new URL('../workers/audioWorker.ts', import.meta.url), { type: 'module' });

      const partsFromWorker: ArrayBuffer[] = [];

      const workerPromise: Promise<void> = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          worker.terminate();
          reject(new Error('Worker タイムアウト: 処理に時間がかかりすぎています'));
        }, 300000); // 5分のタイムアウト

        const onMessage = (ev: MessageEvent) => {
          try {
            const d = ev.data as any;
            if (d?.type === 'progress') {
              onProgress?.(d.progress);
            } else if (d?.type === 'error') {
              throw new Error(`Worker エラー: ${d.message}`);
            } else if (d?.type === 'result' && Array.isArray(d.parts)) {
              // parts are ArrayBuffers
              partsFromWorker.push(...d.parts);
              worker.removeEventListener('message', onMessage);
              worker.removeEventListener('error', onError);
              clearTimeout(timeoutId);
              resolve();
            }
          } catch (err) {
            console.error('onMessage エラー:', err);
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            clearTimeout(timeoutId);
            worker.terminate();
            reject(err);
          }
        };

        const onError = (e: ErrorEvent) => {
          console.error('Worker エラー:', e.message, e.filename, e.lineno);
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          clearTimeout(timeoutId);
          reject(new Error(`Worker エラー: ${e.message}`));
        };

        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
      });

      // Send processing request to worker
      try {
        console.log('Worker にメッセージを送信:', {
          sampleRate,
          numberOfChannels,
          totalSamples,
          numParts,
          baseSamplesPerPart,
          channelBuffersCount: channelBuffers.length
        });
        
        worker.postMessage(
          {
            type: 'process',
            sampleRate,
            numberOfChannels,
            totalSamples,
            numParts,
            baseSamplesPerPart,
            compress: true,
            channelBuffers
          },
          channelBuffers
        );
      } catch (postError) {
        console.error('Worker へのメッセージ送信エラー:', postError);
        worker.terminate();
        throw new Error(`Worker メッセージ送信エラー: ${postError}`);
      }

      // wait for worker to finish
      await workerPromise;

      // Create Blobs from returned ArrayBuffers
      const results: Blob[] = partsFromWorker.map((ab) => new Blob([ab], { type: 'audio/wav' }));

      // progress to 100
      onProgress?.(100);

      // terminate worker and return results
      try { worker.terminate(); } catch (e) {}
      return results;
    } catch (error) {
      console.error("Web Audio splitting failed:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log("Web Audio API failed, returning structured error for fallback");
      throw new Error(`Web Audio API エラー: ${errorMsg}`);
    } finally {
      try {
        this.cleanup();
      } catch (cleanupError) {
        console.error('Cleanup エラー:', cleanupError);
      }
      arrayBuffer = null;
      audioBuffer = null;
    }
  }

  // WAV encoding is handled in a Web Worker (audioWorker.ts) to keep main thread responsive.

  public cleanup(): void {
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (e) {}
      this.audioContext = null;
    }
  }
}

export const splitAudioFile = async (
  file: File | Blob,
  mode: "size" | "count",
  options: { maxSize?: number; count?: number },
  progressCallback?: (progress: number) => void
): Promise<Blob[]> => {
  const splitter = new WebAudioSplitter();
  try {
    if (mode === "size" && options.maxSize) {
      return await splitter.splitAudioBySize(file, options.maxSize, progressCallback);
    } else if (mode === "count" && options.count) {
      return await splitter.splitAudioByCount(file, options.count, progressCallback);
    }
    throw new Error("Invalid split parameters");
  } finally {
    splitter.cleanup();
  }
};

