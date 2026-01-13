import React from 'react';
import { Download, FileAudio, Package } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SplitFile {
  name: string;
  size: number;
  blob: Blob;
  duration?: string;
}

interface DownloadListProps {
  files: SplitFile[];
  onDownload: (file: SplitFile) => void;
  onDownloadAll: () => void;
  className?: string;
}

export const DownloadList: React.FC<DownloadListProps> = ({ 
  files, 
  onDownload, 
  onDownloadAll,
  className 
}) => {
  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">分割結果</h3>
        <button
          onClick={onDownloadAll}
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
              onClick={() => onDownload(file)}
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