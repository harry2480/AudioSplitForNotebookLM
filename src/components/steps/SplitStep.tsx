import { useState, useEffect, useRef } from "react";
import { Download, Loader2, AlertCircle, CheckCircle, Scissors } from "lucide-react";
import type { SplitFile } from "../DownloadList";
import { ProgressBar } from "../ProgressBar";

interface SplitStepProps {
  splitFiles: SplitFile[];
  onDownloadSplit?: (file: SplitFile) => void;
  onDownloadAllSplits?: () => void;
  onSplitCompleted?: (files: SplitFile[]) => void;
  splitAudio?: (file: File | Blob, mode: "size" | "count", options: { maxSize? : number; count?: number }) => Promise<Blob[]>;
  selectedFile?: File;
  progress?: number;
  onProcessingStateChange?: (isProcessing: boolean, progress?: { isSplitting?: boolean }) => void;
}

export function SplitStep({ 
  splitFiles, 
  onDownloadSplit,
  onDownloadAllSplits,
  onSplitCompleted,
  splitAudio,
  selectedFile,
  progress = 0,
  onProcessingStateChange,
}: SplitStepProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localSplitFiles, setLocalSplitFiles] = useState<SplitFile[]>(splitFiles || []);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => { setLocalSplitFiles(splitFiles); if (splitFiles.length > 0) setHasCompleted(true); }, [splitFiles]);

  const handleDownloadAllInternal = async () => {
    if (!onDownloadAllSplits || isZipping) return;
    setIsZipping(true);
    try {
      await onDownloadAllSplits();
    } finally {
      setIsZipping(false);
    }
  };

  const handleStartSplit = async () => {
    if (!selectedFile || !splitAudio || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setError(null);
    setHasCompleted(false);
    onProcessingStateChange?.(true, { isSplitting: true });

    try {
      const isVideo = /\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv)$/i.test(selectedFile.name);
      setStatus(isVideo
        ? "動画から音声を抽出中...（時間がかかる場合があります）"
        : "分割の準備中...");
      const maxSizeMB = 195;
      const blobs = await splitAudio(selectedFile, "size", { maxSize: maxSizeMB });

      const originalNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      const blobType = blobs[0]?.type ?? '';
      const outputExt = blobType === 'audio/wav' ? 'wav' : blobType === 'audio/webm' ? 'webm' : 'mp3';
      const splitParts = blobs.map((blob, partIndex) => ({
        name: `${partIndex + 1}_${originalNameWithoutExt}.${outputExt}`,
        size: blob.size,
        blob,
        originalFileName: selectedFile.name
      }));
      
      setLocalSplitFiles(splitParts);
      onSplitCompleted?.(splitParts);
      setHasCompleted(true);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : '不明なエラーが発生しました';
      setError(`分割処理中にエラーが発生しました: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
      onProcessingStateChange?.(false, { isSplitting: false });
    }
  };

  return (
    <div className="space-y-6">
      {!hasCompleted && !isProcessing && (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
          <p className="text-gray-600 mb-6 text-center">
            ファイルを NotebookLM 用に最適化（200MB以下に分割）しますか？
          </p>
          <button
            onClick={handleStartSplit}
            className="px-10 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 text-lg"
          >
            <Scissors className="w-5 h-5" />
            分割を実行する
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="bg-blue-50 rounded-2xl p-8 border border-blue-200 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-xl font-bold text-blue-800">音声ファイルを分割中...</span>
          </div>
          <ProgressBar progress={progress} message={status} className="mt-2" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {hasCompleted && localSplitFiles.length > 0 && (
        <div className="bg-green-50 rounded-2xl p-8 border border-green-200">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <h3 className="text-xl font-bold text-green-800">分割が完了しました</h3>
          </div>
          
          <div className="bg-white/80 rounded-xl p-6 border border-green-300 mb-8 text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">{localSplitFiles.length}</div>
            <div className="text-sm text-green-700">分割後のファイル数</div>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" />
                ファイルの保存
              </h4>
              <div className="flex flex-wrap gap-3">
                {onDownloadSplit && localSplitFiles.map(file => (
                  <button
                    key={file.name}
                    onClick={() => {
                      console.log('Individual download clicked:', file.name);
                      onDownloadSplit(file);
                    }}
                    className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all text-sm font-medium"
                  >
                     {file.name}
                  </button>
                ))}
                {onDownloadAllSplits && localSplitFiles.length > 1 && (
                  <button
                    onClick={handleDownloadAllInternal}
                    disabled={isZipping}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-all text-sm font-bold shadow-md flex items-center gap-2"
                  >
                     {isZipping ? (
                       <>
                         <Loader2 className="w-4 h-4 animate-spin" />
                         ZIP生成中...
                       </>
                     ) : (
                       "すべて一括保存 (ZIP)"
                     )}
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-xl">
              <p className="text-sm text-emerald-800 text-center">
                <strong> 次のステップ:</strong> 保存したファイルを <strong>NotebookLM</strong> にドラッグ＆ドロップして読み込ませてください。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

