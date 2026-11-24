import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Response } from 'express';
import multer from 'multer';
import {
  AGE_RANGES,
  GENDERS,
  HATE_WITH_PASSION_OPTIONS,
  INTERESTED_IN_OPTIONS,
  KENYA_COUNTIES,
  LOOKING_FOR_OPTIONS,
  makeAvatarSvg,
} from '../../src/shared/kenya-data.js';
import type {
  AgeRange,
  Gender,
  HateWithPassionOption,
  InterestedIn,
  LookingForOption,
} from '../../src/shared/types.js';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthRequest,
} from '../auth.js';
import { getDb, type UserRow } from '../db.js';
import { getDevInbox, sendVerificationEmail } from '../email.js';
import { toPrivateUserProfile } from '../geo.js';
import { purgeSessionImages } from '../media-sweeper.js';

export const authRouter = Router();
export const profileRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const AVATAR_PALETTES: ReadonlyArray<[string, string]> = [
  ['#F59E0B', '#F43F5E'],
  ['#06B6D4', '#10B981'],
  ['#EC4899', '#8B5CF6'],
  ['#F59E0B', '#06B6D4'],
  ['#10B981', '#2563EB'],
  ['#A855F7', '#F43F5E'],
];

const avatarsDir = path.resolve('uploads/avatars');

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(avatarsDir, { recursive: true });
    cb(null, avatarsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const safeExt = /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '.png';
    cb(null, `avatar-${crypto.randomUUID()}${safeExt}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_AVATAR_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile photos.'));
    }
  },
});

function generateSixDigitCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function defaultAvatarForNickname(nickname: string): string {
  const words = nickname.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`
      : nickname.trim().slice(0, 2) || '47';
  const hash = crypto.createHash('sha256').update(nickname).digest()[0] ?? 0;
  const [c1, c2] = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
  return makeAvatarSvg(initials, c1, c2);
}

function sanitizeSelectionArray<T extends string>(
  input: unknown,
  allowed: readonly T[]
): T[] | null {
  if (!Array.isArray(input)) return null;
  const allowedSet = new Set<string>(allowed);
  const result: T[] = [];
  for (const item of input) {
    if (typeof item !== 'string' || !allowedSet.has(item)) {
      return null;
    }
    if (!result.includes(item as T)) {
      result.push(item as T);
    }
  }
  return result;
}

function createEmailCode(email: string, purpose: 'verify' | 'reset'): string {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const code = generateSixDigitCode();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();

  db.prepare(
    `UPDATE email_codes SET used = 1 WHERE email = ? AND purpose = ? AND used = 0`
  ).run(normalized, purpose);

  db.prepare(
    `INSERT INTO email_codes (id, email, code, purpose, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(`code-${crypto.randomUUID()}`, normalized, code, purpose, expiresAt, createdAt);

  return code;
}

// ============================================================================
// POST /api/auth/register (Strictly Email-Only + Mandatory 18+ Disclaimer)
// ============================================================================
authRouter.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body ?? {};
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    const gender = body.gender as Gender;
    const ageRange = body.ageRange as AgeRange;
    const interestedIn = body.interestedIn as InterestedIn;
    const hasChildren = body.hasChildren;
    const homeCounty = typeof body.homeCounty === 'string' ? body.homeCounty.trim() : '';
    const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 280) : '';
    const avatarUrl =
      typeof body.avatarUrl === 'string' && body.avatarUrl.trim().length > 0
        ? body.avatarUrl.trim()
        : '';

    const confirmedAdult = body.confirmedAdult;
    const acceptedResponsibility = body.acceptedResponsibility;
    const signature = typeof body.signature === 'string' ? body.signature.trim() : '';

    // 1. Mandatory 18+ & personal responsibility disclaimer check
    if (
      confirmedAdult !== true ||
      acceptedResponsibility !== true ||
      signature.length < 2
    ) {
      res.status(400).json({
        error: 'DISCLAIMER_REQUIRED',
        message:
          'You must confirm you are above 18 years old, accept full responsibility for your actions and/or omissions, and sign the privacy disclaimer.',
      });
      return;
    }

    // 2. Strict email-only validation
    if (!EMAIL_REGEX.test(rawEmail)) {
      res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'A valid email address is required. Registration is email-only.',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    if (nickname.length < 2 || nickname.length > 32) {
      res.status(400).json({
        error: 'INVALID_NICKNAME',
        message: 'User Name / App Name must be between 2 and 32 characters.',
      });
      return;
    }

    if (!GENDERS.includes(gender)) {
      res.status(400).json({
        error: 'INVALID_GENDER',
        message: 'Gender must be Man or Woman.',
      });
      return;
    }

    if (!AGE_RANGES.includes(ageRange)) {
      res.status(400).json({
        error: 'INVALID_AGE_RANGE',
        message: 'Please select a valid age range (20-22 through 41-50).',
      });
      return;
    }

    if (!INTERESTED_IN_OPTIONS.includes(interestedIn)) {
      res.status(400).json({
        error: 'INVALID_INTERESTED_IN',
        message: 'Interested In must be Men, Women, or Both.',
      });
      return;
    }

    if (typeof hasChildren !== 'boolean') {
      res.status(400).json({
        error: 'INVALID_HAS_CHILDREN',
        message: 'Please indicate whether you have child(ren) (Yes/No).',
      });
      return;
    }

    if (!KENYA_COUNTIES.includes(homeCounty)) {
      res.status(400).json({
        error: 'INVALID_HOME_COUNTY',
        message: 'Please select one of the 47 Kenyan counties.',
      });
      return;
    }

    const lookingFor = sanitizeSelectionArray<LookingForOption>(
      body.lookingFor,
      LOOKING_FOR_OPTIONS
    );
    if (!lookingFor || lookingFor.length < 1) {
      res.status(400).json({
        error: 'INVALID_LOOKING_FOR',
        message: 'Select at least one valid "Looking For" option.',
      });
      return;
    }

    const hateWithPassion = sanitizeSelectionArray<HateWithPassionOption>(
      body.hateWithPassion,
      HATE_WITH_PASSION_OPTIONS
    );
    if (!hateWithPassion || hateWithPassion.length < 1) {
      res.status(400).json({
        error: 'INVALID_HATE_WITH_PASSION',
        message: 'Select at least one valid "Hate With Passion" option.',
      });
      return;
    }

    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(rawEmail) as { id: string } | undefined;

    if (existing) {
      res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email address already exists.',
      });
      return;
    }

    const userId = `user-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const passwordHash = hashPassword(password);
    const finalAvatar = avatarUrl || defaultAvatarForNickname(nickname);

    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, email_verified, nickname, avatar_url,
        gender, age_range, interested_in, has_children, home_county,
        looking_for_json, hate_with_passion_json, bio,
        disclaimer_signed, disclaimer_signed_at, disclaimer_signature,
        location_active, lat, lng, active_city_label,
        is_online, last_active_at, created_at
      ) VALUES (
        ?, ?, ?, 0, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        1, ?, ?,
        0, NULL, NULL, NULL,
        0, ?, ?
      )`
    ).run(
      userId,
      rawEmail,
      passwordHash,
      nickname,
      finalAvatar,
      gender,
      ageRange,
      interestedIn,
      hasChildren ? 1 : 0,
      homeCounty,
      JSON.stringify(lookingFor),
      JSON.stringify(hateWithPassion),
      bio,
      nowIso,
      signature,
      nowIso,
      nowIso
    );

    const code = createEmailCode(rawEmail, 'verify');
    await sendVerificationEmail(rawEmail, code, 'verify');

    res.status(201).json({
      ok: true,
      email: rawEmail,
      verificationRequired: true,
    });
  } catch (err) {
    console.error('[47 Cities auth] register error:', err);
    res.status(500).json({
      error: 'REGISTER_FAILED',
      message: 'Could not complete registration. Please try again.',
    });
  }
});

// ============================================================================
// GET /api/auth/dev-inbox
// ============================================================================
authRouter.get('/dev-inbox', (req: AuthRequest, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email : undefined;
  const messages = getDevInbox(email);
  res.json({ messages });
});

// ============================================================================
// POST /api/auth/resend-code
// ============================================================================
authRouter.post('/resend-code', async (req: AuthRequest, res: Response) => {
  try {
    const rawEmail =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const purpose: 'verify' | 'reset' =
      req.body?.purpose === 'reset' ? 'reset' : 'verify';

    if (!EMAIL_REGEX.test(rawEmail)) {
      res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Please provide a valid email address.',
      });
      return;
    }

    const db = getDb();
    const user = db
      .prepare('SELECT id, email FROM users WHERE email = ?')
      .get(rawEmail) as { id: string; email: string } | undefined;

    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'No account found for that email address.',
      });
      return;
    }

    const code = createEmailCode(rawEmail, purpose);
    await sendVerificationEmail(rawEmail, code, purpose);

    res.json({ ok: true, email: rawEmail, purpose });
  } catch (err) {
    console.error('[47 Cities auth] resend-code error:', err);
    res.status(500).json({
      error: 'RESEND_FAILED',
      message: 'Could not send verification code.',
    });
  }
});

// ============================================================================
// POST /api/auth/verify-email
// ============================================================================
authRouter.post('/verify-email', (req: AuthRequest, res: Response) => {
  const rawEmail =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

  if (!EMAIL_REGEX.test(rawEmail) || !/^\d{6}$/.test(code)) {
    res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Please provide your email and the 6-digit verification code.',
    });
    return;
  }

  const db = getDb();
  const nowIso = new Date().toISOString();

  const codeRow = db
    .prepare(
      `SELECT id FROM email_codes
       WHERE email = ? AND code = ? AND purpose = 'verify' AND used = 0 AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(rawEmail, code, nowIso) as { id: string } | undefined;

  if (!codeRow) {
    res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Verification code is invalid or has expired.',
    });
    return;
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(rawEmail) as UserRow | undefined;

  if (!user) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'Account not found.',
    });
    return;
  }

  db.prepare('UPDATE email_codes SET used = 1 WHERE id = ?').run(codeRow.id);
  db.prepare('UPDATE users SET email_verified = 1, last_active_at = ? WHERE id = ?').run(
    nowIso,
    user.id
  );

  const updatedUser = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(user.id) as unknown as UserRow;

  const { sessionId } = createSession(updatedUser.id);
  setSessionCookie(res, sessionId);

  res.json({
    ok: true,
    user: toPrivateUserProfile(updatedUser),
  });
});

// ============================================================================
// POST /api/auth/login
// ============================================================================
authRouter.post('/login', (req: AuthRequest, res: Response) => {
  const rawEmail =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!EMAIL_REGEX.test(rawEmail) || !password) {
    res.status(400).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Email and password are required.',
    });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(rawEmail) as UserRow | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
    return;
  }

  if (!user.email_verified) {
    res.status(403).json({
      error: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address before signing in.',
      email: user.email,
    });
    return;
  }

  const nowIso = new Date().toISOString();
  db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(nowIso, user.id);
  const refreshed = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(user.id) as unknown as UserRow;

  const { sessionId } = createSession(refreshed.id);
  setSessionCookie(res, sessionId);

  res.json({
    ok: true,
    user: toPrivateUserProfile(refreshed),
  });
});

// ============================================================================
// POST /api/auth/logout (Purges Session Images + Deactivates Location)
// ============================================================================
authRouter.post('/logout', (req: AuthRequest, res: Response) => {
  let clearedImages = 0;

  if (req.sessionId) {
    try {
      clearedImages = purgeSessionImages(req.sessionId);
    } catch (err) {
      console.error('[47 Cities auth] purgeSessionImages on logout failed:', err);
    }

    if (req.userRow) {
      const db = getDb();
      const nowIso = new Date().toISOString();
      db.prepare(
        `UPDATE users
         SET is_online = 0, location_active = 0, last_active_at = ?
         WHERE id = ?`
      ).run(nowIso, req.userRow.id);
    }

    deleteSession(req.sessionId);
  }

  clearSessionCookie(res);
  res.json({ ok: true, clearedImages });
});

// ============================================================================
// POST /api/auth/forgot-password & POST /api/auth/reset-password
// ============================================================================
authRouter.post('/forgot-password', async (req: AuthRequest, res: Response) => {
  try {
    const rawEmail =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!EMAIL_REGEX.test(rawEmail)) {
      res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.',
      });
      return;
    }

    const db = getDb();
    const user = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(rawEmail) as { id: string } | undefined;

    if (user) {
      const code = createEmailCode(rawEmail, 'reset');
      await sendVerificationEmail(rawEmail, code, 'reset');
    }

    res.json({
      ok: true,
      message:
        'If an account exists for that email, a 6-digit password reset code has been sent.',
    });
  } catch (err) {
    console.error('[47 Cities auth] forgot-password error:', err);
    res.status(500).json({
      error: 'RESET_REQUEST_FAILED',
      message: 'Could not process password reset request.',
    });
  }
});

authRouter.post('/reset-password', (req: AuthRequest, res: Response) => {
  const rawEmail =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const newPassword =
    typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!EMAIL_REGEX.test(rawEmail) || !/^\d{6}$/.test(code)) {
    res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Valid email and 6-digit reset code are required.',
    });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({
      error: 'WEAK_PASSWORD',
      message: 'New password must be at least 6 characters long.',
    });
    return;
  }

  const db = getDb();
  const nowIso = new Date().toISOString();

  const codeRow = db
    .prepare(
      `SELECT id FROM email_codes
       WHERE email = ? AND code = ? AND purpose = 'reset' AND used = 0 AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(rawEmail, code, nowIso) as { id: string } | undefined;

  if (!codeRow) {
    res.status(400).json({
      error: 'INVALID_CODE',
      message: 'Password reset code is invalid or expired.',
    });
    return;
  }

  const user = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(rawEmail) as { id: string } | undefined;

  if (!user) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'Account not found.',
    });
    return;
  }

  db.prepare('UPDATE email_codes SET used = 1 WHERE id = ?').run(codeRow.id);
  db.prepare(
    `UPDATE users SET password_hash = ?, email_verified = 1, last_active_at = ? WHERE id = ?`
  ).run(hashPassword(newPassword), nowIso, user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  res.json({
    ok: true,
    message: 'Password reset successfully. You can now sign in.',
  });
});

// ============================================================================
// GET /api/auth/me (Session hydration probe — returns 200 with null user when unauthenticated)
// ============================================================================
authRouter.get('/me', (req: AuthRequest, res: Response) => {
  if (!req.userRow || !req.sessionId) {
    res.json({ authenticated: false, user: null });
    return;
  }
  res.json({ authenticated: true, user: toPrivateUserProfile(req.userRow) });
});

// ============================================================================
// PATCH /api/profile (Update Own Private Profile)
// ============================================================================
profileRouter.patch('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.userRow!;
  const body = req.body ?? {};

  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (body.nickname !== undefined) {
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    if (nickname.length < 2 || nickname.length > 32) {
      res.status(400).json({
        error: 'INVALID_NICKNAME',
        message: 'Nickname must be between 2 and 32 characters.',
      });
      return;
    }
    updates.push('nickname = ?');
    params.push(nickname);
  }

  if (body.avatarUrl !== undefined) {
    const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : '';
    if (!avatarUrl || avatarUrl.length > 2_500_000) {
      res.status(400).json({
        error: 'INVALID_AVATAR',
        message: 'Invalid avatar image URL or payload.',
      });
      return;
    }
    updates.push('avatar_url = ?');
    params.push(avatarUrl);
  }

  if (body.gender !== undefined) {
    if (!GENDERS.includes(body.gender)) {
      res.status(400).json({ error: 'INVALID_GENDER', message: 'Invalid gender.' });
      return;
    }
    updates.push('gender = ?');
    params.push(body.gender);
  }

  if (body.ageRange !== undefined) {
    if (!AGE_RANGES.includes(body.ageRange)) {
      res.status(400).json({ error: 'INVALID_AGE_RANGE', message: 'Invalid age range.' });
      return;
    }
    updates.push('age_range = ?');
    params.push(body.ageRange);
  }

  if (body.interestedIn !== undefined) {
    if (!INTERESTED_IN_OPTIONS.includes(body.interestedIn)) {
      res.status(400).json({
        error: 'INVALID_INTERESTED_IN',
        message: 'Invalid Interested In selection.',
      });
      return;
    }
    updates.push('interested_in = ?');
    params.push(body.interestedIn);
  }

  if (body.hasChildren !== undefined) {
    if (typeof body.hasChildren !== 'boolean') {
      res.status(400).json({
        error: 'INVALID_HAS_CHILDREN',
        message: 'hasChildren must be a boolean.',
      });
      return;
    }
    updates.push('has_children = ?');
    params.push(body.hasChildren ? 1 : 0);
  }

  if (body.homeCounty !== undefined) {
    const county = typeof body.homeCounty === 'string' ? body.homeCounty.trim() : '';
    if (!KENYA_COUNTIES.includes(county)) {
      res.status(400).json({
        error: 'INVALID_HOME_COUNTY',
        message: 'Please select a valid Kenyan county.',
      });
      return;
    }
    updates.push('home_county = ?');
    params.push(county);
  }

  if (body.lookingFor !== undefined) {
    const lf = sanitizeSelectionArray<LookingForOption>(
      body.lookingFor,
      LOOKING_FOR_OPTIONS
    );
    if (!lf || lf.length < 1) {
      res.status(400).json({
        error: 'INVALID_LOOKING_FOR',
        message: 'Select at least one valid Looking For option.',
      });
      return;
    }
    updates.push('looking_for_json = ?');
    params.push(JSON.stringify(lf));
  }

  if (body.hateWithPassion !== undefined) {
    const hwp = sanitizeSelectionArray<HateWithPassionOption>(
      body.hateWithPassion,
      HATE_WITH_PASSION_OPTIONS
    );
    if (!hwp || hwp.length < 1) {
      res.status(400).json({
        error: 'INVALID_HATE_WITH_PASSION',
        message: 'Select at least one valid Hate With Passion option.',
      });
      return;
    }
    updates.push('hate_with_passion_json = ?');
    params.push(JSON.stringify(hwp));
  }

  if (body.bio !== undefined) {
    const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 280) : '';
    updates.push('bio = ?');
    params.push(bio);
  }

  const db = getDb();
  const nowIso = new Date().toISOString();
  updates.push('last_active_at = ?');
  params.push(nowIso);
  params.push(user.id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(user.id) as unknown as UserRow;

  res.json({ user: toPrivateUserProfile(updated) });
});

// ============================================================================
// POST /api/profile/avatar (Multipart upload <= 2MB OR JSON { avatarUrl })
// ============================================================================
function maybeMultipartAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const contentType = req.headers['content-type'] || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        const isTooLarge =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
        res.status(isTooLarge ? 413 : 400).json({
          error: isTooLarge ? 'AVATAR_TOO_LARGE' : 'AVATAR_UPLOAD_ERROR',
          message: isTooLarge
            ? 'Profile photo must be 2 MB or smaller.'
            : err.message || 'Invalid profile photo upload.',
        });
        return;
      }
      next();
    });
    return;
  }
  next();
}

profileRouter.post(
  '/avatar',
  requireAuth,
  maybeMultipartAvatar,
  (req: AuthRequest, res: Response) => {
    const user = req.userRow!;
    let nextAvatarUrl: string | null = null;

    if (req.file) {
      nextAvatarUrl = `/uploads/avatars/${req.file.filename}`;
    } else if (typeof req.body?.avatarUrl === 'string') {
      const raw = req.body.avatarUrl.trim();
      if (
        (raw.startsWith('data:image/') || raw.startsWith('/uploads/')) &&
        raw.length <= 2_800_000
      ) {
        nextAvatarUrl = raw;
      }
    }

    if (!nextAvatarUrl) {
      res.status(400).json({
        error: 'INVALID_AVATAR',
        message: 'Provide an image file upload ("avatar") or a valid image data URL.',
      });
      return;
    }

    const db = getDb();
    const nowIso = new Date().toISOString();
    db.prepare('UPDATE users SET avatar_url = ?, last_active_at = ? WHERE id = ?').run(
      nextAvatarUrl,
      nowIso,
      user.id
    );

    const updated = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(user.id) as unknown as UserRow;

    res.json({ user: toPrivateUserProfile(updated) });
  }
);
