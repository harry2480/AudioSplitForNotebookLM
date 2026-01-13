/**
 * Recovery Manager - 処理の中断時のリカバリー機能を提供
 */

export interface RecoveryState {
  // 基本情報
  timestamp: number;
  currentStep: string;
  version: string;
  
  // ファイル情報
  selectedFile?: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  };
  
  // 分割処理の状態
  splitState?: {
    isProcessing: boolean;
    progress: number;
    completedFiles: Array<{
      name: string;
      size: number;
      duration: number;
    }>;
    remainingFileData?: string; // Base64 encoded remaining data
  };
  
  // 文字起こし処理の状態
  transcriptionState?: {
    isProcessing: boolean;
    currentFileIndex: number;
    totalFiles: number;
    completedTranscriptions: Array<{
      fileName: string;
      text: string;
      timestamp: number;
    }>;
    settings: {
      model: string;
      language: string;
      backgroundInfo?: string;
      customPrompt?: string;
    };
  };
  
  // サマリー生成の状態
  summaryState?: {
    isProcessing: boolean;
    transcriptionResults?: any[];
    backgroundInfo?: string;
    generatedSummary?: string;
  };
  
  // ビジュアルキャプチャの状態
  visualCaptureState?: {
    captures: Array<{
      timestamp: number;
      imageUrl: string;
      tabInfo?: any;
    }>;
    analysisProgress?: number;
    analyzedCaptures?: any[];
    visualSummary?: string;
  };
}

const RECOVERY_KEY = 'audioSplitRecovery';
const RECOVERY_VERSION = '1.0.0';
const RECOVERY_EXPIRY_HOURS = 24; // 24時間後に自動削除

export class RecoveryManager {
  private static instance: RecoveryManager;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private currentState: RecoveryState | null = null;
  
  private constructor() {
    this.cleanupExpiredRecovery();
  }
  
  static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager();
    }
    return RecoveryManager.instance;
  }
  
  /**
   * リカバリー状態を保存
   */
  saveState(state: Partial<RecoveryState>): void {
    try {
      this.currentState = {
        ...this.currentState,
        ...state,
        timestamp: Date.now(),
        version: RECOVERY_VERSION
      } as RecoveryState;
      
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(this.currentState));
    } catch (error) {
      console.error('Failed to save recovery state:', error);
      // ストレージ容量不足の場合は古いデータを削除
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearOldData();
        try {
          localStorage.setItem(RECOVERY_KEY, JSON.stringify(this.currentState));
        } catch (retryError) {
          console.error('Failed to save recovery state after cleanup:', retryError);
        }
      }
    }
  }
  
  /**
   * リカバリー状態を読み込み
   */
  loadState(): RecoveryState | null {
    try {
      const savedState = localStorage.getItem(RECOVERY_KEY);
      if (!savedState) return null;
      
      const state = JSON.parse(savedState) as RecoveryState;
      
      // バージョンチェック
      if (state.version !== RECOVERY_VERSION) {
        console.warn('Recovery state version mismatch, clearing old data');
        this.clearState();
        return null;
      }
      
      // 有効期限チェック
      const expiryTime = state.timestamp + (RECOVERY_EXPIRY_HOURS * 60 * 60 * 1000);
      if (Date.now() > expiryTime) {
        console.info('Recovery state expired, clearing');
        this.clearState();
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to load recovery state:', error);
      return null;
    }
  }
  
  /**
   * リカバリー状態をクリア
   */
  clearState(): void {
    try {
      localStorage.removeItem(RECOVERY_KEY);
      this.currentState = null;
      this.stopAutoSave();
    } catch (error) {
      console.error('Failed to clear recovery state:', error);
    }
  }
  
  /**
   * 自動保存を開始
   */
  startAutoSave(intervalMs: number = 5000): void {
    this.stopAutoSave();
    this.autoSaveInterval = setInterval(() => {
      if (this.currentState) {
        this.saveState({});
      }
    }, intervalMs);
  }
  
  /**
   * 自動保存を停止
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
  
  /**
   * 特定のステップの状態を更新
   */
  updateStepState(step: string, data: any): void {
    const updateData: Partial<RecoveryState> = {
      currentStep: step
    };
    
    switch (step) {
      case 'split':
        updateData.splitState = {
          ...this.currentState?.splitState,
          ...data
        };
        break;
      case 'transcription':
        updateData.transcriptionState = {
          ...this.currentState?.transcriptionState,
          ...data
        };
        break;
      case 'summary':
        updateData.summaryState = {
          ...this.currentState?.summaryState,
          ...data
        };
        break;
      case 'visual':
        updateData.visualCaptureState = {
          ...this.currentState?.visualCaptureState,
          ...data
        };
        break;
    }
    
    this.saveState(updateData);
  }
  
  /**
   * リカバリー可能かチェック
   */
  hasRecoverableState(): boolean {
    const state = this.loadState();
    if (!state) return false;
    
    // 処理中のタスクがあるかチェック
    return !!(
      state.splitState?.isProcessing ||
      state.transcriptionState?.isProcessing ||
      state.summaryState?.isProcessing ||
      (state.transcriptionState?.completedTranscriptions && 
       state.transcriptionState.completedTranscriptions.length > 0) ||
      (state.splitState?.completedFiles && 
       state.splitState.completedFiles.length > 0)
    );
  }
  
  /**
   * リカバリー情報を取得
   */
  getRecoveryInfo(): {
    canRecover: boolean;
    lastSaved?: Date;
    currentStep?: string;
    progress?: string;
  } {
    const state = this.loadState();
    if (!state) {
      return { canRecover: false };
    }
    
    let progress = '';
    if (state.transcriptionState?.completedTranscriptions) {
      const completed = state.transcriptionState.completedTranscriptions.length;
      const total = state.transcriptionState.totalFiles;
      progress = `文字起こし: ${completed}/${total} ファイル完了`;
    } else if (state.splitState?.completedFiles) {
      progress = `分割済み: ${state.splitState.completedFiles.length} ファイル`;
    }
    
    return {
      canRecover: this.hasRecoverableState(),
      lastSaved: new Date(state.timestamp),
      currentStep: state.currentStep,
      progress
    };
  }
  
  /**
   * 期限切れのリカバリーデータを削除
   */
  private cleanupExpiredRecovery(): void {
    try {
      const state = this.loadState();
      if (state) {
        const expiryTime = state.timestamp + (RECOVERY_EXPIRY_HOURS * 60 * 60 * 1000);
        if (Date.now() > expiryTime) {
          this.clearState();
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired recovery:', error);
    }
  }
  
  /**
   * 古いデータを削除（ストレージ容量不足時）
   */
  private clearOldData(): void {
    try {
      // リカバリーデータ以外の古いデータも削除
      const keysToCheck = ['transcriptionResults', 'splitFiles', 'visualCaptures'];
      keysToCheck.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            // 1日以上古いデータは削除
            if (parsed.timestamp && Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
              localStorage.removeItem(key);
            }
          } catch {
            // パース失敗した古いデータは削除
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Failed to clear old data:', error);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const recoveryManager = RecoveryManager.getInstance();
