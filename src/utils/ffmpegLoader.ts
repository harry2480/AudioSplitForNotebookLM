import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// FFmpeg.wasm を CDN から読み込む際のタイムアウト（ms）。
// unpkg がストール（応答も失敗も返さない）した場合の無限ローディングを防ぐ。
const LOAD_TIMEOUT_MS = 60000;

const BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

// promise が指定時間内に settle しなければ reject するラッパー。
export const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `${label}がタイムアウトしました（${ms / 1000}秒）。通信環境を確認して再度お試しください。`
            )
          ),
        ms
      )
    ),
  ]);

// wasm コアは数十MBあるため、アプリ全体で1インスタンスだけを共有する。
// （録音後のMP3変換と分割処理が別々に読み込むと二重にメモリを消費する）
let instance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

export const getFFmpeg = async (): Promise<FFmpeg> => {
  if (instance) return instance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();

    // Capture logs for debugging production issues
    ffmpeg.on('log', ({ message }) => {
      if (message.includes('Error') || message.includes('failed')) {
        console.error('FFmpeg Log:', message);
      }
    });

    try {
      // CDN(unpkg)がストールしても永久ハングしないようタイムアウトを設ける。
      const [coreURL, wasmURL] = await withTimeout(
        Promise.all([
          toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
          toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
        ]),
        LOAD_TIMEOUT_MS,
        'FFmpegコアの読み込み'
      );
      await withTimeout(ffmpeg.load({ coreURL, wasmURL }), LOAD_TIMEOUT_MS, 'FFmpegの初期化');
    } catch (loadError) {
      console.error('Failed to load FFmpeg from unpkg:', loadError);
      loadingPromise = null; // 失敗したら次回に再試行できるようにする
      throw loadError;
    }

    instance = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
};
