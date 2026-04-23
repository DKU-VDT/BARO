import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Camera, Monitor, UserSquare, Sun, CheckCircle2,
  ChevronRight, ChevronLeft, ScanFace, Loader2, AlertCircle,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { usePosture } from '../context/PostureContext';
import type { PostureBaseline } from '../context/PostureContext';

// ─── MediaPipe 설정 ──────────────────────────────────────────────────────────
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// MediaPipe Pose Landmark 인덱스
const LM = { NOSE: 0, LEFT_EAR: 7, RIGHT_EAR: 8, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12 };

type CalibPhase = 'loading' | 'ready' | 'measuring' | 'done' | 'error';

// ─── 유틸 함수 ───────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Lm = { x: number; y: number; z: number; visibility?: number };

/**
 * MediaPipe 랜드마크 → 자세 지표 계산
 * 모든 좌표는 픽셀 단위로 변환 후 계산 (비율 왜곡 방지)
 */
function computeMetrics(lms: Lm[], vw: number, vh: number): PostureBaseline {
  const px = (lm: Lm) => ({ x: lm.x * vw, y: lm.y * vh });

  const nose       = px(lms[LM.NOSE]);
  const leftEar    = px(lms[LM.LEFT_EAR]);
  const rightEar   = px(lms[LM.RIGHT_EAR]);
  const leftSh     = px(lms[LM.LEFT_SHOULDER]);
  const rightSh    = px(lms[LM.RIGHT_SHOULDER]);

  const shCX = (leftSh.x + rightSh.x) / 2;
  const shCY = (leftSh.y + rightSh.y) / 2;
  const earCX = (leftEar.x + rightEar.x) / 2;
  const earCY = (leftEar.y + rightEar.y) / 2;

  // 1. 어깨 중심 높이 (normalized)
  const shoulderCenterY = shCY / vh;

  // 2. 머리 위치 편차: nose.y - 어깨중심.y (양수 = 고개 숙임 = 거북목)
  const headDeviation = (nose.y - shCY) / vh;

  // 3. 어깨 기울기: |좌어깨Y - 우어깨Y| (양수 = 비대칭)
  const shoulderTilt = Math.abs(leftSh.y - rightSh.y) / vh;

  // 4. 목 각도: 귀 중심 → 어깨 중심 선과 수직의 각도 (0° = 완벽한 수직)
  const dxNeck = earCX - shCX;
  const dyNeck = shCY - earCY; // 귀가 어깨보다 위 → 양수
  const neckAngle = Math.atan2(Math.abs(dxNeck), Math.max(dyNeck, 1)) * (180 / Math.PI);

  // 5. CVA 근사 (craniovertebral angle): 귀-어깨 선과 수평선의 각도
  //    양측 평균. 연구 기준 50° 미만 = 거북목(FHP)
  const calcCVA = (ear: { x: number; y: number }, sh: { x: number; y: number }) => {
    const dy = sh.y - ear.y; // 어깨가 귀보다 아래 → 양수 (정상)
    const dx = Math.abs(ear.x - sh.x) + 1;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };
  const cva = (calcCVA(leftEar, leftSh) + calcCVA(rightEar, rightSh)) / 2;

  return { shoulderCenterY, headDeviation, shoulderTilt, neckAngle, cva };
}

function averageBaseline(samples: PostureBaseline[]): PostureBaseline {
  const n = samples.length;
  return {
    shoulderCenterY: samples.reduce((s, x) => s + x.shoulderCenterY, 0) / n,
    headDeviation:   samples.reduce((s, x) => s + x.headDeviation, 0) / n,
    shoulderTilt:    samples.reduce((s, x) => s + x.shoulderTilt, 0) / n,
    neckAngle:       samples.reduce((s, x) => s + x.neckAngle, 0) / n,
    cva:             samples.reduce((s, x) => s + x.cva, 0) / n,
  };
}

/**
 * 캔버스에 랜드마크 시각화 오버레이 그리기
 * 캔버스는 비디오와 동일한 intrinsic 크기 사용 (CSS로 표시 크기 조절)
 */
function drawOverlay(canvas: HTMLCanvasElement | null, lms: Lm[], vw: number, vh: number) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width  = vw;
  canvas.height = vh;
  ctx.clearRect(0, 0, vw, vh);

  const p = (lm: Lm) => ({ x: lm.x * vw, y: lm.y * vh });

  const nose      = p(lms[LM.NOSE]);
  const leftEar   = p(lms[LM.LEFT_EAR]);
  const rightEar  = p(lms[LM.RIGHT_EAR]);
  const leftSh    = p(lms[LM.LEFT_SHOULDER]);
  const rightSh   = p(lms[LM.RIGHT_SHOULDER]);

  const shCenter  = { x: (leftSh.x + rightSh.x) / 2,  y: (leftSh.y + rightSh.y) / 2 };
  const earCenter = { x: (leftEar.x + rightEar.x) / 2, y: (leftEar.y + rightEar.y) / 2 };

  const line = (a: { x: number; y: number }, b: { x: number; y: number }, color: string, width = 3, dash: number[] = []) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const dot = (pt: { x: number; y: number }, fill: string, r = 8) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  // 어깨 연결선 (amber)
  line(leftSh, rightSh, '#fbbf24', 3);
  // 목 라인: 귀 중심 → 어깨 중심 (indigo)
  line(earCenter, shCenter, '#818cf8', 3);
  // 수직 기준선 (어깨 중심 기준 위로, dashed)
  line(shCenter, { x: shCenter.x, y: shCenter.y - 90 }, 'rgba(255,255,255,0.35)', 1.5, [6, 5]);

  // 점: 코(빨강), 귀(파랑), 어깨(보라), 중심점(초록)
  dot(nose,      '#f87171');
  dot(leftEar,   '#60a5fa');
  dot(rightEar,  '#60a5fa');
  dot(leftSh,    '#a78bfa');
  dot(rightSh,   '#a78bfa');
  dot(earCenter, '#34d399', 6);
  dot(shCenter,  '#34d399', 6);
}

async function initLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
interface CameraSetupWizardProps {
  onClose: () => void;
}

export const CameraSetupWizard: React.FC<CameraSetupWizardProps> = ({ onClose }) => {
  const { setBaseline } = usePosture();
  const [step, setStep] = useState(1);

  // Step 2 상태
  const [calibPhase, setCalibPhase]       = useState<CalibPhase>('loading');
  const [countdown, setCountdown]         = useState(3);
  const [measureProgress, setMeasureProgress] = useState(0);
  const [liveMetrics, setLiveMetrics]     = useState<PostureBaseline | null>(null);
  const [calibResult, setCalibResult]     = useState<PostureBaseline | null>(null);

  // Refs
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef        = useRef<number>(0);
  const samplesRef    = useRef<PostureBaseline[]>([]);
  const phaseRef      = useRef<CalibPhase>('loading');
  const isActiveRef   = useRef(false);
  const lastUiUpdate  = useRef(0);

  // phaseRef를 calibPhase와 동기화
  useEffect(() => { phaseRef.current = calibPhase; }, [calibPhase]);

  // Step 2 전체 생명주기
  useEffect(() => {
    if (step !== 2) return;

    isActiveRef.current = true;
    setCalibPhase('loading');
    phaseRef.current = 'loading';

    // ── 오버레이 감지 루프 (ready ~ measuring 동안 계속 실행) ──────────────
    const detectionLoop = () => {
      if (!isActiveRef.current) return;
      const video    = videoRef.current;
      const landmarker = landmarkerRef.current;
      const phase    = phaseRef.current;

      if (phase === 'done' || phase === 'error') return;

      if (video && video.readyState >= 2 && landmarker) {
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          if (result.landmarks.length > 0) {
            const lms     = result.landmarks[0] as Lm[];
            const metrics = computeMetrics(lms, video.videoWidth, video.videoHeight);

            drawOverlay(canvasRef.current, lms, video.videoWidth, video.videoHeight);

            // 측정 중이면 샘플 수집
            if (phase === 'measuring') {
              samplesRef.current.push(metrics);
            }

            // React 상태는 100ms마다 업데이트 (렌더 부하 절감)
            const now = performance.now();
            if (now - lastUiUpdate.current > 100) {
              setLiveMetrics(metrics);
              lastUiUpdate.current = now;
            }
          }
        } catch {
          // 프레임 오류 무시
        }
      }

      rafRef.current = requestAnimationFrame(detectionLoop);
    };

    // ── 메인 흐름 (async) ─────────────────────────────────────────────────
    const run = async () => {
      // 카메라 + MediaPipe 병렬 초기화
      const [camResult, lmResult] = await Promise.allSettled([
        navigator.mediaDevices.getUserMedia({ video: true }),
        initLandmarker(),
      ]);

      if (!isActiveRef.current) return;

      if (camResult.status === 'rejected' || lmResult.status === 'rejected') {
        setCalibPhase('error');
        phaseRef.current = 'error';
        return;
      }

      const stream = camResult.value;
      streamRef.current   = stream;
      landmarkerRef.current = lmResult.value;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((res) => {
          if (!videoRef.current) return res();
          videoRef.current.onloadeddata = () => res();
        });
      }

      if (!isActiveRef.current) return;

      // 오버레이 루프 시작
      setCalibPhase('ready');
      phaseRef.current = 'ready';
      detectionLoop();

      // 카운트다운: 3 → 2 → 1
      for (let i = 3; i >= 1; i--) {
        if (!isActiveRef.current) return;
        setCountdown(i);
        await sleep(1000);
      }

      if (!isActiveRef.current) return;

      // 측정 시작
      samplesRef.current = [];
      setCalibPhase('measuring');
      phaseRef.current = 'measuring';

      const measureStart = performance.now();
      const DURATION = 3000;

      while (performance.now() - measureStart < DURATION) {
        if (!isActiveRef.current) return;
        setMeasureProgress(((performance.now() - measureStart) / DURATION) * 100);
        await sleep(80);
      }

      if (!isActiveRef.current) return;

      // 결과 집계
      if (samplesRef.current.length > 0) {
        const avg = averageBaseline(samplesRef.current);
        setCalibResult(avg);
        setBaseline(avg); // PostureContext + localStorage 저장
        setCalibPhase('done');
        phaseRef.current = 'done';
      } else {
        setCalibPhase('error');
        phaseRef.current = 'error';
      }
    };

    run();

    return () => {
      isActiveRef.current = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [step]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onClose();
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const canGoNext = step !== 2 || calibPhase === 'done' || calibPhase === 'error';

  // ── CVA 평가 헬퍼 ─────────────────────────────────────────────────────────
  const getCvaStatus = (cva: number) =>
    cva >= 50
      ? { label: '정상 범위', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' }
      : { label: '거북목 주의', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };

  // ─── JSX ──────────────────────────────────────────────────────────────────
  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">자세 기준 측정 마법사</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 진행 바 */}
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* 본문 */}
        <div className="p-6 md:p-8 flex-1 min-h-[420px] flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">

            {/* ── Step 1: 환경 안내 ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex flex-col"
              >
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">정확한 측정을 위한 준비</h3>
                  <p className="text-slate-500 text-sm">바른 자세로 앉은 상태에서 측정해야 기준값이 정확해집니다.</p>
                </div>
                <div className="grid gap-4 mt-auto mb-auto">
                  {[
                    { icon: <Monitor className="w-6 h-6" />, title: '모니터 중앙 배치', desc: '웹캠을 모니터 상단 정중앙에 위치시켜주세요. 측면 배치 시 어깨 대칭 분석이 부정확해집니다.' },
                    { icon: <UserSquare className="w-6 h-6" />, title: '눈높이 맞춤', desc: '카메라 렌즈와 눈높이를 수평으로 맞춰주세요. 목과 어깨 전체가 화면에 보여야 합니다.' },
                    { icon: <Sun className="w-6 h-6" />, title: '충분한 조명', desc: '얼굴에 짙은 그림자가 없도록 실내 조명을 켜주세요. 역광은 피하는 것이 좋습니다.' },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                      <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm shrink-0">{icon}</div>
                      <div>
                        <h4 className="font-bold text-slate-800 mb-1">{title}</h4>
                        <p className="text-sm text-slate-600">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step 2: 실제 자세 측정 ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex flex-col h-full"
              >
                <div className="text-center mb-4 shrink-0">
                  <h3 className="text-xl font-bold text-slate-800 mb-1">자세 기준 측정</h3>
                  <p className="text-sm text-slate-500">
                    {calibPhase === 'loading'   && 'AI 엔진을 불러오는 중입니다...'}
                    {calibPhase === 'ready'     && `바른 자세를 유지하세요. ${countdown}초 후 측정이 시작됩니다.`}
                    {calibPhase === 'measuring' && '측정 중입니다. 자세를 유지해주세요.'}
                    {calibPhase === 'done'      && '기준 자세 측정 완료! 다음 단계로 이동하세요.'}
                    {calibPhase === 'error'     && '측정 중 오류가 발생했습니다. 카메라 권한을 확인해주세요.'}
                  </p>
                </div>

                {/* 카메라 + 오버레이 컨테이너 */}
                <div className="flex-1 relative bg-slate-900 rounded-2xl overflow-hidden border-4 border-slate-800">

                  {calibPhase === 'error' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                      <AlertCircle className="w-12 h-12" />
                      <p className="font-medium">카메라 또는 AI 초기화 실패</p>
                      <p className="text-sm">브라우저 카메라 권한을 확인 후 다시 시도해주세요.</p>
                    </div>
                  ) : (
                    <>
                      {/* 비디오 */}
                      <video
                        ref={videoRef}
                        autoPlay playsInline muted
                        className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                      />

                      {/* 랜드마크 캔버스 (비디오와 동일하게 미러) */}
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none z-10"
                      />

                      {/* 로딩 오버레이 */}
                      {calibPhase === 'loading' && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/70 gap-3">
                          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                          <p className="text-sm font-semibold text-slate-200">AI 포즈 감지 엔진 로딩 중...</p>
                        </div>
                      )}

                      {/* 카운트다운 오버레이 */}
                      {calibPhase === 'ready' && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                          <motion.div
                            key={countdown}
                            initial={{ scale: 1.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-24 h-24 rounded-full bg-indigo-600/80 backdrop-blur-sm flex items-center justify-center shadow-xl"
                          >
                            <span className="text-5xl font-black text-white">{countdown}</span>
                          </motion.div>
                          <p className="mt-3 text-sm font-bold text-white bg-black/50 px-3 py-1 rounded-lg backdrop-blur-sm">
                            바른 자세를 유지하세요
                          </p>
                        </div>
                      )}

                      {/* 측정 중 진행 바 */}
                      {calibPhase === 'measuring' && (
                        <div className="absolute bottom-16 left-4 right-4 z-20">
                          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-white">측정 중...</span>
                              <span className="text-xs text-slate-300">{Math.round(measureProgress)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-400 rounded-full transition-all duration-100"
                                style={{ width: `${measureProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 측정 완료 오버레이 */}
                      {calibPhase === 'done' && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-emerald-900/40 backdrop-blur-[2px]">
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                            <p className="text-white font-bold text-lg">측정 완료</p>
                          </div>
                        </div>
                      )}

                      {/* 실시간 지표 (측정 중) */}
                      {liveMetrics && (calibPhase === 'measuring' || calibPhase === 'ready') && (
                        <div className="absolute bottom-3 left-3 right-3 z-20 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2.5 flex gap-4 text-xs text-white">
                          <span className="flex gap-1.5 items-center">
                            <span className="text-indigo-300 font-semibold">CVA</span>
                            <span className={liveMetrics.cva >= 50 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                              {liveMetrics.cva.toFixed(1)}°
                            </span>
                          </span>
                          <span className="flex gap-1.5 items-center">
                            <span className="text-indigo-300 font-semibold">목각도</span>
                            <span className="font-bold">{liveMetrics.neckAngle.toFixed(1)}°</span>
                          </span>
                          <span className="flex gap-1.5 items-center">
                            <span className="text-indigo-300 font-semibold">어깨</span>
                            <span className="font-bold">{(liveMetrics.shoulderTilt * 100).toFixed(1)}%</span>
                          </span>
                        </div>
                      )}

                      {/* LIVE 배지 */}
                      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-md">
                        <ScanFace className={`w-4 h-4 ${calibPhase === 'measuring' ? 'text-amber-400' : 'text-indigo-400'}`} />
                        <span className={`text-[9px] font-bold tracking-widest ${calibPhase === 'measuring' ? 'text-amber-400' : 'text-indigo-400'}`}>
                          {calibPhase === 'measuring' ? '측정 중' : 'AI 감지'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Step 3: 측정 결과 ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-center"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">기준 자세가 저장되었습니다!</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-sm leading-relaxed">
                  이 자세를 기준으로 거북목·어깨 비대칭을 실시간 모니터링합니다.
                  자세가 크게 틀어지면 알림이 발생합니다.
                </p>

                {calibResult ? (
                  <div className="w-full max-w-sm space-y-3">
                    {/* CVA */}
                    {(() => {
                      const s = getCvaStatus(calibResult.cva);
                      return (
                        <div className={`flex items-center justify-between p-3 rounded-xl border ${s.bg}`}>
                          <div className="text-left">
                            <p className="text-xs font-semibold text-slate-500">CVA 각도 (거북목 지표)</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">50° 이상 = 정상 / 이하 = 거북목 의심</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className={`text-xl font-black ${s.color}`}>{calibResult.cva.toFixed(1)}°</p>
                            <p className={`text-[10px] font-bold ${s.color}`}>{s.label}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 목 각도 */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 border-slate-200">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-slate-500">목 각도 (수직 기준)</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">수직에서 벗어난 각도</p>
                      </div>
                      <p className="text-xl font-black text-slate-700 shrink-0 ml-3">{calibResult.neckAngle.toFixed(1)}°</p>
                    </div>

                    {/* 머리 편차 */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 border-slate-200">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-slate-500">머리 위치 편차</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">코 위치 기준, 값이 클수록 고개 숙임</p>
                      </div>
                      <p className="text-xl font-black text-slate-700 shrink-0 ml-3">
                        {(calibResult.headDeviation * 100).toFixed(1)}%
                      </p>
                    </div>

                    {/* 어깨 기울기 */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 border-slate-200">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-slate-500">어깨 기울기</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">좌우 어깨 높이 차이</p>
                      </div>
                      <p className={`text-xl font-black shrink-0 ml-3 ${calibResult.shoulderTilt > 0.04 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {(calibResult.shoulderTilt * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ) : (
                  // 측정 없이 단계를 건너뛴 경우
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 w-full max-w-sm">
                    <ul className="space-y-2 text-sm text-slate-600 text-left">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 카메라 각도 정상</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 얼굴 및 어깨 정렬 완료</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> AI 트래킹 엔진 활성화됨</li>
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={handlePrev}
            className={`px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 ${step === 1 ? 'invisible' : ''}`}
          >
            <ChevronLeft className="w-4 h-4" /> 이전으로
          </button>

          <button
            onClick={handleNext}
            disabled={!canGoNext}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === 3 ? '완료' : '다음 단계'}
            {step !== 3 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
