import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from '../components/FileUpload';
import { SplitOptions, type SplitMode } from '../components/SplitOptions';
import { DownloadList, type SplitFile } from '../components/DownloadList';
import { ProgressBar } from '../components/ProgressBar';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { downloadFile, downloadAllAsZip } from '../utils/download';
import { Scissors, Download, FileAudio, Loader2, CheckCircle } from 'lucide-react';

export function SplitPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('size');
  const [maxSize, setMaxSize] = useState(190);
  const [splitCount, setSplitCount] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  
  const { splitAudio, progress } = useFFmpeg();

  // Clean up function to release memory
  const cleanupSplitFiles = useCallback(() => {
    splitFiles.forEach(file => {
      if (file.blob && (file as any).url) {
        URL.revokeObjectURL((file as any).url);
      }
    });
    console.log('Cleaned up previous split files');
  }, [splitFiles]);

  const handleFileSelect = useCallback((file: File) => {
    cleanupSplitFiles();
    setSelectedFile(file);
    setSplitFiles([]);
  }, [cleanupSplitFiles]);

  const handleSplit = useCallback(async () => {
    if (!selectedFile) return;

    cleanupSplitFiles();
    setIsProcessing(true);
    setSplitFiles([]);

    try {
      const options = splitMode === 'size' 
        ? { maxSize } 
        : { count: splitCount };
      
      const blobs = await splitAudio(selectedFile, splitMode, options);
      
      const files: SplitFile[] = blobs.map((blob, index) => {
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
        const extension = 'wav'; // FFmpeg outputs WAV
        return {
          name: `${baseName}_part${index + 1}.${extension}`,
          size: blob.size,
          blob
        };
      });
      
      setSplitFiles(files);
    } catch (error) {
      console.error('Error splitting audio:', error);
      alert('音声ファイルの分割中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, splitMode, maxSize, splitCount, splitAudio, cleanupSplitFiles]);

  const handleDownload = useCallback((file: SplitFile) => {
    downloadFile(file);
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (selectedFile && splitFiles.length > 0) {
      downloadAllAsZip(splitFiles, selectedFile.name);
    }
  }, [splitFiles, selectedFile]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupSplitFiles();
    };
  }, [cleanupSplitFiles]);

  // Warn before page unload if there's unsaved data
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasUnsavedData = 
        isProcessing || // 処理中
        splitFiles.length > 0 || // 分割ファイルあり
        selectedFile !== null; // 選択済みファイルあり

      if (hasUnsavedData) {
        const message = isProcessing 
          ? '音声ファイルを処理中です。ページを離れると処理が中断されます。'
          : '分割したファイルが失われます。本当にページを離れますか？';
        
        event.preventDefault();
        // Modern browsers show a generic message regardless of returnValue
        event.returnValue = '';
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isProcessing, splitFiles.length, selectedFile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
      <div className="container mx-auto px-6 py-8 pt-20">
        <div className="max-w-4xl mx-auto">

          {/* Unsaved Data Indicator */}
          {(isProcessing || splitFiles.length > 0 || selectedFile !== null) && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-3"></div>
              <p className="text-sm text-amber-800">
                {isProcessing 
                  ? '処理中 - ブラウザを閉じると処理が中断されます'
                  : '分割されたファイルがあります - ブラウザを閉じる前にダウンロードしてください'
                }
              </p>
            </div>
          )}
          
          {/* Step 1: File Upload */}
          <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                <FileAudio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">音声ファイルを選択</h2>
                <p className="text-sm text-gray-600 mt-1">分割したい音声ファイルをアップロード</p>
              </div>
            </div>
            
            <FileUpload 
              onFileSelect={handleFileSelect}
            />
            
            {selectedFile && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    選択済み: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Split Options */}
          {selectedFile && !isProcessing && splitFiles.length === 0 && (
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                  <Scissors className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">分割設定</h2>
                  <p className="text-sm text-gray-600 mt-1">分割方法とパラメーターを設定</p>
                </div>
              </div>
              
              <SplitOptions
                mode={splitMode}
                onModeChange={setSplitMode}
                maxSize={maxSize}
                onMaxSizeChange={setMaxSize}
                splitCount={splitCount}
                onSplitCountChange={setSplitCount}
              />
              
              <button
                onClick={handleSplit}
                className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Scissors className="w-5 h-5" />
                分割を開始
              </button>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">分割処理中...</h2>
                  <p className="text-sm text-gray-600 mt-1">音声ファイルを分割しています</p>
                </div>
              </div>
              <ProgressBar progress={progress} />
            </div>
          )}

          {/* Step 3: Results */}
          {splitFiles.length > 0 && !isProcessing && (
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">分割完了</h2>
                  <p className="text-sm text-gray-600 mt-1">{splitFiles.length}個のファイルに分割されました</p>
                </div>
              </div>
              
              <DownloadList 
                files={splitFiles}
                onDownload={handleDownload}
                onDownloadAll={handleDownloadAll}
              />
              
              {splitFiles.length > 1 && (
                <button
                  onClick={handleDownloadAll}
                  className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                  <Download className="w-5 h-5" />
                  すべてをZIPでダウンロード
                </button>
              )}
              
              <button
                onClick={() => {
                  setSplitFiles([]);
                  setSelectedFile(null);
                }}
                className="w-full mt-2 px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-xl hover:bg-gray-300 transition-all duration-200"
              >
                新しいファイルを分割
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}