// Tab metadata extraction utility for tab sharing recording
export interface TabMetadata {
  title: string;
  url: string;
  domain: string;
  timestamp: string;
  captureSource: 'tab' | 'window' | 'screen';
}

/**
 * Extracts metadata from a tab sharing media stream
 */
export const extractTabMetadata = async (stream: MediaStream): Promise<TabMetadata | null> => {
  try {
    // Get the display surface from the video track if available
    const videoTrack = stream.getVideoTracks()[0];
    let captureSource: 'tab' | 'window' | 'screen' = 'tab';
    
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      const displaySurface = (settings as any).displaySurface; // eslint-disable-line @typescript-eslint/no-explicit-any
      
      if (displaySurface === 'window') {
        captureSource = 'window';
      } else if (displaySurface === 'monitor') {
        captureSource = 'screen';
      }
    }
    
    // For tab capture, we can try to get some basic information
    // Note: Due to browser security, we cannot directly access tab URL/title from getDisplayMedia
    // But we can provide a structured way to capture this information
    
    const metadata: TabMetadata = {
      title: '', // Will be populated by user or browser APIs if available
      url: '', // Will be populated by user or browser APIs if available  
      domain: '',
      timestamp: new Date().toISOString(),
      captureSource
    };
    
    // Try to get tab information if possible (limited by browser security)
    // In most cases, this information isn't directly available from the stream
    // But we prepare the structure for when it becomes available or for manual input
    
    return metadata;
  } catch (error) {
    console.error('Failed to extract tab metadata:', error);
    return null;
  }
};

/**
 * Creates a formatted background information string from tab metadata
 */
export const formatTabMetadataForBackground = (metadata: TabMetadata): string => {
  const parts: string[] = [];
  
  parts.push(`録音ソース: ${getSourceDisplayName(metadata.captureSource)}`);
  
  if (metadata.title) {
    parts.push(`タブタイトル: ${metadata.title}`);
  }
  
  if (metadata.url) {
    parts.push(`URL: ${metadata.url}`);
  }
  
  if (metadata.domain) {
    parts.push(`ドメイン: ${metadata.domain}`);
  }
  
  parts.push(`録音開始時刻: ${new Date(metadata.timestamp).toLocaleString('ja-JP')}`);
  
  return parts.join('\n');
};

/**
 * Gets display name for capture source
 */
const getSourceDisplayName = (source: 'tab' | 'window' | 'screen'): string => {
  switch (source) {
    case 'tab':
      return 'ブラウザタブ';
    case 'window':
      return 'ウィンドウ';
    case 'screen':
      return '画面全体';
    default:
      return '不明';
  }
};

/**
 * Prompts user to manually input tab information when automatic detection isn't available
 */
export const promptForTabInfo = async (): Promise<Partial<TabMetadata>> => {
  return new Promise((resolve) => {
    const title = prompt('録音対象のタブタイトルを入力してください（任意）:');
    const url = prompt('録音対象のURLを入力してください（任意）:');
    
    let domain = '';
    if (url) {
      try {
        domain = new URL(url).hostname;
      } catch {
        // Invalid URL, ignore
      }
    }
    
    resolve({
      title: title || '',
      url: url || '',
      domain
    });
  });
};