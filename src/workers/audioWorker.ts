/* Web Worker: performs WAV encoding and splitting from transferred channel buffers */
console.log('Worker script loaded');

export type WorkerMessage = {
  type: 'process';
  sampleRate: number;
  numberOfChannels: number;
  totalSamples: number;
  numParts: number;
  baseSamplesPerPart: number;
  compress: boolean;
};

const yieldToMain = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

async function encodeWavPart(
  channelDatas: Float32Array[],
  startSample: number,
  partLength: number,
  sampleRate: number,
  compress: boolean
): Promise<ArrayBuffer> {
  const numberOfChannels = channelDatas.length;
  const bytesPerSample = compress ? 1 : 2;
  const buffer = new ArrayBuffer(44 + partLength * numberOfChannels * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + partLength * numberOfChannels * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, partLength * numberOfChannels * bytesPerSample, true);

  let offset = 44;
  let processed = 0;
  const yieldEvery = 10000;

  for (let i = 0; i < partLength; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelDatas[ch][startSample + i]));
      if (compress) {
        const value = Math.round((sample + 1) * 127.5);
        view.setUint8(offset, Math.max(0, Math.min(255, value)));
        offset += 1;
      } else {
        const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, Math.max(-32768, Math.min(32767, value)), true);
        offset += 2;
      }
      processed++;
      if ((processed % yieldEvery) === 0) await yieldToMain();
    }
  }

  return buffer;
}

self.addEventListener('message', async (ev: MessageEvent) => {
  try {
    const data = ev.data as WorkerMessage & { channelBuffers?: ArrayBuffer[] };
    if (data.type !== 'process' || !data.channelBuffers) {
      console.error('Invalid message data:', data);
      return;
    }

    const { sampleRate, totalSamples, numParts, baseSamplesPerPart, compress } = data;

    console.log('Worker: Processing audio', {
      sampleRate,
      totalSamples,
      numParts,
      baseSamplesPerPart,
      compress,
      channelCount: data.channelBuffers.length
    });

    // Reconstruct Float32Array per channel
    const channelDatas: Float32Array[] = data.channelBuffers.map(buf => new Float32Array(buf));

    const results: ArrayBuffer[] = [];

    for (let i = 0; i < numParts; i++) {
      const startSample = i * baseSamplesPerPart;
      const endSample = (i === numParts - 1) ? totalSamples : (i + 1) * baseSamplesPerPart;
      const partLength = endSample - startSample;

      console.log(`Worker: Encoding part ${i + 1}/${numParts}`, { startSample, endSample, partLength });

      // Encode WAV for this part
      const buf = await encodeWavPart(channelDatas, startSample, partLength, sampleRate, !!compress);
      results.push(buf);

      // progress update
      const progress = 40 + Math.round(((i + 1) / numParts) * 55);
      (self as any).postMessage({ type: 'progress', progress });
      await yieldToMain();
    }

    console.log('Worker: Sending results', { resultCount: results.length });

    // Return results as transferable ArrayBuffers
    (self as any).postMessage({ type: 'result', parts: results }, results);
  } catch (error) {
    console.error('Worker message handling error:', error);
    (self as any).postMessage({ type: 'error', message: String(error) });
  }
});
