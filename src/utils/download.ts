import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { SplitFile } from '../components/DownloadList';

export const downloadFile = (file: SplitFile) => {
  try {
    console.log('Downloading file:', file.name, 'size:', file.size);
    saveAs(file.blob, file.name);
  } catch (error) {
    console.error('Download error:', error);
    alert('ファイルのダウンロードに失敗しました: ' + (error instanceof Error ? error.message : String(error)));
  }
};

export const downloadAllAsZip = async (files: SplitFile[], originalFileName: string) => {
  try {
    console.log('Starting ZIP creation:', { filesCount: files.length, originalFileName });
    
    if (files.length === 0) {
      throw new Error('ダウンロードするファイルがありません');
    }
    
    const zip = new JSZip();
    const folder = zip.folder('audio_split');
    
    if (!folder) {
      throw new Error('ZIPフォルダの作成に失敗しました');
    }
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Adding file ${i + 1}/${files.length}:`, file.name, `size: ${file.size} bytes`);
      
      if (!file.blob || !(file.blob instanceof Blob)) {
        console.warn(`File ${i} is not a valid Blob:`, file);
        continue;
      }
      
      try {
        folder.file(file.name, file.blob);
      } catch (addError) {
        console.error(`Failed to add file ${file.name}:`, addError);
        throw new Error(`ファイル追加失敗: ${file.name}`);
      }
    }
    
    console.log('Generating ZIP blob...');
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
    console.log('ZIP blob generated, size:', content.size, 'bytes');
    
    if (content.size === 0) {
      throw new Error('ZIP生成後のサイズが0です');
    }
    
    // Ensure originalFileName is a string and handle extraction
    const baseZipName = typeof originalFileName === 'string' && originalFileName 
      ? originalFileName.replace(/\.[^/.]+$/, '') 
      : 'audio_split';
    const zipName = `${baseZipName}_split.zip`;
    console.log('Downloading ZIP as:', zipName);
    
    // Use createObjectURL for better compatibility
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('ZIP download completed successfully');
  } catch (error) {
    console.error('ZIP download error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    alert('ZIP保存に失敗しました:\n' + errorMsg);
    throw error;
  }
};