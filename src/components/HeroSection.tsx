import React from "react";
import { Home } from "lucide-react";

type Props = {
  currentPage: "transcribe" | "split";
  onPageChange: (page: "transcribe" | "split") => void;
  isRecording?: boolean;
};

export const HeroSection: React.FC<Props> = ({ 
  currentPage: _currentPage, 
  onPageChange: _onPageChange,
  isRecording = false
}) => {
  return (
    <>
      {/* Compact Header - always visible */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo - Left Edge */}
            <div className="flex items-center">
              <img
                src={import.meta.env.BASE_URL + "icon.png"}
                alt="NotebookLM用音声分割ツール アイコン"
                className="w-8 h-8 drop-shadow-sm mr-3"
                loading="eager"
                decoding="async"
              />
              <span className="text-lg font-bold text-gray-900">NotebookLM用音声分割ツール</span>
            </div>

            {/* Navigation Buttons - Right Edge */}
            <div className="flex items-center gap-2">
              {isRecording && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="hidden sm:inline">録音中</span>
                </div>
              )}
              <button
                onClick={() => !isRecording && _onPageChange("transcribe")}
                disabled={isRecording}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm ${
                  isRecording 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : _currentPage === "transcribe"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">ホーム</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Hero Section */}
      {_currentPage === "transcribe" && (
        <div className="bg-gradient-to-r from-slate-600 to-slate-600 py-12 pt-28">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center text-white">
              <div className="flex items-center justify-center mb-6">
                <img
                  src={import.meta.env.BASE_URL + "icon.png"}
                  alt="アイコン"
                  className="w-16 h-16 md:w-20 h-20 drop-shadow-lg"
                  loading="eager"
                  decoding="async"
                />
              </div>
              <h1 className="text-3xl md:text-5xl font-bold mb-6">
                NotebookLM用音声分割ツール
              </h1>
              <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
                200MBを超える音声ファイルを最適なサイズに自動分割。<br />
                アップロードや録音から、すぐに NotebookLM へ。
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="text-3xl mb-3"></div>
                  <h3 className="text-lg font-semibold mb-2">自動分割で200MB制限をクリア</h3>
                  <p className="text-sm text-white/80">大きな音声ファイルを200MB以下に自動的に分割。NotebookLMへの投入がスムーズになります。</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="text-3xl mb-3"></div>
                  <h3 className="text-lg font-semibold mb-2">完全ローカル処理で安全</h3>
                  <p className="text-sm text-white/80">音声データはサーバーに送信されません。すべてあなたのブラウザ内で処理されるため安心です。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

