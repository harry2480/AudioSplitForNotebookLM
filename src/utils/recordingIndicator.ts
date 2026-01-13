// Recording status indicator utilities for favicon and title
export class RecordingIndicator {
  private static originalTitle: string = document.title;
  private static originalFavicon: string = '';
  private static isRecordingState: boolean = false;
  
  static {
    // Get original favicon
    const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (faviconLink) {
      this.originalFavicon = faviconLink.href;
    }
  }
  
  // Create a canvas-based favicon with recording dot
  private static createRecordingFavicon(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return this.originalFavicon;
    
    // Create base icon (microphone emoji as background)
    ctx.fillStyle = '#4F46E5'; // Indigo background
    ctx.fillRect(0, 0, 32, 32);
    
    // Add microphone icon
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎙️', 16, 22);
    
    // Add red recording dot
    ctx.fillStyle = '#DC2626'; // Red
    ctx.beginPath();
    ctx.arc(24, 8, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add white dot for pulse effect
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(24, 8, 3, 0, 2 * Math.PI);
    ctx.fill();
    
    return canvas.toDataURL();
  }
  
  // Update favicon
  private static updateFavicon(isRecording: boolean): void {
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    
    if (isRecording) {
      faviconLink.href = this.createRecordingFavicon();
    } else {
      // Restore original favicon or use default
      faviconLink.href = this.originalFavicon || '/icon.png';
    }
  }
  
  // Update page title
  private static updateTitle(isRecording: boolean): void {
    if (isRecording) {
      document.title = '🔴 録音中 - 爆速議事録';
    } else {
      document.title = this.originalTitle || '爆速議事録';
    }
  }
  
  // Set recording state
  static setRecording(isRecording: boolean): void {
    if (this.isRecordingState === isRecording) return; // Avoid unnecessary updates
    
    this.isRecordingState = isRecording;
    this.updateFavicon(isRecording);
    this.updateTitle(isRecording);
    
    console.log(`Recording indicator: ${isRecording ? 'ON' : 'OFF'}`);
  }
  
  // Get current state
  static isRecording(): boolean {
    return this.isRecordingState;
  }
  
  // Reset to original state
  static reset(): void {
    this.setRecording(false);
  }
}