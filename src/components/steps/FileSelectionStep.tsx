import { FileUpload } from '../FileUpload';
import { StepContent } from '../StepContent';
import { extractAudioFromVideo } from '../../utils/videoToAudio';
import { useState } from 'react';

interface FileSelectionStepProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onNext: () => void;
  onSkipSplit?: () => void;
  isProcessing: boolean;
}

export function FileSelectionStep({ selectedFile, onFileSelect, onNext, onSkipSplit, isProcessing }: FileSelectionStepProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [skipSplit, setSkipSplit] = useState(false);

  const isVideoFile = (file: File): boolean => {
    const videoMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp', '.flv', '.wmv'];
    
    return videoMimeTypes.includes(file.type.toLowerCase()) ||
           videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const handleFileSelect = async (file: File) => {
    if (isVideoFile(file)) {
      setIsExtracting(true);
      setExtractionProgress(0);
      
      try {
        const audioFile = await extractAudioFromVideo(file, (progress) => {
          setExtractionProgress(progress);
        });
        onFileSelect(audioFile);
      } catch (error) {
        console.error('Audio extraction failed:', error);
        alert(`動画からの音声抽出に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      } finally {
        setIsExtracting(false);
        setExtractionProgress(0);
      }
    } else {
      onFileSelect(file);
    }
  };

  return (
    <StepContent
      title="📁 ファイル選択"
      description="音声・動画ファイルをアップロードしてください"
      nextButtonText="分割設定へ"
      onNext={onNext}
      nextDisabled={!selectedFile || isExtracting || skipSplit}
      showNext={!!selectedFile && !isExtracting && !skipSplit}
      isLoading={isProcessing || isExtracting}
    >
      <FileUpload 
        onFileSelect={handleFileSelect}
        disabled={isProcessing || isExtracting}
      />
      
      {isExtracting && (
        <div className="mt-6 p-6 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl border border-yellow-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">動画から音声を抽出しています...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${extractionProgress}%` }}
              ></div>
            </div>
            <p className="text-sm font-medium text-gray-700">{extractionProgress}%</p>
          </div>
        </div>
      )}
      
      {selectedFile && (
        <>
          <div className="p-6 bg-gradient-to-r from-blue-100 to-violet-100 rounded-2xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">選択されたファイル</p>
                <p className="font-bold text-gray-900">{selectedFile.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">ファイルサイズ</p>
                <p className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
          
          {/* 分割スキップオプション */}
          <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skipSplit}
                onChange={(e) => setSkipSplit(e.target.checked)}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">分割をスキップして文字起こしへ進む</span>
                <p className="text-sm text-gray-600 mt-1">
                  ファイルサイズが200MB以下の場合、分割せずに直接文字起こしできます
                </p>
              </div>
            </label>
            
            {skipSplit && selectedFile.size > 200 * 1024 * 1024 && (
              <div className="mt-3 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
                <p className="text-sm text-yellow-800">
                  ⚠️ ファイルサイズが200MBを超えています。NotebookLMで使用する場合は分割が必要です。
                </p>
              </div>
            )}
          </div>
          
          {/* 次へボタンのカスタマイズ */}
          {skipSplit && onSkipSplit && (
            <button
              onClick={onSkipSplit}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-blue-700 transition-all duration-200"
            >
              文字起こしへ進む（分割をスキップ）
            </button>
          )}
        </>
      )}
    </StepContent>
  );
}