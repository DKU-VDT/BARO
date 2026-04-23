import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './db/database.js';
import { seedExercises } from './db/seed.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import sensorRouter from './routes/sensor.js';
import exercisesRouter from './routes/exercises.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/sensor', sensorRouter);
app.use('/api/exercises', exercisesRouter);

initDB()
  .then(() => seedExercises())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[BARO Server] http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[DB] 연결 실패:', err.message);
    process.exit(1);
  });
