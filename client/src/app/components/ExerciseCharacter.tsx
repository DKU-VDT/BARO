import React, { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ── 랜덤 포즈 프리셋 ─────────────────────────────────────────────────
type PoseData = Record<string, [number, number, number]>;

// ── 운동 이름별 정확한 포즈 매핑 ────────────────────────────────────
// 차렷 자세 — 월드 Z축 기준 쿼터니언 (캐릭터가 +Z 방향 기준)
// 팔이 위로 가면 부호 반전: left +π/2 → -π/2, right -π/2 → +π/2
const ARM_ATTN_Q: Record<string, THREE.Quaternion> = {
  mixamorigLeftArm:  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI * 0.42),
  mixamorigRightArm: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1),  Math.PI * 0.42),
};
// 팔을 쓰는 운동 포즈에서도 차렷 기준값으로 오프셋 적용 (미사용 시 [0,0,0])
const ATTN_L: [number,number,number] = [0, 0, 0];
const ATTN_R: [number,number,number] = [0, 0, 0];

const EXERCISE_POSES: Record<string, PoseData> = {
  // 턱 당기기: 목·머리만 움직임, 팔 차렷
  chin_tuck: {
    mixamorigSpine:[0,0,0], mixamorigSpine1:[0,0,0], mixamorigSpine2:[0,0,0],
    mixamorigNeck:[-20,0,0], mixamorigHead:[-12,0,0],
    mixamorigLeftShoulder:[0,0,0], mixamorigRightShoulder:[0,0,0],
    mixamorigLeftArm:ATTN_L, mixamorigRightArm:ATTN_R,
  },
  // 목 옆으로 기울이기: 목·머리만 움직임, 팔 차렷
  neck_side_stretch: {
    mixamorigSpine:[0,0,0], mixamorigSpine1:[0,0,0], mixamorigSpine2:[0,0,5],
    mixamorigNeck:[-5,0,30], mixamorigHead:[0,0,20],
    mixamorigLeftShoulder:[0,0,0], mixamorigRightShoulder:[0,0,0],
    mixamorigLeftArm:ATTN_L, mixamorigRightArm:ATTN_R,
  },
  // 목 앞으로 구부리기: 목·머리만 움직임, 팔 차렷
  neck_flexion: {
    mixamorigSpine:[0,0,0], mixamorigSpine1:[0,0,0], mixamorigSpine2:[5,0,0],
    mixamorigNeck:[30,0,0], mixamorigHead:[20,0,0],
    mixamorigLeftShoulder:[0,0,0], mixamorigRightShoulder:[0,0,0],
    mixamorigLeftArm:ATTN_L, mixamorigRightArm:ATTN_R,
  },
  // 어깨 돌리기: 팔 움직임이 핵심
  shoulder_roll: {
    mixamorigSpine:[0,0,0], mixamorigSpine1:[0,0,0], mixamorigSpine2:[0,0,0],
    mixamorigNeck:[0,0,0], mixamorigHead:[0,0,0],
    mixamorigLeftShoulder:[0,0,0], mixamorigRightShoulder:[0,0,0],
    mixamorigLeftArm:[-40,0,0], mixamorigRightArm:[-40,0,0],
  },
  // 어깨뼈 모으기: 팔·등 움직임
  scapular_retraction: {
    mixamorigSpine:[0,0,0], mixamorigSpine1:[-5,0,0], mixamorigSpine2:[-15,0,0],
    mixamorigNeck:[-8,0,0], mixamorigHead:[-5,0,0],
    mixamorigLeftShoulder:[0,0,0], mixamorigRightShoulder:[0,0,0],
    mixamorigLeftArm:[25,0,35], mixamorigRightArm:[25,0,-35],
  },
  // 등 펴기: 척추·목 움직임, 팔 차렷
  thoracic_extension: {
    mixamorigSpine:[-5,0,0], mixamorigSpine1:[-12,0,0], mixamorigSpine2:[-22,0,0],
    mixamorigNeck:[-10,0,0], mixamorigHead:[-6,0,0],
    mixamorigLeftShoulder:[0,0,0], mixamorigRightShoulder:[0,0,0],
    mixamorigLeftArm:ATTN_L, mixamorigRightArm:ATTN_R,
  },
};

function getPose(exerciseName?: string): PoseData {
  if (exerciseName && EXERCISE_POSES[exerciseName]) return EXERCISE_POSES[exerciseName];
  const all = Object.values(EXERCISE_POSES);
  return all[Math.floor(Math.random() * all.length)];
}

// ── 운동별 움직여야 하는 뼈 마스크 ─────────────────────────────────
// AI가 관계없는 뼈까지 돌리면 완전히 다른 동작으로 보임 → 마스크로 강제 0
const BONE_MASK: Record<string, string[]> = {
  chin_tuck:           ['mixamorigNeck', 'mixamorigHead'],
  neck_side_stretch:   ['mixamorigSpine2', 'mixamorigNeck', 'mixamorigHead'],
  neck_flexion:        ['mixamorigNeck', 'mixamorigHead'],
  shoulder_roll:       ['mixamorigLeftShoulder', 'mixamorigRightShoulder',
                        'mixamorigLeftArm', 'mixamorigRightArm'],
  scapular_retraction: ['mixamorigSpine2', 'mixamorigLeftShoulder', 'mixamorigRightShoulder',
                        'mixamorigLeftArm', 'mixamorigRightArm'],
  thoracic_extension:  ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2',
                        'mixamorigNeck', 'mixamorigHead'],
};

// AI 값에서 마스크 밖의 뼈는 0으로 강제, 방향도 보정
function applyMask(data: PoseData, exerciseName?: string): PoseData {
  const mask = exerciseName ? BONE_MASK[exerciseName] : null;

  // 방향 보정 규칙: [뼈, 축(0=x,1=y,2=z), 올바른 부호]
  const DIR: Record<string, [string, number, number][]> = {
    chin_tuck:          [['mixamorigNeck', 0, -1], ['mixamorigHead', 0, -1]],
    neck_flexion:       [['mixamorigNeck', 0,  1], ['mixamorigHead', 0,  1]],
    thoracic_extension: [['mixamorigSpine2', 0, -1], ['mixamorigSpine1', 0, -1]],
    scapular_retraction:[['mixamorigSpine2', 0, -1]],
  };
  const dirRules = exerciseName ? (DIR[exerciseName] ?? []) : [];

  const result: PoseData = {};
  for (const key of Object.keys(data)) {
    if (!mask || mask.includes(key)) {
      const v: [number, number, number] = [...data[key]] as [number, number, number];
      // 방향 보정: 부호가 틀리면 반전
      for (const [bone, axis, sign] of dirRules) {
        if (bone === key && v[axis] !== 0 && Math.sign(v[axis]) !== sign) {
          v[axis] = -v[axis];
        }
      }
      result[key] = v;
    } else {
      result[key] = [0, 0, 0];
    }
  }
  return result;
}

// ── 뼈 이름 키워드 매핑 ──────────────────────────────────────────────
const BONE_KEYWORDS: Record<string, string[]> = {
  mixamorigSpine:          ['spine',   'pelvis',   'hips'],
  mixamorigSpine1:         ['spine1',  'spine_1'],
  mixamorigSpine2:         ['spine2',  'spine_2',  'chest'],
  mixamorigNeck:           ['neck'],
  mixamorigHead:           ['head'],
  mixamorigLeftShoulder:   ['leftshoulder',  'l_shoulder',  'shoulder_l'],
  mixamorigRightShoulder:  ['rightshoulder', 'r_shoulder',  'shoulder_r'],
  mixamorigLeftArm:        ['leftarm',  'l_arm',  'upperarm_l', 'leftupperarm'],
  mixamorigRightArm:       ['rightarm', 'r_arm',  'upperarm_r', 'rightupperarm'],
};

// ── T-포즈 캐시 (모듈 레벨 — 씬 재마운트 시 초기 상태 복원) ──────────
const tPoseCache = new Map<string, THREE.Euler>();
let tPoseCaptured = false;

function collectBones(root: THREE.Object3D): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  root.traverse(obj => {
    if ((obj as THREE.Bone).isBone) map.set(obj.name, obj as THREE.Bone);
  });
  return map;
}

function resolveBone(stdName: string, available: Map<string, THREE.Bone>): THREE.Bone | null {
  const lc = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const stdNorm = lc(stdName);
  for (const [name, bone] of available) {
    if (lc(name) === stdNorm) return bone;
  }
  const stripped = lc(stdName.replace(/^mixamorig:?/i, ''));
  for (const [name, bone] of available) {
    if (lc(name.replace(/^mixamorig:?/i, '')) === stripped) return bone;
  }
  for (const kw of (BONE_KEYWORDS[stdName] ?? [])) {
    for (const [name, bone] of available) {
      if (lc(name).includes(lc(kw))) return bone;
    }
  }
  return null;
}

// ── 3D 캐릭터 메시 ──────────────────────────────────────────────────
function CharacterMesh({ poseData }: { poseData: PoseData }) {
  const { scene } = useGLTF('/character.glb');
  const resolvedRef = useRef<Map<string, { bone: THREE.Bone; rest: THREE.Euler }>>(new Map());
  const timeRef     = useRef(0);

  useEffect(() => {
    const available = collectBones(scene);

    if (!tPoseCaptured) {
      available.forEach((bone, name) => {
        tPoseCache.set(name, bone.rotation.clone());
      });
      tPoseCaptured = true;
    } else {
      available.forEach((bone, name) => {
        const saved = tPoseCache.get(name);
        if (saved) bone.rotation.copy(saved);
      });
    }

    const resolved = new Map<string, { bone: THREE.Bone; rest: THREE.Euler }>();
    Object.keys(BONE_KEYWORDS).forEach(stdName => {
      const bone = resolveBone(stdName, available);
      if (bone) {
        const rest = tPoseCache.get(bone.name) ?? bone.rotation.clone();
        resolved.set(stdName, { bone, rest: rest.clone() });
      }
    });
    resolvedRef.current = resolved;
    timeRef.current = 0;

    // 팔 뼈 rest 회전값 확인용 (차렷 값 찾는 중)
    const armBones = ['mixamorigLeftArm', 'mixamorigRightArm'];
    armBones.forEach(n => {
      const entry = resolved.get(n);
      if (entry) console.log(`[bone] ${n} rest:`, entry.rest.x.toFixed(2), entry.rest.y.toFixed(2), entry.rest.z.toFixed(2));
    });
  }, [scene, poseData]);

  useFrame((_, delta) => {
    if (resolvedRef.current.size === 0) return;

    timeRef.current += delta;
    const cycle = 6.0;
    const t = timeRef.current % cycle;
    let progress = 0;

    if      (t < 2.0) progress = t / 2.0;
    else if (t < 4.0) progress = 1.0;
    else if (t < 5.5) progress = 1.0 - (t - 4.0) / 1.5;
    else              progress = 0;

    const smooth = THREE.MathUtils.smoothstep(progress, 0, 1);

    resolvedRef.current.forEach(({ bone, rest }, stdName) => {
      const target = poseData[stdName];
      const isZero = !target || (target[0] === 0 && target[1] === 0 && target[2] === 0);

      if (isZero) {
        const attnQ = ARM_ATTN_Q[stdName];
        if (attnQ && bone.parent) {
          // 월드 공간 회전을 로컬 공간으로 변환: newLocal = P^(-1) × W × P × restQ
          const pQ = new THREE.Quaternion();
          bone.parent.getWorldQuaternion(pQ);
          const restQ = new THREE.Quaternion().setFromEuler(rest);
          const newLocalQ = pQ.clone().invert()
            .multiply(attnQ)
            .multiply(pQ)
            .multiply(restQ);
          bone.quaternion.copy(newLocalQ);
        } else {
          bone.rotation.copy(rest);
        }
        return;
      }
      bone.rotation.x = THREE.MathUtils.lerp(rest.x, rest.x + THREE.MathUtils.degToRad(target[0]), smooth);
      bone.rotation.y = THREE.MathUtils.lerp(rest.y, rest.y + THREE.MathUtils.degToRad(target[1]), smooth);
      bone.rotation.z = THREE.MathUtils.lerp(rest.z, rest.z + THREE.MathUtils.degToRad(target[2]), smooth);
    });
  });

  return <primitive object={scene} scale={1.8} position={[0, -2.2, 0]} />;
}

function Fallback() {
  return (
    <mesh>
      <capsuleGeometry args={[0.3, 1.2, 4, 8]} />
      <meshStandardMaterial color="#6366f1" opacity={0.25} transparent />
    </mesh>
  );
}

// ── 외부 공개 컴포넌트 ───────────────────────────────────────────────
interface ExerciseCharacterProps {
  exerciseId: number | null;
  exerciseName?: string;
  className?: string;
}

export const ExerciseCharacter: React.FC<ExerciseCharacterProps> = ({ exerciseId, exerciseName, className = '' }) => {
  const [poseData, setPoseData]   = useState<PoseData>(() => getPose(exerciseName));
  const [status, setStatus]       = useState<'loading' | 'ok' | 'error'>('loading');
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    if (!exerciseId) return;
    setStatus('loading');
    setCanvasReady(false);

    fetch(`/api/exercises/pose/${exerciseId}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data: PoseData) => {
        // 1) 마스크 적용 + 방향 보정
        const masked = applyMask(data, exerciseName);
        // 2) 마스크된 값의 실제 회전량 검증
        const total = Object.values(masked).reduce(
          (sum, v) => sum + Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]), 0
        );
        console.log('[AI 포즈] 마스킹 후 총 회전량:', total.toFixed(1), '°', masked);
        if (total < 20) {
          console.warn('[AI 포즈] 마스킹 후 값이 작음 → 하드코딩 폴백');
          setPoseData(getPose(exerciseName));
          setStatus('error');
        } else {
          setPoseData(masked);
          setStatus('ok');
        }
      })
      .catch(() => {
        setPoseData(getPose(exerciseName));
        setStatus('error');
      })
      .finally(() => {
        setTimeout(() => setCanvasReady(true), 300);
      });
  }, [exerciseId, exerciseName]);

  return (
    <div className={`relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 ${className}`}>
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
        {status === 'loading' && (
          <span className="text-[10px] bg-indigo-500/80 text-white px-2 py-0.5 rounded-full font-bold">AI 자세 생성 중...</span>
        )}
        {status === 'ok' && (
          <span className="text-[10px] bg-emerald-500/80 text-white px-2 py-0.5 rounded-full font-bold">AI 생성 자세</span>
        )}
        {status === 'error' && (
          <span className="text-[10px] bg-amber-500/80 text-white px-2 py-0.5 rounded-full font-bold">기본 자세</span>
        )}
      </div>

      {!canvasReady ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Canvas
          camera={{ position: [1.8, 0.5, 3.0], fov: 45 }}
          dpr={1}
          gl={{ antialias: false, powerPreference: 'low-power' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', e => {
              e.preventDefault();
              console.warn('[WebGL] 컨텍스트 손실 — 복구 시도');
              setTimeout(() => {
                const ext = gl.getContext().getExtension('WEBGL_lose_context');
                ext?.restoreContext();
              }, 500);
            });
          }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 4, 2]} intensity={1.0} />
          <directionalLight position={[-2, 2, -2]} intensity={0.3} />
          <Suspense fallback={<Fallback />}>
            <CharacterMesh poseData={poseData} />
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
            minAzimuthAngle={-Math.PI / 4}
            maxAzimuthAngle={Math.PI / 4}
          />
        </Canvas>
      )}
    </div>
  );
};

useGLTF.preload('/character.glb');
