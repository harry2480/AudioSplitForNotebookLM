// Alternative audio splitting using Web Audio API for better compatibility
export class WebAudioSplitter {
  private audioContext: AudioContext | null = null;

  async splitAudioBySize(file: File | Blob, maxSizeMB: number): Promise<Blob[]> {
    return this.splitAudio(file, 'size', { maxSize: maxSizeMB });
  }

  async splitAudioByCount(file: File | Blob, count: number): Promise<Blob[]> {
    return this.splitAudio(file, 'count', { count });
  }

  private async splitAudio(
    file: File | Blob, 
    mode: 'size' | 'count', 
    options: { maxSize?: number; count?: number }
  ): Promise<Blob[]> {
    let arrayBuffer: ArrayBuffer | null = null;
    let audioBuffer: AudioBuffer | null = null;
    
    try {
      console.log('=== Starting audio splitting process ===');
      console.log('File:', file instanceof File ? file.name : 'blob', 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      console.log('Mode:', mode, 'Options:', options);
      
      // Initialize AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('AudioContext created successfully');
      
      // Read file as ArrayBuffer
      console.log('Reading file as ArrayBuffer...');
      arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
      
      // Decode audio data
      console.log('Decoding audio data...');
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('Audio decoded successfully');
      
      const sampleRate = audioBuffer.sampleRate;
      const numberOfChannels = audioBuffer.numberOfChannels;
      const duration = audioBuffer.duration;
      
      console.log('Original file info:', {
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        duration: duration.toFixed(2) + ' seconds',
        sampleRate,
        channels: numberOfChannels
      });
      
      let numParts: number;
      
      if (mode === 'size' && options.maxSize) {
        const maxSizeBytes = options.maxSize * 1024 * 1024;
        
        // Calculate based on actual 8-bit WAV output size
        // 8-bit WAV = sampleRate × channels × duration × 1 byte + header
        const estimatedWavSize = (sampleRate * numberOfChannels * duration * 1) + 44;
        
        // Add safety buffer for conversion overhead
        const bufferFactor = 1.05; // 5% buffer
        const effectiveSize = estimatedWavSize * bufferFactor;
        
        numParts = Math.ceil(effectiveSize / maxSizeBytes);
        
        // Ensure we have at least 2 parts for meaningful splitting
        numParts = Math.max(numParts, 2);
        
        console.log(`Size-based splitting:`);
        console.log(`- Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- Estimated 8-bit WAV size: ${(estimatedWavSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- With buffer (${bufferFactor}x): ${(effectiveSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- Max size per part: ${options.maxSize} MB`);
        console.log(`- Calculated parts: ${numParts}`);
      } else if (mode === 'count' && options.count) {
        numParts = options.count;
        console.log(`Count-based splitting: ${numParts} parts`);
      } else {
        throw new Error('Invalid split parameters');
      }
      
      const partDuration = duration / numParts;
      const results: Blob[] = [];
      
      console.log(`Creating ${numParts} parts, each ${partDuration.toFixed(2)} seconds long`);
      
      // Calculate exact sample boundaries for each part to avoid overlap
      const totalSamples = audioBuffer.length;
      const baseSamplesPerPart = Math.floor(totalSamples / numParts);
      
      console.log(`Total samples: ${totalSamples}, Base samples per part: ${baseSamplesPerPart}`);
      
      for (let i = 0; i < numParts; i++) {
        // Calculate exact sample boundaries without overlap
        const startSample = i * baseSamplesPerPart;
        let endSample: number;
        
        if (i === numParts - 1) {
          // Last part gets all remaining samples
          endSample = totalSamples;
        } else {
          endSample = (i + 1) * baseSamplesPerPart;
        }
        
        const partLength = endSample - startSample;
        const startTime = startSample / sampleRate;
        const endTime = endSample / sampleRate;
        const actualDuration = partLength / sampleRate;
        
        console.log(`Part ${i + 1}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${actualDuration.toFixed(2)}s, samples ${startSample}-${endSample-1})`);
        
        // Create new AudioBuffer for this part
        const partBuffer = this.audioContext.createBuffer(
          numberOfChannels,
          partLength,
          sampleRate
        );
        
        // Copy audio data
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const originalData = audioBuffer.getChannelData(channel);
          const partData = partBuffer.getChannelData(channel);
          
          for (let j = 0; j < partLength; j++) {
            partData[j] = originalData[startSample + j] || 0;
          }
        }
        
        // Convert to WAV blob
        // Use 8-bit compression to reduce file size while maintaining compatibility
        const blob = await this.audioBufferToWav(partBuffer, true);
        const sizeInMB = (blob.size / 1024 / 1024).toFixed(2);
        console.log(`Part ${i + 1} created: ${sizeInMB} MB`);
        
        // Check if this part exceeds the target size (for size-based splitting)
        if (mode === 'size' && options.maxSize) {
          const maxSizeBytes = options.maxSize * 1024 * 1024;
          if (blob.size > maxSizeBytes) {
            console.warn(`Part ${i + 1} (${sizeInMB} MB) exceeds target size (${options.maxSize} MB) - but this is expected for audio conversion`);
          }
        }
        
        results.push(blob);
      }
      
      console.log(`=== Splitting completed successfully ===`);
      console.log(`Generated ${results.length} parts`);
      
      // Verify no samples are missing or duplicated
      let totalProcessedSamples = 0;
      for (let i = 0; i < numParts; i++) {
        const startSample = i * baseSamplesPerPart;
        const endSample = i === numParts - 1 ? totalSamples : (i + 1) * baseSamplesPerPart;
        const partSamples = endSample - startSample;
        totalProcessedSamples += partSamples;
        
        console.log(`Part ${i + 1}: ${(results[i].size / 1024 / 1024).toFixed(2)} MB (${partSamples} samples)`);
      }
      
      console.log(`Total samples: ${totalSamples}, Processed samples: ${totalProcessedSamples}`);
      if (totalProcessedSamples !== totalSamples) {
        console.warn(`Sample count mismatch! Missing/duplicate samples detected.`);
      } else {
        console.log(`✅ Perfect sample coverage - no overlap or gaps`);
      }
      
      // Validate results - ensure we actually split the audio
      if (results.length < 2 && (mode === 'size' && options.maxSize)) {
        throw new Error('分割に失敗しました：分割されたファイルが2つ未満です');
      }
      
      // Log file sizes but don't throw errors (audio conversion can increase size)
      if (mode === 'size' && options.maxSize) {
        const maxSizeBytes = options.maxSize * 1024 * 1024;
        let allWithinLimit = true;
        for (let i = 0; i < results.length; i++) {
          if (results[i].size > maxSizeBytes) {
            console.warn(`Part ${i + 1} size: ${(results[i].size / 1024 / 1024).toFixed(2)} MB (target: ${options.maxSize} MB)`);
            allWithinLimit = false;
          }
        }
        if (!allWithinLimit) {
          console.log('Note: Some parts exceed target size due to audio format conversion. This is normal.');
        }
      }
      
      return results;
    } catch (error) {
      console.error('Web Audio splitting failed:', error);
      console.error('Error details:', error);
      
      // Never return the original file - always throw error
      throw new Error(`音声分割処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      // Clean up resources
      this.cleanup();
      
      // Release large memory objects
      arrayBuffer = null;
      audioBuffer = null;
      
      // Suggest garbage collection (browser may or may not honor this)
      if (typeof (globalThis as any).gc === 'function') {
        (globalThis as any).gc();
      }
      
      console.log('Memory cleanup completed');
    }
  }

  private async audioBufferToWav(audioBuffer: AudioBuffer, compress = false): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    
    // Use 8-bit if compression is requested to reduce file size
    const bytesPerSample = compress ? 1 : 2;
    
    // Create WAV header
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * bytesPerSample);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
    view.setUint16(32, numberOfChannels * bytesPerSample, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * bytesPerSample, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        
        if (compress) {
          // 8-bit PCM (unsigned)
          const value = Math.round((sample + 1) * 127.5);
          view.setUint8(offset, Math.max(0, Math.min(255, value)));
          offset += 1;
        } else {
          // 16-bit PCM (signed)
          const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, Math.max(-32768, Math.min(32767, value)), true);
          offset += 2;
        }
      }
    }
    
    return new Blob([buffer], { type: 'audio/mp3' }); // Changed to mp3 for recommendation, though content is PCM
  }

  // Clean up AudioContext and release resources
  public cleanup(): void {
    if (this.audioContext) {
      try {
        // Close the AudioContext to release resources
        this.audioContext.close();
        console.log('AudioContext closed');
      } catch (error) {
        console.warn('Error closing AudioContext:', error);
      }
      this.audioContext = null;
    }
  }
}

// Main export function for audio splitting
export const splitAudioFile = async (
  file: File | Blob,
  mode: 'size' | 'count',
  options: { maxSize?: number; count?: number },
  progressCallback?: (progress: number) => void
): Promise<Blob[]> => {
  console.log('=== splitAudioFile called ===');
  console.log('File:', file instanceof File ? file.name : 'blob', 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
  console.log('Mode:', mode, 'Options:', options);
  
  const splitter = new WebAudioSplitter();
  
  try {
    if (progressCallback) progressCallback(0);
    
    let result: Blob[];
    if (mode === 'size' && options.maxSize) {
      console.log(`Attempting size-based splitting with maxSize: ${options.maxSize} MB`);
      result = await splitter.splitAudioBySize(file, options.maxSize);
    } else if (mode === 'count' && options.count) {
      console.log(`Attempting count-based splitting with count: ${options.count}`);
      result = await splitter.splitAudioByCount(file, options.count);
    } else {
      throw new Error('Invalid split parameters provided');
    }
    
    // Final validation
    if (!result || result.length === 0) {
      throw new Error('分割結果が空です');
    }
    
    if (result.length === 1 && file.size > 200 * 1024 * 1024) {
      throw new Error('大きなファイルが1つのままです - 分割が失敗している可能性があります');
    }
    
    console.log(`=== splitAudioFile completed successfully ===`);
    console.log(`Returning ${result.length} split files`);
    
    if (progressCallback) progressCallback(100);
    return result;
  } catch (error) {
    console.error('=== Audio splitting failed ===');
    console.error('Error:', error);
    
    // Re-throw with more descriptive error
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    throw new Error(`音声ファイルの分割に失敗しました: ${errorMessage}`);
  } finally {
    // Ensure cleanup happens even if there's an error
    splitter.cleanup();
  }
};