import { useState, useEffect, useCallback } from 'react';
import { recoveryManager, type RecoveryState } from '../utils/recoveryManager';

export interface UseRecoveryOptions {
  autoSaveInterval?: number;
  onRecoveryDetected?: (state: RecoveryState) => void;
}

export interface UseRecoveryReturn {
  hasRecovery: boolean;
  recoveryInfo: {
    canRecover: boolean;
    lastSaved?: Date;
    currentStep?: string;
    progress?: string;
  };
  recoverState: () => RecoveryState | null;
  clearRecovery: () => void;
  saveProgress: (step: string, data: any) => void;
  startAutoSave: () => void;
  stopAutoSave: () => void;
}

export function useRecovery(options: UseRecoveryOptions = {}): UseRecoveryReturn {
  const { autoSaveInterval = 5000, onRecoveryDetected } = options;
  const [hasRecovery, setHasRecovery] = useState(false);
  const [recoveryInfo, setRecoveryInfo] = useState<UseRecoveryReturn['recoveryInfo']>({
    canRecover: false
  });
  const [recoveryDetectedCalled, setRecoveryDetectedCalled] = useState(false);
  
  // 初回マウント時にリカバリー状態をチェック
  useEffect(() => {
    const checkRecovery = () => {
      const canRecover = recoveryManager.hasRecoverableState();
      setHasRecovery(canRecover);
      setRecoveryInfo(recoveryManager.getRecoveryInfo());
      
      // onRecoveryDetected を次のティックで実行してrender loopを防ぐ
      if (canRecover && onRecoveryDetected && !recoveryDetectedCalled) {
        const state = recoveryManager.loadState();
        if (state) {
          setRecoveryDetectedCalled(true);
          setTimeout(() => {
            onRecoveryDetected(state);
          }, 100); // 少し遅延を増やす
        }
      }
    };
    
    checkRecovery();
    
    // ページ離脱時の警告
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = recoveryManager.loadState();
      if (state?.splitState?.isProcessing || 
          state?.transcriptionState?.isProcessing ||
          state?.summaryState?.isProcessing) {
        e.preventDefault();
        e.returnValue = '処理中のタスクがあります。ページを離れると進行状況が失われる可能性があります。';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onRecoveryDetected]);
  
  // リカバリー状態を復元
  const recoverState = useCallback((): RecoveryState | null => {
    const state = recoveryManager.loadState();
    if (state) {
      console.log('Recovering state from:', new Date(state.timestamp));
      return state;
    }
    return null;
  }, []);
  
  // リカバリー状態をクリア
  const clearRecovery = useCallback(() => {
    recoveryManager.clearState();
    setHasRecovery(false);
    setRecoveryInfo({ canRecover: false });
    setRecoveryDetectedCalled(false);
  }, []);
  
  // 進行状況を保存
  const saveProgress = useCallback((step: string, data: any) => {
    recoveryManager.updateStepState(step, data);
    // 状態を更新
    setRecoveryInfo(recoveryManager.getRecoveryInfo());
  }, []);
  
  // 自動保存を開始
  const startAutoSave = useCallback(() => {
    recoveryManager.startAutoSave(autoSaveInterval);
  }, [autoSaveInterval]);
  
  // 自動保存を停止
  const stopAutoSave = useCallback(() => {
    recoveryManager.stopAutoSave();
  }, []);
  
  return {
    hasRecovery,
    recoveryInfo,
    recoverState,
    clearRecovery,
    saveProgress,
    startAutoSave,
    stopAutoSave
  };
}