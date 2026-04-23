import type { PostureBaseline } from '../context/PostureContext';

export type PostureProblem =
  | 'forward_head_posture'
  | 'rounded_shoulder'
  | 'neck_tension'
  | 'neck_stiffness'
  | 'shoulder_stiffness'
  | 'slouched_posture';

export const PROBLEM_LABELS: Record<PostureProblem, string> = {
  forward_head_posture: '거북목',
  rounded_shoulder:     '라운드숄더',
  neck_tension:         '목 긴장',
  neck_stiffness:       '목 뻣뻣함',
  shoulder_stiffness:   '어깨 뻣뻣함',
  slouched_posture:     '굽은 자세',
};

export const PROBLEM_SUGGESTIONS: Record<PostureProblem, string> = {
  forward_head_posture: '모니터 높이를 눈높이로 맞추고 턱을 당겨주세요.',
  rounded_shoulder:     '어깨를 뒤로 당겨 가슴을 펴주세요.',
  neck_tension:         '목을 옆으로 천천히 기울여 긴장을 풀어주세요.',
  neck_stiffness:       '목을 앞뒤로 천천히 움직여 풀어주세요.',
  shoulder_stiffness:   '어깨를 천천히 돌려 긴장을 완화해주세요.',
  slouched_posture:     '허리를 곧게 펴고 가슴을 열어주세요.',
};

/**
 * 현재 자세 지표와 기준 지표를 비교해 문제 유형을 분류합니다.
 * 우선순위 순서: 거북목 → 라운드숄더 → 굽은 자세 → 목 긴장 → 목 뻣뻣함 → 어깨 뻣뻣함
 */
export function classifyPostureProblem(
  cur: PostureBaseline,
  base: PostureBaseline
): PostureProblem | null {
  const headDevDelta   = cur.headDeviation  - base.headDeviation;
  const shoulderTiltDelta = cur.shoulderTilt - base.shoulderTilt;
  const neckAngleDelta = cur.neckAngle      - base.neckAngle;
  const cvaDelta       = cur.cva            - base.cva;

  // 거북목: 머리가 앞으로 나오고 CVA 감소
  if (headDevDelta > 0.08 && cvaDelta < -8) {
    return 'forward_head_posture';
  }

  // 라운드숄더: 어깨 비대칭이 뚜렷하게 증가
  if (shoulderTiltDelta > 0.06) {
    return 'rounded_shoulder';
  }

  // 굽은 자세: 머리 편차 + 목 각도 모두 증가
  if (headDevDelta > 0.06 && neckAngleDelta > 8) {
    return 'slouched_posture';
  }

  // 목 긴장: 목 각도가 크게 증가 (기울어짐 포함)
  if (neckAngleDelta > 12) {
    return 'neck_tension';
  }

  // 목 뻣뻣함: 중간 수준 목 각도 변화 또는 CVA 저하
  if (neckAngleDelta > 8 || (headDevDelta > 0.05 && cvaDelta < -5)) {
    return 'neck_stiffness';
  }

  // 어깨 뻣뻣함: 어깨 비대칭 증가
  if (shoulderTiltDelta > 0.04) {
    return 'shoulder_stiffness';
  }

  return null;
}
