import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb, type UserRow } from './db.js';

export const SESSION_COOKIE_NAME = 'fc_sid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || '47-cities-kenya-futuristic-proximity-secret-2026';
}

export interface AuthRequest extends Request {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userRow?: any;
  sessionId?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;

  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derivedBuf = crypto.scryptSync(password, salt, keyBuf.length);
    if (keyBuf.length !== derivedBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}

export function signSessionToken(sessionId: string): string {
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sessionId)
    .digest('base64url');
  return `${sessionId}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx <= 0) return null;

  const sessionId = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sessionId)
    .digest('base64url');

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return sessionId;
}

export function createSession(userId: string): {
  sessionId: string;
  signedToken: string;
  expiresAt: string;
} {
  const db = getDb();
  const sessionId = `sess-${crypto.randomUUID()}`;
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(sessionId, userId, createdAt, expiresAt);

  return {
    sessionId,
    signedToken: signSessionToken(sessionId),
    expiresAt,
  };
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function setSessionCookie(res: Response, sessionId: string): void {
  const signedToken = signSessionToken(sessionId);
  res.cookie(SESSION_COOKIE_NAME, signedToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

function extractSessionId(req: Request): string | null {
  const rawCookie = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof rawCookie === 'string' && rawCookie.length > 0) {
    const verified = verifySessionToken(rawCookie);
    if (verified) return verified;
  }

  const headerVal = req.headers['x-session-id'];
  if (typeof headerVal === 'string' && headerVal.trim().length > 0) {
    const trimmed = headerVal.trim();
    const verified = verifySessionToken(trimmed);
    return verified ?? trimmed;
  }

  return null;
}

export function attachSession(req: AuthRequest, _res: Response, next: NextFunction): void {
  const sessionId = extractSessionId(req);
  if (!sessionId) {
    next();
    return;
  }

  try {
    const db = getDb();
    const nowIso = new Date().toISOString();
    const session = db
      .prepare('SELECT id, user_id, expires_at FROM sessions WHERE id = ?')
      .get(sessionId) as { id: string; user_id: string; expires_at: string } | undefined;

    if (!session || session.expires_at <= nowIso) {
      if (session) {
        db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
      }
      next();
      return;
    }

    const userRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(session.user_id) as UserRow | undefined;

    if (userRow) {
      req.userRow = userRow;
      req.sessionId = session.id;
    }
  } catch (err) {
    console.error('[47 Cities auth] attachSession failed:', err);
  }

  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.userRow || !req.sessionId) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in with your email.',
    });
    return;
  }
  next();
}

export function requireActiveLocation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.userRow || !req.sessionId) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in with your email.',
    });
    return;
  }

  if (
    !req.userRow.location_active ||
    req.userRow.lat === null ||
    req.userRow.lat === undefined ||
    req.userRow.lng === null ||
    req.userRow.lng === undefined
  ) {
    res.status(403).json({
      error: 'LOCATION_REQUIRED',
      message:
        'Turn on your location to activate the portal and view nearby members or activity.',
    });
    return;
  }

  next();
}
