import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type { DevEmailMessage } from '../src/shared/types.js';
import { getDb } from './db.js';

function shouldRecordDevInbox(): boolean {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_INBOX === 'false') {
    return false;
  }
  return true;
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: 'verify' | 'reset'
): Promise<DevEmailMessage> {
  const normalizedTo = to.trim().toLowerCase();
  const id = `mail-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  const subject =
    purpose === 'verify'
      ? `47 Cities — Your Email Verification Code: ${code}`
      : `47 Cities — Password Reset Code: ${code}`;

  const text =
    purpose === 'verify'
      ? `Karibu to 47 Cities!\n\nYour 6-digit email verification code is: ${code}\n\nThis code expires in 15 minutes. Enter it in the app to verify your email and activate your 10 km proximity portal.`
      : `47 Cities Password Reset\n\nYour 6-digit password reset code is: ${code}\n\nThis code expires in 15 minutes. If you did not request a reset, you can safely ignore this email.`;

  if (shouldRecordDevInbox()) {
    const db = getDb();
    db.prepare(
      `INSERT INTO dev_emails (id, recipient, subject, purpose, code, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, normalizedTo, subject, purpose, code, text, createdAt);
  }

  if (process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '47 Cities <no-reply@47cities.ke>',
        to: normalizedTo,
        subject,
        text,
      });
    } catch (err) {
      // Keep local dev/test flow resilient even if external SMTP is unreachable
      console.warn('[47 Cities email] SMTP send failed, dev inbox copy retained:', err);
    }
  }

  return {
    id,
    to: normalizedTo,
    subject,
    purpose,
    code,
    text,
    createdAt,
  };
}

export function getDevInbox(email?: string): DevEmailMessage[] {
  const db = getDb();
  const normalized = email?.trim().toLowerCase();

  const rows = normalized
    ? (db
        .prepare(
          `SELECT id, recipient, subject, purpose, code, text, created_at
           FROM dev_emails
           WHERE recipient = ?
           ORDER BY created_at DESC
           LIMIT 50`
        )
        .all(normalized) as Array<Record<string, any>>)
    : (db
        .prepare(
          `SELECT id, recipient, subject, purpose, code, text, created_at
           FROM dev_emails
           ORDER BY created_at DESC
           LIMIT 50`
        )
        .all() as Array<Record<string, any>>);

  return rows.map((row) => ({
    id: String(row.id),
    to: String(row.recipient),
    subject: String(row.subject),
    purpose: (row.purpose === 'reset' ? 'reset' : 'verify') as 'verify' | 'reset',
    code: String(row.code),
    text: String(row.text),
    createdAt: String(row.created_at),
  }));
}
