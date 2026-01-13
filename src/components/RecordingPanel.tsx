import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Circle, AlertCircle } from "lucide-react";

type Props = {
  onRecorded: (file: File | File[]) => void;
  onRecordingStateChange?: (active: boolean) => void;
  onSegmentsStateChange?: (hasSegments: boolean) => void;
};

export const RecordingPanel: React.FC<Props> = ({
  onRecorded,
  onRecordingStateChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: "audio/webm" });
        onRecorded(file);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      onRecordingStateChange?.(true);
      
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      setError("マイクへのアクセスが拒否されました。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onRecordingStateChange?.(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
      <div className="flex flex-col items-center gap-4">
        {isRecording ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-2 text-red-600 animate-pulse">
              <Circle className="w-3 h-3 fill-current" />
              <span className="font-bold text-lg">録音中: {formatDuration(duration)}</span>
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
          <div className="flex flex-col items-center gap-3">
             <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 mb-2">
               <Mic className="w-8 h-8" />
             </div>
             <p className="text-gray-600 text-center mb-4 text-sm">
               ミーティングの音声を直接録音して分割できます
             </p>
             <button
               onClick={startRecording}
               className="flex items-center gap-2 px-8 py-3 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors font-bold shadow-lg"
             >
               <Circle className="w-5 h-5 fill-red-500" />
               録音を開始
             </button>
          </div>
        )}
        
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

