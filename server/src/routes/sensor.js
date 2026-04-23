import { Router } from 'express';
import pool from '../db/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// GET /api/sensor  — 현재 연결된 센서 조회
// ────────────────────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, device_name, device_id, connected, connected_at, updated_at
       FROM sensors
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({ sensor: rows[0] ?? null });
  } catch (error) {
    console.error('GET /api/sensor error:', error);
    res.status(500).json({ message: '센서 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sensor/connect  — 센서 연결 저장
// body: { deviceName, deviceId }
// ────────────────────────────────────────────────────────────────────────────
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { deviceName, deviceId } = req.body;

    if (!deviceName || !deviceId) {
      return res.status(400).json({ message: 'deviceName과 deviceId가 필요합니다.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO sensors (
          user_id,
          device_name,
          device_id,
          connected,
          connected_at,
          updated_at
        )
        VALUES ($1, $2, $3, TRUE, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET device_name  = EXCLUDED.device_name,
            device_id    = EXCLUDED.device_id,
            connected    = TRUE,
            connected_at = NOW(),
            updated_at   = NOW()
        RETURNING id, user_id, device_name, device_id, connected, connected_at, updated_at`,
      [req.user.id, deviceName, deviceId]
    );

    res.json({ sensor: rows[0] });
  } catch (error) {
    console.error('POST /api/sensor/connect error:', error);
    res.status(500).json({ message: '센서 연결 저장 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/sensor  — 센서 연결 해제
// ────────────────────────────────────────────────────────────────────────────
router.delete('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE sensors
       SET connected = FALSE,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, user_id, device_name, device_id, connected, connected_at, updated_at`,
      [req.user.id]
    );

    res.json({
      message: '센서 연결이 해제되었습니다.',
      sensor: rows[0] ?? null,
    });
  } catch (error) {
    console.error('DELETE /api/sensor error:', error);
    res.status(500).json({ message: '센서 연결 해제 중 오류가 발생했습니다.' });
  }
});

export default router;