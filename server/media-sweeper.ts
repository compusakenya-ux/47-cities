import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import {
  IMAGE_TTL_SECONDS,
  MAX_SESSION_IMAGE_BYTES,
  type SessionImageBudget,
} from '../src/shared/types.js';

export const CHAT_IMAGES_DIR = path.resolve('uploads', 'chat-images');
export const VOICE_UPLOADS_DIR = path.resolve('uploads', 'voice');

export function ensureUploadDirs(): void {
  fs.mkdirSync(CHAT_IMAGES_DIR, { recursive: true });
  fs.mkdirSync(VOICE_UPLOADS_DIR, { recursive: true });
}

interface SessionImageRow {
  id: string;
  session_id: string;
  user_id: string;
  message_id: string | null;
  file_path: string;
  public_url: string;
  size_bytes: number;
  expires_at: string;
  created_at: string;
}

function safeDeleteFile(filePath: string | null | undefined): void {
  if (!filePath) return;
  try {
    const resolved = path.resolve(filePath);
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  } catch {
    // Best-effort physical cleanup; never crash sweeper on missing/locked file.
  }
}

/**
 * Deletes all session_images whose expires_at <= now:
 * - Removes physical files from uploads/chat-images/
 * - Updates matching chat_messages (image_url = NULL, text = '[Image expired & cleared]')
 * - Deletes the session_images rows
 * Returns the number of expired images cleared.
 */
export function sweepExpiredImages(): number {
  const db = getDb();
  const nowIso = new Date().toISOString();

  const expiredRows = db
    .prepare(
      `SELECT id, session_id, user_id, message_id, file_path, public_url, size_bytes, expires_at, created_at
       FROM session_images
       WHERE expires_at <= ?`
    )
    .all(nowIso) as unknown as SessionImageRow[];

  if (expiredRows.length === 0) {
    return 0;
  }

  const updateMsgById = db.prepare(
    `UPDATE chat_messages
     SET image_url = NULL,
         text = '[Image expired & cleared]'
     WHERE id = ?`
  );

  const updateMsgByUrl = db.prepare(
    `UPDATE chat_messages
     SET image_url = NULL,
         text = '[Image expired & cleared]'
     WHERE image_url = ?`
  );

  const deleteImageRow = db.prepare(`DELETE FROM session_images WHERE id = ?`);

  for (const row of expiredRows) {
    safeDeleteFile(row.file_path);

    if (row.message_id) {
      updateMsgById.run(row.message_id);
    } else if (row.public_url) {
      updateMsgByUrl.run(row.public_url);
    }

    deleteImageRow.run(row.id);
  }

  return expiredRows.length;
}

/**
 * Immediately purges ALL ephemeral chat images owned by a given session.
 * Called on logout, beforeunload beacon, and POST /api/chat/clear-session-images.
 */
export function purgeSessionImages(sessionId: string): number {
  if (!sessionId) return 0;

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, session_id, user_id, message_id, file_path, public_url, size_bytes, expires_at, created_at
       FROM session_images
       WHERE session_id = ?`
    )
    .all(sessionId) as unknown as SessionImageRow[];

  if (rows.length === 0) {
    return 0;
  }

  const updateMsgById = db.prepare(
    `UPDATE chat_messages
     SET image_url = NULL,
         text = '[Image cleared at session end]'
     WHERE id = ?`
  );

  const updateMsgByUrl = db.prepare(
    `UPDATE chat_messages
     SET image_url = NULL,
         text = '[Image cleared at session end]'
     WHERE image_url = ?`
  );

  const deleteBySession = db.prepare(
    `DELETE FROM session_images WHERE session_id = ?`
  );

  for (const row of rows) {
    safeDeleteFile(row.file_path);

    if (row.message_id) {
      updateMsgById.run(row.message_id);
    } else if (row.public_url) {
      updateMsgByUrl.run(row.public_url);
    }
  }

  deleteBySession.run(sessionId);
  return rows.length;
}

/**
 * Sweeps any expired images first, then computes the live 20 MB session image budget.
 */
export function getSessionImageBudget(sessionId: string): SessionImageBudget {
  sweepExpiredImages();

  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(size_bytes), 0) AS used_bytes,
              COUNT(*) AS active_count
       FROM session_images
       WHERE session_id = ?`
    )
    .get(sessionId) as unknown as
    | { used_bytes: number; active_count: number }
    | undefined;

  const usedBytes = Number(row?.used_bytes ?? 0);
  const activeImageCount = Number(row?.active_count ?? 0);
  const remainingBytes = Math.max(0, MAX_SESSION_IMAGE_BYTES - usedBytes);

  return {
    usedBytes,
    maxBytes: MAX_SESSION_IMAGE_BYTES,
    remainingBytes,
    activeImageCount,
    ttlSeconds: IMAGE_TTL_SECONDS,
  };
}

/**
 * Starts the 30-second background sweeper with .unref() so Vitest / CLI exits cleanly.
 */
export function startMediaSweeper(): NodeJS.Timeout {
  ensureUploadDirs();
  try {
    sweepExpiredImages();
  } catch {
    // DB might not be initialized yet in edge cases; interval will pick it up.
  }

  const timer = setInterval(() => {
    try {
      sweepExpiredImages();
    } catch {
      // Keep sweeper resilient across DB resets in tests.
    }
  }, 30_000);

  timer.unref();
  return timer;
}
