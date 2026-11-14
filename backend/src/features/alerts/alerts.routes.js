import { Router } from 'express';
import { asyncHandler } from '../../lib/wrap-async.js';
import { queryAll } from '../../lib/sqlite.js';
import { validateAstronautId } from '../../lib/validation.js';

const router = Router();

router.get('/:id/alerts', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  const alerts = await queryAll(
    'SELECT * FROM alerts WHERE astronaut_id = ? ORDER BY created_at DESC LIMIT 100',
    [astronautId]
  );
  res.json(alerts);
}));

export default router;
