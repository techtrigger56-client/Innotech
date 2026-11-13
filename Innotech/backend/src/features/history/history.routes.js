import { Router } from 'express';
import { asyncHandler } from '../../lib/wrap-async.js';
import { queryAll } from '../../lib/sqlite.js';
import { validateAstronautId } from '../../lib/validation.js';

const router = Router();
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInteger(value, fallback, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    const error = new Error(`${label} deve ser um número inteiro entre 1 e ${maximum}.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

router.get('/:id/history', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const page = parsePositiveInteger(req.query.page, 1, 'A página');
  const pageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, 'O tamanho da página', MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) {
    const error = new Error('A página solicitada está fora do intervalo permitido.');
    error.status = 400;
    throw error;
  }

  const [countRow] = await queryAll(
    `SELECT COUNT(*) AS total FROM (
      SELECT id FROM health_measurements WHERE astronaut_id = ?
      UNION ALL SELECT id FROM alerts WHERE astronaut_id = ?
      UNION ALL SELECT id FROM symptoms WHERE astronaut_id = ?
      UNION ALL SELECT id FROM exercise_records WHERE astronaut_id = ?
    )`,
    [astronautId, astronautId, astronautId, astronautId]
  );
  const items = await queryAll(
    `SELECT id, kind, occurred_at AS occurredAt, title, description, severity, level
     FROM (
       SELECT
         CAST(id AS TEXT) AS id,
         'measurement' AS kind,
         timestamp AS occurred_at,
         'Medição de acompanhamento' AS title,
         TRIM(
           COALESCE(CASE WHEN heart_rate IS NOT NULL THEN 'Frequência cardíaca: ' || heart_rate || ' bpm · ' END, '') ||
           COALESCE(CASE WHEN oxygen_saturation IS NOT NULL THEN 'Saturação de oxigénio: ' || oxygen_saturation || ' % · ' END, '') ||
           COALESCE(CASE WHEN respiratory_rate IS NOT NULL THEN 'Frequência respiratória: ' || respiratory_rate || '/min · ' END, '') ||
           COALESCE(CASE WHEN sleep_hours IS NOT NULL THEN 'Sono: ' || sleep_hours || ' h · ' END, '') ||
           COALESCE(CASE WHEN stress_level IS NOT NULL THEN 'Stress: ' || stress_level || '/10 · ' END, '') ||
           COALESCE(CASE WHEN fatigue_level IS NOT NULL THEN 'Fadiga: ' || fatigue_level || '/10 · ' END, '') ||
           COALESCE(CASE WHEN isolation_level IS NOT NULL THEN 'Isolamento: ' || isolation_level || '/10 · ' END, '') ||
           COALESCE(CASE WHEN concentration_level IS NOT NULL THEN 'Concentração: ' || concentration_level || '/10 · ' END, '') ||
           COALESCE(CASE WHEN motivation_level IS NOT NULL THEN 'Motivação: ' || motivation_level || '/10 · ' END, '') ||
           COALESCE(CASE WHEN sleep_quality IS NOT NULL THEN 'Qualidade do sono: ' || sleep_quality || '/10 · ' END, '') ||
           COALESCE(CASE WHEN mood IS NOT NULL THEN 'Humor: ' || mood END, ''),
           ' ·'
         ) AS description,
         NULL AS severity,
         NULL AS level
       FROM health_measurements WHERE astronaut_id = ?
       UNION ALL
       SELECT CAST(id AS TEXT), 'alert', created_at, title, description, NULL, level
       FROM alerts WHERE astronaut_id = ?
       UNION ALL
       SELECT CAST(id AS TEXT), 'symptom', timestamp, title, description, severity, NULL
       FROM symptoms WHERE astronaut_id = ?
       UNION ALL
       SELECT
         CAST(id AS TEXT),
         'exercise',
         timestamp,
         activity_type,
         CAST(duration_minutes AS TEXT) || ' min · intensidade ' || intensity ||
           CASE WHEN fatigue_after IS NOT NULL THEN ' · fadiga após exercício ' || fatigue_after || '/10' ELSE '' END ||
           CASE WHEN notes IS NOT NULL AND notes != '' THEN ' · ' || notes ELSE '' END,
         NULL,
         NULL
       FROM exercise_records WHERE astronaut_id = ?
     )
     ORDER BY occurred_at DESC, kind ASC, CAST(id AS INTEGER) DESC
     LIMIT ? OFFSET ?`,
    [astronautId, astronautId, astronautId, astronautId, pageSize, offset]
  );

  res.json({
    page,
    pageSize,
    total: countRow.total,
    totalPages: Math.ceil(countRow.total / pageSize),
    items,
  });
}));

export default router;
