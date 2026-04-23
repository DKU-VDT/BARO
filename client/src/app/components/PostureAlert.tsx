import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { usePosture } from '../context/PostureContext';
import { PROBLEM_LABELS, PROBLEM_SUGGESTIONS } from '../utils/postureClassifier';

const AUTO_DISMISS_MS = 8000;

export const PostureAlert: React.FC = () => {
  const { activeAlert, dismissAlert } = usePosture();

  useEffect(() => {
    if (!activeAlert) return;
    const t = setTimeout(dismissAlert, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [activeAlert, dismissAlert]);

  const isLastWarning = activeAlert && activeAlert.count >= activeAlert.max;

  return (
    <AnimatePresence>
      {activeAlert && (
        <motion.div
          key={activeAlert.id}
          initial={{ y: -100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0,    opacity: 1, scale: 1    }}
          exit={{    y: -100, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4"
        >
          <div className={`relative rounded-2xl shadow-2xl border overflow-hidden ${
            isLastWarning
              ? 'bg-red-950 border-red-500'
              : activeAlert.count === 2
              ? 'bg-orange-950 border-orange-400'
              : 'bg-amber-950 border-amber-400'
          }`}>
            {/* 자동 닫기 진행 바 */}
            <motion.div
              className={`absolute top-0 left-0 h-1 ${
                isLastWarning ? 'bg-red-400' : 'bg-amber-400'
              }`}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
            />

            <div className="p-4 pt-5">
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  isLastWarning ? 'bg-red-500/30' : 'bg-amber-500/30'
                }`}>
                  {isLastWarning
                    ? <AlertTriangle className="w-5 h-5 text-red-300" />
                    : <ShieldAlert className="w-5 h-5 text-amber-300" />
                  }
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  {/* 제목 + 문제 유형 배지 + 경고 카운트 */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={`text-sm font-black ${
                      isLastWarning ? 'text-red-200' : 'text-amber-200'
                    }`}>
                      {isLastWarning ? '마지막 경고' : `자세 경고 ${activeAlert.count}회`}
                    </p>

                    {/* 문제 유형 배지 */}
                    {activeAlert.problem && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isLastWarning
                          ? 'bg-red-500/30 text-red-300'
                          : 'bg-amber-500/30 text-amber-300'
                      }`}>
                        {PROBLEM_LABELS[activeAlert.problem]}
                      </span>
                    )}

                    {/* 경고 횟수 점 */}
                    <div className="flex gap-1 ml-auto">
                      {Array.from({ length: activeAlert.max }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < activeAlert.count
                              ? isLastWarning ? 'bg-red-400' : 'bg-amber-400'
                              : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed">
                    {activeAlert.message}
                  </p>

                  {/* 문제별 제안 */}
                  {activeAlert.problem && (
                    <p className={`text-xs font-medium mt-1 ${
                      isLastWarning ? 'text-red-300' : 'text-amber-300'
                    }`}>
                      {PROBLEM_SUGGESTIONS[activeAlert.problem]}
                    </p>
                  )}

                  <p className={`text-xs font-bold mt-1 ${
                    isLastWarning ? 'text-red-400' : 'text-white/40'
                  }`}>
                    현재 CVA {activeAlert.angle}°
                    {isLastWarning && ' — 스트레칭 화면이 곧 시작됩니다!'}
                  </p>
                </div>

                {/* 닫기 */}
                <button
                  onClick={dismissAlert}
                  className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
