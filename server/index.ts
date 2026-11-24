import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { attachSession } from './auth.js';
import { initDb } from './db.js';
import { startMediaSweeper } from './media-sweeper.js';
import { aiRouter } from './routes/ai.js';
import { authRouter, profileRouter } from './routes/auth.js';
import { blackboardRouter } from './routes/blackboard.js';
import { chatRouter } from './routes/chat.js';
import { locationRouter, membersRouter } from './routes/members.js';
import { seedDatabase } from './seed.js';

export function createApp(): Express {
  initDb();
  seedDatabase();

  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ extended: true, limit: '6mb' }));
  app.use(cookieParser());
  app.use(attachSession);

  // Serve uploaded avatars, voice notes, and ephemeral chat images
  const uploadsDir = path.resolve('uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // Health probe
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: '47-cities', timestamp: new Date().toISOString() });
  });

  // Core API routes
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/location', locationRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/blackboard', blackboardRouter);
  app.use('/api/stories', blackboardRouter);

  // Unknown API route fallback
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'API endpoint not found.',
    });
  });

  // Serve built frontend in production when dist/index.html exists
  const distDir = path.resolve('dist');
  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(distDir));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (
        req.method === 'GET' &&
        !req.path.startsWith('/api') &&
        !req.path.startsWith('/uploads')
      ) {
        res.sendFile(indexHtml);
        return;
      }
      next();
    });
  }

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[47 Cities server] unhandled error:', err);
    if (res.headersSent) return;
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    });
  });

  return app;
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    const currentFile = path.resolve(fileURLToPath(import.meta.url));
    const entryFile = path.resolve(process.argv[1]);
    return currentFile.toLowerCase() === entryFile.toLowerCase();
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const port = Number(process.env.PORT || 3001);
  const app = createApp();
  startMediaSweeper();

  app.listen(port, '0.0.0.0', () => {
    console.log(`[47 Cities] API server listening on http://127.0.0.1:${port}`);
  });
}
