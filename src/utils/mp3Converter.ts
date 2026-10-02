import { FFFSType } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './ffmpegLoader';

// NotebookLM など外部サービスは webm / ogg を受け付けないことがあるため、
// 出力ファイルは常に MP3 に統一する。
const MP3_BITRATE = '128k';

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/, '');

export const isMp3 = (file: File | Blob): boolean => {
  const name = file instanceof File ? file.name.toLowerCase() : '';
  return name.endsWith('.mp3') || file.type === 'audio/mpeg' || file.type === 'audio/mp3';
};

/**
 * 任意の音声/動画ファイルを MP3 に変換する。
 * 大きなファイルを FileReader で一括メモリ読み込みすると
 * "File could not be read! Code=-1"（ArrayBuffer上限/メモリ不足）で失敗するため、
 * WORKERFS でマウントして遅延参照する（非対応環境ではメモリ読み込みへフォールバック）。
 */
export const convertToMp3 = async (
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<File> => {
  const ffmpeg = await getFFmpeg();

  const sourceName = file instanceof File ? file.name : 'input';
  const inputExt = sourceName.includes('.') ? sourceName.substring(sourceName.lastIndexOf('.')) : '';
  const inputName = `convert_input${inputExt}`;
  const outputName = 'converted_output.mp3';
  const mountDir = '/mnt_convert';
  let mounted = false;
  let wroteFallback = false;

  const handleProgress = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(100, Math.max(0, Math.round(progress * 100))));
  };
  ffmpeg.on('progress', handleProgress);

  try {
    // File を包み直しても中身はコピーされない（参照のまま）ためメモリを消費しない。
    const inputFile = new File([file], inputName, { type: file.type });

    let inputPath = inputName;
    try {
      await ffmpeg.createDir(mountDir).catch(() => {}); // 既存でも無視
      await ffmpeg.mount(FFFSType.WORKERFS, { files: [inputFile] }, mountDir);
      inputPath = `${mountDir}/${inputName}`;
      mounted = true;
    } catch (mountErr) {
      console.warn('WORKERFS mount unavailable, falling back to in-memory read:', mountErr);
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      wroteFallback = true;
      inputPath = inputName;
    }

    await ffmpeg.exec([
      '-i', inputPath,
      '-vn', // 動画トラックは捨てる
      '-acodec', 'libmp3lame',
      '-ab', MP3_BITRATE,
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const bytes = new Uint8Array(data as ArrayBuffer);
    if (bytes.byteLength === 0) {
      throw new Error('変換結果が空でした');
    }

    onProgress?.(100);
    return new File([bytes], `${stripExtension(sourceName)}.mp3`, { type: 'audio/mpeg' });
  } finally {
    ffmpeg.off('progress', handleProgress);
    // 成功・失敗どちらでも仮想FSを後始末（次回実行時の EEXIST を防ぐ）
    if (mounted) {
      await ffmpeg.unmount(mountDir).catch(() => {});
      await ffmpeg.deleteDir(mountDir).catch(() => {});
    }
    if (wroteFallback) {
      await ffmpeg.deleteFile(inputName).catch(() => {});
    }
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
};
