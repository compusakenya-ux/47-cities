import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../server/index.js';
import { closeDb, getDb, resetDbForTests } from '../server/db.js';
import { DEMO_USER_EMAIL, DEMO_USER_PASSWORD } from '../server/seed.js';
import { sweepExpiredImages } from '../server/media-sweeper.js';
import { TEST_CITY_PINS } from '../src/shared/kenya-data.js';
import { MAX_SESSION_IMAGE_BYTES } from '../src/shared/types.js';

const NAIROBI_PIN = TEST_CITY_PINS.find((p) => p.id === 'nairobi-cbd')!;

// Minimal valid 1x1 PNG buffer
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TINY_PNG_BUFFER = Buffer.from(TINY_PNG_BASE64, 'base64');

// Minimal valid PCM WAV buffer (header + silent samples)
function createTinyWavBuffer(): Buffer {
  const dataSize = 160;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(16000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

const filesToCleanup: string[] = [];

function trackUploadUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return null;
  const absPath = path.resolve(publicUrl.replace(/^\//, ''));
  filesToCleanup.push(absPath);
  return absPath;
}

describe('47 Cities — Multi-Chat Media, 20 MB/2h Ephemeral Images, Blackboard Milestones & Behind-the-Hood AI', () => {
  let app: Express;

  beforeEach(() => {
    resetDbForTests(':memory:');
    app = createApp();
  });

  afterAll(() => {
    closeDb();
    for (const filePath of filesToCleanup) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  async function createAuthenticatedNairobiAgent() {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
    });
    expect(loginRes.status).toBe(200);

    const locRes = await agent.post('/api/location/activate').send({
      lat: NAIROBI_PIN.lat,
      lng: NAIROBI_PIN.lng,
      cityLabel: NAIROBI_PIN.label,
      source: 'test-pin',
    });
    expect(locRes.status).toBe(200);

    return { agent, userId: loginRes.body.user.id as string };
  }

  describe('1. Chat Text, Emojis, Voice Notes & 20 MB / 2-Hour Ephemeral Images', () => {
    it('supports emoji text chat + topic mining and serves uploaded voice notes cleanly', async () => {
      const { agent, userId } = await createAuthenticatedNairobiAgent();

      // Send text + emojis mentioning coffee, football, and fitness
      const textRes = await agent.post('/api/chat/messages/user-nbo-01/text').send({
        text: 'Hey Amani! 🔥☕ Let us catch Arsenal football and grab espresso after our gym workout 🇰🇪✨',
      });
      expect(textRes.status).toBe(201);
      expect(textRes.body.message.type).toBe('text');
      expect(textRes.body.message.text).toContain('🔥☕');
      expect(textRes.body.extractedTopics.length).toBeGreaterThanOrEqual(2);

      // Verify user_chat_topics rows were persisted
      const db = getDb();
      const topicRows = db
        .prepare('SELECT topic_key, weight FROM user_chat_topics WHERE user_id = ?')
        .all(userId) as unknown as Array<{ topic_key: string; weight: number }>;
      expect(topicRows.length).toBeGreaterThanOrEqual(2);

      // Upload voice note via JSON audioDataUrl
      const wavDataUrl = `data:audio/wav;base64,${createTinyWavBuffer().toString('base64')}`;
      const voiceRes = await agent.post('/api/chat/messages/user-nbo-01/voice').send({
        audioDataUrl: wavDataUrl,
        durationSec: 3,
      });
      expect(voiceRes.status).toBe(201);
      expect(voiceRes.body.message.type).toBe('voice');
      expect(voiceRes.body.message.audioUrl).toMatch(/^\/uploads\/voice\/voice-/);
      expect(voiceRes.body.message.audioDurationSec).toBe(3);
      trackUploadUrl(voiceRes.body.message.audioUrl);

      // Serve voice audio file cleanly (200)
      const audioServe = await agent.get(voiceRes.body.message.audioUrl);
      expect(audioServe.status).toBe(200);
      expect(audioServe.body.length).toBeGreaterThan(40);
    });

    it('tracks 20 MB SessionImageBudget, blocks >20 MB with 413 SESSION_IMAGE_LIMIT_EXCEEDED, sweeps expired images, and purges on logout', async () => {
      const { agent } = await createAuthenticatedNairobiAgent();

      // Initial budget is 0 / 20 MB
      const initBudget = await agent.get('/api/chat/image-budget');
      expect(initBudget.status).toBe(200);
      expect(initBudget.body.budget.usedBytes).toBe(0);
      expect(initBudget.body.budget.maxBytes).toBe(MAX_SESSION_IMAGE_BYTES);
      expect(initBudget.body.budget.ttlSeconds).toBe(7200);

      // Upload 1st image (small PNG via multipart)
      const img1Res = await agent
        .post('/api/chat/messages/user-nbo-01/image')
        .attach('image', TINY_PNG_BUFFER, { filename: 'coffee.png', contentType: 'image/png' });
      expect(img1Res.status).toBe(201);
      expect(img1Res.body.message.type).toBe('image');
      expect(img1Res.body.message.imageUrl).toMatch(/^\/uploads\/chat-images\/img-/);
      expect(img1Res.body.budget.usedBytes).toBe(TINY_PNG_BUFFER.length);
      expect(img1Res.body.budget.activeImageCount).toBe(1);
      const img1Path = trackUploadUrl(img1Res.body.message.imageUrl)!;
      expect(fs.existsSync(img1Path)).toBe(true);

      // Upload large 12 MB image buffer -> succeeds (cumulative ~12 MB <= 20 MB)
      const chunk12Mb = Buffer.alloc(12 * 1024 * 1024, 0xab);
      const img2Res = await agent
        .post('/api/chat/messages/user-nbo-01/image')
        .attach('image', chunk12Mb, { filename: 'sunset1.png', contentType: 'image/png' });
      expect(img2Res.status).toBe(201);
      expect(img2Res.body.budget.activeImageCount).toBe(2);
      const img2Path = trackUploadUrl(img2Res.body.message.imageUrl)!;
      expect(fs.existsSync(img2Path)).toBe(true);

      // Upload another 9 MB image -> exceeds 20 MB cumulative -> MUST return 413 SESSION_IMAGE_LIMIT_EXCEEDED
      const chunk9Mb = Buffer.alloc(9 * 1024 * 1024, 0xcd);
      const overLimitRes = await agent
        .post('/api/chat/messages/user-nbo-01/image')
        .attach('image', chunk9Mb, { filename: 'too-big.png', contentType: 'image/png' });
      expect(overLimitRes.status).toBe(413);
      expect(overLimitRes.body.error).toBe('SESSION_IMAGE_LIMIT_EXCEEDED');

      // Test 2-hour expiry sweep: backdate img1's expires_at to the past, then run sweepExpiredImages()
      const db = getDb();
      const pastIso = new Date(Date.now() - 60_000).toISOString();
      db.prepare('UPDATE session_images SET expires_at = ? WHERE message_id = ?').run(
        pastIso,
        img1Res.body.message.id
      );

      const sweptCount = sweepExpiredImages();
      expect(sweptCount).toBe(1);
      expect(fs.existsSync(img1Path)).toBe(false);

      const expiredMsgRow = db
        .prepare('SELECT image_url, text FROM chat_messages WHERE id = ?')
        .get(img1Res.body.message.id) as { image_url: string | null; text: string | null };
      expect(expiredMsgRow.image_url).toBeNull();

      // img2 is still active; now POST /api/auth/logout MUST immediately purge all remaining session images!
      expect(fs.existsSync(img2Path)).toBe(true);
      const logoutRes = await agent.post('/api/auth/logout');
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.clearedImages).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(img2Path)).toBe(false);

      const purgedMsgRow = db
        .prepare('SELECT image_url FROM chat_messages WHERE id = ?')
        .get(img2Res.body.message.id) as { image_url: string | null };
      expect(purgedMsgRow.image_url).toBeNull();
    });
  });

  describe('2. Public Blackboard (Politics, Health, Sports), Stories & Cumulative 10/100 View Stars', () => {
    it('supports creating posts, topic filtering, toggling stars, reactions, reposts, bookmarks, comments, and stories', async () => {
      const { agent } = await createAuthenticatedNairobiAgent();

      // Create a Politics post
      const createRes = await agent.post('/api/blackboard').send({
        topic: 'Politics',
        content: 'Devolution works best when every county publishes live digital budgets! #47Cities',
      });
      expect(createRes.status).toBe(201);
      const postId: string = createRes.body.post.id;
      expect(createRes.body.post.topic).toBe('Politics');
      expect(createRes.body.post.starCount).toBe(0);

      // Topic filtering for Politics, Health, Sports
      for (const topic of ['Politics', 'Health', 'Sports'] as const) {
        const filterRes = await agent.get('/api/blackboard').query({ topic });
        expect(filterRes.status).toBe(200);
        expect(filterRes.body.posts.length).toBeGreaterThanOrEqual(1);
        expect(
          filterRes.body.posts.every((p: { topic: string }) => p.topic === topic)
        ).toBe(true);
      }

      // Toggle reader Star ON then OFF
      const starOn = await agent.post(`/api/blackboard/${postId}/star`);
      expect(starOn.status).toBe(200);
      expect(starOn.body.post.userHasStarred).toBe(true);
      expect(starOn.body.post.readerStars).toBe(1);
      expect(starOn.body.post.starCount).toBe(1);

      const starOff = await agent.post(`/api/blackboard/${postId}/star`);
      expect(starOff.status).toBe(200);
      expect(starOff.body.post.userHasStarred).toBe(false);
      expect(starOff.body.post.readerStars).toBe(0);

      // Reactions
      const reactRes = await agent
        .post(`/api/blackboard/${postId}/react`)
        .send({ reaction: 'fire' });
      expect(reactRes.status).toBe(200);
      expect(reactRes.body.post.userReaction).toBe('fire');
      expect(reactRes.body.post.reactions.fire).toBe(1);

      // Repost & Bookmark
      const repostRes = await agent.post(`/api/blackboard/${postId}/repost`);
      expect(repostRes.status).toBe(200);
      expect(repostRes.body.post.userHasReposted).toBe(true);
      expect(repostRes.body.post.repostCount).toBe(1);

      const bookmarkRes = await agent.post(`/api/blackboard/${postId}/bookmark`);
      expect(bookmarkRes.status).toBe(200);
      expect(bookmarkRes.body.post.userHasBookmarked).toBe(true);

      // Comments
      const addComment = await agent
        .post(`/api/blackboard/${postId}/comments`)
        .send({ content: 'Totally agree — open county dashboards would be huge!' });
      expect(addComment.status).toBe(201);
      expect(addComment.body.commentCount).toBe(1);

      const getComments = await agent.get(`/api/blackboard/${postId}/comments`);
      expect(getComments.status).toBe(200);
      expect(getComments.body.comments).toHaveLength(1);
      expect(getComments.body.comments[0].content).toContain('open county dashboards');

      // Proximity Stories create + view
      const createStory = await agent.post('/api/stories').send({
        caption: 'Evening rooftop coffee in Westlands ✨',
        topic: 'Hangouts',
        accentFrom: '#F59E0B',
        accentTo: '#06B6D4',
      });
      expect(createStory.status).toBe(201);
      const storyId: string = createStory.body.story.id;

      const viewStory = await agent.post(`/api/stories/${storyId}/view`);
      expect(viewStory.status).toBe(200);
      expect(viewStory.body.ok).toBe(true);
    });

    it('unlocks cumulative 10-view and 100-view Star milestones on post-milestone-10 and post-milestone-100', async () => {
      const { agent } = await createAuthenticatedNairobiAgent();

      // post-milestone-10 starts at 9 views, 3 reader stars, 0 view milestone stars
      const m10Res = await agent.post('/api/blackboard/post-milestone-10/view');
      expect(m10Res.status).toBe(200);
      expect(m10Res.body.unlockedMilestone).toBe(10);
      expect(m10Res.body.post.viewCount).toBe(10);
      expect(m10Res.body.post.milestone10Unlocked).toBe(true);
      expect(m10Res.body.post.milestone100Unlocked).toBe(false);
      expect(m10Res.body.post.viewMilestoneStars).toBe(1);
      expect(m10Res.body.post.starCount).toBe(m10Res.body.post.readerStars + 1);

      // post-milestone-100 starts at 99 views, 14 reader stars, 1 view milestone star (from 10)
      const m100Res = await agent.post('/api/blackboard/post-milestone-100/view');
      expect(m100Res.status).toBe(200);
      expect(m100Res.body.unlockedMilestone).toBe(100);
      expect(m100Res.body.post.viewCount).toBe(100);
      expect(m100Res.body.post.milestone10Unlocked).toBe(true);
      expect(m100Res.body.post.milestone100Unlocked).toBe(true);
      expect(m100Res.body.post.viewMilestoneStars).toBe(10);
      expect(m100Res.body.post.starCount).toBe(m100Res.body.post.readerStars + 10);
    });
  });

  describe('3. Behind-the-Hood AI Automation & Community Safety Guard', () => {
    it('updates minedInterests and recalculates /api/ai/matches & /api/ai/whats-next after chatting about interests', async () => {
      const { agent } = await createAuthenticatedNairobiAgent();

      const beforeMatches = await agent.get('/api/ai/matches');
      expect(beforeMatches.status).toBe(200);
      expect(beforeMatches.body.minedInterests).toEqual([]);

      const beforeWhatsNext = await agent.get('/api/ai/whats-next');
      expect(beforeWhatsNext.status).toBe(200);
      expect(beforeWhatsNext.body.predictions.length).toBeGreaterThanOrEqual(3);

      // Chat heavily about football, coffee, and fitness
      await agent.post('/api/chat/messages/user-nbo-01/text').send({
        text: 'I love watching Arsenal football matches, drinking Nairobi espresso coffee, and hitting the gym fitness marathon run!',
      });
      await agent.post('/api/chat/messages/user-nbo-02/text').send({
        text: 'Rugby Shujaa sevens at Nyayo stadium plus cold brew coffee and yoga wellness every weekend!',
      });

      const afterMatches = await agent.get('/api/ai/matches');
      expect(afterMatches.status).toBe(200);
      expect(afterMatches.body.minedInterests.length).toBeGreaterThanOrEqual(3);
      expect(afterMatches.body.matches.length).toBeGreaterThan(0);

      // Compatibility scores should dynamically update after mining chat interests
      const beforeTopScore = beforeMatches.body.matches[0]?.compatibilityScore ?? 0;
      const afterTopScore = afterMatches.body.matches[0]?.compatibilityScore ?? 0;
      expect(afterTopScore).toBeGreaterThanOrEqual(beforeTopScore);

      const whatsNext = await agent.get('/api/ai/whats-next');
      expect(whatsNext.status).toBe(200);
      expect(whatsNext.body.predictions.length).toBeGreaterThanOrEqual(3);
      expect(whatsNext.body.countyPulse.length).toBeGreaterThanOrEqual(3);
      // Should now include an interest-driven "What's Next" prediction card
      const predIds = whatsNext.body.predictions.map((p: { id: string }) => p.id);
      expect(predIds.some((id: string) => id.startsWith('pred-interest-'))).toBe(true);
    });

    it('rejects severe toxic abuse via positivity guard across chat, blackboard posts, comments, and stories', async () => {
      const { agent } = await createAuthenticatedNairobiAgent();

      const toxicChat = await agent
        .post('/api/chat/messages/user-nbo-01/text')
        .send({ text: 'You should go die right now' });
      expect(toxicChat.status).toBe(400);
      expect(toxicChat.body.error).toBe('COMMUNITY_SAFETY_FILTER');

      const toxicPost = await agent.post('/api/blackboard').send({
        topic: 'Politics',
        content: 'This is a bomb threat against the event',
      });
      expect(toxicPost.status).toBe(400);
      expect(toxicPost.body.error).toBe('COMMUNITY_SAFETY_FILTER');

      const toxicComment = await agent
        .post('/api/blackboard/post-milestone-10/comments')
        .send({ content: 'kill yourself now' });
      expect(toxicComment.status).toBe(400);
      expect(toxicComment.body.error).toBe('COMMUNITY_SAFETY_FILTER');

      const toxicStory = await agent.post('/api/stories').send({
        caption: 'i will kill you tonight',
      });
      expect(toxicStory.status).toBe(400);
      expect(toxicStory.body.error).toBe('COMMUNITY_SAFETY_FILTER');
    });

    it('returns valid /api/ai/polish-post and /api/ai/icebreaker outputs (and enforces 10 km access control on icebreaker)', async () => {
      const { agent } = await createAuthenticatedNairobiAgent();

      const polishRes = await agent.post('/api/ai/polish-post').send({
        content: 'nairobi needs better cycling lanes along ngong road and westlands',
        topic: 'Politics',
      });
      expect(polishRes.status).toBe(200);
      expect(polishRes.body.polished.length).toBeGreaterThan(20);
      expect(polishRes.body.suggestedTopic).toBe('Politics');
      expect(Array.isArray(polishRes.body.suggestedTags)).toBe(true);
      expect(polishRes.body.suggestedTags.length).toBeGreaterThan(0);

      const icebreakerRes = await agent.post('/api/ai/icebreaker').send({
        targetMemberId: 'user-nbo-01',
      });
      expect(icebreakerRes.status).toBe(200);
      expect(icebreakerRes.body.targetMemberId).toBe('user-nbo-01');
      expect(Array.isArray(icebreakerRes.body.openers)).toBe(true);
      expect(icebreakerRes.body.openers).toHaveLength(3);
      expect(icebreakerRes.body.contextHint).toBeTruthy();

      // Verify icebreaker never leaks private fields of user-nbo-01 (Kiambu, Liar, Lazy)
      const combined = [...icebreakerRes.body.openers, icebreakerRes.body.contextHint]
        .join(' ')
        .toLowerCase();
      expect(combined).not.toContain('kiambu');
      expect(combined).not.toContain('liar');
      expect(combined).not.toContain('lazy');

      // Out-of-range user (>10 km) must be rejected with 403 PROFILE_RESTRICTED
      const restrictedIce = await agent.post('/api/ai/icebreaker').send({
        targetMemberId: 'user-far-01',
      });
      expect(restrictedIce.status).toBe(403);
      expect(restrictedIce.body.error).toBe('PROFILE_RESTRICTED');
    });
  });
});
