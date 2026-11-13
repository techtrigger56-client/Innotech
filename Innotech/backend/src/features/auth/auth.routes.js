import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/wrap-async.js';
import { authenticateUser, createSession, revokeSession } from './auth.service.js';
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
} from './auth.middleware.js';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de início de sessão. Tente novamente mais tarde.' },
});

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    astronautId: user.astronautId,
  };
}

router.post('/login', loginLimiter, asyncHandler(async (request, response) => {
  const { email, password } = request.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' ||
      email.length > 254 || password.length === 0 || password.length > 256) {
    response.status(400).json({ error: 'Indique um e-mail e uma palavra-passe válidos.' });
    return;
  }

  const user = await authenticateUser(email.trim(), password);
  if (!user) {
    response.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }

  const session = await createSession(user.id);
  setSessionCookie(response, session.token);
  response.json({ user: publicUser(user), expiresAt: session.expiresAt });
}));

router.get('/me', requireAuth, (request, response) => {
  response.json({ user: publicUser(request.user) });
});

router.post('/logout', requireAuth, asyncHandler(async (request, response) => {
  await revokeSession(request.user.sessionId);
  clearSessionCookie(response);
  response.status(204).end();
}));

export default router;
