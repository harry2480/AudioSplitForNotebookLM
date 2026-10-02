import { useState, useEffect, useRef } from "react";
import { Download, Loader2, AlertCircle, CheckCircle, Scissors, Clock, XCircle } from "lucide-react";
import type { SplitFile } from "../DownloadList";
import { ProgressBar } from "../ProgressBar";

type FileStatus = {
  name: string;
  state: "pending" | "processing" | "done" | "error";
  parts?: number;
  error?: string;
};

interface SplitStepProps {
  splitFiles: SplitFile[];
  onDownloadSplit?: (file: SplitFile) => void;
  onDownloadAllSplits?: () => void;
  onSplitCompleted?: (files: SplitFile[]) => void;
  splitAudio?: (file: File | Blob, mode: "size" | "count", options: { maxSize? : number; count?: number }) => Promise<Blob[]>;
  selectedFile?: File;
  // 複数ファイルを順番に処理する場合に指定（selectedFile より優先）
  selectedFiles?: File[];
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
  selectedFiles,
  progress = 0,
  onProcessingStateChange,
}: SplitStepProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localSplitFiles, setLocalSplitFiles] = useState<SplitFile[]>(splitFiles || []);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const processingRef = useRef(false);

  const files = selectedFiles ?? (selectedFile ? [selectedFile] : []);
  const isBatch = files.length > 1;
  // FFmpeg の progress は -c copy 時などに範囲外の値を返すことがあるため丸める
  const fileProgress = Math.min(100, Math.max(0, progress));
  const overallProgress = files.length > 0
    ? Math.round(((currentIndex + fileProgress / 100) / files.length) * 100)
    : 0;

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

  const updateStatus = (index: number, patch: Partial<FileStatus>) => {
    setFileStatuses(prev => prev.map((st, i) => (i === index ? { ...st, ...patch } : st)));
  };

  const handleStartSplit = async () => {
    if (files.length === 0 || !splitAudio || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setError(null);
    setHasCompleted(false);
    setCurrentIndex(0);
    setFileStatuses(files.map(f => ({ name: f.name, state: "pending" })));
    onProcessingStateChange?.(true, { isSplitting: true });

    // FFmpeg.wasm は1インスタンスなので、ファイルは1件ずつ順番に処理する
    const allParts: SplitFile[] = [];
    const usedNames = new Set<string>();
    const failed: string[] = [];

    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        setCurrentIndex(fileIndex);
        updateStatus(fileIndex, { state: "processing" });

        const prefix = isBatch ? `(${fileIndex + 1}/${files.length}) ${file.name}: ` : "";
        // MP3/WAV 以外は分割前に MP3 へ変換されるため、その旨を表示する。
        const needsConversion = !/\.(mp3|wav)$/i.test(file.name);
        setStatus(prefix + (needsConversion
          ? "音声をMP3に変換中...（時間がかかる場合があります）"
          : "分割の準備中..."));

        try {
          const maxSizeMB = 195;
          const blobs = await splitAudio(file, "size", { maxSize: maxSizeMB });
          if (blobs.length === 0) throw new Error("出力ファイルが生成されませんでした");

          const originalNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          const outputExt = blobs[0]?.type === 'audio/wav' ? 'wav' : 'mp3';
          blobs.forEach((blob, partIndex) => {
            // 同名ファイルを複数選んだ場合に ZIP 内で上書きされないよう連番を付ける
            const baseName = `${partIndex + 1}_${originalNameWithoutExt}`;
            let name = `${baseName}.${outputExt}`;
            for (let n = 2; usedNames.has(name); n++) name = `${baseName} (${n}).${outputExt}`;
            usedNames.add(name);
            allParts.push({ name, size: blob.size, blob, originalFileName: file.name });
          });
          updateStatus(fileIndex, { state: "done", parts: blobs.length });
        } catch (e) {
          console.error(e);
          const errorMessage = e instanceof Error ? e.message : '不明なエラーが発生しました';
          failed.push(`${file.name}: ${errorMessage}`);
          updateStatus(fileIndex, { state: "error", error: errorMessage });
        }
      }

      if (failed.length > 0) {
        setError(`分割処理中にエラーが発生しました:\n${failed.join("\n")}`);
      }
      if (allParts.length > 0) {
        setLocalSplitFiles(allParts);
        onSplitCompleted?.(allParts);
        setHasCompleted(true);
      }
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
      onProcessingStateChange?.(false, { isSplitting: false });
    }
  };

  const renderStatusIcon = (state: FileStatus["state"]) => {
    switch (state) {
      case "processing": return <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />;
      case "done": return <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />;
      case "error": return <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />;
      default: return <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {!hasCompleted && !isProcessing && (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
          <p className="text-gray-600 mb-6 text-center">
            {isBatch
              ? `${files.length}件のファイルを NotebookLM 用に最適化（200MB以下に分割）しますか？`
              : "ファイルを NotebookLM 用に最適化（200MB以下に分割）しますか？"}
          </p>
          <button
            onClick={handleStartSplit}
            className="px-10 py-4 bg-gradient-to-r from-slate-600 to-slate-600 text-white font-bold rounded-xl hover:from-slate-700 hover:to-slate-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 text-lg"
          >
            <Scissors className="w-5 h-5" />
            {isBatch ? `${files.length}件まとめて分割する` : "分割を実行する"}
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="bg-blue-50 rounded-2xl p-8 border border-blue-200 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-xl font-bold text-blue-800">
              {isBatch ? `音声ファイルを分割中... (${currentIndex + 1}/${files.length})` : "音声ファイルを分割中..."}
            </span>
          </div>
          <ProgressBar progress={isBatch ? overallProgress : progress} message={status} className="mt-2" />
        </div>
      )}

      {isBatch && fileStatuses.length > 0 && (
        <ul className="space-y-2">
          {fileStatuses.map((st, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg text-sm">
              {renderStatusIcon(st.state)}
              <span className="flex-1 truncate text-gray-800">{st.name}</span>
              {st.state === "done" && <span className="text-green-700">{st.parts}ファイル</span>}
              {st.state === "error" && <span className="text-red-700">失敗</span>}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
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

