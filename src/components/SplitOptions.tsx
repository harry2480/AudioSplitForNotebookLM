import React from 'react';
import { cn } from '../lib/utils';
import { HardDrive, Hash } from 'lucide-react';

export type SplitMode = 'size' | 'count';

interface SplitOptionsProps {
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  maxSize: number;
  onMaxSizeChange: (size: number) => void;
  splitCount: number;
  onSplitCountChange: (count: number) => void;
  disabled?: boolean;
}

export const SplitOptions: React.FC<SplitOptionsProps> = ({
  mode,
  onModeChange,
  maxSize,
  onMaxSizeChange,
  splitCount,
  onSplitCountChange,
  disabled
}) => {
  return (
    <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-2">
          分割方式を選択
        </h3>
        <p className="text-gray-600">ファイルサイズまたは分割数を指定してください</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className={cn(
            "relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02]",
            mode === 'size' 
              ? "border-violet-400 bg-gradient-to-br from-violet-100 to-blue-100 shadow-lg" 
              : "border-gray-200 hover:border-violet-200 bg-white hover:bg-gradient-to-br hover:from-violet-50 hover:to-blue-50"
          )}
          onClick={() => onModeChange('size')}
        >
          <div className="flex items-start space-x-4">
            <div className={cn(
              "p-3 rounded-xl",
              mode === 'size' ? "bg-gradient-to-br from-violet-500 to-blue-600" : "bg-gray-200"
            )}>
              <HardDrive className={cn(
                "w-6 h-6",
                mode === 'size' ? "text-white" : "text-gray-600"
              )} />
            </div>
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <input
                  type="radio"
                  name="splitMode"
                  value="size"
                  checked={mode === 'size'}
                  onChange={() => onModeChange('size')}
                  className="w-5 h-5 text-violet-600 mr-3"
                />
                <span className="font-bold text-gray-800 text-lg">最大サイズ指定</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                各ファイルの最大サイズを指定して分割します
              </p>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={maxSize}
                  onChange={(e) => onMaxSizeChange(Number(e.target.value))}
                  disabled={mode !== 'size'}
                  className={cn(
                    "w-20 px-3 py-2 rounded-xl font-bold text-center transition-all",
                    mode === 'size' 
                      ? "border-2 border-violet-300 bg-white text-violet-600 shadow-inner" 
                      : "border border-gray-300 bg-gray-100 text-gray-400"
                  )}
                />
                <span className={cn(
                  "font-bold text-lg",
                  mode === 'size' ? "text-violet-600" : "text-gray-400"
                )}>MB</span>
              </div>
            </div>
          </div>
        </div>

        <div 
          className={cn(
            "relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02]",
            mode === 'count' 
              ? "border-blue-400 bg-gradient-to-br from-blue-100 to-cyan-100 shadow-lg" 
              : "border-gray-200 hover:border-blue-200 bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50"
          )}
          onClick={() => onModeChange('count')}
        >
          <div className="flex items-start space-x-4">
            <div className={cn(
              "p-3 rounded-xl",
              mode === 'count' ? "bg-gradient-to-br from-blue-500 to-cyan-600" : "bg-gray-200"
            )}>
              <Hash className={cn(
                "w-6 h-6",
                mode === 'count' ? "text-white" : "text-gray-600"
              )} />
            </div>
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <input
                  type="radio"
                  name="splitMode"
                  value="count"
                  checked={mode === 'count'}
                  onChange={() => onModeChange('count')}
                  className="w-5 h-5 text-blue-600 mr-3"
                />
                <span className="font-bold text-gray-800 text-lg">分割数指定</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                指定した個数に均等分割します
              </p>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={splitCount}
                  onChange={(e) => onSplitCountChange(Number(e.target.value))}
                  disabled={mode !== 'count'}
                  className={cn(
                    "w-20 px-3 py-2 rounded-xl font-bold text-center transition-all",
                    mode === 'count' 
                      ? "border-2 border-blue-300 bg-white text-blue-600 shadow-inner" 
                      : "border border-gray-300 bg-gray-100 text-gray-400"
                  )}
                />
                <span className={cn(
                  "font-bold text-lg",
                  mode === 'count' ? "text-blue-600" : "text-gray-400"
                )}>個</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};