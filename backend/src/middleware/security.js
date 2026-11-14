import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { securityConfig } from '../config/security.js';

export function configureSecurity(app) {
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || securityConfig.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origem não autorizada pelo CORS.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Idempotency-Key']
    })
  );
  app.use(
    '/api/',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
    })
  );
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}
