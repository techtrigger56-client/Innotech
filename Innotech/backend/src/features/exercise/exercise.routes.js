import { Router } from 'express';
import { asyncHandler } from '../../lib/wrap-async.js';
import { execute, queryAll } from '../../lib/sqlite.js';
import { sanitizeText, validateAstronautId, validateNumber } from '../../lib/validation.js';

const router = Router();
const allowedIntensities = ['low', 'moderate', 'high'];

router.get('/:id/exercises/summary', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const days = req.query.days === undefined ? 7 : Number(req.query.days);
  if (![7, 30].includes(days)) {
    const error = new Error('O período deve ser de 7 ou 30 dias.');
    error.status = 400;
    throw error;
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const [summary] = await queryAll(
    `SELECT COUNT(*) AS sessions,
            COALESCE(SUM(duration_minutes), 0) AS totalMinutes,
            ROUND(AVG(duration_minutes), 1) AS averageDurationMinutes,
            COUNT(DISTINCT substr(timestamp, 1, 10)) AS activeDays
     FROM exercise_records
     WHERE astronaut_id = ? AND timestamp >= ? AND timestamp <= ?`,
    [astronautId, start.toISOString(), end.toISOString()]
  );
  res.json({ days, ...summary });
}));

router.get('/:id/exercises', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const exercises = await queryAll(
    'SELECT * FROM exercise_records WHERE astronaut_id = ? ORDER BY timestamp DESC LIMIT 100',
    [astronautId]
  );
  res.json(exercises);
}));

router.post('/:id/exercises', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const astronaut = await queryAll('SELECT id FROM astronauts WHERE id = ?', [astronautId]);
  const activityType = sanitizeText(req.body.activityType, 80);
  const intensity = sanitizeText(req.body.intensity, 20);
  const durationMinutes = validateNumber(req.body.durationMinutes, 'Duração', 1, 600);
  const fatigueAfter = req.body.fatigueAfter === undefined || req.body.fatigueAfter === null || req.body.fatigueAfter === ''
    ? null
    : validateNumber(req.body.fatigueAfter, 'Fadiga após exercício', 0, 10);
  const notes = sanitizeText(req.body.notes, 500);

  if (!activityType) {
    const error = new Error('Indique o tipo de exercício.');
    error.status = 400;
    throw error;
  }

  if (!astronaut.length) {
    const error = new Error('Astronauta não encontrado.');
    error.status = 404;
    throw error;
  }

  if (!Number.isInteger(durationMinutes)) {
    const error = new Error('A duração deve ser indicada em minutos inteiros.');
    error.status = 400;
    throw error;
  }

  if (!allowedIntensities.includes(intensity)) {
    const error = new Error('A intensidade deve ser baixa, moderada ou alta.');
    error.status = 400;
    throw error;
  }

  const result = await execute(
    `INSERT INTO exercise_records (
      astronaut_id, timestamp, activity_type, duration_minutes, intensity, fatigue_after, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      astronautId,
      new Date().toISOString(),
      activityType,
      durationMinutes,
      intensity,
      fatigueAfter,
      notes || null
    ]
  );

  res.status(201).json({ success: true, id: result.lastID });
}));

export default router;
