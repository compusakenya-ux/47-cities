import crypto from 'node:crypto';
import { Router, type Response } from 'express';
import { getDb, type UserRow } from '../db.js';
import {
  requireActiveLocation,
  requireAuth,
  type AuthRequest,
} from '../auth.js';
import { canAccessMember, toPublicMemberProfile } from '../geo.js';
import {
  checkPositivity,
  extractInterestTopicsFromText,
  getClusterBlackboardTopic,
  getUserInterestVector,
  mineChatInterests,
} from '../ai/chat-miner.js';
import { BLACKBOARD_TOPICS } from '../../src/shared/kenya-data.js';
import type {
  BlackboardComment,
  BlackboardPost,
  BlackboardTopic,
  ReactionType,
  StoryItem,
} from '../../src/shared/types.js';

const VALID_REACTIONS: readonly ReactionType[] = [
  'love',
  'fire',
  'vibe',
  'laugh',
  'inspire',
];

interface PostRow {
  id: string;
  author_id: string;
  topic: string;
  content: string;
  image_url: string | null;
  view_count: number;
  reader_stars: number;
  milestone10_unlocked: number;
  milestone100_unlocked: number;
  created_at: string;
}

interface StoryRow {
  id: string;
  author_id: string;
  caption: string;
  image_url: string | null;
  accent_from: string;
  accent_to: string;
  topic: string | null;
  created_at: string;
  expires_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

function computeViewMilestoneStars(
  milestone10Unlocked: boolean,
  milestone100Unlocked: boolean
): number {
  if (milestone100Unlocked) return 10;
  if (milestone10Unlocked) return 1;
  return 0;
}

function hydratePost(postRow: PostRow, viewerId: string): BlackboardPost | null {
  const db = getDb();
  const authorRow = db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(postRow.author_id) as UserRow | undefined;

  if (!authorRow) return null;

  const userStar = db
    .prepare(`SELECT 1 FROM post_stars WHERE post_id = ? AND user_id = ?`)
    .get(postRow.id, viewerId);

  const reactionRows = db
    .prepare(
      `SELECT reaction, COUNT(*) AS cnt
       FROM post_reactions
       WHERE post_id = ?
       GROUP BY reaction`
    )
    .all(postRow.id) as unknown as Array<{ reaction: string; cnt: number }>;

  const reactions: Record<ReactionType, number> = {
    love: 0,
    fire: 0,
    vibe: 0,
    laugh: 0,
    inspire: 0,
  };
  for (const r of reactionRows) {
    if (VALID_REACTIONS.includes(r.reaction as ReactionType)) {
      reactions[r.reaction as ReactionType] = Number(r.cnt ?? 0);
    }
  }

  const viewerReactionRow = db
    .prepare(
      `SELECT reaction FROM post_reactions WHERE post_id = ? AND user_id = ?`
    )
    .get(postRow.id, viewerId) as { reaction: string } | undefined;

  const commentCountRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM post_comments WHERE post_id = ?`)
    .get(postRow.id) as { cnt: number } | undefined;

  const repostCountRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM post_reposts WHERE post_id = ?`)
    .get(postRow.id) as { cnt: number } | undefined;

  const userRepost = db
    .prepare(`SELECT 1 FROM post_reposts WHERE post_id = ? AND user_id = ?`)
    .get(postRow.id, viewerId);

  const userBookmark = db
    .prepare(`SELECT 1 FROM post_bookmarks WHERE post_id = ? AND user_id = ?`)
    .get(postRow.id, viewerId);

  const viewCount = Number(postRow.view_count ?? 0);
  const readerStars = Number(postRow.reader_stars ?? 0);
  const milestone10Unlocked =
    Boolean(postRow.milestone10_unlocked) || viewCount >= 10;
  const milestone100Unlocked =
    Boolean(postRow.milestone100_unlocked) || viewCount >= 100;
  const viewMilestoneStars = computeViewMilestoneStars(
    milestone10Unlocked,
    milestone100Unlocked
  );

  return {
    id: postRow.id,
    author: toPublicMemberProfile(authorRow),
    topic: postRow.topic as BlackboardTopic,
    content: postRow.content,
    imageUrl: postRow.image_url ?? null,
    createdAt: postRow.created_at,
    viewCount,
    starCount: readerStars + viewMilestoneStars,
    readerStars,
    viewMilestoneStars,
    milestone10Unlocked,
    milestone100Unlocked,
    userHasStarred: Boolean(userStar),
    reactions,
    userReaction: viewerReactionRow
      ? (viewerReactionRow.reaction as ReactionType)
      : null,
    commentCount: Number(commentCountRow?.cnt ?? 0),
    repostCount: Number(repostCountRow?.cnt ?? 0),
    userHasReposted: Boolean(userRepost),
    userHasBookmarked: Boolean(userBookmark),
  };
}

function hydrateStory(storyRow: StoryRow, viewerId: string): StoryItem | null {
  const db = getDb();
  const authorRow = db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(storyRow.author_id) as UserRow | undefined;

  if (!authorRow) return null;

  const viewedRow = db
    .prepare(`SELECT 1 FROM story_views WHERE story_id = ? AND user_id = ?`)
    .get(storyRow.id, viewerId);

  return {
    id: storyRow.id,
    author: toPublicMemberProfile(authorRow),
    caption: storyRow.caption,
    imageUrl: storyRow.image_url ?? null,
    accentFrom: storyRow.accent_from,
    accentTo: storyRow.accent_to,
    topic: (storyRow.topic as BlackboardTopic) || undefined,
    createdAt: storyRow.created_at,
    expiresAt: storyRow.expires_at,
    viewed: Boolean(viewedRow),
  };
}

// ============================================================================
// Proximity Stories Router (mounted at /api/stories OR delegated from blackboardRouter)
// ============================================================================

export const storiesRouter = Router();

storiesRouter.get(
  '/',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const db = getDb();
    const nowIso = new Date().toISOString();

    const rows = db
      .prepare(
        `SELECT *
         FROM stories
         WHERE expires_at > ?
         ORDER BY created_at DESC`
      )
      .all(nowIso) as unknown as StoryRow[];

    const stories: StoryItem[] = [];
    for (const row of rows) {
      if (row.author_id !== me.id) {
        const authorRow = db
          .prepare(`SELECT * FROM users WHERE id = ?`)
          .get(row.author_id) as UserRow | undefined;
        if (!authorRow || !canAccessMember(me, authorRow).allowed) {
          continue;
        }
      }

      const item = hydrateStory(row, me.id);
      if (item) stories.push(item);
    }

    // Put own stories first, then unviewed, then newest
    stories.sort((a, b) => {
      const aSelf = a.author.id === me.id ? 1 : 0;
      const bSelf = b.author.id === me.id ? 1 : 0;
      if (aSelf !== bSelf) return bSelf - aSelf;
      const aUnviewed = a.viewed ? 0 : 1;
      const bUnviewed = b.viewed ? 0 : 1;
      if (aUnviewed !== bUnviewed) return bUnviewed - aUnviewed;
      return b.createdAt.localeCompare(a.createdAt);
    });

    res.json({ stories });
  }
);

storiesRouter.post(
  '/',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const caption =
      typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';

    if (!caption) {
      res.status(400).json({
        error: 'CAPTION_REQUIRED',
        message: 'Story caption is required.',
      });
      return;
    }
    if (caption.length > 260) {
      res.status(400).json({
        error: 'CAPTION_TOO_LONG',
        message: 'Story caption must be 260 characters or fewer.',
      });
      return;
    }

    const positivity = checkPositivity(caption);
    if (!positivity.allowed) {
      res.status(400).json({
        error: 'COMMUNITY_SAFETY_FILTER',
        message: positivity.reason,
      });
      return;
    }

    const rawTopic = typeof req.body?.topic === 'string' ? req.body.topic : '';
    const topic: BlackboardTopic = BLACKBOARD_TOPICS.includes(
      rawTopic as BlackboardTopic
    )
      ? (rawTopic as BlackboardTopic)
      : 'Lifestyle';

    const accentFrom =
      typeof req.body?.accentFrom === 'string' && req.body.accentFrom.trim()
        ? req.body.accentFrom.trim().slice(0, 32)
        : '#F59E0B';
    const accentTo =
      typeof req.body?.accentTo === 'string' && req.body.accentTo.trim()
        ? req.body.accentTo.trim().slice(0, 32)
        : '#06B6D4';
    const imageUrl =
      typeof req.body?.imageUrl === 'string' && req.body.imageUrl.trim()
        ? req.body.imageUrl.trim()
        : null;

    const db = getDb();
    const id = `story-${crypto.randomUUID()}`;
    const nowMs = Date.now();
    const createdAt = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + 24 * 60 * 60_000).toISOString();

    db.prepare(
      `INSERT INTO stories (
         id, author_id, caption, image_url, accent_from, accent_to, topic, created_at, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      me.id,
      caption,
      imageUrl,
      accentFrom,
      accentTo,
      topic,
      createdAt,
      expiresAt
    );

    mineChatInterests(me.id, caption, 0.8);

    const saved = db
      .prepare(`SELECT * FROM stories WHERE id = ?`)
      .get(id) as unknown as StoryRow;

    res.status(201).json({ story: hydrateStory(saved, me.id) });
  }
);

storiesRouter.post(
  '/:id/view',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const storyId = String(req.params.id || '').trim();
    const db = getDb();

    const story = db
      .prepare(`SELECT id FROM stories WHERE id = ?`)
      .get(storyId) as { id: string } | undefined;

    if (!story) {
      res.status(404).json({
        error: 'STORY_NOT_FOUND',
        message: 'Story not found.',
      });
      return;
    }

    db.prepare(
      `INSERT OR IGNORE INTO story_views (story_id, user_id, created_at)
       VALUES (?, ?, ?)`
    ).run(storyId, me.id, new Date().toISOString());

    res.json({ ok: true });
  }
);

// ============================================================================
// Public Blackboard Posts Router
// ============================================================================

export const postsRouter = Router();

postsRouter.get(
  '/',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const topicParam =
      typeof req.query.topic === 'string' ? req.query.topic.trim() : 'All';
    const sortParam =
      typeof req.query.sort === 'string' ? req.query.sort.trim() : 'forYou';

    const db = getDb();
    let rows: PostRow[];

    if (
      topicParam &&
      topicParam !== 'All' &&
      BLACKBOARD_TOPICS.includes(topicParam as BlackboardTopic)
    ) {
      rows = db
        .prepare(
          `SELECT * FROM blackboard_posts WHERE topic = ? ORDER BY created_at DESC`
        )
        .all(topicParam) as unknown as PostRow[];
    } else {
      rows = db
        .prepare(`SELECT * FROM blackboard_posts ORDER BY created_at DESC`)
        .all() as unknown as PostRow[];
    }

    const posts: BlackboardPost[] = [];
    for (const row of rows) {
      const hydrated = hydratePost(row, me.id);
      if (hydrated) posts.push(hydrated);
    }

    if (sortParam === 'stars') {
      posts.sort((a, b) => {
        if (b.starCount !== a.starCount) return b.starCount - a.starCount;
        if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount;
        return b.createdAt.localeCompare(a.createdAt);
      });
    } else if (sortParam === 'latest') {
      posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      // 'forYou' AI-personalized ranking combining chat-mined interests, stars, and freshness
      const viewerVector = getUserInterestVector(me.id);
      const preferredTopics = new Map<BlackboardTopic, number>();
      for (const [key, weight] of viewerVector.entries()) {
        const mappedTopic = getClusterBlackboardTopic(key);
        if (mappedTopic) {
          preferredTopics.set(
            mappedTopic,
            (preferredTopics.get(mappedTopic) ?? 0) + weight
          );
        }
      }

      const nowMs = Date.now();
      const scorePost = (p: BlackboardPost): number => {
        const ageHours = Math.max(
          0,
          (nowMs - new Date(p.createdAt).getTime()) / 3_600_000
        );
        const recencyScore = Math.max(0, 24 - ageHours * 1.1);
        const topicBoost = Math.min(20, (preferredTopics.get(p.topic) ?? 0) * 2.5);
        const contentTopics = extractInterestTopicsFromText(p.content);
        let keywordBoost = 0;
        for (const key of contentTopics) {
          if (viewerVector.has(key)) {
            keywordBoost += 6;
          }
        }
        const engagementScore = p.starCount * 1.6 + p.commentCount * 2;
        return recencyScore + topicBoost + Math.min(18, keywordBoost) + engagementScore;
      };

      posts.sort((a, b) => scorePost(b) - scorePost(a));
    }

    res.json({ posts });
  }
);

postsRouter.post(
  '/',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const content =
      typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const imageUrl =
      typeof req.body?.imageUrl === 'string' && req.body.imageUrl.trim()
        ? req.body.imageUrl.trim()
        : null;

    if (!BLACKBOARD_TOPICS.includes(topic as BlackboardTopic)) {
      res.status(400).json({
        error: 'INVALID_TOPIC',
        message: `Topic must be one of: ${BLACKBOARD_TOPICS.join(', ')}.`,
      });
      return;
    }

    if (!content) {
      res.status(400).json({
        error: 'CONTENT_REQUIRED',
        message: 'Post content cannot be empty.',
      });
      return;
    }
    if (content.length > 1500) {
      res.status(400).json({
        error: 'CONTENT_TOO_LONG',
        message: 'Post content must be 1500 characters or fewer.',
      });
      return;
    }

    const positivity = checkPositivity(content);
    if (!positivity.allowed) {
      res.status(400).json({
        error: 'COMMUNITY_SAFETY_FILTER',
        message: positivity.reason,
      });
      return;
    }

    const db = getDb();
    const id = `post-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO blackboard_posts (
         id, author_id, topic, content, image_url,
         view_count, reader_stars, milestone10_unlocked, milestone100_unlocked, created_at
       ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, ?)`
    ).run(id, me.id, topic, content, imageUrl, createdAt);

    // Evolve user interest vector from their Blackboard post
    mineChatInterests(me.id, `${topic} ${content}`, 1.2);

    const saved = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(id) as unknown as PostRow;

    res.status(201).json({ post: hydratePost(saved, me.id) });
  }
);

postsRouter.post(
  '/:id/view',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const postId = String(req.params.id || '').trim();
    const db = getDb();

    const existing = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow | undefined;

    if (!existing) {
      res.status(404).json({
        error: 'POST_NOT_FOUND',
        message: 'Blackboard post not found.',
      });
      return;
    }

    const nextViewCount = Number(existing.view_count ?? 0) + 1;
    const prevM10 = Boolean(existing.milestone10_unlocked);
    const prevM100 = Boolean(existing.milestone100_unlocked);
    const nextM10 = prevM10 || nextViewCount >= 10;
    const nextM100 = prevM100 || nextViewCount >= 100;

    let unlockedMilestone: 100 | 10 | null = null;
    if (!prevM100 && nextM100) {
      unlockedMilestone = 100;
    } else if (!prevM10 && nextM10) {
      unlockedMilestone = 10;
    }

    db.prepare(
      `UPDATE blackboard_posts
       SET view_count = ?,
           milestone10_unlocked = ?,
           milestone100_unlocked = ?
       WHERE id = ?`
    ).run(nextViewCount, nextM10 ? 1 : 0, nextM100 ? 1 : 0, postId);

    const updated = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow;

    res.json({
      post: hydratePost(updated, me.id),
      unlockedMilestone,
    });
  }
);

postsRouter.post(
  '/:id/star',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const postId = String(req.params.id || '').trim();
    const db = getDb();

    const existing = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow | undefined;

    if (!existing) {
      res.status(404).json({
        error: 'POST_NOT_FOUND',
        message: 'Blackboard post not found.',
      });
      return;
    }

    const alreadyStarred = db
      .prepare(`SELECT 1 FROM post_stars WHERE post_id = ? AND user_id = ?`)
      .get(postId, me.id);

    if (alreadyStarred) {
      db.prepare(`DELETE FROM post_stars WHERE post_id = ? AND user_id = ?`).run(
        postId,
        me.id
      );
      db.prepare(
        `UPDATE blackboard_posts
         SET reader_stars = MAX(0, reader_stars - 1)
         WHERE id = ?`
      ).run(postId);
    } else {
      db.prepare(
        `INSERT INTO post_stars (post_id, user_id, created_at)
         VALUES (?, ?, ?)`
      ).run(postId, me.id, new Date().toISOString());
      db.prepare(
        `UPDATE blackboard_posts
         SET reader_stars = reader_stars + 1
         WHERE id = ?`
      ).run(postId);

      // Subtle behind-the-hood interest signal when a user stars a post
      mineChatInterests(me.id, `${existing.topic} ${existing.content}`, 0.6);
    }

    const updated = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow;

    res.json({ post: hydratePost(updated, me.id) });
  }
);

postsRouter.post(
  '/:id/react',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const postId = String(req.params.id || '').trim();
    const reaction =
      typeof req.body?.reaction === 'string' ? req.body.reaction.trim() : '';

    if (!VALID_REACTIONS.includes(reaction as ReactionType)) {
      res.status(400).json({
        error: 'INVALID_REACTION',
        message: `Reaction must be one of: ${VALID_REACTIONS.join(', ')}.`,
      });
      return;
    }

    const db = getDb();
    const existing = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow | undefined;

    if (!existing) {
      res.status(404).json({
        error: 'POST_NOT_FOUND',
        message: 'Blackboard post not found.',
      });
      return;
    }

    const current = db
      .prepare(
        `SELECT reaction FROM post_reactions WHERE post_id = ? AND user_id = ?`
      )
      .get(postId, me.id) as { reaction: string } | undefined;

    if (current && current.reaction === reaction) {
      db.prepare(
        `DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?`
      ).run(postId, me.id);
    } else {
      db.prepare(
        `INSERT INTO post_reactions (post_id, user_id, reaction, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(post_id, user_id)
         DO UPDATE SET reaction = excluded.reaction, created_at = excluded.created_at`
      ).run(postId, me.id, reaction, new Date().toISOString());
    }

    const updated = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow;

    res.json({ post: hydratePost(updated, me.id) });
  }
);

postsRouter.post(
  '/:id/repost',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const postId = String(req.params.id || '').trim();
    const db = getDb();

    const existing = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow | undefined;

    if (!existing) {
      res.status(404).json({
        error: 'POST_NOT_FOUND',
        message: 'Blackboard post not found.',
      });
      return;
    }

    const already = db
      .prepare(`SELECT 1 FROM post_reposts WHERE post_id = ? AND user_id = ?`)
      .get(postId, me.id);

    if (already) {
      db.prepare(
        `DELETE FROM post_reposts WHERE post_id = ? AND user_id = ?`
      ).run(postId, me.id);
    } else {
      db.prepare(
        `INSERT INTO post_reposts (post_id, user_id, created_at)
         VALUES (?, ?, ?)`
      ).run(postId, me.id, new Date().toISOString());
    }

    const updated = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow;

    res.json({ post: hydratePost(updated, me.id) });
  }
);

postsRouter.post(
  '/:id/bookmark',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const postId = String(req.params.id || '').trim();
    const db = getDb();

    const existing = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow | undefined;

    if (!existing) {
      res.status(404).json({
        error: 'POST_NOT_FOUND',
        message: 'Blackboard post not found.',
      });
      return;
    }

    const already = db
      .prepare(`SELECT 1 FROM post_bookmarks WHERE post_id = ? AND user_id = ?`)
      .get(postId, me.id);

    if (already) {
      db.prepare(
        `DELETE FROM post_bookmarks WHERE post_id = ? AND user_id = ?`
      ).run(postId, me.id);
    } else {
      db.prepare(
        `INSERT INTO post_bookmarks (post_id, user_id, created_at)
         VALUES (?, ?, ?)`
      ).run(postId, me.id, new Date().toISOString());
    }

    const updated = db
      .prepare(`SELECT * FROM blackboard_posts WHERE id = ?`)
      .get(postId) as unknown as PostRow;

    res.json({ post: hydratePost(updated, me.id) });
  }
);

postsRouter.get(
  '/:id/comments',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const postId = String(req.params.id || '').trim();
    const db = getDb();

    const existing = db
      .prepare(`SELECT id FROM blackboard_posts WHERE id = ?`)
      .get(postId) as { id: string } | undefined;

    if (!existing) {
      res.status(404).json({
        error: 'POST_NOT_FOUND',
        message: 'Blackboard post not found.',
      });
      return;
    }

    const rows = db
      .prepare(
        `SELECT * FROM post_comments WHERE post_id = ? ORDER BY created_at ASC`
      )
      .all(postId) as unknown as CommentRow[];

    const comments: BlackboardComment[] = [];
    for (const row of rows) {
      const authorRow = db
        .prepare(`SELECT * FROM users WHERE id = ?`)
        .get(row.author_id) as UserRow | undefined;
      if (!authorRow) continue;
      comments.push({
        id: row.id,
        postId: row.post_id,
        author: toPublicMemberProfile(authorRow),
        content: row.content,
        createdAt: row.created_at,
      });
    }

    res.json({ comments });
  }
);

postsRouter.post(
  '/:id/comments',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const postId = String(req.params.id || '').trim();
    const content =
      typeof req.body?.content === 'string' ? req.body.content.trim() : '';

    if (!content) {
      res.status(400).json({
        error: 'COMMENT_REQUIRED',
        message: 'Comment cannot be empty.',
      });
      return;
    }
    if (content.length > 600) {
      res.status(400).json({
        error: 'COMMENT_TOO_LONG',
        message: 'Comment must be 600 characters or fewer.',
      });
      return;
    }

    const positivity = checkPositivity(content);
    if (!positivity.allowed) {
      res.status(400).json({
        error: 'COMMUNITY_SAFETY_FILTER',
        message: positivity.reason,
      });
      return;
    }

    const db = getDb();
    const existing = db
      .prepare(`SELECT id FROM blackboard_posts WHERE id = ?`)
      .get(postId) as { id: string } | undefined;

    if (!existing) {
      res.status(404).json({
        error: 'POST_NOT_FOUND',
        message: 'Blackboard post not found.',
      });
      return;
    }

    const id = `cmt-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO post_comments (id, post_id, author_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, postId, me.id, content, createdAt);

    mineChatInterests(me.id, content, 0.8);

    const countRow = db
      .prepare(`SELECT COUNT(*) AS cnt FROM post_comments WHERE post_id = ?`)
      .get(postId) as { cnt: number } | undefined;

    const comment: BlackboardComment = {
      id,
      postId,
      author: toPublicMemberProfile(me),
      content,
      createdAt,
    };

    res.status(201).json({
      comment,
      commentCount: Number(countRow?.cnt ?? 1),
    });
  }
);

// ============================================================================
// Unified blackboardRouter: supports BOTH:
//   - app.use('/api/blackboard', blackboardRouter) + app.use('/api/stories', blackboardRouter)
//   - app.use('/api/blackboard', blackboardRouter) + app.use('/api/stories', storiesRouter)
//   - app.use('/api', blackboardRouter)
// ============================================================================

export const blackboardRouter = Router();

blackboardRouter.use('/stories', storiesRouter);
blackboardRouter.use('/blackboard', postsRouter);

blackboardRouter.use((req, res, next) => {
  if (req.baseUrl.endsWith('/stories')) {
    storiesRouter(req, res, next);
    return;
  }
  if (req.baseUrl.endsWith('/blackboard')) {
    postsRouter(req, res, next);
    return;
  }
  next();
});
