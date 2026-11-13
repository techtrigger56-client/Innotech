import { Router } from 'express';
import { asyncHandler } from '../../lib/wrap-async.js';
import { execute, queryAll } from '../../lib/sqlite.js';
import { sanitizeText, validateAstronautId } from '../../lib/validation.js';

const router = Router();
const SYMPTOM_CATEGORIES = {
  headache: 'Dor de cabeça',
  dizziness: 'Tontura',
  nausea: 'Náusea',
  muscle_pain: 'Dor muscular',
  fatigue: 'Fadiga',
  breathing_difficulty: 'Dificuldade respiratória',
  other: 'Outro sintoma',
};

router.get('/:id/symptoms', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const symptoms = await queryAll(
    'SELECT * FROM symptoms WHERE astronaut_id = ? ORDER BY timestamp DESC LIMIT 100',
    [astronautId]
  );
  res.json(symptoms);
}));

router.post('/:id/symptoms', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const astronaut = await queryAll('SELECT id FROM astronauts WHERE id = ?', [astronautId]);
  const category = sanitizeText(req.body.category || 'other', 40);
  const title = sanitizeText(req.body.title, 80);
  const description = sanitizeText(req.body.description, 500);
  const severity = sanitizeText(req.body.severity || 'moderate', 20);
  const allowedSeverities = ['mild', 'moderate', 'severe'];

  if (!Object.hasOwn(SYMPTOM_CATEGORIES, category)) {
    const error = new Error('Selecione uma categoria de sintoma válida.');
    error.status = 400;
    throw error;
  }

  const symptomTitle = category === 'other' ? title : SYMPTOM_CATEGORIES[category];
  if (!symptomTitle) {
    const error = new Error('Descreva o outro sintoma a registar.');
    error.status = 400;
    throw error;
  }

  if (!astronaut.length) {
    const error = new Error('Astronauta não encontrado.');
    error.status = 404;
    throw error;
  }

  if (!allowedSeverities.includes(severity)) {
    const error = new Error('A gravidade deve ser ligeira, moderada ou elevada.');
    error.status = 400;
    throw error;
  }

  const result = await execute(
    `INSERT INTO symptoms (astronaut_id, timestamp, title, category, description, severity)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [astronautId, new Date().toISOString(), symptomTitle, category, description || null, severity]
  );

  res.status(201).json({ success: true, id: result.lastID });
}));

export default router;
