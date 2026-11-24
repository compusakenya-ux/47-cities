import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified: number;
  nickname: string;
  avatar_url: string;
  gender: string;
  age_range: string;
  interested_in: string;
  has_children: number;
  home_county: string;
  looking_for_json: string;
  hate_with_passion_json: string;
  bio: string;
  disclaimer_signed: number;
  disclaimer_signed_at: string | null;
  disclaimer_signature: string | null;
  location_active: number;
  lat: number | null;
  lng: number | null;
  active_city_label: string | null;
  is_online: number;
  last_active_at: string;
  created_at: string;
}

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;

function resolveDbPath(dbPath?: string): string {
  const target = dbPath ?? process.env.DB_PATH ?? 'data/47cities.db';
  if (target === ':memory:') {
    return ':memory:';
  }
  return path.resolve(target);
}

function createSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      nickname TEXT NOT NULL,
      avatar_url TEXT NOT NULL,
      gender TEXT NOT NULL,
      age_range TEXT NOT NULL,
      interested_in TEXT NOT NULL,
      has_children INTEGER NOT NULL DEFAULT 0,
      home_county TEXT NOT NULL,
      looking_for_json TEXT NOT NULL DEFAULT '[]',
      hate_with_passion_json TEXT NOT NULL DEFAULT '[]',
      bio TEXT NOT NULL DEFAULT '',
      disclaimer_signed INTEGER NOT NULL DEFAULT 0,
      disclaimer_signed_at TEXT,
      disclaimer_signature TEXT,
      location_active INTEGER NOT NULL DEFAULT 0,
      lat REAL,
      lng REAL,
      active_city_label TEXT,
      is_online INTEGER NOT NULL DEFAULT 0,
      last_active_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_location_active ON users(location_active, email_verified);

    CREATE TABLE IF NOT EXISTS email_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes(email, purpose, used);

    CREATE TABLE IF NOT EXISTS dev_emails (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dev_emails_recipient ON dev_emails(recipient, created_at);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS user_chat_topics (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic_key TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, topic_key)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'text',
      text TEXT,
      audio_url TEXT,
      audio_duration_sec REAL,
      image_url TEXT,
      image_size_bytes INTEGER,
      image_expires_at TEXT,
      session_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_participants ON chat_messages(sender_id, receiver_id);

    CREATE TABLE IF NOT EXISTS session_images (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      public_url TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_session_images_session ON session_images(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_images_expires ON session_images(expires_at);

    CREATE TABLE IF NOT EXISTS blackboard_posts (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      view_count INTEGER NOT NULL DEFAULT 0,
      reader_stars INTEGER NOT NULL DEFAULT 0,
      milestone10_unlocked INTEGER NOT NULL DEFAULT 0,
      milestone100_unlocked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blackboard_posts_topic ON blackboard_posts(topic, created_at);

    CREATE TABLE IF NOT EXISTS post_stars (
      post_id TEXT NOT NULL REFERENCES blackboard_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_reactions (
      post_id TEXT NOT NULL REFERENCES blackboard_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reaction TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES blackboard_posts(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at);

    CREATE TABLE IF NOT EXISTS post_reposts (
      post_id TEXT NOT NULL REFERENCES blackboard_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_bookmarks (
      post_id TEXT NOT NULL REFERENCES blackboard_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      caption TEXT NOT NULL,
      image_url TEXT,
      accent_from TEXT NOT NULL,
      accent_to TEXT NOT NULL,
      topic TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);

    CREATE TABLE IF NOT EXISTS story_views (
      story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (story_id, user_id)
    );
  `);
}

export function initDb(dbPath?: string): DatabaseSync {
  const resolved = resolveDbPath(dbPath);

  if (dbInstance && (dbPath === undefined || currentDbPath === resolved)) {
    return dbInstance;
  }

  if (dbInstance) {
    closeDb();
  }

  if (resolved !== ':memory:') {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }

  const db = new DatabaseSync(resolved);
  if (resolved !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
  }
  createSchema(db);

  dbInstance = db;
  currentDbPath = resolved;
  return dbInstance;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore already-closed handle
    }
    dbInstance = null;
    currentDbPath = null;
  }
}

export function resetDbForTests(dbPath: string = ':memory:'): DatabaseSync {
  closeDb();
  return initDb(dbPath);
}
