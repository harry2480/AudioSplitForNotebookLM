import { DownloadList, type SplitFile } from '../DownloadList';
import { ProgressBar } from '../ProgressBar';
import { StepContent } from '../StepContent';

interface SplitResultsStepProps {
  splitFiles: SplitFile[];
  onDownload: (file: SplitFile) => void;
  onDownloadAll: () => void;
  onNext?: () => void;
  showNext?: boolean;
  nextButtonText?: string;
  isProcessing: boolean;
  progress?: number;
}

export function SplitResultsStep({ 
  splitFiles, 
  onDownload, 
  onDownloadAll, 
  onNext,
  showNext = true,
  nextButtonText = "文字起こしへ",
  isProcessing,
  progress
}: SplitResultsStepProps) {
  if (isProcessing) {
    return (
      <StepContent
        title="⚡ 分割実行中"
        description="音声ファイルを分割しています..."
        showNext={false}
      >
        <ProgressBar 
          progress={progress || 0}
          message="音声ファイルを分割しています..."
        />
      </StepContent>
    );
  }

  if (splitFiles.length === 0) {
    return (
      <StepContent
        title="⚡ 分割準備完了"
        description="設定が完了しました。分割を開始してください。"
        showNext={false}
      >
        <div className="text-center py-8 text-gray-500">
          前のステップで分割を開始してください
        </div>
      </StepContent>
    );
  }

  return (
    <StepContent
      title="✅ 分割完了"
      description={`音声ファイルが${splitFiles.length}個のパートに分割されました`}
      nextButtonText={nextButtonText}
      onNext={onNext}
      showNext={showNext}
    >
      <DownloadList
        files={splitFiles}
        onDownload={onDownload}
        onDownloadAll={onDownloadAll}
      />
      
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800">
          💡 ここで停止してダウンロードのみ使用することも可能です。
          文字起こしやまとめ機能を使いたい場合は「{nextButtonText}」をクリックしてください。
        </p>
      </div>
    </StepContent>
  );
}