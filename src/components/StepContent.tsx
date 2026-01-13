import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface StepContentProps {
  title: string;
  description: string;
  children: ReactNode;
  nextButtonText?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  showNext?: boolean;
  isLoading?: boolean;
}

export function StepContent({ 
  title, 
  description, 
  children, 
  nextButtonText = "次へ",
  onNext,
  nextDisabled = false,
  showNext = true,
  isLoading = false
}: StepContentProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600">{description}</p>
      </div>
      
      <div className="space-y-6">
        {children}
        
        {showNext && onNext && (
          <div className="flex justify-end">
            <button
              onClick={onNext}
              disabled={nextDisabled || isLoading}
              className="px-8 py-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
              {nextButtonText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}