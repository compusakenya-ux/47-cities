import {
  makeAvatarSvg,
  SEED_BLACKBOARD_POSTS,
  SEED_STORIES,
  SEED_USERS,
} from '../src/shared/kenya-data.js';
import type { ReactionType } from '../src/shared/types.js';
import { hashPassword } from './auth.js';
import { getDb } from './db.js';

export const DEMO_USER_EMAIL = 'demo@47cities.ke';
export const DEMO_USER_PASSWORD = 'Kenya2026!';

const REACTION_TYPES: readonly ReactionType[] = ['love', 'fire', 'vibe', 'laugh', 'inspire'];

export function seedDatabase(): void {
  const db = getDb();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Compute password hash once for fast idempotent seeding
  const sharedHash = hashPassword(DEMO_USER_PASSWORD);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, email, password_hash, email_verified, nickname, avatar_url,
      gender, age_range, interested_in, has_children, home_county,
      looking_for_json, hate_with_passion_json, bio,
      disclaimer_signed, disclaimer_signed_at, disclaimer_signature,
      location_active, lat, lng, active_city_label,
      is_online, last_active_at, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  const insertTopic = db.prepare(`
    INSERT OR IGNORE INTO user_chat_topics (user_id, topic_key, weight, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  // 1. Seed 18 realistic Kenyan singles across Nairobi, outer Nairobi (>10km), Mombasa, and Kisumu
  for (const u of SEED_USERS) {
    const lastActiveAt = new Date(now - u.lastActiveOffsetMinutes * 60_000).toISOString();
    const createdAt = new Date(now - (24 * 60 + u.lastActiveOffsetMinutes) * 60_000).toISOString();

    insertUser.run(
      u.id,
      u.email.toLowerCase(),
      sharedHash,
      1, // email_verified
      u.nickname,
      u.avatarUrl,
      u.gender,
      u.ageRange,
      u.interestedIn,
      u.hasChildren ? 1 : 0,
      u.homeCounty,
      JSON.stringify(u.lookingFor),
      JSON.stringify(u.hateWithPassion),
      u.bio,
      1, // disclaimer_signed
      createdAt,
      u.nickname,
      1, // location_active
      u.lat,
      u.lng,
      u.activeCityLabel,
      u.isOnline ? 1 : 0,
      lastActiveAt,
      createdAt
    );

    for (const kw of u.interestKeywords) {
      insertTopic.run(u.id, kw.toLowerCase(), 2.0, nowIso);
    }
  }

  // 2. Seed verified demo account with location_active = 0 so login ALWAYS hits Location Gate first
  const demoCreatedAt = new Date(now - 3 * 24 * 60 * 60_000).toISOString();
  insertUser.run(
    'user-demo-01',
    DEMO_USER_EMAIL,
    sharedHash,
    1, // email_verified
    'NairobiExplorer',
    makeAvatarSvg('NE', '#F59E0B', '#10B981'),
    'Man',
    '26-29',
    'Both',
    0,
    'Nairobi',
    JSON.stringify(['Soulmate', 'Hangout', 'Chat-Mate']),
    JSON.stringify(['Liar', 'Ujinga']),
    'Exploring 47 Cities across Kenya — coffee, music, and great conversations.',
    1,
    demoCreatedAt,
    'NairobiExplorer',
    0, // location_active = 0 (Location Gate enforced on login!)
    null,
    null,
    null,
    0,
    demoCreatedAt,
    demoCreatedAt
  );

  // 3. Seed 14 Blackboard posts (including milestone posts at 9 and 99 views)
  const insertPost = db.prepare(`
    INSERT OR IGNORE INTO blackboard_posts (
      id, author_id, topic, content, image_url,
      view_count, reader_stars, milestone10_unlocked, milestone100_unlocked, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReaction = db.prepare(`
    INSERT OR IGNORE INTO post_reactions (post_id, user_id, reaction, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const seedUserIds = SEED_USERS.map((u) => u.id);

  for (let pIdx = 0; pIdx < SEED_BLACKBOARD_POSTS.length; pIdx++) {
    const post = SEED_BLACKBOARD_POSTS[pIdx];
    const createdAt = new Date(now - post.createdOffsetMinutes * 60_000).toISOString();
    const milestone10 = post.initialViewCount >= 10 ? 1 : 0;
    const milestone100 = post.initialViewCount >= 100 ? 1 : 0;

    const info = insertPost.run(
      post.id,
      post.authorId,
      post.topic,
      post.content,
      post.imageUrl,
      post.initialViewCount,
      post.initialReaderStars,
      milestone10,
      milestone100,
      createdAt
    );

    // Seed initial reactions only when the post was newly inserted (keeps seeding idempotent)
    if (info.changes > 0) {
      const reactorPool = seedUserIds.filter((uid) => uid !== post.authorId);
      let cursor = pIdx % reactorPool.length;
      const usedReactors = new Set<string>();

      // First pass: guarantee at least 1 reaction for every non-zero reaction type
      const remaining: Record<ReactionType, number> = { ...post.initialReactions };
      for (const rType of REACTION_TYPES) {
        if (remaining[rType] > 0 && usedReactors.size < reactorPool.length) {
          const reactorId = reactorPool[cursor % reactorPool.length];
          cursor++;
          if (!usedReactors.has(reactorId)) {
            usedReactors.add(reactorId);
            insertReaction.run(post.id, reactorId, rType, createdAt);
            remaining[rType]--;
          }
        }
      }

      // Second pass: fill additional reactions proportionally up to available seed users
      let placed = true;
      while (placed && usedReactors.size < Math.min(reactorPool.length, 10)) {
        placed = false;
        for (const rType of REACTION_TYPES) {
          if (remaining[rType] > 0 && usedReactors.size < Math.min(reactorPool.length, 10)) {
            let tries = 0;
            while (tries < reactorPool.length) {
              const reactorId = reactorPool[cursor % reactorPool.length];
              cursor++;
              tries++;
              if (!usedReactors.has(reactorId)) {
                usedReactors.add(reactorId);
                insertReaction.run(post.id, reactorId, rType, createdAt);
                remaining[rType]--;
                placed = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  // 4. Seed 6 active Proximity Stories (24h TTL)
  const insertStory = db.prepare(`
    INSERT OR IGNORE INTO stories (
      id, author_id, caption, image_url, accent_from, accent_to, topic, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const story of SEED_STORIES) {
    const createdAtMs = now - story.createdOffsetMinutes * 60_000;
    const createdAt = new Date(createdAtMs).toISOString();
    const expiresAt = new Date(createdAtMs + 24 * 60 * 60_000).toISOString();

    insertStory.run(
      story.id,
      story.authorId,
      story.caption,
      story.imageUrl,
      story.accentFrom,
      story.accentTo,
      story.topic,
      createdAt,
      expiresAt
    );
  }
}
