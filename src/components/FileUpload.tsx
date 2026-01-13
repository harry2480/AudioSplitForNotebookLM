import React, { useCallback, useState } from 'react';
import { Upload, FileAudio, Music, Video } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const mediaFile = files.find(file => 
      file.type.startsWith('audio/') || 
      file.type.startsWith('video/') ||
      file.name.match(/\.(mp3|wav|m4a|ogg|webm|mp4|mov|avi|mkv)$/i)
    );

    if (mediaFile) {
      onFileSelect(mediaFile);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 cursor-pointer",
        isDragging 
          ? "border-violet-400 bg-gradient-to-br from-violet-100 to-blue-100 scale-[1.02]" 
          : "border-gray-300 hover:border-violet-300 bg-gradient-to-br from-white to-gray-50 hover:from-violet-50 hover:to-blue-50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.ogg,.webm,.mp4,.mov,.avi,.mkv"
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-blue-400 rounded-full blur-xl opacity-40 animate-pulse"></div>
          <div className="relative p-6 bg-gradient-to-br from-violet-500 to-blue-600 rounded-full shadow-lg">
            <Upload className="w-10 h-10 text-white" />
          </div>
        </div>
      </div>
      
      <h3 className="text-2xl font-bold text-gray-800 mb-2">
        音声・動画ファイルをドロップ
      </h3>
      <p className="text-lg text-gray-600 mb-8">
        または <span className="font-semibold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">クリックして選択</span>
      </p>
      
      <div className="flex items-center justify-center space-x-6">
        <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-full">
          <FileAudio className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">MP3・WAV・M4A</span>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-full">
          <Music className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">OGG・WebM</span>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-full">
          <Video className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">MP4・MOV・AVI</span>
        </div>
      </div>
    </div>
  );
};