import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePosture } from '../context/PostureContext';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, Camera, CameraOff, Loader2, ChevronRight } from 'lucide-react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { PROBLEM_LABELS } from '../utils/postureClassifier';
import { ExerciseCharacter } from './ExerciseCharacter';

// ─────────────────────────────────────────────────────────────
const WASM_URL  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const HOLD_SECONDS         = 5;
const SCORE_THRESHOLD      = 0.72;  // 72% 이상이면 자세 인식 성공

type Lm = { x: number; y: number; z: number; visibility?: number };

interface Exercise {
  id:              number;
  name:            string;
  target_problem:  string;
  description:     string;
  how_to:          string[];
  hold_time:       string;
  repeat:          string;
  key_points:      string[];
  mediapipe_check: Record<string, unknown>;
  animation_id:    string | null;
}

// ── 운동별 각도 기반 자세 점수 계산 ─────────────────────────────
function evaluateExercise(
  exerciseName: string,
  lms: Lm[],
  vw: number,
  vh: number,
  baseline: { headDeviation: number; shoulderTilt: number; neckAngle: number; cva: number } | null
): number {
  const px = (lm: Lm) => ({ x: lm.x * vw, y: lm.y * vh });

  const nose    = px(lms[0]);
  const leftEar = px(lms[7]);
  const rightEar= px(lms[8]);
  const leftSh  = px(lms[11]);
  const rightSh = px(lms[12]);

  const earCX = (leftEar.x + rightEar.x) / 2;
  const earCY = (leftEar.y + rightEar.y) / 2;
  const shCX  = (leftSh.x  + rightSh.x)  / 2;
  const shCY  = (leftSh.y  + rightSh.y)  / 2;

  const calcCVA = (e: { x: number; y: number }, s: { x: number; y: number }) =>
    Math.atan2(s.y - e.y, Math.abs(e.x - s.x) + 1) * (180 / Math.PI);
  const cva = (calcCVA(leftEar, leftSh) + calcCVA(rightEar, rightSh)) / 2;

  const headDeviation = (nose.y - shCY) / vh;
  const shoulderTilt  = Math.abs(leftSh.y - rightSh.y) / vh;
  const neckAngle     = Math.atan2(Math.abs(earCX - shCX), Math.max(shCY - earCY, 1)) * (180 / Math.PI);

  // 귀 라인 기울기 각도 (좌우 스트레칭 판정, 양수 = 오른쪽 기울임)
  const lateralTilt = Math.atan2(leftEar.y - rightEar.y, rightEar.x - leftEar.x) * (180 / Math.PI);

  // 코가 귀 중심보다 위에 있는 정도 (양수 = 코가 위, 음수 = 코가 아래 = 목 굽힘)
  const headAboveEar = (earCY - nose.y) / vh;

  const b = baseline;

  switch (exerciseName) {
    case 'chin_tuck': {
      // CVA 유지 + 머리가 앞으로 나오지 않음 + 어깨 안정
      const cvaOk       = b ? cva >= b.cva - 3 : cva >= 50;
      const headBack    = b ? headDeviation <= b.headDeviation + 0.02 : headDeviation < 0.35;
      const shStable    = b ? Math.abs(shoulderTilt - b.shoulderTilt) < 0.04 : shoulderTilt < 0.05;
      return (cvaOk ? 0.5 : Math.min(cva / 53, 1) * 0.35)
           + (headBack ? 0.30 : 0)
           + (shStable ? 0.20 : 0);
    }

    case 'neck_side_stretch': {
      // 귀 라인이 15° 이상 기울어지고 어깨가 올라가지 않음
      const absTilt  = Math.abs(lateralTilt);
      const tiltOk   = absTilt >= 15;
      const tiltScore = tiltOk ? 0.70 : (absTilt / 15) * 0.50;
      const shOk     = b ? shoulderTilt <= b.shoulderTilt + 0.05 : shoulderTilt < 0.08;
      return tiltScore + (shOk ? 0.30 : 0.05);
    }

    case 'neck_flexion': {
      // 코가 귀 중심과 같은 높이 이하 (턱이 가슴 쪽으로)
      const flexOk    = headAboveEar < 0.05;
      const flexScore = flexOk ? 0.70 : Math.max(0, (0.10 - headAboveEar) / 0.10) * 0.50;
      const shStable  = b ? Math.abs(shoulderTilt - b.shoulderTilt) < 0.04 : shoulderTilt < 0.05;
      return flexScore + (shStable ? 0.30 : 0.10);
    }

    case 'shoulder_roll': {
      // 어깨가 움직이고 있어야 함 — 어깨 기울기가 베이스보다 변화해야 통과
      const shMoving = b ? Math.abs(shoulderTilt - b.shoulderTilt) > 0.025 : shoulderTilt > 0.03;
      const uprightOk = b ? cva >= b.cva - 12 : cva >= 40;
      return (shMoving ? 0.65 : 0.20) + (uprightOk ? 0.35 : 0.10);
    }

    case 'scapular_retraction': {
      // 어깨가 수평 + CVA 개선 + 머리 안 나옴 — 셋 다 충족해야 통과
      const cvaOk   = b ? cva >= b.cva - 3 : cva >= 50;
      const levelOk = b ? shoulderTilt < b.shoulderTilt + 0.02 : shoulderTilt < 0.035;
      const headOk  = b ? headDeviation < b.headDeviation + 0.01 : headDeviation < 0.34;
      if (!cvaOk || !levelOk || !headOk) return 0.20;
      return 0.80;
    }

    case 'thoracic_extension': {
      // CVA 개선 + 머리 뒤로 + 목 과도한 젖힘 없음
      const cvaHigh   = b ? cva >= b.cva : cva >= 52;
      const headGood  = b ? headDeviation <= b.headDeviation + 0.01 : headDeviation < 0.33;
      const neckRelax = b ? neckAngle <= b.neckAngle + 5 : neckAngle < 25;
      return (cvaHigh   ? 0.50 : Math.min(cva / 55, 1) * 0.35)
           + (headGood  ? 0.30 : 0)
           + (neckRelax ? 0.20 : 0.10);
    }

    default: {
      const uprightOk = b ? cva >= b.cva - 8 : cva >= 45;
      return uprightOk ? 0.65 : 0.30;
    }
  }
}

// 운동별 실시간 피드백 메시지
function getExerciseFeedback(exerciseName: string, score: number): string {
  if (score >= SCORE_THRESHOLD) return '잘 하고 있어요! 자세를 유지하세요.';
  switch (exerciseName) {
    case 'chin_tuck':           return '턱을 더 뒤로 당기고 시선은 정면을 유지하세요.';
    case 'neck_side_stretch':   return '고개를 옆으로 더 기울여주세요. 어깨는 내려주세요.';
    case 'neck_flexion':        return '턱을 천천히 가슴 쪽으로 내려주세요.';
    case 'shoulder_roll':       return '어깨를 천천히 뒤로 돌려주세요.';
    case 'scapular_retraction': return '어깨를 뒤로 모아 가슴을 펴주세요.';
    case 'thoracic_extension':  return '가슴을 열고 상체를 천천히 펴주세요.';
    default:                    return '화면의 자세를 따라해주세요.';
  }
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export const ScreenLock: React.FC = () => {
  const { postureState, unlockScreen, currentProblem, baseline } = usePosture();
  const { user } = useAuth();

  // 운동 데이터
  const [exercise, setExercise]       = useState<Exercise | null>(null);
  const [loadingEx, setLoadingEx]     = useState(false);

  // MediaPipe
  const [mpReady, setMpReady]         = useState(false);
  const landmarkerRef                 = useRef<PoseLandmarker | null>(null);

  // 카메라
  const videoRef                      = useRef<HTMLVideoElement>(null);
  const rafRef                        = useRef<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // 단계: 'loading' → 'hold' → 'success'
  const [phase, setPhase]             = useState<'loading' | 'hold' | 'success'>('loading');
  const [holdProgress, setHoldProgress] = useState(0);
  const [score, setScore]             = useState(0);
  const holdElapsedRef                = useRef(0);
  const lastTimestampRef              = useRef<number | null>(null);

  // ── 잠금 진입 시 초기화 ─────────────────────────────────────
  useEffect(() => {
    if (postureState !== 'locked') return;
    setPhase('loading');
    setHoldProgress(0);
    setScore(0);
    holdElapsedRef.current = 0;
    lastTimestampRef.current = null;
    setCameraReady(false);
    setCameraError(false);

    // 운동 랜덤 선택
    setLoadingEx(true);
    fetch('/api/exercises')
      .then(r => r.json())
      .then((list: Exercise[]) => {
        if (!list?.length) return setExercise(null);
        setExercise(list[Math.floor(Math.random() * list.length)]);
      })
      .catch(() => setExercise(null))
      .finally(() => setLoadingEx(false));
  }, [postureState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MediaPipe 초기화 (앱 최초 1회) ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const lm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (cancelled) return;
        landmarkerRef.current = lm;
        setMpReady(true);
      } catch (e) {
        console.error('[MediaPipe]', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── 카메라 시작 ──────────────────────────────────────────────
  useEffect(() => {
    if (postureState !== 'locked') return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setCameraReady(true);
      })
      .catch(() => setCameraError(true));
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [postureState]);

  // loading → hold 전환
  useEffect(() => {
    if (postureState === 'locked' && phase === 'loading' && mpReady && cameraReady && !loadingEx) {
      setPhase('hold');
    }
  }, [postureState, phase, mpReady, cameraReady, loadingEx]);

  // ── 메인 루프: 각도 기반 자세 판정 ──────────────────────────
  const runLoop = useCallback((timestamp: number) => {
    const video     = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }

    let currentScore = 0;
    try {
      const result = landmarker.detectForVideo(video, timestamp);
      if (result.landmarks?.[0] && exercise) {
        currentScore = evaluateExercise(
          exercise.name,
          result.landmarks[0] as Lm[],
          video.videoWidth,
          video.videoHeight,
          baseline
        );
      }
    } catch { /* 프레임 오류 무시 */ }

    setScore(currentScore);

    const dt = lastTimestampRef.current ? timestamp - lastTimestampRef.current : 16;

    if (currentScore >= SCORE_THRESHOLD) {
      holdElapsedRef.current = Math.min(holdElapsedRef.current + dt, HOLD_SECONDS * 1000);
    } else {
      holdElapsedRef.current = Math.max(0, holdElapsedRef.current - 40);
    }
    lastTimestampRef.current = timestamp;

    const progress = holdElapsedRef.current / (HOLD_SECONDS * 1000);
    setHoldProgress(progress);

    if (progress >= 1) {
      setPhase('success');
      // 완료 기록 저장 (인증된 경우)
      if (exercise && user) {
        fetch('/api/exercises/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('baro_token')}`,
          },
          body: JSON.stringify({
            exercise_id:  exercise.id,
            problem_type: currentProblem,
            completed:    true,
          }),
        }).catch(() => { /* 실패해도 화면 해제는 진행 */ });
      }
      setTimeout(unlockScreen, 1500);
      return;
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, [exercise, baseline, unlockScreen, currentProblem, user]);

  // ── 루프 시작/종료 ───────────────────────────────────────────
  useEffect(() => {
    if (postureState !== 'locked' || phase !== 'hold' || !mpReady || !cameraReady) return;
    rafRef.current = requestAnimationFrame(runLoop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [postureState, phase, mpReady, cameraReady, runLoop]);

  if (postureState !== 'locked') return null;

  const radius         = 54;
  const circumference  = 2 * Math.PI * radius;
  const dashOffset     = circumference * (1 - holdProgress);
  const isMatching     = score >= SCORE_THRESHOLD;
  const feedback       = exercise ? getExerciseFeedback(exercise.name, score) : '';

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">

        {/* ── 왼쪽: 운동 안내 ── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4"
        >
          <div className="text-center mb-1">
            <span className="inline-block bg-red-500/20 text-red-300 text-xs font-bold px-3 py-1 rounded-full border border-red-500/30 mb-3">
              자세 불량 3회 누적 — 스트레칭 필요
            </span>
            {currentProblem && (
              <div className="inline-block ml-2 bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/30 mb-3">
                감지된 문제: {PROBLEM_LABELS[currentProblem]}
              </div>
            )}
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {exercise ? exercise.description : '스트레칭을 해주세요'}
            </h1>
          </div>

          {loadingEx || !exercise ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* 3D 캐릭터 — 카메라와 동일한 aspect-video 비율 */}
              <div className="w-full aspect-video rounded-2xl overflow-hidden">
                <ExerciseCharacter exerciseId={exercise.id} exerciseName={exercise.name} />
              </div>

              {/* 수행 방법 + 주의사항 (압축) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1.5">수행 방법</p>
                  <ol className="space-y-1">
                    {exercise.how_to.map((step, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-white/75">
                        <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                  <p className="text-amber-300/70 text-[10px] font-bold uppercase tracking-wider mb-1.5">주의사항</p>
                  <ul className="space-y-1">
                    {exercise.key_points.map((pt, i) => (
                      <li key={i} className="text-[11px] text-white/60 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* ── 오른쪽: 카메라 + 타이머 ── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-col items-center gap-5"
        >
          {/* 카메라 뷰 */}
          <div className={`relative w-full rounded-2xl overflow-hidden aspect-video bg-slate-900 transition-all duration-300 ${
            isMatching && phase === 'hold'
              ? 'border-2 border-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.35)]'
              : 'border-2 border-white/10'
          }`}>
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/40">
                <CameraOff className="w-10 h-10" />
                <p className="text-sm">카메라를 사용할 수 없습니다.</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay muted playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* 카메라 상태 */}
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-2.5 py-1.5 rounded-full text-xs text-white/70 font-medium">
                  <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
                  <Camera className="w-3 h-3" /> 카메라
                </div>

                {/* 자세 점수 배지 */}
                {phase === 'hold' && (
                  <div className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isMatching ? 'bg-emerald-500/80 text-white' : 'bg-black/60 text-white/50'
                  }`}>
                    {isMatching ? '✓ 자세 인식됨' : `점수 ${Math.round(score * 100)}%`}
                  </div>
                )}

                {/* 로딩 오버레이 */}
                <AnimatePresence>
                  {phase === 'loading' && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3"
                    >
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      <p className="text-white/60 text-sm">준비 중...</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 성공 오버레이 */}
                <AnimatePresence>
                  {phase === 'success' && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-900/85"
                    >
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <CheckCircle className="w-20 h-20 text-emerald-400" />
                      </motion.div>
                      <p className="text-white font-black text-xl mt-3">스트레칭 완료!</p>
                      <p className="text-emerald-300 text-sm mt-1">잠금을 해제합니다...</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* 원형 진행 타이머 */}
          <AnimatePresence>
            {phase === 'hold' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <svg width="128" height="128" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  <circle
                    cx="64" cy="64" r={radius} fill="none"
                    stroke={isMatching ? (holdProgress > 0.8 ? '#22c55e' : '#6366f1') : 'rgba(255,255,255,0.15)'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 64 64)"
                    style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
                  />
                  <text x="64" y="60" textAnchor="middle" fill="white" fontSize="26" fontWeight="900" fontFamily="sans-serif">
                    {Math.ceil(HOLD_SECONDS * (1 - holdProgress))}
                  </text>
                  <text x="64" y="80" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="sans-serif">
                    초 유지
                  </text>
                </svg>

                <p className={`text-sm font-medium text-center transition-colors px-4 ${
                  isMatching ? 'text-emerald-400' : 'text-white/50'
                }`}>
                  {feedback}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </div>
  );
};
