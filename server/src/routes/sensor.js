import { Router } from 'express';
import pool from '../db/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// GET /api/sensor  — 연결된 센서 조회
// ────────────────────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM sensors WHERE user_id = $1',
    [req.user.id]
  );
  res.json({ sensor: rows[0] ?? null });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sensor/connect  — 센서 연결 저장
// body: { deviceName, deviceId, battery }
// ────────────────────────────────────────────────────────────────────────────
router.post('/connect', authenticate, async (req, res) => {
  const { deviceName, deviceId, battery } = req.body;
  if (!deviceName || !deviceId)
    return res.status(400).json({ message: '기기 정보가 필요합니다.' });

  const { rows } = await pool.query(
    `INSERT INTO sensors (user_id, device_name, device_id, battery, connected, connected_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET device_name  = EXCLUDED.device_name,
           device_id    = EXCLUDED.device_id,
           battery      = EXCLUDED.battery,
           connected    = TRUE,
           connected_at = NOW(),
           updated_at   = NOW()
     RETURNING *`,
    [req.user.id, deviceName, deviceId, battery ?? null]
  );
  res.json({ sensor: rows[0] });
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/sensor  — 센서 연결 해제
// ────────────────────────────────────────────────────────────────────────────
router.delete('/', authenticate, async (req, res) => {
  await pool.query(
    `UPDATE sensors SET connected = FALSE, updated_at = NOW() WHERE user_id = $1`,
    [req.user.id]
  );
  res.json({ message: '센서 연결이 해제되었습니다.' });
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/sensor/battery  — 배터리 상태 업데이트
// body: { battery }
// ────────────────────────────────────────────────────────────────────────────
router.patch('/battery', authenticate, async (req, res) => {
  const { battery } = req.body;
  if (battery === undefined) return res.status(400).json({ message: 'battery 값이 필요합니다.' });

  const { rows } = await pool.query(
    `UPDATE sensors SET battery = $1, updated_at = NOW()
     WHERE user_id = $2 RETURNING *`,
    [battery, req.user.id]
  );
  res.json({ sensor: rows[0] ?? null });
});

export default router;
