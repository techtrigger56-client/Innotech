import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { execute, queryAll } from '../../lib/sqlite.js';

const scrypt = promisify(scryptCallback);
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const dummyPasswordHash = hashPassword('ahms-invalid-account-timing-value');

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, saltHex, keyHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) {
    return false;
  }

  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  await execute('DELETE FROM auth_sessions WHERE expires_at <= ?', [new Date().toISOString()]);
  await execute(
    'INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, hashSessionToken(token), expiresAt]
  );
  return { token, expiresAt };
}

export async function getSessionUser(token) {
  if (!token) return null;

  const rows = await queryAll(
    `SELECT users.id, users.email, users.role, users.astronaut_id AS astronautId,
            auth_sessions.id AS sessionId, auth_sessions.expires_at AS expiresAt
     FROM auth_sessions
     JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.token_hash = ?
     LIMIT 1`,
    [hashSessionToken(token)]
  );

  const user = rows[0];
  const expiration = user ? new Date(user.expiresAt).getTime() : NaN;
  if (!user || !Number.isFinite(expiration) || expiration <= Date.now()) {
    if (user) await execute('DELETE FROM auth_sessions WHERE id = ?', [user.sessionId]);
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    astronautId: user.astronautId,
    sessionId: user.sessionId,
  };
}

export async function authenticateUser(email, password) {
  const rows = await queryAll(
    'SELECT id, email, password_hash, role, astronaut_id AS astronautId FROM users WHERE email = ? COLLATE NOCASE LIMIT 1',
    [email]
  );
  const user = rows[0];
  const passwordMatches = await verifyPassword(
    password,
    user ? user.password_hash : await dummyPasswordHash
  );

  if (!user || !passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    astronautId: user.astronautId,
  };
}

export async function revokeSession(sessionId) {
  await execute('DELETE FROM auth_sessions WHERE id = ?', [sessionId]);
}
