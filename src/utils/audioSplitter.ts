
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
      
      onProgress?.(5);
      await yieldToMain();

      arrayBuffer = await file.arrayBuffer();
      onProgress?.(15);
      await yieldToMain();

      // デコード処理（ここが最も重い）
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      onProgress?.(40);
      await yieldToMain();
      
      const sampleRate = audioBuffer.sampleRate;
      const numberOfChannels = audioBuffer.numberOfChannels;
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
        const onMessage = (ev: MessageEvent) => {
          const d = ev.data as any;
          if (d?.type === 'progress') {
            onProgress?.(d.progress);
          } else if (d?.type === 'result' && Array.isArray(d.parts)) {
            // parts are ArrayBuffers
            partsFromWorker.push(...d.parts);
            worker.removeEventListener('message', onMessage);
            resolve();
          }
        };

        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', (e) => { worker.removeEventListener('message', onMessage); reject(e); });
      });

      // Send processing request to worker
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
      throw error;
    } finally {
      this.cleanup();
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

