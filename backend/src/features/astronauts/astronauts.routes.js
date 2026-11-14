import { Router } from 'express';
import { queryAll } from '../../lib/sqlite.js';
import { asyncHandler } from '../../lib/wrap-async.js';
import { validateAstronautId } from '../../lib/validation.js';
import { getHealthSummary } from '../measurements/measurements.service.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const astronauts = req.user.role === 'mission-control'
    ? await queryAll("SELECT * FROM astronauts WHERE role = 'astronaut' ORDER BY name ASC")
    : await queryAll(
      "SELECT * FROM astronauts WHERE role = 'astronaut' AND id = ? ORDER BY name ASC",
      [req.user.astronautId]
    );
  res.json(astronauts);
}));

router.get('/:id/summary', asyncHandler(async (req, res) => {
  const astronautId = validateAstronautId(req.params.id);
  res.json(await getHealthSummary(astronautId));
}));

export default router;
