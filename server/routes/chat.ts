import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { getDb } from '../db.js';
import {
  requireActiveLocation,
  requireAuth,
  type AuthRequest,
} from '../auth.js';
import { canAccessMember, toPublicMemberProfile } from '../geo.js';
import {
  CHAT_IMAGES_DIR,
  VOICE_UPLOADS_DIR,
  ensureUploadDirs,
  getSessionImageBudget,
  purgeSessionImages,
  sweepExpiredImages,
} from '../media-sweeper.js';
import { checkPositivity, mineChatInterests } from '../ai/chat-miner.js';
import {
  IMAGE_TTL_SECONDS,
  MAX_SESSION_IMAGE_BYTES,
  type ChatMessage,
  type ChatMessageType,
  type ChatThread,
} from '../../src/shared/types.js';

export const chatRouter = Router();

ensureUploadDirs();

export function makeThreadId(userA: string, userB: string): string {
  return [userA, userB].sort().join('__');
}

interface ChatMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  receiver_id: string;
  type: string;
  text: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  image_url: string | null;
  image_size_bytes: number | null;
  image_expires_at: string | null;
  session_id: string | null;
  created_at: string;
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    type: row.type as ChatMessageType,
    text: row.text ?? null,
    audioUrl: row.audio_url ?? null,
    audioDurationSec:
      row.audio_duration_sec !== null && row.audio_duration_sec !== undefined
        ? Number(row.audio_duration_sec)
        : null,
    imageUrl: row.image_url ?? null,
    imageSizeBytes:
      row.image_size_bytes !== null && row.image_size_bytes !== undefined
        ? Number(row.image_size_bytes)
        : null,
    imageExpiresAt: row.image_expires_at ?? null,
    createdAt: row.created_at,
  };
}

function findUserRow(userId: string): Record<string, any> | undefined {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(userId) as Record<string, any> | undefined;
}

function safeUnlink(filePath: string | undefined): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup errors
  }
}

function extensionFromMime(mime: string, fallback: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes('png')) return '.png';
  if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg';
  if (lower.includes('webp')) return '.webp';
  if (lower.includes('gif')) return '.gif';
  if (lower.includes('svg')) return '.svg';
  if (lower.includes('wav')) return '.wav';
  if (lower.includes('mpeg') || lower.includes('mp3')) return '.mp3';
  if (lower.includes('ogg')) return '.ogg';
  if (lower.includes('mp4') || lower.includes('m4a')) return '.m4a';
  if (lower.includes('webm')) return '.webm';
  return fallback;
}

function parseDataUrl(
  dataUrl: string
): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  try {
    const mime = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    return { mime, buffer };
  } catch {
    return null;
  }
}

// Multer storage for voice notes (max 5 MB)
const voiceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, VOICE_UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext =
      path.extname(file.originalname) ||
      extensionFromMime(file.mimetype || '', '.webm');
    cb(null, `voice-${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const uploadVoice = multer({
  storage: voiceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'video/webm'
    ) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_AUDIO_TYPE'));
    }
  },
});

// Multer storage for ephemeral chat images (temp file written to disk, checked against 20 MB session budget)
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, CHAT_IMAGES_DIR);
  },
  filename: (_req, file, cb) => {
    const ext =
      path.extname(file.originalname) ||
      extensionFromMime(file.mimetype || '', '.jpg');
    cb(null, `img-${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  // Allow slightly above 20 MB so our handler can return 413 SESSION_IMAGE_LIMIT_EXCEEDED with budget details
  limits: { fileSize: MAX_SESSION_IMAGE_BYTES + 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_IMAGE_TYPE'));
    }
  },
});

function maybeMultipart(
  uploader: (req: Request, res: Response, next: NextFunction) => void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      uploader(req, res, (err: unknown) => {
        if (!err) {
          next();
          return;
        }
        const authReq = req as AuthRequest;
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          const budget = authReq.sessionId
            ? getSessionImageBudget(authReq.sessionId)
            : undefined;
          res.status(413).json({
            error: 'SESSION_IMAGE_LIMIT_EXCEEDED',
            message: 'Uploaded file exceeds the allowed size limit.',
            budget,
          });
          return;
        }
        const msg = err instanceof Error ? err.message : 'Upload failed';
        if (msg === 'INVALID_IMAGE_TYPE') {
          res.status(400).json({
            error: 'INVALID_IMAGE_TYPE',
            message: 'Only image files are allowed.',
          });
          return;
        }
        if (msg === 'INVALID_AUDIO_TYPE') {
          res.status(400).json({
            error: 'INVALID_AUDIO_TYPE',
            message: 'Only audio files are allowed for voice notes.',
          });
          return;
        }
        res.status(400).json({ error: 'UPLOAD_FAILED', message: msg });
      });
      return;
    }
    next();
  };
}

// ============================================================================
// Session Image Budget & Purge Endpoints
// ============================================================================

chatRouter.get('/image-budget', requireAuth, (req: AuthRequest, res: Response) => {
  const sessionId = req.sessionId || `user-${req.userRow!.id}`;
  const budget = getSessionImageBudget(sessionId);
  res.json({ budget });
});

chatRouter.post(
  '/clear-session-images',
  requireAuth,
  (req: AuthRequest, res: Response) => {
    const sessionId = req.sessionId || `user-${req.userRow!.id}`;
    const clearedCount = purgeSessionImages(sessionId);
    const budget = getSessionImageBudget(sessionId);
    res.json({ ok: true, clearedCount, budget });
  }
);

// ============================================================================
// Threads & Messages Endpoints (Strict Auth + 10 km Proximity Gate)
// ============================================================================

chatRouter.get(
  '/threads',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const sessionId = req.sessionId || `user-${me.id}`;
    const budget = getSessionImageBudget(sessionId);
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT *
         FROM chat_messages
         WHERE sender_id = ? OR receiver_id = ?
         ORDER BY created_at DESC`
      )
      .all(me.id, me.id) as unknown as ChatMessageRow[];

    const latestByPeer = new Map<string, ChatMessageRow>();
    for (const row of rows) {
      const peerId = row.sender_id === me.id ? row.receiver_id : row.sender_id;
      if (!latestByPeer.has(peerId)) {
        latestByPeer.set(peerId, row);
      }
    }

    const threads: ChatThread[] = [];
    for (const [peerId, lastRow] of latestByPeer.entries()) {
      const peerRow = findUserRow(peerId);
      if (!peerRow) continue;
      if (!canAccessMember(me, peerRow).allowed) continue;

      threads.push({
        threadId: lastRow.thread_id,
        peer: toPublicMemberProfile(peerRow),
        lastMessage: toChatMessage(lastRow),
        unreadCount: 0,
        updatedAt: lastRow.created_at,
      });
    }

    res.json({ threads, budget });
  }
);

chatRouter.get(
  '/messages/:peerId',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const peerId = String(req.params.peerId || '').trim();
    const peerRow = findUserRow(peerId);

    if (!peerRow || peerRow.id === me.id) {
      res.status(404).json({
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
      });
      return;
    }

    const access = canAccessMember(me, peerRow);
    if (!access.allowed) {
      res.status(403).json({
        error: 'PROFILE_RESTRICTED',
        message:
          access.reason ||
          'You can only chat with compatible members within 10 km.',
      });
      return;
    }

    sweepExpiredImages();
    const sessionId = req.sessionId || `user-${me.id}`;
    const budget = getSessionImageBudget(sessionId);
    const threadId = makeThreadId(me.id, peerRow.id);

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT *
         FROM chat_messages
         WHERE thread_id = ?
         ORDER BY created_at ASC`
      )
      .all(threadId) as unknown as ChatMessageRow[];

    res.json({
      threadId,
      peer: toPublicMemberProfile(peerRow),
      messages: rows.map(toChatMessage),
      budget,
    });
  }
);

chatRouter.post(
  '/messages/:peerId/text',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const peerId = String(req.params.peerId || '').trim();
    const peerRow = findUserRow(peerId);

    if (!peerRow || peerRow.id === me.id) {
      res.status(404).json({
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
      });
      return;
    }

    const access = canAccessMember(me, peerRow);
    if (!access.allowed) {
      res.status(403).json({
        error: 'PROFILE_RESTRICTED',
        message:
          access.reason ||
          'You can only message compatible members within 10 km.',
      });
      return;
    }

    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!rawText) {
      res.status(400).json({
        error: 'EMPTY_MESSAGE',
        message: 'Please enter a message before sending.',
      });
      return;
    }
    if (rawText.length > 2000) {
      res.status(400).json({
        error: 'MESSAGE_TOO_LONG',
        message: 'Message must be 2000 characters or fewer.',
      });
      return;
    }

    const positivity = checkPositivity(rawText);
    if (!positivity.allowed) {
      res.status(400).json({
        error: 'COMMUNITY_SAFETY_FILTER',
        message: positivity.reason,
      });
      return;
    }

    const db = getDb();
    const id = `msg-${crypto.randomUUID()}`;
    const threadId = makeThreadId(me.id, peerRow.id);
    const createdAt = new Date().toISOString();
    const sessionId = req.sessionId || null;

    db.prepare(
      `INSERT INTO chat_messages (
         id, thread_id, sender_id, receiver_id, type, text,
         audio_url, audio_duration_sec, image_url, image_size_bytes, image_expires_at,
         session_id, created_at
       ) VALUES (?, ?, ?, ?, 'text', ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`
    ).run(id, threadId, me.id, peerRow.id, rawText, sessionId, createdAt);

    // Dynamically evolve user's behind-the-hood interest vector from chat
    const extractedTopics = mineChatInterests(me.id, rawText, 1.8);

    const savedRow = db
      .prepare(`SELECT * FROM chat_messages WHERE id = ?`)
      .get(id) as unknown as ChatMessageRow;

    res.status(201).json({
      message: toChatMessage(savedRow),
      extractedTopics,
    });
  }
);

chatRouter.post(
  '/messages/:peerId/voice',
  requireAuth,
  requireActiveLocation,
  maybeMultipart(uploadVoice.single('audio')),
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const peerId = String(req.params.peerId || '').trim();
    const peerRow = findUserRow(peerId);

    if (!peerRow || peerRow.id === me.id) {
      safeUnlink(req.file?.path);
      res.status(404).json({
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
      });
      return;
    }

    const access = canAccessMember(me, peerRow);
    if (!access.allowed) {
      safeUnlink(req.file?.path);
      res.status(403).json({
        error: 'PROFILE_RESTRICTED',
        message:
          access.reason ||
          'You can only send voice notes to compatible members within 10 km.',
      });
      return;
    }

    let audioUrl: string | null = null;
    let durationSec = Number(req.body?.durationSec ?? req.body?.duration ?? 0);
    if (!Number.isFinite(durationSec) || durationSec < 0) durationSec = 0;
    durationSec = Math.min(300, Math.round(durationSec));

    if (req.file) {
      audioUrl = `/uploads/voice/${path.basename(req.file.path)}`;
    } else if (typeof req.body?.audioDataUrl === 'string') {
      const parsed = parseDataUrl(req.body.audioDataUrl);
      if (!parsed || parsed.buffer.length === 0) {
        res.status(400).json({
          error: 'INVALID_AUDIO_PAYLOAD',
          message: 'Invalid audio data URL provided.',
        });
        return;
      }
      if (parsed.buffer.length > 5 * 1024 * 1024) {
        res.status(413).json({
          error: 'VOICE_TOO_LARGE',
          message: 'Voice notes must be 5 MB or smaller.',
        });
        return;
      }
      ensureUploadDirs();
      const ext = extensionFromMime(parsed.mime, '.wav');
      const fileName = `voice-${Date.now()}-${crypto.randomUUID()}${ext}`;
      const fullPath = path.join(VOICE_UPLOADS_DIR, fileName);
      fs.writeFileSync(fullPath, parsed.buffer);
      audioUrl = `/uploads/voice/${fileName}`;
    } else {
      res.status(400).json({
        error: 'AUDIO_REQUIRED',
        message: 'Attach an audio file or provide audioDataUrl.',
      });
      return;
    }

    const db = getDb();
    const id = `msg-${crypto.randomUUID()}`;
    const threadId = makeThreadId(me.id, peerRow.id);
    const createdAt = new Date().toISOString();
    const sessionId = req.sessionId || null;

    db.prepare(
      `INSERT INTO chat_messages (
         id, thread_id, sender_id, receiver_id, type, text,
         audio_url, audio_duration_sec, image_url, image_size_bytes, image_expires_at,
         session_id, created_at
       ) VALUES (?, ?, ?, ?, 'voice', NULL, ?, ?, NULL, NULL, NULL, ?, ?)`
    ).run(
      id,
      threadId,
      me.id,
      peerRow.id,
      audioUrl,
      durationSec || 2,
      sessionId,
      createdAt
    );

    const savedRow = db
      .prepare(`SELECT * FROM chat_messages WHERE id = ?`)
      .get(id) as unknown as ChatMessageRow;

    res.status(201).json({ message: toChatMessage(savedRow) });
  }
);

chatRouter.post(
  '/messages/:peerId/image',
  requireAuth,
  requireActiveLocation,
  maybeMultipart(uploadImage.single('image')),
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const sessionId = req.sessionId || `user-${me.id}`;
    const peerId = String(req.params.peerId || '').trim();
    const peerRow = findUserRow(peerId);

    if (!peerRow || peerRow.id === me.id) {
      safeUnlink(req.file?.path);
      res.status(404).json({
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
      });
      return;
    }

    const access = canAccessMember(me, peerRow);
    if (!access.allowed) {
      safeUnlink(req.file?.path);
      res.status(403).json({
        error: 'PROFILE_RESTRICTED',
        message:
          access.reason ||
          'You can only share images with compatible members within 10 km.',
      });
      return;
    }

    // Check current 20 MB session budget before finalizing file
    const currentBudget = getSessionImageBudget(sessionId);

    let filePath = '';
    let publicUrl = '';
    let sizeBytes = 0;

    if (req.file) {
      filePath = req.file.path;
      sizeBytes = req.file.size;
      publicUrl = `/uploads/chat-images/${path.basename(filePath)}`;
    } else if (typeof req.body?.imageDataUrl === 'string') {
      const parsed = parseDataUrl(req.body.imageDataUrl);
      if (!parsed || !parsed.mime.startsWith('image/') || parsed.buffer.length === 0) {
        res.status(400).json({
          error: 'INVALID_IMAGE_PAYLOAD',
          message: 'Please provide a valid image file or imageDataUrl.',
        });
        return;
      }
      sizeBytes = parsed.buffer.length;

      if (currentBudget.usedBytes + sizeBytes > MAX_SESSION_IMAGE_BYTES) {
        res.status(413).json({
          error: 'SESSION_IMAGE_LIMIT_EXCEEDED',
          message:
            '20 MB session image limit reached. Clear images or wait for expiry.',
          budget: currentBudget,
        });
        return;
      }

      ensureUploadDirs();
      const rawName =
        typeof req.body?.fileName === 'string' ? req.body.fileName : '';
      const ext =
        path.extname(rawName) || extensionFromMime(parsed.mime, '.png');
      const fileName = `img-${Date.now()}-${crypto.randomUUID()}${ext}`;
      filePath = path.join(CHAT_IMAGES_DIR, fileName);
      fs.writeFileSync(filePath, parsed.buffer);
      publicUrl = `/uploads/chat-images/${fileName}`;
    } else {
      res.status(400).json({
        error: 'IMAGE_REQUIRED',
        message: 'Attach an image file or provide imageDataUrl.',
      });
      return;
    }

    if (currentBudget.usedBytes + sizeBytes > MAX_SESSION_IMAGE_BYTES) {
      safeUnlink(filePath);
      res.status(413).json({
        error: 'SESSION_IMAGE_LIMIT_EXCEEDED',
        message:
          '20 MB session image limit reached. Clear images or wait for expiry.',
        budget: currentBudget,
      });
      return;
    }

    const db = getDb();
    const messageId = `msg-${crypto.randomUUID()}`;
    const imageRowId = `simg-${crypto.randomUUID()}`;
    const threadId = makeThreadId(me.id, peerRow.id);
    const nowMs = Date.now();
    const createdAt = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + IMAGE_TTL_SECONDS * 1000).toISOString();
    const caption =
      typeof req.body?.caption === 'string' && req.body.caption.trim()
        ? req.body.caption.trim().slice(0, 280)
        : null;

    db.prepare(
      `INSERT INTO chat_messages (
         id, thread_id, sender_id, receiver_id, type, text,
         audio_url, audio_duration_sec, image_url, image_size_bytes, image_expires_at,
         session_id, created_at
       ) VALUES (?, ?, ?, ?, 'image', ?, NULL, NULL, ?, ?, ?, ?, ?)`
    ).run(
      messageId,
      threadId,
      me.id,
      peerRow.id,
      caption,
      publicUrl,
      sizeBytes,
      expiresAt,
      sessionId,
      createdAt
    );

    db.prepare(
      `INSERT INTO session_images (
         id, session_id, user_id, message_id, file_path, public_url, size_bytes, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      imageRowId,
      sessionId,
      me.id,
      messageId,
      filePath,
      publicUrl,
      sizeBytes,
      expiresAt,
      createdAt
    );

    const savedRow = db
      .prepare(`SELECT * FROM chat_messages WHERE id = ?`)
      .get(messageId) as unknown as ChatMessageRow;

    const updatedBudget = getSessionImageBudget(sessionId);

    res.status(201).json({
      message: toChatMessage(savedRow),
      budget: updatedBudget,
    });
  }
);
