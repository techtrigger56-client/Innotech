import express from 'express';
import { configureSecurity } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import healthRoutes from './features/health/health.routes.js';
import astronautRoutes from './features/astronauts/astronauts.routes.js';
import measurementRoutes from './features/measurements/measurements.routes.js';
import checkinRoutes from './features/checkins/checkins.routes.js';
import alertRoutes from './features/alerts/alerts.routes.js';
import symptomRoutes from './features/symptoms/symptoms.routes.js';
import exerciseRoutes from './features/exercise/exercise.routes.js';
import historyRoutes from './features/history/history.routes.js';
import authRoutes from './features/auth/auth.routes.js';
import { authorizeAstronautAccess, requireAuth } from './features/auth/auth.middleware.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';

const app = express();

configureSecurity(app);
app.use(express.json({ limit: '1mb' }));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/astronauts', requireAuth, authorizeAstronautAccess, idempotencyMiddleware);
app.use('/api/astronauts', astronautRoutes);
app.use('/api/astronauts', measurementRoutes);
app.use('/api/astronauts', checkinRoutes);
app.use('/api/astronauts', alertRoutes);
app.use('/api/astronauts', symptomRoutes);
app.use('/api/astronauts', exerciseRoutes);
app.use('/api/astronauts', historyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
