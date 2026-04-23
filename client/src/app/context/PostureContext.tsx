import React, { createContext, useContext, useState, useEffect } from 'react';
import type { PostureProblem } from '../utils/postureClassifier';
import { PROBLEM_LABELS } from '../utils/postureClassifier';

type PostureState = 'good' | 'warning' | 'danger' | 'locked';

export interface PostureBaseline {
  shoulderCenterY: number;
  headDeviation:   number;
  shoulderTilt:    number;
  neckAngle:       number;
  cva:             number;
}

export interface ActiveAlert {
  id:      number;
  count:   number;
  max:     number;
  message: string;
  angle:   number;
  problem: PostureProblem | null;
}

interface PostureContextType {
  postureState:   PostureState;
  warningsCount:  number;
  plantExp:       number;
  activeAlert:    ActiveAlert | null;
  baseline:       PostureBaseline | null;
  hasCalibrated:  boolean;
  currentProblem: PostureProblem | null;
  triggerWarning: (problem?: PostureProblem | null, angle?: number) => void;
  triggerDanger:  (problem?: PostureProblem | null, angle?: number) => void;
  resetPosture:   () => void;
  unlockScreen:   () => void;
  dismissAlert:   () => void;
  addPlantExp:    (amount: number) => void;
  setBaseline:    (b: PostureBaseline) => void;
}

const BASELINE_KEY = 'baro_posture_baseline';
const MAX_WARNINGS = 3;

function makeMessages(problem: PostureProblem | null): Record<number, string> {
  const label = problem ? `[${PROBLEM_LABELS[problem]}] ` : '';
  return {
    1: `${label}자세 이상이 감지되었습니다. 바른 자세로 교정해주세요.`,
    2: `${label}경고가 2회 누적됐습니다. 잠시 스트레칭을 해주세요.`,
    3: `${label}경고 3회 누적! 잠시 후 스트레칭 화면이 시작됩니다.`,
  };
}

const PostureContext = createContext<PostureContextType | undefined>(undefined);

function loadBaseline(): PostureBaseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    return raw ? (JSON.parse(raw) as PostureBaseline) : null;
  } catch {
    return null;
  }
}

export const PostureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [postureState,   setPostureState]   = useState<PostureState>('good');
  const [warningsCount,  setWarningsCount]  = useState(0);
  const [plantExp,       setPlantExp]       = useState(150);
  const [activeAlert,    setActiveAlert]    = useState<ActiveAlert | null>(null);
  const [baseline,       setBaselineState]  = useState<PostureBaseline | null>(loadBaseline);
  const [currentProblem, setCurrentProblem] = useState<PostureProblem | null>(null);

  const hasCalibrated = baseline !== null;

  const setBaseline = (b: PostureBaseline) => {
    setBaselineState(b);
    localStorage.setItem(BASELINE_KEY, JSON.stringify(b));
  };

  const triggerWarning = (problem: PostureProblem | null = null, angle = 30) => {
    if (postureState === 'locked') return;
    setCurrentProblem(problem);
    setPostureState('warning');
    setWarningsCount((prev) => {
      const next = prev + 1;
      const msgs = makeMessages(problem);
      setActiveAlert({
        id: Date.now(),
        count: next,
        max: MAX_WARNINGS,
        message: msgs[next] ?? msgs[1],
        angle,
        problem,
      });
      if (next >= MAX_WARNINGS) {
        setTimeout(() => setPostureState('locked'), 1500);
      }
      return next;
    });
  };

  const triggerDanger = (problem: PostureProblem | null = null, angle = 40) => {
    if (postureState === 'locked') return;
    setCurrentProblem(problem);
    setPostureState('danger');
    setWarningsCount((prev) => {
      const next = prev + 1;
      const msgs = makeMessages(problem);
      setActiveAlert({
        id: Date.now(),
        count: next,
        max: MAX_WARNINGS,
        message: msgs[next] ?? msgs[1],
        angle,
        problem,
      });
      if (next >= MAX_WARNINGS) {
        setTimeout(() => setPostureState('locked'), 1500);
      }
      return next;
    });
  };

  const dismissAlert = () => setActiveAlert(null);

  const resetPosture = () => {
    if (postureState === 'locked') return;
    setPostureState('good');
  };

  const unlockScreen = () => {
    setPostureState('good');
    setWarningsCount(0);
    setActiveAlert(null);
    setCurrentProblem(null);
  };

  const addPlantExp = (amount: number) => {
    setPlantExp((prev) => Math.min(prev + amount, 1000));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (postureState === 'good') {
        addPlantExp(5);
      } else if (postureState === 'warning' || postureState === 'danger') {
        setPlantExp((prev) => Math.max(prev - 2, 0));
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [postureState]);

  return (
    <PostureContext.Provider value={{
      postureState, warningsCount, plantExp, activeAlert,
      baseline, hasCalibrated, currentProblem, setBaseline,
      triggerWarning, triggerDanger, resetPosture, unlockScreen, dismissAlert, addPlantExp,
    }}>
      {children}
    </PostureContext.Provider>
  );
};

export const usePosture = () => {
  const context = useContext(PostureContext);
  if (context === undefined) throw new Error('usePosture must be used within a PostureProvider');
  return context;
};
