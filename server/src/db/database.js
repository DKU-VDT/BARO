import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// 테이블 초기화 (앱 시작 시 한 번 실행)
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      email        TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      level        INTEGER DEFAULT 1,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL,
      code       TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      push_enabled  BOOLEAN DEFAULT TRUE,
      sound_enabled BOOLEAN DEFAULT TRUE,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sensors (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      device_name  TEXT,
      device_id    TEXT,
      battery      INTEGER,
      connected    BOOLEAN DEFAULT FALSE,
      connected_at TIMESTAMPTZ,
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id               SERIAL PRIMARY KEY,
      name             TEXT UNIQUE NOT NULL,
      target_problem   TEXT NOT NULL,
      description      TEXT NOT NULL,
      how_to           JSONB NOT NULL DEFAULT '[]',
      hold_time        TEXT,
      repeat           TEXT,
      key_points       JSONB NOT NULL DEFAULT '[]',
      mediapipe_check  JSONB NOT NULL DEFAULT '{}',
      animation_id     TEXT,
      image_url        TEXT,
      pose_data        JSONB,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_exercise_history (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      exercise_id  INTEGER REFERENCES exercises(id),
      problem_type TEXT,
      completed    BOOLEAN DEFAULT FALSE,
      started_at   TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // 기존 테이블에 누락된 컬럼 추가 (마이그레이션)
  await pool.query(`
    ALTER TABLE exercises
      ADD COLUMN IF NOT EXISTS animation_id TEXT,
      ADD COLUMN IF NOT EXISTS image_url    TEXT,
      ADD COLUMN IF NOT EXISTS pose_data    JSONB;
  `);

  console.log('[DB] 테이블 초기화 완료');
}

export default pool;
