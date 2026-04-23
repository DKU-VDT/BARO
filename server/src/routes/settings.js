import { Router } from 'express';
import pool from '../db/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// 설정이 없으면 기본값으로 자동 생성하는 헬퍼
async function getOrCreateSettings(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );
  if (rows.length > 0) return rows[0];

  const { rows: created } = await pool.query(
    `INSERT INTO user_settings (user_id, push_enabled, sound_enabled)
     VALUES ($1, TRUE, TRUE) RETURNING *`,
    [userId]
  );
  return created[0];
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/settings  — 내 설정 조회
// ────────────────────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const settings = await getOrCreateSettings(req.user.id);
  res.json({ settings });
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/settings  — 설정 저장
// body: { pushEnabled?, soundEnabled? }
// ────────────────────────────────────────────────────────────────────────────
router.patch('/', authenticate, async (req, res) => {
  const { pushEnabled, soundEnabled } = req.body;
  await getOrCreateSettings(req.user.id);

  const { rows } = await pool.query(
    `UPDATE user_settings
     SET push_enabled  = COALESCE($1, push_enabled),
         sound_enabled = COALESCE($2, sound_enabled),
         updated_at    = NOW()
     WHERE user_id = $3
     RETURNING *`,
    [
      pushEnabled  !== undefined ? pushEnabled  : null,
      soundEnabled !== undefined ? soundEnabled : null,
      req.user.id,
    ]
  );
  res.json({ settings: rows[0] });
});

export default router;
