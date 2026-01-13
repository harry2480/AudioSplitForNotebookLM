import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Clock, RefreshCw, X } from 'lucide-react';

interface RecoveryDialogProps {
  open: boolean;
  onRecover: () => void;
  onDiscard: () => void;
  recoveryInfo: {
    lastSaved?: Date;
    currentStep?: string;
    progress?: string;
  };
}

export function RecoveryDialog({
  open,
  onRecover,
  onDiscard,
  recoveryInfo
}: RecoveryDialogProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}時間${minutes % 60}分前`;
    }
    return `${minutes}分前`;
  };
  
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl max-w-md w-full p-6 z-50">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold mb-2">
                未完了の処理が見つかりました
              </Dialog.Title>
              
              <Dialog.Description className="text-gray-600 mb-4">
                前回の処理が中断されているようです。続きから再開しますか？
              </Dialog.Description>
              
              {recoveryInfo.lastSaved && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">
                      最終保存: {formatTime(recoveryInfo.lastSaved)}
                    </span>
                  </div>
                  
                  {recoveryInfo.currentStep && (
                    <div className="text-sm text-gray-600">
                      ステップ: {
                        recoveryInfo.currentStep === 'split' ? '音声分割' :
                        recoveryInfo.currentStep === 'transcription' ? '文字起こし' :
                        recoveryInfo.currentStep === 'summary' ? 'サマリー生成' :
                        recoveryInfo.currentStep === 'visual' ? 'ビジュアル解析' :
                        recoveryInfo.currentStep
                      }
                    </div>
                  )}
                  
                  {recoveryInfo.progress && (
                    <div className="text-sm text-gray-600">
                      進捗: {recoveryInfo.progress}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={onRecover}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  続きから再開
                </button>
                
                <button
                  onClick={onDiscard}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  新規で開始
                </button>
              </div>
            </div>
            
            <Dialog.Close asChild>
              <button
                onClick={onDiscard}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}