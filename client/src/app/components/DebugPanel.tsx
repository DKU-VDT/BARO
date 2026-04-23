import React from 'react';
import { usePosture } from '../context/PostureContext';

export const DebugPanel: React.FC = () => {
  const { warningsCount, triggerWarning } = usePosture();

  const triggerLock = () => {
    triggerWarning();
    triggerWarning();
    triggerWarning();
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 p-3 bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-lg flex items-center gap-3">
      <h3 className="text-sm font-semibold text-slate-800">경고</h3>
      <span className="text-sm font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-md">
        {warningsCount} / 3
      </span>
      <button
        onClick={triggerLock}
        className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors"
      >
        스크린락 테스트
      </button>
    </div>
  );
};
