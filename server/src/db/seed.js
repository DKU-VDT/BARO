import pool from './database.js';

const exercises = [
  {
    name: 'chin_tuck',
    target_problem: 'forward_head_posture',
    description: '턱을 뒤로 당겨 목 정렬을 바로잡는 동작',
    how_to: [
      '의자에 앉아 허리를 곧게 편다',
      '정면을 바라본 상태에서 턱을 뒤로 당긴다',
      '고개를 숙이지 않도록 유지한다',
    ],
    hold_time: '5~10초',
    repeat: '5~10회',
    key_points: ['고개를 아래로 숙이지 않기', '어깨는 움직이지 않기'],
    mediapipe_check: {
      labels: ['nose-ear-shoulder 정렬 개선', '머리 전방 이동 감소'],
      cva_min: 50,
      head_back: true,
      shoulder_stable_max: 0.04,
      hold_seconds: 5,
    },
    animation_id: 'chin_tuck_anim',
  },
  {
    name: 'neck_side_stretch',
    target_problem: 'neck_tension',
    description: '목 옆 근육을 늘려 긴장을 완화하는 동작',
    how_to: [
      '어깨를 고정한 상태에서',
      '고개를 천천히 오른쪽으로 기울인다',
      '반대쪽도 동일하게 수행한다',
    ],
    hold_time: '5~10초',
    repeat: '좌우 3~5회',
    key_points: ['어깨가 올라가지 않도록 유지', '반동 없이 천천히 움직이기'],
    mediapipe_check: {
      labels: ['머리 기울기 각도', '어깨 높이 변화 여부'],
      head_tilt_min: 15,
      shoulder_rise_max: 0.05,
      hold_seconds: 5,
    },
    animation_id: 'neck_side_stretch_anim',
  },
  {
    name: 'neck_flexion',
    target_problem: 'neck_stiffness',
    description: '목 뒤쪽 근육을 이완하는 동작',
    how_to: [
      '허리를 세운 상태에서',
      '천천히 턱을 가슴 쪽으로 내린다',
      '무리하지 않는 범위에서 유지한다',
    ],
    hold_time: '5~10초',
    repeat: '3~5회',
    key_points: ['급하게 숙이지 않기', '어깨를 고정하기'],
    mediapipe_check: {
      labels: ['머리-어깨 각도 감소', '상체 과도한 움직임 여부'],
      head_flex_threshold: 0.05,
      shoulder_stable_max: 0.04,
      hold_seconds: 5,
    },
    animation_id: 'neck_flexion_anim',
  },
  {
    name: 'shoulder_roll',
    target_problem: 'shoulder_stiffness',
    description: '어깨를 회전시켜 긴장을 완화하는 동작',
    how_to: [
      '한쪽 어깨를 천천히 위로 올린다',
      '뒤로 돌리면서 아래로 내린다',
      '반대 방향도 반복한다',
    ],
    hold_time: '연속 동작',
    repeat: '10회',
    key_points: ['천천히 부드럽게 움직이기', '상체는 고정하기'],
    mediapipe_check: {
      labels: ['어깨 움직임 궤적', '좌우 균형'],
      upright_cva_min: 42,
      hold_seconds: 8,
    },
    animation_id: 'shoulder_roll_anim',
  },
  {
    name: 'scapular_retraction',
    target_problem: 'rounded_shoulder',
    description: '어깨를 뒤로 모아 자세를 펴는 동작',
    how_to: [
      '허리를 세운 상태에서',
      '양쪽 어깨를 뒤로 당긴다',
      '가슴을 자연스럽게 펴준다',
    ],
    hold_time: '5~10초',
    repeat: '5~10회',
    key_points: ['어깨를 과도하게 올리지 않기', '허리는 곧게 유지'],
    mediapipe_check: {
      labels: ['어깨 위치 뒤로 이동', '상체 정렬 개선'],
      cva_min: 48,
      shoulder_level_max: 0.04,
      hold_seconds: 5,
    },
    animation_id: 'scapular_retraction_anim',
  },
  {
    name: 'thoracic_extension',
    target_problem: 'slouched_posture',
    description: '등과 가슴을 펴서 굽은 자세를 교정하는 동작',
    how_to: [
      '허리를 곧게 편 상태에서',
      '가슴을 앞으로 열고 상체를 뒤로 약간 젖힌다',
      '목은 과도하게 젖히지 않는다',
    ],
    hold_time: '10~15초',
    repeat: '3~5회',
    key_points: ['허리를 과하게 꺾지 않기', '목을 과도하게 뒤로 젖히지 않기'],
    mediapipe_check: {
      labels: ['상체 기울기 변화', '어깨 위치 변화'],
      cva_min: 52,
      head_back: true,
      neck_angle_max: 30,
      hold_seconds: 8,
    },
    animation_id: 'thoracic_extension_anim',
  },
];

export async function seedExercises() {
  let inserted = 0;
  let updated = 0;

  for (const ex of exercises) {
    const result = await pool.query(
      `INSERT INTO exercises
         (name, target_problem, description, how_to, hold_time, repeat,
          key_points, mediapipe_check, animation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (name) DO UPDATE SET
         target_problem  = EXCLUDED.target_problem,
         description     = EXCLUDED.description,
         how_to          = EXCLUDED.how_to,
         hold_time       = EXCLUDED.hold_time,
         repeat          = EXCLUDED.repeat,
         key_points      = EXCLUDED.key_points,
         mediapipe_check = EXCLUDED.mediapipe_check,
         animation_id    = EXCLUDED.animation_id
       RETURNING (xmax = 0) AS inserted`,
      [
        ex.name,
        ex.target_problem,
        ex.description,
        JSON.stringify(ex.how_to),
        ex.hold_time,
        ex.repeat,
        JSON.stringify(ex.key_points),
        JSON.stringify(ex.mediapipe_check),
        ex.animation_id,
      ]
    );

    if (result.rows[0]?.inserted) inserted++;
    else updated++;
  }

  console.log(`[Seed] exercises: ${inserted}개 삽입, ${updated}개 업데이트`);
}
