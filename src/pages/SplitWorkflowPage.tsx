import { useState, useCallback, useEffect, useTransition } from "react";
import { FileUpload } from "../components/FileUpload";
import { SplitStep } from "../components/steps/SplitStep";
import { type SplitFile } from "../components/DownloadList";
import { useFFmpeg } from "../hooks/useFFmpeg";
import { downloadFile, downloadAllAsZip } from "../utils/download";
import { 
  FileText
} from "lucide-react";
import { RecordingPanel } from "../components/RecordingPanel";
import { RecordingIndicator } from "../utils/recordingIndicator";

type Props = {
  onRecordingStateChange?: (isActive: boolean) => void;
  onStepStateChange?: (stepState: {
    hasFile: boolean;
    hasSplitFiles: boolean;
  }) => void;
};

export function SplitWorkflowPage({ onRecordingStateChange, onStepStateChange }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecordingActive, setIsRecordingActive] = useState<boolean>(false);

  const handleRecordingStateChange = (isActive: boolean) => {
    setIsRecordingActive(isActive);
    onRecordingStateChange?.(isActive);
    RecordingIndicator.setRecording(isActive);
  };
  
  const handleSegmentsStateChange = (_hasSegments: boolean) => {
    // 録音セグメントの状態変更を無視
  };
  
  const { splitAudio, progress } = useFFmpeg();

  useEffect(() => {
    onStepStateChange?.({
      hasFile: !!selectedFile,
      hasSplitFiles: splitFiles.length > 0
    });
  }, [selectedFile, splitFiles.length, onStepStateChange]);

  const cleanupSplitFiles = useCallback(() => {
    setSplitFiles(currentFiles => {
      currentFiles.forEach(file => {
        if (file.blob && (file as any).url) URL.revokeObjectURL((file as any).url);
      });
      return currentFiles;
    });
  }, []);

  useEffect(() => {
    return () => {
      RecordingIndicator.reset();
    };
  }, []);

  const handleFileSelect = useCallback(async (file: File | File[]) => {
    cleanupSplitFiles();
    setSplitFiles([]);
    setError(null);
    
    if (Array.isArray(file)) {
      const sFiles = file.map((segment, index) => ({
        name: segment.name || `segment_${index + 1}.webm`,
        size: segment.size,
        blob: new Blob([segment], { type: segment.type }),
        originalFileName: file[0]?.name || 'audio'
      }));
      setSelectedFile(file[0]);
      startTransition(() => { setSplitFiles(sFiles); });
      return;
    }
    setSelectedFile(file);
  }, [cleanupSplitFiles]);

  const handleDownload = useCallback((file: SplitFile) => { downloadFile(file); }, []);
  const handleDownloadAll = useCallback(async () => {
    // splitFilesがあれば実行できるように条件を緩和
    if (splitFiles && splitFiles.length > 0) {
      try {
        console.log('handleDownloadAll triggered with', splitFiles.length, 'files');
        // selectedFileがない場合は最初のファイルから取得を試みる
        const fileName = selectedFile?.name || splitFiles[0].originalFileName || 'audio_split';
        console.log('Using fileName for ZIP:', fileName);
        await downloadAllAsZip(splitFiles, fileName);
      } catch (error) {
        console.error('Error in handleDownloadAll:', error);
        setError('ZIP保存に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
      }
    } else {
      console.warn('handleDownloadAll: No splitFiles available', splitFiles);
      setError('保存するファイルがありません。まずは分割を実行してください。');
    }
  }, [splitFiles, selectedFile]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isRecordingActive || splitFiles.length > 0) {
        event.preventDefault(); return "データが失われます。";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRecordingActive, splitFiles.length]);

  const currentStep = !selectedFile ? 1 : (splitFiles.length === 0 ? 1 : 2);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8 pt-20">
        <div className="mb-8 flex justify-center">
            <div className="flex items-center space-x-3">
              <div className={`flex items-center ${currentStep >= 1 ? "text-slate-600" : "text-gray-400"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${currentStep >= 1 ? "bg-slate-600 text-white" : "bg-white"}`}>1</div>
                <span className="ml-2 font-medium hidden sm:inline">音声準備</span>
              </div>
              <div className={`w-12 h-0.5 ${currentStep >= 2 ? "bg-slate-600" : "bg-gray-300"}`}></div>
              <div className={`flex items-center ${currentStep >= 2 ? "text-slate-600" : "text-gray-400"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${currentStep >= 2 ? "bg-slate-600 text-white" : "bg-white"}`}>2</div>
                <span className="ml-2 font-medium hidden sm:inline">分割保存</span>
              </div>
            </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-xl">{error}</div>}

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold">1. 音声を準備</h2>
          </div>
          {!selectedFile ? (
            <>
              <RecordingPanel onRecorded={handleFileSelect} onRecordingStateChange={handleRecordingStateChange} onSegmentsStateChange={handleSegmentsStateChange} />
              <div className="mt-6 border-t pt-6">
                <FileUpload onFileSelect={handleFileSelect} disabled={isPending} />
                <p className="text-sm text-gray-500 mt-2 text-center"> 200MB以上のファイルは自動分割されます</p>
              </div>
            </>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex justify-between items-center">
              <span className="font-medium text-green-800">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</span>
              <button onClick={() => { setSelectedFile(null); setSplitFiles([]); }} className="text-green-700 underline hover:text-green-800 transition-colors">変更する</button>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">2. 分割保存</h2>
            <SplitStep
              splitFiles={splitFiles}
              selectedFile={selectedFile}
              splitAudio={splitAudio}
              progress={progress}
              onDownloadSplit={handleDownload} 
              onDownloadAllSplits={handleDownloadAll}
              onSplitCompleted={(files) => {
                console.log('Split completed, updating parent state:', files.length, 'files');
                setSplitFiles(files);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

