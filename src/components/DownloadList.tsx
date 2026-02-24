import React from 'react';
import { Download, FileAudio, Package } from 'lucide-react';
import { cn } from '../lib/utils';
import { downloadAllAsZip } from '../utils/download';

export interface SplitFile {
  name: string;
  size: number;
  blob: Blob;
  duration?: string;
  originalFileName?: string;
}

interface DownloadListProps {
  files: SplitFile[];
  onDownload: (file: SplitFile) => void;
  onDownloadAll?: () => void;
  originalFileName?: string;
  className?: string;
}

export const DownloadList: React.FC<DownloadListProps> = ({ 
  files, 
  onDownload, 
  onDownloadAll,
  originalFileName,
  className 
}) => {
  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const handleZipDownload = async () => {
    try {
      // Get originalFileName from files array or from prop
      const zipFileName = originalFileName || (files[0]?.originalFileName) || 'audio_split';
      
      console.log('handleZipDownload triggered', { 
        filesCount: files.length, 
        zipFileName
      });
      
      if (onDownloadAll) {
        console.log('Using provided onDownloadAll callback');
        onDownloadAll();
      } else {
        console.log('Using direct downloadAllAsZip, fileName:', zipFileName);
        await downloadAllAsZip(files, zipFileName);
      }
    } catch (error) {
      console.error('ZIP download error:', error);
      alert('ZIP保存に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">分割結果</h3>
        <button
          onClick={handleZipDownload}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Package className="w-4 h-4" />
          <span>ZIP一括ダウンロード</span>
        </button>
      </div>

      <div className="space-y-2">
        {files.map((file, index) => (
          <div 
            key={index}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <FileAudio className="w-6 h-6 text-gray-500" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {formatSize(file.size)}
                  {file.duration && ` • ${file.duration}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                console.log('Individual download clicked from DownloadList:', file.name);
                onDownload(file);
              }}
              className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>ダウンロード</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};