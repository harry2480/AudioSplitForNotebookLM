import React from 'react';
import { RecordingPanel } from './RecordingPanel';
import { FileUpload } from './FileUpload';

type Props = {
  mode: 'record' | 'upload';
  onFileSelect: (file: File | File[]) => void;
  onRecordingStateChange: (active: boolean) => void;
  onSegmentsStateChange?: (hasSegments: boolean) => void;
  isProcessing: boolean;
  isPending: boolean;
};

export const QuickStartFlow: React.FC<Props> = ({ 
  mode,
  onFileSelect, 
  onRecordingStateChange, 
  onSegmentsStateChange,
  isProcessing, 
  isPending 
}) => {
  if (mode === 'record') {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
            <span className="text-white font-bold">🎤</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">録音設定</h2>
            <p className="text-sm text-gray-600 mt-1">マイクと会議タブを設定して録音開始</p>
          </div>
        </div>
        
        <RecordingPanel 
          onRecorded={onFileSelect} 
          onRecordingStateChange={onRecordingStateChange}
          onSegmentsStateChange={onSegmentsStateChange}
        />
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
          <span className="text-white font-bold text-sm">FILE</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">ファイルをアップロード</h2>
          <p className="text-sm text-gray-600 mt-1">音声・動画ファイルから文字起こし</p>
        </div>
      </div>
      
      <FileUpload
        onFileSelect={(file: File) => onFileSelect(file)}
        disabled={isProcessing || isPending}
      />
      
      {(isProcessing || isPending) && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                {isProcessing ? '音声ファイルを処理中...' : 'ファイルを準備中...'}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                大きなファイルの場合、数分かかることがあります
              </p>
            </div>
          </div>
        </div>
      )}
      
      {!isProcessing && !isPending && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            💡 200MB以上のファイルは自動的に分割されます
          </p>
        </div>
      )}
    </div>
  );
};