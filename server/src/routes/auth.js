import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pool from '../db/database.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import { authenticate } from '../middleware/authenticate.js';

dotenv.config();

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'baro-dev-secret';

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, level: user.level },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function safeUser(row) {
  return { id: row.id, name: row.name, email: row.email, level: row.level };
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/send-verification
// ────────────────────────────────────────────────────────────────────────────
router.post('/send-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: '이메일을 입력해주세요.' });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    'UPDATE verification_codes SET used = TRUE WHERE email = $1 AND used = FALSE',
    [email]
  );
  await pool.query(
    'INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
    [email, code, expiresAt]
  );

  sendVerificationEmail(email, code).catch(console.error);

  res.json({ message: '인증번호가 전송되었습니다.' });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-code
// ────────────────────────────────────────────────────────────────────────────
router.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ message: '이메일과 인증번호를 입력해주세요.' });

  const { rows } = await pool.query(
    `SELECT id FROM verification_codes
     WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [email, code]
  );

  if (rows.length === 0)
    return res.status(400).json({ message: '잘못된 인증번호이거나 만료되었습니다.' });

  await pool.query('UPDATE verification_codes SET used = TRUE WHERE id = $1', [rows[0].id]);

  res.json({ message: '인증이 완료되었습니다.' });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
  if (password.length < 8)
    return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' });

  // 이메일 인증 완료 여부 확인
  const { rows: verified } = await pool.query(
    'SELECT id FROM verification_codes WHERE email = $1 AND used = TRUE LIMIT 1',
    [email]
  );
  if (verified.length === 0)
    return res.status(400).json({ message: '이메일 인증을 먼저 완료해주세요.' });

  const { rows: existing } = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );
  if (existing.length > 0)
    return res.status(409).json({ message: '이미 가입된 이메일입니다.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [name, email, passwordHash]
  );

  const user = rows[0];
  const token = signToken(user);

  res.status(201).json({ token, user: safeUser(user) });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length === 0)
    return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });

  const token = signToken(user);
  res.json({ token, user: safeUser(user) });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  (인증 필요)
// ────────────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, level FROM users WHERE id = $1',
    [req.user.id]
  );
  if (rows.length === 0)
    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  res.json({ user: rows[0] });
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/me  (프로필 수정, 인증 필요)
// ────────────────────────────────────────────────────────────────────────────
router.patch('/me', authenticate, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: '이름을 입력해주세요.' });

  const { rows } = await pool.query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, level',
    [name, req.user.id]
  );
  res.json({ user: rows[0] });
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/password  (비밀번호 변경, 인증 필요)
// body: { currentPassword, newPassword }
// ────────────────────────────────────────────────────────────────────────────
router.patch('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
  if (newPassword.length < 8)
    return res.status(400).json({ message: '새 비밀번호는 8자 이상이어야 합니다.' });

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (rows.length === 0)
    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid)
    return res.status(401).json({ message: '현재 비밀번호가 올바르지 않습니다.' });

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

  res.json({ message: '비밀번호가 변경되었습니다.' });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: '이메일을 입력해주세요.' });

  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

  if (rows.length > 0) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [rows[0].id]
    );
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [rows[0].id, token, expiresAt]
    );

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;
    sendPasswordResetEmail(email, resetUrl).catch(console.error);
  }

  res.json({ message: '입력한 이메일로 재설정 링크를 전송했습니다.' });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// body: { token, newPassword }
// ────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ message: '토큰과 새 비밀번호를 입력해주세요.' });
  if (newPassword.length < 8)
    return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' });

  const { rows } = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
    [token]
  );

  if (rows.length === 0)
    return res.status(400).json({ message: '유효하지 않거나 만료된 링크입니다.' });

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, rows[0].user_id]);
  await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [rows[0].id]);

  res.json({ message: '비밀번호가 재설정되었습니다.' });
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/me  (회원 탈퇴, 인증 필요)
// ────────────────────────────────────────────────────────────────────────────
router.delete('/me', authenticate, async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
  res.json({ message: '계정이 삭제되었습니다.' });
});

export default router;
