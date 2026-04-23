import React, { useEffect, useRef, useState } from "react";
import {
  CameraOff,
  Focus,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Maximize2,
  X,
  Clock,
} from "lucide-react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { usePosture } from "../context/PostureContext";
import type { PostureBaseline } from "../context/PostureContext";
import { classifyPostureProblem } from "../utils/postureClassifier";
import { createPortal } from "react-dom";

// ── 설정 ─────────────────────────────────────────────────────────────────────
const WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const LM = { NOSE: 0, LEFT_EAR: 7, RIGHT_EAR: 8, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12 };

/**
 * 자세 불량 판정 임계값 (baseline 대비 편차)
 * - headDeviation : 코가 baseline보다 8% 이상 내려가면
 * - shoulderTilt  : 어깨 기울기가 baseline보다 4% 이상 커지면
 * - neckAngle     : 목 각도가 baseline보다 10° 이상 증가하면
 * - cva           : CVA가 baseline보다 8° 이상 감소하면
 * 위 4가지 중 2개 이상 충족 시 자세 불량으로 판정
 */
const THRESHOLD = { headDeviation: 0.08, shoulderTilt: 0.04, neckAngle: 10, cva: 8 };

const WARNING_HOLD_MS = 30_000; // 30초 연속 자세 불량 → 경고 1회
const COOLDOWN_MS     = 60_000; // 경고 후 60초 쿨다운

// ── 타입 / 헬퍼 ──────────────────────────────────────────────────────────────
type Lm = { x: number; y: number; z: number; visibility?: number };

function computeMetrics(lms: Lm[], vw: number, vh: number): PostureBaseline {
  const px = (lm: Lm) => ({ x: lm.x * vw, y: lm.y * vh });

  const nose     = px(lms[LM.NOSE]);
  const leftEar  = px(lms[LM.LEFT_EAR]);
  const rightEar = px(lms[LM.RIGHT_EAR]);
  const leftSh   = px(lms[LM.LEFT_SHOULDER]);
  const rightSh  = px(lms[LM.RIGHT_SHOULDER]);

  const shCX  = (leftSh.x + rightSh.x) / 2;
  const shCY  = (leftSh.y + rightSh.y) / 2;
  const earCX = (leftEar.x + rightEar.x) / 2;
  const earCY = (leftEar.y + rightEar.y) / 2;

  // 어깨 중심 높이
  const shoulderCenterY = shCY / vh;
  // 머리 위치 편차: y_nose - 어깨 중심 높이 (클수록 거북목)
  const headDeviation   = (nose.y - shCY) / vh;
  // 어깨 기울기: |y1 - y2|
  const shoulderTilt    = Math.abs(leftSh.y - rightSh.y) / vh;
  // 목 각도 (수직 기준)
  const neckAngle = Math.atan2(Math.abs(earCX - shCX), Math.max(shCY - earCY, 1)) * (180 / Math.PI);
  // CVA 근사: 귀-어깨 선 vs 수평선
  const calcCVA = (e: { x: number; y: number }, s: { x: number; y: number }) =>
    Math.atan2(s.y - e.y, Math.abs(e.x - s.x) + 1) * (180 / Math.PI);
  const cva = (calcCVA(leftEar, leftSh) + calcCVA(rightEar, rightSh)) / 2;

  return { shoulderCenterY, headDeviation, shoulderTilt, neckAngle, cva };
}

function checkBad(cur: PostureBaseline, base: PostureBaseline | null): boolean {
  if (!base) return cur.cva < 45; // 기준 없으면 절대값 사용
  let cnt = 0;
  if (cur.headDeviation > base.headDeviation + THRESHOLD.headDeviation) cnt++;
  if (cur.shoulderTilt  > base.shoulderTilt  + THRESHOLD.shoulderTilt)  cnt++;
  if (cur.neckAngle     > base.neckAngle     + THRESHOLD.neckAngle)     cnt++;
  if (cur.cva           < base.cva           - THRESHOLD.cva)           cnt++;
  return cnt >= 2;
}

function drawOverlay(canvas: HTMLCanvasElement | null, lms: Lm[], vw: number, vh: number, bad: boolean) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width  = vw;
  canvas.height = vh;
  ctx.clearRect(0, 0, vw, vh);

  const p = (lm: Lm) => ({ x: lm.x * vw, y: lm.y * vh });
  const nose     = p(lms[LM.NOSE]);
  const leftEar  = p(lms[LM.LEFT_EAR]);
  const rightEar = p(lms[LM.RIGHT_EAR]);
  const leftSh   = p(lms[LM.LEFT_SHOULDER]);
  const rightSh  = p(lms[LM.RIGHT_SHOULDER]);
  const shC  = { x: (leftSh.x + rightSh.x) / 2,  y: (leftSh.y + rightSh.y) / 2 };
  const earC = { x: (leftEar.x + rightEar.x) / 2, y: (leftEar.y + rightEar.y) / 2 };

  const lineCol = bad ? "#f87171" : "#34d399";
  const dotCol  = bad ? "#ef4444" : "#10b981";

  const line = (a: {x:number;y:number}, b: {x:number;y:number}, c: string, w=3, dash: number[]=[]) => {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  };
  const dot = (pt: {x:number;y:number}, fill: string, r=8) => {
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI*2);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2.5; ctx.stroke();
  };

  line(leftSh, rightSh, "#fbbf24", 3);                                     // 어깨 연결 (amber)
  line(earC, shC, lineCol, 3);                                              // 목 라인 (상태 색상)
  line(shC, {x: shC.x, y: shC.y - 80}, "rgba(255,255,255,0.3)", 1.5, [5,5]); // 수직 기준 (점선)

  dot(nose,     "#f472b6");   // 코 (pink)
  dot(leftEar,  "#60a5fa");   // 귀 (blue)
  dot(rightEar, "#60a5fa");
  dot(leftSh,   "#a78bfa");   // 어깨 (violet)
  dot(rightSh,  "#a78bfa");
  dot(earC, dotCol, 5);       // 귀 중심
  dot(shC,  dotCol, 5);       // 어깨 중심
}

async function initLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
export const LiveCamera: React.FC = () => {
  const { postureState, baseline, triggerWarning } = usePosture();

  // 루프 내에서 항상 최신값을 참조하기 위한 refs
  const baselineRef       = useRef(baseline);
  const triggerWarningRef = useRef(triggerWarning);
  const postureStateRef   = useRef(postureState);
  useEffect(() => { postureStateRef.current = postureState; }, [postureState]);
  const isFullscreenRef   = useRef(false);
  useEffect(() => { baselineRef.current = baseline; badStartRef.current = null; setIsBad(false); setBadSecs(0); }, [baseline]);
  useEffect(() => { triggerWarningRef.current = triggerWarning; }, [triggerWarning]);

  // DOM refs
  const videoRef            = useRef<HTMLVideoElement>(null);
  const canvasRef           = useRef<HTMLCanvasElement>(null);
  const fullscreenVideoRef  = useRef<HTMLVideoElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  // 내부 refs
  const streamRef     = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef        = useRef<number>(0);
  const isActiveRef   = useRef(false);
  const badStartRef   = useRef<number | null>(null);
  const cooldownRef   = useRef<number>(0);
  const lastUiRef     = useRef<number>(0);

  // State
  const [hasCamera, setHasCamera]       = useState<boolean | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveMetrics, setLiveMetrics]   = useState<PostureBaseline | null>(null);
  const [isBad, setIsBad]               = useState(false);
  const [badSecs, setBadSecs]           = useState(0);

  useEffect(() => { isFullscreenRef.current = isFullscreen; }, [isFullscreen]);

  // 잠금 시 GPU 랜드마커 닫기 → 3D 캐릭터에 WebGL 컨텍스트 양보
  useEffect(() => {
    if (postureState === 'locked') {
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    } else if (postureState === 'good' && isActiveRef.current && !landmarkerRef.current) {
      initLandmarker().then(lm => {
        if (isActiveRef.current) landmarkerRef.current = lm;
        else lm.close();
      }).catch(() => {});
    }
  }, [postureState]);

  // ── 카메라 + MediaPipe 생명주기 ─────────────────────────────────────────
  useEffect(() => {
    isActiveRef.current = true;

    (async () => {
      // 카메라 시작
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        if (isActiveRef.current) setHasCamera(false);
        return;
      }
      if (!isActiveRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      setHasCamera(true);
      if (videoRef.current) videoRef.current.srcObject = stream;

      // MediaPipe 초기화
      try {
        landmarkerRef.current = await initLandmarker();
      } catch {
        return;
      }
      if (!isActiveRef.current) { landmarkerRef.current?.close(); landmarkerRef.current = null; return; }

      // 감지 루프
      const loop = () => {
        if (!isActiveRef.current) return;

        const video = videoRef.current;
        if (video && video.readyState >= 2 && landmarkerRef.current) {
          try {
            const result = landmarkerRef.current.detectForVideo(video, performance.now());
            if (result.landmarks.length > 0) {
              const lms     = result.landmarks[0] as Lm[];
              const vw      = video.videoWidth;
              const vh      = video.videoHeight;
              const metrics = computeMetrics(lms, vw, vh);
              const bad     = checkBad(metrics, baselineRef.current);

              // 캔버스 오버레이 그리기
              drawOverlay(canvasRef.current, lms, vw, vh, bad);
              if (isFullscreenRef.current) {
                drawOverlay(fullscreenCanvasRef.current, lms, vw, vh, bad);
              }

              // 30초 자세 불량 경고 타이머
              const now = performance.now();
              if (bad) {
                if (badStartRef.current === null) badStartRef.current = now;
                const elapsed = now - badStartRef.current;

                // 30초 초과 & 쿨다운 지남 → 경고 발생
                if (elapsed >= WARNING_HOLD_MS && now - cooldownRef.current >= COOLDOWN_MS) {
                  const problem = baselineRef.current
                    ? classifyPostureProblem(metrics, baselineRef.current)
                    : null;
                  triggerWarningRef.current(problem, Math.round(metrics.cva));
                  cooldownRef.current = now;
                  badStartRef.current = null;
                }

                if (now - lastUiRef.current > 200) {
                  setIsBad(true);
                  setBadSecs(Math.min(Math.floor(elapsed / 1000), 30));
                  setLiveMetrics(metrics);
                  lastUiRef.current = now;
                }
              } else {
                badStartRef.current = null;
                if (now - lastUiRef.current > 200) {
                  setIsBad(false);
                  setBadSecs(0);
                  setLiveMetrics(metrics);
                  lastUiRef.current = now;
                }
              }
            }
          } catch { /* 프레임 오류 무시 */ }
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      isActiveRef.current = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []); // 마운트 시 1회 실행

  // 풀스크린 전환 시 video에 스트림 연결
  useEffect(() => {
    if (isFullscreen && fullscreenVideoRef.current && streamRef.current) {
      fullscreenVideoRef.current.srcObject = streamRef.current;
    }
  }, [isFullscreen]);

  // ── 상태 표시 설정 ────────────────────────────────────────────────────────
  const cvaStr = liveMetrics ? `${liveMetrics.cva.toFixed(1)}°` : "--";
  const symStr = liveMetrics ? `${Math.max(0, 100 - liveMetrics.shoulderTilt * 800).toFixed(0)}%` : "--";

  const getStatus = () => {
    if (postureState === "danger" || (isBad && liveMetrics && liveMetrics.cva < 42)) {
      return { color: "text-red-500", bg: "bg-red-500/20", border: "border-red-500", icon: <AlertTriangle className="w-5 h-5" />, label: "위험 (자세 불량)" };
    }
    if (postureState === "warning" || isBad) {
      return { color: "text-amber-500", bg: "bg-amber-500/20", border: "border-amber-500", icon: <ShieldAlert className="w-5 h-5" />, label: "주의 (자세 흐트러짐)" };
    }
    return { color: "text-emerald-500", bg: "bg-emerald-500/20", border: "border-emerald-500", icon: <ShieldCheck className="w-5 h-5" />, label: "정상 (바른 자세)" };
  };
  const st = getStatus();

  // ── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-full flex flex-col relative group">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
              <Focus className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">실시간 AI 자세 분석</span>
              <button
                onClick={() => setIsFullscreen(true)}
                className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>크게 보기</span>
              </button>
            </h3>
            <p className="text-xs text-slate-500 mt-1">카메라를 통해 현재 자세를 모니터링합니다.</p>
          </div>
        </div>

        {/* 카메라 영역 */}
        <div className="relative flex-1 bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-800 flex flex-col items-center justify-center h-full">
          {hasCamera === false ? (
            <div className="flex flex-col items-center text-slate-400 gap-3 z-10">
              <CameraOff className="w-10 h-10" />
              <p className="text-sm font-medium">카메라 권한이 없거나 찾을 수 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 비디오 (좌우 반전) */}
              <video
                ref={videoRef}
                autoPlay playsInline muted
                className="absolute inset-0 w-full h-full object-cover -scale-x-100"
              />
              {/* 랜드마크 캔버스 (동일하게 반전) */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none z-10"
              />

              {/* 자세 불량 지속 시간 바 */}
              {isBad && (
                <div className="absolute top-3 left-12 right-3 z-20 bg-amber-500/90 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-white shrink-0" />
                  <div className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-1000"
                      style={{ width: `${(badSecs / 30) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white shrink-0">{badSecs}s / 30s</span>
                </div>
              )}

              {/* 하단 지표 오버레이 */}
              <div className="absolute bottom-3 left-3 right-3 z-20 bg-black/60 backdrop-blur-sm p-3 rounded-xl border border-white/10 text-white flex flex-col gap-1.5">
                <div className="flex justify-between items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.border} ${st.color}`}>
                    <span className="scale-75 origin-left">{st.icon}</span>
                    {st.label}
                  </div>
                </div>
                <div className="flex justify-between items-center gap-4 text-[10px] font-medium text-white/70">
                  <span>CVA 각도</span>
                  <span className={`font-bold ${st.color} text-xs`}>{cvaStr}</span>
                </div>
                <div className="flex justify-between items-center gap-4 text-[10px] font-medium text-white/70">
                  <span>어깨 대칭도</span>
                  <span className="font-bold text-xs text-white">{symStr}</span>
                </div>
              </div>

              {/* LIVE AI 배지 */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-md">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-bold text-white tracking-widest">LIVE AI</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 풀스크린 모달 */}
      {isFullscreen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col items-center justify-center">

            {hasCamera === false ? (
              <div className="flex flex-col items-center text-slate-400 gap-4 z-10">
                <CameraOff className="w-16 h-16" />
                <p className="text-xl font-medium">카메라 권한이 없거나 찾을 수 없습니다.</p>
              </div>
            ) : (
              <>
                <video
                  ref={fullscreenVideoRef}
                  autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                />
                <canvas
                  ref={fullscreenCanvasRef}
                  className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none z-20"
                />
              </>
            )}

            {/* 풀스크린 상단 바 */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-red-500 px-3 py-1.5 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-bold text-white tracking-widest">LIVE AI</span>
                </div>
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold border bg-black/50 backdrop-blur-md ${st.border} ${st.color}`}>
                  {st.icon} {st.label}
                </div>
                {isBad && (
                  <div className="flex items-center gap-2 bg-amber-500/80 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <Clock className="w-4 h-4 text-white" />
                    <span className="text-xs font-bold text-white">{badSecs}s / 30s</span>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${(badSecs / 30) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 bg-black/50 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 풀스크린 하단 지표 */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/20 text-white flex items-center gap-12">
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium text-white/70">CVA 각도</span>
                <span className={`text-3xl font-black ${st.color}`}>{cvaStr}</span>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium text-white/70">어깨 대칭도</span>
                <span className="text-3xl font-black text-emerald-400">{symStr}</span>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium text-white/70">추정 위험도</span>
                <span className={`text-3xl font-black ${st.color}`}>
                  {postureState === "danger" || (isBad && liveMetrics && liveMetrics.cva < 42) ? "위험" : isBad ? "주의" : "낮음"}
                </span>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
