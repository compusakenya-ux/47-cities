import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../server/index.js';
import { closeDb, resetDbForTests } from '../server/db.js';
import { DEMO_USER_EMAIL, DEMO_USER_PASSWORD } from '../server/seed.js';
import { SEED_USERS, TEST_CITY_PINS } from '../src/shared/kenya-data.js';
import type {
  AIMatchSuggestion,
  AgeRange,
  BlackboardPost,
  Gender,
  HateWithPassionOption,
  InterestedIn,
  LookingForOption,
  PublicMemberProfile,
  StoryItem,
} from '../src/shared/types.js';

const EXPECTED_PUBLIC_KEYS = [
  'ageRange',
  'avatarUrl',
  'gender',
  'id',
  'isOnline',
  'lastActiveAt',
  'nickname',
  'withinProximity',
].sort();

const FORBIDDEN_PRIVATE_KEYS = [
  'email',
  'lat',
  'lng',
  'distance',
  'distanceKm',
  'homeCounty',
  'home_county',
  'hasChildren',
  'has_children',
  'lookingFor',
  'looking_for_json',
  'hateWithPassion',
  'hate_with_passion_json',
  'interestedIn',
  'interested_in',
  'password_hash',
  'passwordHash',
  'disclaimerSignature',
  'activeCityLabel',
  'bio',
];

function assertStrictPublicMemberProfile(profile: unknown, contextLabel: string): void {
  expect(profile, `${contextLabel}: profile must be defined`).toBeTruthy();
  expect(typeof profile, `${contextLabel}: profile must be an object`).toBe('object');
  const obj = profile as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  expect(keys, `${contextLabel}: must contain ONLY the 8 PublicMemberProfile keys`).toEqual(
    EXPECTED_PUBLIC_KEYS
  );
  for (const forbidden of FORBIDDEN_PRIVATE_KEYS) {
    expect(obj, `${contextLabel}: must not expose private field "${forbidden}"`).not.toHaveProperty(
      forbidden
    );
  }
  expect(obj.withinProximity).toBe(true);
  expect(['Man', 'Woman']).toContain(obj.gender);
}

interface TestRegisterBody {
  email: string;
  password: string;
  nickname: string;
  gender: Gender;
  ageRange: AgeRange;
  interestedIn: InterestedIn;
  hasChildren: boolean;
  homeCounty: string;
  lookingFor: LookingForOption[];
  hateWithPassion: HateWithPassionOption[];
  bio: string;
  confirmedAdult: boolean;
  acceptedResponsibility: boolean;
  signature: string;
}

const VALID_BASE_REGISTRATION: TestRegisterBody = {
  email: 'juma.nairobi@47cities.ke',
  password: 'StrongPassword2026!',
  nickname: 'JumaNBO',
  gender: 'Man',
  ageRange: '26-29',
  interestedIn: 'Women',
  hasChildren: false,
  homeCounty: 'Nairobi',
  lookingFor: ['Soulmate', 'Hangout'],
  hateWithPassion: ['Ujinga', 'Liar'],
  bio: 'Nairobi rooftop coffee and Sunday football.',
  confirmedAdult: true,
  acceptedResponsibility: true,
  signature: 'JumaNBO',
};

const NAIROBI_PIN = TEST_CITY_PINS.find((p) => p.id === 'nairobi-cbd')!;
const MOMBASA_PIN = TEST_CITY_PINS.find((p) => p.id === 'mombasa-nyali')!;
const KISUMU_PIN = TEST_CITY_PINS.find((p) => p.id === 'kisumu-milimani')!;

describe('47 Cities — Auth, 18+ Disclaimer, Location Gate, 10 km Proximity & Privacy Shield', () => {
  let app: Express;

  beforeEach(() => {
    resetDbForTests(':memory:');
    app = createApp();
  });

  afterAll(() => {
    closeDb();
  });

  async function registerAndVerifyAgent(
    overrides: Partial<typeof VALID_BASE_REGISTRATION> = {}
  ) {
    const agent = request.agent(app);
    const payload = { ...VALID_BASE_REGISTRATION, ...overrides };

    const regRes = await agent.post('/api/auth/register').send(payload);
    expect(regRes.status).toBe(201);
    expect(regRes.body.verificationRequired).toBe(true);

    const inboxRes = await agent
      .get('/api/auth/dev-inbox')
      .query({ email: payload.email });
    expect(inboxRes.status).toBe(200);
    expect(inboxRes.body.messages.length).toBeGreaterThanOrEqual(1);
    const verifyCode: string = inboxRes.body.messages[0].code;
    expect(verifyCode).toMatch(/^\d{6}$/);

    const verifyRes = await agent.post('/api/auth/verify-email').send({
      email: payload.email,
      code: verifyCode,
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.ok).toBe(true);
    expect(verifyRes.body.user.emailVerified).toBe(true);

    return { agent, user: verifyRes.body.user, payload };
  }

  describe('1. Email-Only Registration, 18+ Disclaimer & Auth Lifecycle', () => {
    it('rejects missing or incomplete 18+ disclaimer with 400 DISCLAIMER_REQUIRED', async () => {
      const noAdult = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_BASE_REGISTRATION, confirmedAdult: false });
      expect(noAdult.status).toBe(400);
      expect(noAdult.body.error).toBe('DISCLAIMER_REQUIRED');

      const noResp = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_BASE_REGISTRATION, acceptedResponsibility: false });
      expect(noResp.status).toBe(400);
      expect(noResp.body.error).toBe('DISCLAIMER_REQUIRED');

      const noSig = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_BASE_REGISTRATION, signature: '' });
      expect(noSig.status).toBe(400);
      expect(noSig.body.error).toBe('DISCLAIMER_REQUIRED');
    });

    it('rejects invalid email, weak password, and duplicate email', async () => {
      const badEmail = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_BASE_REGISTRATION, email: '+254712345678' });
      expect(badEmail.status).toBe(400);
      expect(badEmail.body.error).toBe('INVALID_EMAIL');

      const weakPwd = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_BASE_REGISTRATION, password: '123' });
      expect(weakPwd.status).toBe(400);
      expect(weakPwd.body.error).toBe('WEAK_PASSWORD');

      const dup = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_BASE_REGISTRATION, email: DEMO_USER_EMAIL });
      expect(dup.status).toBe(409);
      expect(dup.body.error).toBe('EMAIL_EXISTS');
    });

    it('blocks unverified login with 403 EMAIL_NOT_VERIFIED, then supports verify, me, login, and password reset', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(VALID_BASE_REGISTRATION);
      expect(regRes.status).toBe(201);

      const unverifiedLogin = await request(app).post('/api/auth/login').send({
        email: VALID_BASE_REGISTRATION.email,
        password: VALID_BASE_REGISTRATION.password,
      });
      expect(unverifiedLogin.status).toBe(403);
      expect(unverifiedLogin.body.error).toBe('EMAIL_NOT_VERIFIED');

      // Verify via 6-digit code in Dev Inbox
      const inbox = await request(app)
        .get('/api/auth/dev-inbox')
        .query({ email: VALID_BASE_REGISTRATION.email });
      const verifyCode = inbox.body.messages[0].code;

      const agent = request.agent(app);
      const verifyRes = await agent.post('/api/auth/verify-email').send({
        email: VALID_BASE_REGISTRATION.email,
        code: verifyCode,
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.user.email).toBe(VALID_BASE_REGISTRATION.email);
      expect(verifyRes.body.user.disclaimerSigned).toBe(true);
      expect(verifyRes.body.user.disclaimerSignature).toBe('JumaNBO');
      expect(verifyRes.body.user.locationActive).toBe(false);

      // /api/auth/me works with session cookie
      const meRes = await agent.get('/api/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.nickname).toBe('JumaNBO');

      // Forgot & reset password flow
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: VALID_BASE_REGISTRATION.email });
      expect(forgotRes.status).toBe(200);

      const resetInbox = await request(app)
        .get('/api/auth/dev-inbox')
        .query({ email: VALID_BASE_REGISTRATION.email });
      const resetMsg = resetInbox.body.messages.find(
        (m: { purpose: string }) => m.purpose === 'reset'
      );
      expect(resetMsg).toBeTruthy();

      const resetRes = await request(app).post('/api/auth/reset-password').send({
        email: VALID_BASE_REGISTRATION.email,
        code: resetMsg.code,
        newPassword: 'NewSecurePassword99!',
      });
      expect(resetRes.status).toBe(200);

      // Old password rejected, new password succeeds
      const oldLogin = await request(app).post('/api/auth/login').send({
        email: VALID_BASE_REGISTRATION.email,
        password: VALID_BASE_REGISTRATION.password,
      });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app).post('/api/auth/login').send({
        email: VALID_BASE_REGISTRATION.email,
        password: 'NewSecurePassword99!',
      });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.user.email).toBe(VALID_BASE_REGISTRATION.email);
    });
  });

  describe('2. Mandatory Location Gate (Lock -> Activate -> Unlock -> Deactivate -> Re-Lock)', () => {
    const GATED_ENDPOINTS = [
      '/api/members/nearby',
      '/api/blackboard',
      '/api/stories',
      '/api/chat/threads',
      '/api/ai/matches',
      '/api/ai/whats-next',
    ];

    it('returns 403 LOCATION_REQUIRED on all gated routes until location is activated, then re-locks on deactivate', async () => {
      const agent = request.agent(app);
      const loginRes = await agent.post('/api/auth/login').send({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.locationActive).toBe(false);

      // Phase A: All gated endpoints MUST be locked (403 LOCATION_REQUIRED)
      for (const endpoint of GATED_ENDPOINTS) {
        const res = await agent.get(endpoint);
        expect(res.status, `GET ${endpoint} must return 403 while location is OFF`).toBe(403);
        expect(res.body.error).toBe('LOCATION_REQUIRED');
      }

      // Phase B: Activate location in Nairobi CBD
      const activateRes = await agent.post('/api/location/activate').send({
        lat: NAIROBI_PIN.lat,
        lng: NAIROBI_PIN.lng,
        cityLabel: NAIROBI_PIN.label,
        source: 'test-pin',
      });
      expect(activateRes.status).toBe(200);
      expect(activateRes.body.user.locationActive).toBe(true);
      expect(activateRes.body.nearbyCount).toBe(12);

      // All gated endpoints MUST unlock (200)
      for (const endpoint of GATED_ENDPOINTS) {
        const res = await agent.get(endpoint);
        expect(res.status, `GET ${endpoint} must return 200 while location is ON`).toBe(200);
      }

      // Phase C: Deactivate location -> immediate re-lock
      const deactivateRes = await agent.post('/api/location/deactivate');
      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.user.locationActive).toBe(false);

      for (const endpoint of GATED_ENDPOINTS) {
        const res = await agent.get(endpoint);
        expect(res.status, `GET ${endpoint} must immediately re-lock to 403`).toBe(403);
        expect(res.body.error).toBe('LOCATION_REQUIRED');
      }
    });
  });

  describe('3. 10 km Proximity Radius & Zero-Leak Privacy Shield', () => {
    it('enforces strict 10 km radius in Nairobi (excludes 18 km Ruiru/Kitengela, Mombasa, and Kisumu) and switches cleanly per city pin', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
      });

      // Activate Nairobi CBD
      await agent.post('/api/location/activate').send({
        lat: NAIROBI_PIN.lat,
        lng: NAIROBI_PIN.lng,
        cityLabel: NAIROBI_PIN.label,
      });

      const nboRes = await agent.get('/api/members/nearby');
      expect(nboRes.status).toBe(200);
      const nboIds = (nboRes.body.members as PublicMemberProfile[]).map((m) => m.id);

      // Should include all 12 inner Nairobi seed users
      expect(nboIds).toHaveLength(12);
      for (let i = 1; i <= 12; i++) {
        expect(nboIds).toContain(`user-nbo-${String(i).padStart(2, '0')}`);
      }
      // Must EXCLUDE outer Nairobi (~18 km), Mombasa, and Kisumu
      expect(nboIds).not.toContain('user-far-01');
      expect(nboIds).not.toContain('user-far-02');
      expect(nboIds).not.toContain('user-msa-01');
      expect(nboIds).not.toContain('user-msa-02');
      expect(nboIds).not.toContain('user-ksm-01');
      expect(nboIds).not.toContain('user-ksm-02');

      // Direct access to >10 km member MUST be blocked with 403 PROFILE_RESTRICTED
      const farDirect = await agent.get('/api/members/user-far-01');
      expect(farDirect.status).toBe(403);
      expect(farDirect.body.error).toBe('PROFILE_RESTRICTED');

      const msaDirect = await agent.get('/api/members/user-msa-01');
      expect(msaDirect.status).toBe(403);
      expect(msaDirect.body.error).toBe('PROFILE_RESTRICTED');

      // Switch to Mombasa pin -> sees ONLY Mombasa users
      await agent.post('/api/location/activate').send({
        lat: MOMBASA_PIN.lat,
        lng: MOMBASA_PIN.lng,
        cityLabel: MOMBASA_PIN.label,
      });
      const msaRes = await agent.get('/api/members/nearby');
      const msaIds = (msaRes.body.members as PublicMemberProfile[]).map((m) => m.id);
      expect(msaIds.sort()).toEqual(['user-msa-01', 'user-msa-02']);

      // Switch to Kisumu pin -> sees ONLY Kisumu users
      await agent.post('/api/location/activate').send({
        lat: KISUMU_PIN.lat,
        lng: KISUMU_PIN.lng,
        cityLabel: KISUMU_PIN.label,
      });
      const ksmRes = await agent.get('/api/members/nearby');
      const ksmIds = (ksmRes.body.members as PublicMemberProfile[]).map((m) => m.id);
      expect(ksmIds.sort()).toEqual(['user-ksm-01', 'user-ksm-02']);
    });

    it('enforces the 8-key PublicMemberProfile Privacy Shield across EVERY endpoint and prevents private-field leaks in AI reasons/icebreakers', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
      });
      await agent.post('/api/location/activate').send({
        lat: NAIROBI_PIN.lat,
        lng: NAIROBI_PIN.lng,
        cityLabel: NAIROBI_PIN.label,
      });

      // Seed a chat thread so /api/chat/threads returns a peer
      const msgRes = await agent
        .post('/api/chat/messages/user-nbo-01/text')
        .send({ text: 'Hello Amani! Love coffee and jazz around Nairobi ☕🎶' });
      expect(msgRes.status).toBe(201);

      // 1. /api/members/nearby
      const nearbyRes = await agent.get('/api/members/nearby');
      expect(nearbyRes.status).toBe(200);
      expect(nearbyRes.body.members.length).toBeGreaterThan(0);
      for (const m of nearbyRes.body.members) {
        assertStrictPublicMemberProfile(m, 'GET /api/members/nearby');
      }

      // 2. /api/members/:id
      const singleRes = await agent.get('/api/members/user-nbo-01');
      expect(singleRes.status).toBe(200);
      assertStrictPublicMemberProfile(singleRes.body.member, 'GET /api/members/:id');

      // 3. /api/blackboard
      const bbRes = await agent.get('/api/blackboard');
      expect(bbRes.status).toBe(200);
      expect(bbRes.body.posts.length).toBeGreaterThan(0);
      for (const post of bbRes.body.posts as BlackboardPost[]) {
        assertStrictPublicMemberProfile(post.author, `GET /api/blackboard post ${post.id}`);
      }

      // 4. /api/stories
      const storiesRes = await agent.get('/api/stories');
      expect(storiesRes.status).toBe(200);
      expect(storiesRes.body.stories.length).toBeGreaterThan(0);
      for (const story of storiesRes.body.stories as StoryItem[]) {
        assertStrictPublicMemberProfile(story.author, `GET /api/stories story ${story.id}`);
      }

      // 5. /api/chat/threads
      const threadsRes = await agent.get('/api/chat/threads');
      expect(threadsRes.status).toBe(200);
      expect(threadsRes.body.threads.length).toBeGreaterThanOrEqual(1);
      for (const thread of threadsRes.body.threads) {
        assertStrictPublicMemberProfile(thread.peer, 'GET /api/chat/threads');
      }

      // 6. /api/ai/matches & private-field non-leakage check
      const matchesRes = await agent.get('/api/ai/matches');
      expect(matchesRes.status).toBe(200);
      const matches = matchesRes.body.matches as AIMatchSuggestion[];
      expect(matches.length).toBeGreaterThan(0);

      const seedById = new Map(SEED_USERS.map((u) => [u.id, u]));

      for (const match of matches) {
        assertStrictPublicMemberProfile(match.member, `GET /api/ai/matches ${match.member.id}`);

        const seed = seedById.get(match.member.id);
        if (!seed) continue;

        const aiText = [...match.reasons, match.icebreaker, match.vibeLabel].join(' ').toLowerCase();

        // Must NEVER reveal peer's private homeCounty, email, hasChildren, or hateWithPassion
        expect(aiText, `AI output leaked email for ${seed.id}`).not.toContain(
          seed.email.toLowerCase()
        );
        if (seed.homeCounty.toLowerCase() !== 'nairobi') {
          expect(
            aiText,
            `AI output leaked private homeCounty "${seed.homeCounty}" for ${seed.id}`
          ).not.toContain(seed.homeCounty.toLowerCase());
        }
        for (const hate of seed.hateWithPassion) {
          expect(
            aiText,
            `AI output leaked private hateWithPassion "${hate}" for ${seed.id}`
          ).not.toContain(hate.toLowerCase());
        }
        expect(aiText, `AI output leaked parental status for ${seed.id}`).not.toMatch(
          /\b(has children|no children|proud dad|has kids|no kids|parent)\b/i
        );
      }
    });
  });

  describe('4. Strict "Interested In" Gender Access Control (Women / Men / Both)', () => {
    it('enforces Women-only visibility and blocks direct Man profile & chat access with 403 PROFILE_RESTRICTED', async () => {
      const { agent } = await registerAndVerifyAgent({
        email: 'interested.women@47cities.ke',
        nickname: 'KenWomen',
        gender: 'Man',
        interestedIn: 'Women',
      });

      await agent.post('/api/location/activate').send({
        lat: NAIROBI_PIN.lat,
        lng: NAIROBI_PIN.lng,
        cityLabel: NAIROBI_PIN.label,
      });

      const nearbyRes = await agent.get('/api/members/nearby');
      expect(nearbyRes.status).toBe(200);
      const members = nearbyRes.body.members as PublicMemberProfile[];
      expect(members).toHaveLength(6); // 6 Nairobi Women
      expect(members.every((m) => m.gender === 'Woman')).toBe(true);

      // Direct profile & chat access to Nairobi Man (user-nbo-02) MUST return 403 PROFILE_RESTRICTED
      const manProfile = await agent.get('/api/members/user-nbo-02');
      expect(manProfile.status).toBe(403);
      expect(manProfile.body.error).toBe('PROFILE_RESTRICTED');

      const manMessages = await agent.get('/api/chat/messages/user-nbo-02');
      expect(manMessages.status).toBe(403);
      expect(manMessages.body.error).toBe('PROFILE_RESTRICTED');

      const manSend = await agent
        .post('/api/chat/messages/user-nbo-02/text')
        .send({ text: 'Should be blocked' });
      expect(manSend.status).toBe(403);
      expect(manSend.body.error).toBe('PROFILE_RESTRICTED');

      // Allowed access to Nairobi Woman (user-nbo-01)
      const womanProfile = await agent.get('/api/members/user-nbo-01');
      expect(womanProfile.status).toBe(200);
      expect(womanProfile.body.member.gender).toBe('Woman');
    });

    it('enforces Men-only visibility and blocks direct Woman profile access', async () => {
      const { agent } = await registerAndVerifyAgent({
        email: 'interested.men@47cities.ke',
        nickname: 'NiaMen',
        gender: 'Woman',
        interestedIn: 'Men',
      });

      await agent.post('/api/location/activate').send({
        lat: NAIROBI_PIN.lat,
        lng: NAIROBI_PIN.lng,
        cityLabel: NAIROBI_PIN.label,
      });

      const nearbyRes = await agent.get('/api/members/nearby');
      expect(nearbyRes.status).toBe(200);
      const members = nearbyRes.body.members as PublicMemberProfile[];
      expect(members).toHaveLength(6); // 6 Nairobi Men
      expect(members.every((m) => m.gender === 'Man')).toBe(true);

      const womanProfile = await agent.get('/api/members/user-nbo-01');
      expect(womanProfile.status).toBe(403);
      expect(womanProfile.body.error).toBe('PROFILE_RESTRICTED');
    });

    it('allows Both viewer to see both Men and Women within 10 km', async () => {
      const { agent } = await registerAndVerifyAgent({
        email: 'interested.both@47cities.ke',
        nickname: 'ZuriBoth',
        gender: 'Woman',
        interestedIn: 'Both',
      });

      await agent.post('/api/location/activate').send({
        lat: NAIROBI_PIN.lat,
        lng: NAIROBI_PIN.lng,
        cityLabel: NAIROBI_PIN.label,
      });

      const nearbyRes = await agent.get('/api/members/nearby');
      expect(nearbyRes.status).toBe(200);
      const members = nearbyRes.body.members as PublicMemberProfile[];
      expect(members).toHaveLength(12);
      expect(members.some((m) => m.gender === 'Man')).toBe(true);
      expect(members.some((m) => m.gender === 'Woman')).toBe(true);
    });
  });
});
