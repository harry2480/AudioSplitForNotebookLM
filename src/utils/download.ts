import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { SplitFile } from '../components/DownloadList';

export const downloadFile = (file: SplitFile) => {
  saveAs(file.blob, file.name);
};

export const downloadAllAsZip = async (files: SplitFile[], originalFileName: string) => {
  const zip = new JSZip();
  
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });
  
  const content = await zip.generateAsync({ type: 'blob' });
  const zipName = originalFileName.replace(/\.[^/.]+$/, '') + '_split.zip';
  saveAs(content, zipName);
};