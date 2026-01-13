import { SplitOptions, type SplitMode } from '../SplitOptions';
import { StepContent } from '../StepContent';

interface SplitConfigStepProps {
  splitMode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  maxSize: number;
  onMaxSizeChange: (size: number) => void;
  splitCount: number;
  onSplitCountChange: (count: number) => void;
  onNext: () => void;
  isProcessing: boolean;
}

export function SplitConfigStep({ 
  splitMode,
  onModeChange,
  maxSize,
  onMaxSizeChange,
  splitCount,
  onSplitCountChange,
  onNext,
  isProcessing
}: SplitConfigStepProps) {
  return (
    <StepContent
      title="⚙️ 分割設定"
      description="音声ファイルをどのように分割するかを設定してください"
      nextButtonText="分割開始"
      onNext={onNext}
      isLoading={isProcessing}
    >
      <SplitOptions
        mode={splitMode}
        onModeChange={onModeChange}
        maxSize={maxSize}
        onMaxSizeChange={onMaxSizeChange}
        splitCount={splitCount}
        onSplitCountChange={onSplitCountChange}
        disabled={isProcessing}
      />
    </StepContent>
  );
}