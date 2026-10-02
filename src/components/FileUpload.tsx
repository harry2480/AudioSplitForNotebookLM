import React, { useCallback, useState } from 'react';
import { Upload, FileAudio, Music, Video, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  // 指定すると複数選択モードになり、有効なファイルをまとめて受け取る
  // skipped: 非対応・小さすぎるため除外したファイル名（親で利用者に通知する）
  onFilesSelect?: (files: File[], skipped: string[]) => void;
  disabled?: boolean;
}

const isMediaFile = (file: File) =>
  file.type.startsWith('audio/') ||
  file.type.startsWith('video/') ||
  /\.(mp3|wav|m4a|aac|flac|ogg|opus|webm|mp4|m4v|mov|avi|mkv|3gp|flv|wmv)$/i.test(file.name);

const validateAudioFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size - must be at least 10KB (likely not a valid audio file if smaller)
  const minSize = 10 * 1024; // 10KB
  if (file.size < minSize) {
    return { valid: false, error: 'ファイルサイズが小さすぎます。別のファイルを選択してください。' };
  }

  return { valid: true };
};

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onFilesSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // 複数モード: 無効なファイルは除外して残りを渡す。単一モード: 先頭の1件のみ。
  // checkMedia=false: ファイル選択ダイアログは accept で絞り込み済みなので形式判定しない（従来どおり）
  const handleFiles = useCallback((files: File[], checkMedia: boolean) => {
    setValidationError(null);
    const mediaFiles = checkMedia ? files.filter(isMediaFile) : files;
    if (mediaFiles.length === 0) {
      setValidationError('音声・動画ファイルを選択してください。');
      return;
    }

    if (onFilesSelect) {
      const validFiles = mediaFiles.filter(file => validateAudioFile(file).valid);
      if (validFiles.length === 0) {
        setValidationError('有効な音声・動画ファイルがありません。');
        return;
      }
      const skipped = files.filter(file => !validFiles.includes(file)).map(file => file.name);
      onFilesSelect(validFiles, skipped);
      return;
    }

    const validation = validateAudioFile(mediaFiles[0]);
    if (!validation.valid) {
      setValidationError(validation.error || 'ファイルが無効です。');
      return;
    }
    onFileSelect(mediaFiles[0]);
  }, [onFileSelect, onFilesSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(Array.from(e.dataTransfer.files), true);
  }, [handleFiles, disabled]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // 同じファイルを選び直しても onChange が発火するようにリセット
    e.target.value = '';
    if (files.length > 0) handleFiles(files, !!onFilesSelect);
  }, [handleFiles, onFilesSelect]);

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 cursor-pointer",
        isDragging 
          ? "border-slate-400 bg-gradient-to-br from-slate-100 to-blue-100 scale-[1.02]" 
          : "border-gray-300 hover:border-slate-300 bg-gradient-to-br from-white to-gray-50 hover:from-slate-50 hover:to-blue-50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.webm,.mp4,.m4v,.mov,.avi,.mkv,.3gp,.flv,.wmv"
        onChange={handleFileInput}
        multiple={!!onFilesSelect}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-400 to-blue-400 rounded-full blur-xl opacity-40 animate-pulse"></div>
          <div className="relative p-6 bg-gradient-to-br from-slate-500 to-blue-600 rounded-full shadow-lg">
            <Upload className="w-10 h-10 text-white" />
          </div>
        </div>
      </div>
      
      <h3 className="text-2xl font-bold text-gray-800 mb-2">
        音声・動画ファイルをドロップ
      </h3>
      {onFilesSelect && (
        <p className="text-sm text-gray-500 mb-2">複数ファイルをまとめて選択できます</p>
      )}
      <p className="text-lg text-gray-600 mb-8">
        または <span className="font-semibold bg-gradient-to-r from-slate-600 to-blue-600 bg-clip-text text-transparent">クリックして選択</span>
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

      {validationError && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{validationError}</p>
        </div>
      )}
    </div>
  );
};