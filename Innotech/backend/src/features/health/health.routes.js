import { Router } from 'express';
import { asyncHandler } from '../../lib/wrap-async.js';

const router = Router();

router.get('/health', asyncHandler(async (req, res) => {
  res.json({
    status: 'ok',
    service: 'Innotech backend',
    timestamp: new Date().toISOString()
  });
}));

export default router;
