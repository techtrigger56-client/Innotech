import { Router } from 'express';
import { asyncHandler } from '../../lib/wrap-async.js';
import { execute } from '../../lib/sqlite.js';
import {
  sanitizeText,
  validateAstronautId,
  validateNumber,
  validateOptionalNumber,
} from '../../lib/validation.js';

const router = Router();

router.post('/:id/checkin', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const {
    sleepHours,
    stressLevel,
    fatigueLevel,
    isolationLevel,
    concentrationLevel,
    motivationLevel,
    sleepQuality,
    mood,
    note,
  } = req.body;
  const timestamp = new Date().toISOString();
  const sanitizedNote = sanitizeText(note, 500);
  const sanitizedMood = sanitizeText(mood || 'Normal', 40);
  const allowedMoods = ['Normal', 'Bom', 'Razoável', 'Baixo'];

  if (!allowedMoods.includes(sanitizedMood)) {
    const error = new Error('Selecione um humor válido.');
    error.status = 400;
    throw error;
  }

  const result = await execute(
    `INSERT INTO health_measurements (
      astronaut_id, timestamp, sleep_hours, stress_level, fatigue_level,
      isolation_level, concentration_level, motivation_level, sleep_quality, mood
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      astronautId,
      timestamp,
      validateNumber(sleepHours, 'Horas de sono', 0, 24),
      validateNumber(stressLevel, 'Stress', 0, 10),
      validateNumber(fatigueLevel, 'Fadiga', 0, 10),
      validateOptionalNumber(isolationLevel, 'Isolamento', 0, 10),
      validateOptionalNumber(concentrationLevel, 'Concentração', 0, 10),
      validateOptionalNumber(motivationLevel, 'Motivação', 0, 10),
      validateOptionalNumber(sleepQuality, 'Qualidade do sono', 0, 10),
      sanitizedMood
    ]
  );

  if (sanitizedNote) {
    await execute(
      'INSERT INTO symptoms (astronaut_id, timestamp, title, description, severity) VALUES (?, ?, ?, ?, ?)',
      [astronautId, timestamp, 'Observação do check-in', sanitizedNote, 'moderate']
    );
  }

  res.status(201).json({
    success: true,
    message: 'Check-in registado com sucesso.',
    id: result.lastID
  });
}));

export default router;
