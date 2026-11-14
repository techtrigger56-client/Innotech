import { Router } from 'express';
import { asyncHandler } from '../../lib/wrap-async.js';
import { execute } from '../../lib/sqlite.js';
import { sanitizeText, validateAstronautId, validateNumber } from '../../lib/validation.js';

const router = Router();

router.post('/:id/measurements', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const { heartRate, oxygenSaturation, respiratoryRate, sleepHours, stressLevel, fatigueLevel, mood } = req.body;

  const result = await execute(
    `INSERT INTO health_measurements (
      astronaut_id, timestamp, heart_rate, oxygen_saturation, respiratory_rate,
      sleep_hours, stress_level, fatigue_level, mood
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      astronautId,
      new Date().toISOString(),
      validateNumber(heartRate, 'Frequência cardíaca', 30, 220),
      validateNumber(oxygenSaturation, 'Saturação de oxigénio', 70, 100),
      validateNumber(respiratoryRate, 'Frequência respiratória', 6, 60),
      validateNumber(sleepHours, 'Horas de sono', 0, 24),
      validateNumber(stressLevel, 'Stress', 0, 10),
      validateNumber(fatigueLevel, 'Fadiga', 0, 10),
      sanitizeText(mood || 'Normal', 40)
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Medições registadas com sucesso.',
    id: result.lastID
  });
}));

export default router;
