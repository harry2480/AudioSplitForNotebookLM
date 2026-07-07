import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Circle, AlertCircle, MonitorSpeaker, HardDriveDownload } from "lucide-react";

type Props = {
  onRecorded: (file: File | File[]) => void;
  onRecordingStateChange?: (active: boolean) => void;
  onSegmentsStateChange?: (hasSegments: boolean) => void;
};

type Source = "system" | "mic";

// showSaveFilePicker はブラウザに実装済みだが TS の DOM 型に未収載のため最小限で宣言。
type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
};
declare global {
  interface Window {
    showSaveFilePicker?: (
      options?: SaveFilePickerOptions
    ) => Promise<FileSystemFileHandle>;
    webkitAudioContext?: typeof AudioContext;
  }
}

// 無音判定のしきい値（正規化振幅のピーク）と、無音警告を出すまでの猶予（ms）。
const SILENCE_THRESHOLD = 0.01;
const SILENCE_GRACE_MS = 2500;

// timesliceで刻む間隔（ms）。ディスク/メモリへ小分けに吐き出すために使う。
const TIMESLICE_MS = 10000;

const supportsFileSystemAccess = (): boolean =>
  typeof window !== "undefined" && "showSaveFilePicker" in window;

// ブラウザが対応する録音フォーマットを選ぶ（Safari等はwebm非対応なのでmp4等へフォールバック）。
const pickAudioMime = (): { mimeType: string; ext: string } => {
  const candidates = [
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/mp4", ext: "mp4" },
    { mimeType: "audio/ogg", ext: "ogg" },
  ];
  if (typeof MediaRecorder !== "undefined") {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    }
  }
  return { mimeType: "", ext: "webm" }; // 空文字ならブラウザ既定に委ねる
};

export const RecordingPanel: React.FC<Props> = ({
  onRecorded,
  onRecordingStateChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("system");
  const [savingToDisk, setSavingToDisk] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [silent, setSilent] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const isFinalizingRef = useRef(false);

  // 波形可視化（Web Audio API）
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastSoundRef = useRef<number>(0);

  // File System Access API: ディスクへ逐次書き込みするためのハンドル。
  const writableRef = useRef<FileSystemWritableFileStream | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  // 書き込みは同時実行不可のため、Promiseチェーンで直列化する。
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  // ディスク書き込みが1度でも失敗したら破損とみなすフラグ。
  const writeErrorRef = useRef(false);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  // 録音対象ストリームから解析ノードを作り、波形描画に使う。
  const setupVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      // await後の生成でsuspendedになり波形が平坦化する場合があるため明示的に再開する。
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {
          /* noop */
        });
      }
      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      // destinationには繋がない（スピーカーへのエコー/ハウリングを避ける）
      sourceNode.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      lastSoundRef.current = performance.now();
    } catch (err) {
      console.warn("Visualizer setup failed:", err);
    }
  };

  const cleanupVisualizer = () => {
    analyserRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => {
        /* noop */
      });
    }
  };

  const setFinalizing = (value: boolean) => {
    isFinalizingRef.current = value;
    setIsFinalizing(value);
  };

  const startRecording = async () => {
    if (
      isFinalizingRef.current ||
      (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive")
    ) {
      return;
    }
    setError(null);

    // 1. 音源のストリームを取得
    let recordStream: MediaStream;
    try {
      if (source === "system") {
        // getDisplayMediaは仕様上videoが必須。映像は録らず音声トラックだけを録音対象にする。
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        streamRef.current = display; // 停止時に全track（映像含む）を止めるため保持
        const audioTracks = display.getAudioTracks();
        if (audioTracks.length === 0) {
          cleanupStream();
          setError(
            "音声が共有されていません。共有ダイアログで「タブの音声」または「システムの音声を共有」にチェックを入れてください。"
          );
          return;
        }
        // ユーザーがブラウザの「共有を停止」を押したら録音も止める
        audioTracks[0].addEventListener("ended", () => stopRecording());
        recordStream = new MediaStream(audioTracks);
      } else {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = mic;
        // マイク切断・OS側での無効化で録音が止まったら追随する（system経路と一貫）
        mic.getAudioTracks()[0]?.addEventListener("ended", () => stopRecording());
        recordStream = mic;
      }
    } catch (err) {
      console.error(err);
      if (source === "system") {
        setError("画面共有がキャンセルされたか、許可されませんでした。");
      } else {
        setError("マイクへのアクセスが拒否されました。");
      }
      return;
    }

    // 2. 波形可視化をセットアップ（録音できているかを目視確認するため）
    setSilent(false);
    setupVisualizer(recordStream);

    // 3. 保存先を確保（File System Access API 対応時はディスクへ逐次保存）
    const { mimeType, ext } = pickAudioMime();
    const outMime = mimeType || "audio/webm";
    const suggestedName = `recording_${Date.now()}.${ext}`;
    chunksRef.current = [];
    writableRef.current = null;
    fileHandleRef.current = null;
    writeQueueRef.current = Promise.resolve();
    writeErrorRef.current = false;
    let usingDisk = false;

    const savePicker = window.showSaveFilePicker;
    if (savePicker) {
      try {
        const handle = await savePicker({
          suggestedName,
          types: [
            {
              description: "Audio",
              accept: { [outMime]: [`.${ext}`] },
            },
          ],
        });
        fileHandleRef.current = handle;
        writableRef.current = await handle.createWritable();
        usingDisk = true;
      } catch (err) {
        // ユーザーが保存ダイアログをキャンセルした場合は録音を中止
        if (err instanceof DOMException && err.name === "AbortError") {
          cleanupVisualizer();
          cleanupStream();
          return;
        }
        // それ以外の失敗はメモリ方式にフォールバック
        console.warn("showSaveFilePicker failed, falling back to memory:", err);
      }
    }
    setSavingToDisk(usingDisk);

    // 4. 録音開始
    try {
      const recorder = new MediaRecorder(
        recordStream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        const writable = writableRef.current;
        if (writable) {
          // 直列化して逐次ディスクへ書き込む（メモリに溜めない）
          writeQueueRef.current = writeQueueRef.current
            .then(() => writable.write(e.data))
            .catch((writeErr) => {
              console.error("Disk write failed:", writeErr);
              writeErrorRef.current = true; // 破損とみなし停止時に保存を抑止
            });
        } else {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // onstop入口で（await前に同期的に）この録音のハンドルを退避。
        // これにより、close中に次の録音が始まってrefが上書きされても影響を受けない。
        // writeQueueRef はチャンク毎に再代入されるので、ここで読むと末尾（全書き込み）を掴める。
        const writable = writableRef.current;
        const handle = fileHandleRef.current;
        const chunks = chunksRef.current;
        const queue = writeQueueRef.current;
        try {
          if (writable && handle) {
            await queue; // 未書き込みを流し切る
            await writable.close();
            if (writeErrorRef.current) {
              setError("録音のディスク保存中にエラーが発生しました。ファイルが不完全な可能性があります。");
              return;
            }
            onRecorded(await handle.getFile());
          } else {
            const blob = new Blob(chunks, { type: outMime });
            onRecorded(new File([blob], suggestedName, { type: outMime }));
          }
        } catch (err) {
          console.error(err);
          setError("録音の保存に失敗しました。");
        } finally {
          cleanupStream();
          mediaRecorderRef.current = null;
          writableRef.current = null;
          fileHandleRef.current = null;
          writeQueueRef.current = Promise.resolve();
          writeErrorRef.current = false;
          setFinalizing(false);
        }
      };

      recorder.onerror = () => {
        setError("録音中にエラーが発生しました。");
        stopRecording();
      };

      recorder.start(TIMESLICE_MS);
      setIsRecording(true);
      onRecordingStateChange?.(true);

      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      setError("録音を開始できませんでした。");
      // 確保済みのwritableを片付ける
      if (writableRef.current) {
        try {
          await writableRef.current.close();
        } catch {
          /* noop */
        }
        writableRef.current = null;
      }
      setSavingToDisk(false);
      setFinalizing(false);
      cleanupVisualizer();
      cleanupStream();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setFinalizing(true);
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setSavingToDisk(false);
    setSilent(false);
    onRecordingStateChange?.(false);
    cleanupVisualizer();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // アンマウント時に録音中でも確実に後始末する（ストリーム/レコーダー/writable/可視化）。
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // recorder.stop() の onstop が writable.close と cleanupStream を担うが、
      // 発火保証のため stream 停止は同期でも呼んでおく。
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();
      cleanupVisualizer();
    };
  }, []);

  // 録音中は波形を描画し、あわせて無音（音声未検出）を判定する。
  useEffect(() => {
    if (!isRecording) return;
    let raf = 0;
    // バッファは1度だけ確保して毎フレーム使い回す（GC圧を避ける）。
    const data = new Uint8Array(analyserRef.current?.fftSize ?? 2048);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bufferLength = data.length;
      analyser.getByteTimeDomainData(data);

      // 高DPI対応でにじみを防ぐ
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#7c3aed"; // violet-600
      ctx.beginPath();

      let peak = 0;
      const sliceWidth = cssWidth / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 128.0 - 1.0; // -1.0 .. 1.0
        peak = Math.max(peak, Math.abs(v));
        const y = ((v + 1) / 2) * cssHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      // 無音判定（一定時間ピークがしきい値未満なら警告）
      const now = performance.now();
      if (peak >= SILENCE_THRESHOLD) {
        lastSoundRef.current = now;
        setSilent((prev) => (prev ? false : prev));
      } else if (now - lastSoundRef.current > SILENCE_GRACE_MS) {
        setSilent((prev) => (prev ? prev : true));
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isRecording]);

  return (
    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
      <div className="flex flex-col items-center gap-4">
        {isRecording ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-2 text-red-600 animate-pulse">
              <Circle className="w-3 h-3 fill-current" />
              <span className="font-bold text-lg">録音中: {formatDuration(duration)}</span>
            </div>
            {savingToDisk && (
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <HardDriveDownload className="w-4 h-4" />
                <span>ディスクへ自動保存中（長時間録音OK）</span>
              </div>
            )}

            {/* ライブ波形（音が録れているかの目視確認） */}
            <div className="w-full max-w-md">
              <canvas
                ref={canvasRef}
                className={`w-full h-24 rounded-lg border bg-white ${
                  silent ? "border-amber-300" : "border-gray-200"
                }`}
              />
              {silent ? (
                <div className="flex items-center justify-center gap-1.5 text-amber-600 text-xs mt-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {source === "system"
                      ? "音声が検出されていません。共有ダイアログで「音声を共有」がONか確認してください。"
                      : "音声が検出されていません。マイクの入力を確認してください。"}
                  </span>
                </div>
              ) : (
                <p className="text-center text-gray-400 text-xs mt-2">
                  波形が動いていれば音を録音できています
                </p>
              )}
            </div>

            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-bold shadow-lg"
            >
              <Square className="w-5 h-5 fill-current" />
              録音を停止
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 w-full">
            {/* 音源セレクタ */}
            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-full mb-1">
              <button
                onClick={() => setSource("system")}
                disabled={isFinalizing}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  source === "system"
                    ? "bg-white text-violet-700 shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <MonitorSpeaker className="w-4 h-4" />
                PC音声
              </button>
              <button
                onClick={() => setSource("mic")}
                disabled={isFinalizing}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  source === "mic"
                    ? "bg-white text-violet-700 shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Mic className="w-4 h-4" />
                マイク
              </button>
            </div>

            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 mb-1">
              {source === "system" ? (
                <MonitorSpeaker className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </div>
            <p className="text-gray-600 text-center mb-2 text-sm">
              {source === "system"
                ? "再生中の動画や会議アプリなど、PCから出る音を直接録音します"
                : "ミーティングの音声を直接録音して分割できます"}
            </p>
            <button
              onClick={startRecording}
              disabled={isFinalizing}
              className="flex items-center gap-2 px-8 py-3 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors font-bold shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Circle className="w-5 h-5 fill-red-500" />
              {isFinalizing ? "保存中..." : "録音を開始"}
            </button>

            {isFinalizing && (
              <p className="text-xs text-gray-500 text-center mt-1 max-w-sm">
                録音ファイルを保存しています。完了するまでお待ちください。
              </p>
            )}

            {source === "system" && (
              <p className="text-xs text-gray-400 text-center mt-1 max-w-sm">
                共有ダイアログで「タブの音声」または「システムの音声を共有」に必ずチェックを入れてください。
              </p>
            )}
            {!supportsFileSystemAccess() && (
              <p className="text-xs text-amber-600 text-center mt-1 max-w-sm">
                このブラウザは録音のディスク自動保存に未対応です。長時間録音はメモリ制約で失敗する場合があります（Chrome / Edge を推奨）。
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mt-2 text-center">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
