import { Router } from 'express';
import OpenAI from 'openai';
import pool from '../db/database.js';
import { authenticate } from '../middleware/authenticate.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const router = Router();

// 전체 운동 목록
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exercises ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 문제 유형에 맞는 운동 추천
// GET /api/exercises/recommend?problem=forward_head_posture&user_id=1
router.get('/recommend', async (req, res) => {
  const { problem } = req.query;
  if (!problem) {
    return res.status(400).json({ message: 'problem 파라미터가 필요합니다.' });
  }

  try {
    // 1. 해당 문제에 맞는 운동 후보 조회
    const candidates = await pool.query(
      'SELECT * FROM exercises WHERE target_problem = $1 ORDER BY id',
      [problem]
    );

    if (candidates.rows.length === 0) {
      // 매칭 없으면 가장 기본 운동 반환
      const fallback = await pool.query(
        'SELECT * FROM exercises ORDER BY id LIMIT 1'
      );
      return res.json(fallback.rows[0] ?? null);
    }

    // 2. 최근 1시간 내 수행한 운동 제외 (user_id 있을 때)
    const userId = req.query.user_id ? parseInt(req.query.user_id) : null;
    if (userId && candidates.rows.length > 1) {
      const recent = await pool.query(
        `SELECT exercise_id FROM user_exercise_history
         WHERE user_id = $1
           AND started_at > NOW() - INTERVAL '1 hour'`,
        [userId]
      );
      const recentIds = new Set(recent.rows.map(r => r.exercise_id));
      const fresh = candidates.rows.filter(e => !recentIds.has(e.id));
      if (fresh.length > 0) return res.json(fresh[0]);
    }

    res.json(candidates.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 운동별 3D 포즈 데이터 생성 (캐시 우선)
router.get('/pose/:id', async (req, res) => {
  const { id } = req.params;
  const { refresh } = req.query; // ?refresh=1 이면 재생성

  try {
    const result = await pool.query('SELECT * FROM exercises WHERE id = $1', [id]);
    if (!result.rows[0]) return res.status(404).json({ message: '운동을 찾을 수 없습니다.' });

    const exercise = result.rows[0];

    // 캐시된 포즈 반환 (재생성 요청 없을 때)
    if (exercise.pose_data && !refresh) {
      return res.json(exercise.pose_data);
    }

    // 운동별 정점 자세 상세 묘사
    const PEAK_DESCRIPTIONS = {
      chin_tuck: `PEAK POSITION: The character is sitting upright. The chin is pulled STRAIGHT BACK horizontally (like making a double chin), NOT tilted up or down. The ears move backward relative to the shoulders. The back of the neck lengthens. The gaze remains level forward. Only the neck and head move — the rest of the body stays completely still.
      PRIMARY MOVEMENT: neck retracts backward (negative x on Neck and Head bones, -22 to -30 degrees).`,

      neck_side_stretch: `PEAK POSITION: The character tilts their head to the RIGHT side, bringing the right ear toward the right shoulder. The left side of the neck is visibly stretched. The chin stays level (no rotation). The left shoulder stays down and relaxed. The tilt is approximately 30-35 degrees from vertical.
      PRIMARY MOVEMENT: lateral tilt right (positive z on Neck +30 to +35, Head +20 to +25 degrees).`,

      neck_flexion: `PEAK POSITION: The character drops the chin toward the chest. The back of the neck stretches. The head bows forward significantly, about 40-50 degrees from neutral. The shoulders stay relaxed and down. The upper back may round slightly.
      PRIMARY MOVEMENT: forward flexion (positive x on Neck +35 to +45, Head +25 to +35 degrees).`,

      shoulder_roll: `PEAK POSITION: The character has rolled their shoulders BACKWARD and UP in a circular motion. At the peak, both shoulders are raised and pulled back — the shoulder blades squeeze together. The arms hang slightly behind the torso line with elbows bent slightly back. Upper chest is open.
      PRIMARY MOVEMENT: both arms swept backward (positive x on LeftArm +30 to +40, RightArm +30 to +40) with slight backward lean on Spine2 (-10 to -15 x).`,

      scapular_retraction: `PEAK POSITION: The character squeezes their shoulder blades together behind their back. The elbows are pulled backward and outward, like trying to hold a pencil between the shoulder blades. The chest opens forward. The spine extends slightly. Arms form a "W" shape behind the torso.
      PRIMARY MOVEMENT: elbows back (LeftArm x +25 to +35, z +35 to +45; RightArm x +25 to +35, z -35 to -45) and upper back extension (Spine2 x -12 to -20).`,

      thoracic_extension: `PEAK POSITION: The character arches their upper back BACKWARD over an imaginary support (like the top of a chair back). The chest opens upward and forward. The upper spine curves into extension. The head tilts back slightly following the spine. The lower back stays neutral. This is a clear backward arch of the thoracic spine.
      PRIMARY MOVEMENT: upper back extension (Spine2 x -25 to -35, Spine1 x -12 to -18) with head following (Neck x -10 to -15, Head x -5 to -10).`,
    };

    const peakDesc = PEAK_DESCRIPTIONS[exercise.name] || `Show the peak held position of: ${exercise.description}`;

    const prompt = `You are a biomechanics expert generating Mixamo skeleton bone rotations for a 3D therapeutic exercise animation.

Exercise: ${exercise.name}
${peakDesc}

ROTATION AXIS CONVENTIONS (Mixamo, seated character facing +Z):
- x axis: sagittal plane  (positive x = nod/lean FORWARD, negative x = tilt BACKWARD)
- y axis: axial rotation  (positive y = rotate RIGHT, negative y = rotate LEFT)
- z axis: lateral plane   (positive z = lean to the RIGHT, negative z = lean to the LEFT)

RULES:
1. Bones NOT involved in this exercise must be exactly [0, 0, 0].
2. Bones that DO move must meet the minimum degree ranges described above.
3. Values are OFFSETS from T-pose — they will be added on top of the rest rotation.

Respond with ONLY this JSON, no explanation:
{
  "mixamorigSpine": [x, y, z],
  "mixamorigSpine1": [x, y, z],
  "mixamorigSpine2": [x, y, z],
  "mixamorigNeck": [x, y, z],
  "mixamorigHead": [x, y, z],
  "mixamorigLeftShoulder": [x, y, z],
  "mixamorigRightShoulder": [x, y, z],
  "mixamorigLeftArm": [x, y, z],
  "mixamorigRightArm": [x, y, z]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const poseData = JSON.parse(completion.choices[0].message.content);

    // DB에 캐싱
    await pool.query('UPDATE exercises SET pose_data = $1 WHERE id = $2', [
      JSON.stringify(poseData),
      id,
    ]);

    res.json(poseData);
  } catch (err) {
    console.error('[Pose] 생성 실패:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// 운동 수행 기록 저장 (인증 필요)
router.post('/history', authenticate, async (req, res) => {
  const { exercise_id, problem_type, completed } = req.body;
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO user_exercise_history
         (user_id, exercise_id, problem_type, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        user_id,
        exercise_id,
        problem_type,
        completed ?? false,
        completed ? new Date() : null,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
