import { getSessionUser, SESSION_DURATION_MS } from './auth.service.js';

const SESSION_COOKIE = process.env.NODE_ENV === 'production'
  ? '__Host-ahms_session'
  : 'ahms_session';

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export async function requireAuth(request, response, next) {
  try {
    const token = readCookie(request, SESSION_COOKIE);
    const user = await getSessionUser(token);
    if (!user) {
      response.status(401).json({ error: 'Sessão inválida ou expirada. Inicie sessão novamente.' });
      return;
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function authorizeAstronautAccess(request, response, next) {
  if (request.method !== 'GET' && request.user.role !== 'astronaut') {
    response.status(403).json({ error: 'A área Mission Control tem acesso de consulta apenas.' });
    return;
  }

  const pathMatch = request.originalUrl.match(/^\/api\/astronauts\/([^/?]+)/);
  let astronautId = null;
  if (pathMatch) {
    try {
      astronautId = decodeURIComponent(pathMatch[1]);
    } catch {
      response.status(400).json({ error: 'Identificador do astronauta inválido.' });
      return;
    }
  }
  if (request.user.role === 'astronaut' &&
      astronautId &&
      request.user.astronautId !== astronautId) {
    response.status(403).json({ error: 'Não tem permissão para aceder aos dados deste astronauta.' });
    return;
  }

  next();
}

export function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_MS,
  });
}

export function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}
