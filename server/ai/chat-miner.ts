import { getDb } from '../db.js';
import type { BlackboardTopic } from '../../src/shared/types.js';

export interface InterestCluster {
  key: string;
  label: string;
  blackboardTopic: BlackboardTopic;
  keywords: readonly string[];
}

/**
 * 14 rich Kenyan lifestyle & social interest clusters used by the behind-the-hood
 * AI chat-mining and compatibility engine.
 */
export const INTEREST_CLUSTERS: readonly InterestCluster[] = [
  {
    key: 'sports_athletics',
    label: 'Sports & Athletics',
    blackboardTopic: 'Sports',
    keywords: [
      'sports',
      'football',
      'soccer',
      'arsenal',
      'chelsea',
      'man utd',
      'liverpool',
      'epl',
      'rugby',
      'shujaa',
      'sevens',
      'f1',
      'formula 1',
      'running',
      'marathon',
      'athletics',
      'basketball',
      'volleyball',
      'golf',
      'tennis',
      'turf',
      '5-a-side',
      'pitch',
      'stadium',
      'nyayo',
    ],
  },
  {
    key: 'coffee_food',
    label: 'Coffee & Kenyan Foodies',
    blackboardTopic: 'Hangouts',
    keywords: [
      'coffee',
      'espresso',
      'latte',
      'matcha',
      'kahawa',
      'tea',
      'chai',
      'brunch',
      'food',
      'nyama choma',
      'choma',
      'tilapia',
      'pilau',
      'biryani',
      'swahili',
      'tapas',
      'dinner',
      'eatery',
      'restaurant',
      'cafe',
      'foodie',
      'chef',
      'wine',
      'cocktail',
    ],
  },
  {
    key: 'tech_startups',
    label: 'Tech & Startups',
    blackboardTopic: 'Lifestyle',
    keywords: [
      'tech',
      'startup',
      'startups',
      'fintech',
      'coding',
      'code',
      'developer',
      'software',
      'ai',
      'silicon savannah',
      'product',
      'design',
      'agri-tech',
      'climate-tech',
      'ev',
      'e-bus',
      'electric',
      'gaming',
      'campus',
      'digital',
    ],
  },
  {
    key: 'music_concerts',
    label: 'Music & Live Sessions',
    blackboardTopic: 'Lifestyle',
    keywords: [
      'music',
      'afrobeats',
      'afro-house',
      'amapiano',
      'rhumba',
      'ohangla',
      'gengetone',
      'jazz',
      'vinyl',
      'playlist',
      'playlists',
      'concert',
      'concerts',
      'live bands',
      'live sessions',
      'dj',
      'salsa',
      'acoustic',
      'guitar',
      'sound',
    ],
  },
  {
    key: 'travel_roadtrips',
    label: 'Travel & Roadtrips',
    blackboardTopic: 'Hangouts',
    keywords: [
      'travel',
      'roadtrip',
      'roadtrips',
      'diani',
      'naivasha',
      'nyali',
      'mombasa',
      'lamu',
      'kisumu',
      'nakuru',
      'nanyuki',
      'safari',
      'dhow',
      'ocean',
      'beach',
      'lake',
      'sunset',
      'flight',
      'aviation',
      'getaway',
      'weekend trip',
    ],
  },
  {
    key: 'fitness_outdoors',
    label: 'Fitness & Karura Trails',
    blackboardTopic: 'Health',
    keywords: [
      'fitness',
      'hiking',
      'hike',
      'karura',
      'ngong hills',
      'arboretum',
      'gym',
      'workout',
      'cycling',
      'bike',
      'yoga',
      'pilates',
      'swimming',
      'trail',
      'stretch',
      'mobility',
      'crossfit',
    ],
  },
  {
    key: 'politics_civic',
    label: 'Civic & Governance',
    blackboardTopic: 'Politics',
    keywords: [
      'politics',
      'governance',
      'county',
      'counties',
      'budget',
      'policy',
      'urban planning',
      'infrastructure',
      'traffic',
      'parliament',
      'law',
      'civic',
      'public services',
      'constitution',
      'walkable',
    ],
  },
  {
    key: 'health_wellness',
    label: 'Health & Wellness',
    blackboardTopic: 'Health',
    keywords: [
      'health',
      'wellness',
      'sleep',
      'hydration',
      'nutrition',
      'mental health',
      'therapy',
      'breathwork',
      'meditation',
      'nurse',
      'pharmacist',
      'doctor',
      'self-care',
      'mindfulness',
      'calm',
    ],
  },
  {
    key: 'movies_art_books',
    label: 'Art, Books & Cinema',
    blackboardTopic: 'Lifestyle',
    keywords: [
      'movies',
      'cinema',
      'film',
      'netflix',
      'books',
      'reading',
      'bookclub',
      'art',
      'gallery',
      'galleries',
      'photography',
      'camera',
      'skyline',
      'architecture',
      'fashion',
      'creative',
      'memes',
    ],
  },
  {
    key: 'business_finance',
    label: 'Business & Ambition',
    blackboardTopic: 'Lifestyle',
    keywords: [
      'business',
      'finance',
      'investing',
      'investment',
      'founder',
      'entrepreneur',
      'hospitality',
      'logistics',
      'export',
      'consulting',
      'career',
      'hustle',
      'side hustle',
      'real estate',
      'sacco',
      'mmf',
    ],
  },
  {
    key: 'faith_community',
    label: 'Community & Purpose',
    blackboardTopic: 'Lifestyle',
    keywords: [
      'faith',
      'community',
      'volunteer',
      'mentorship',
      'charity',
      'climate',
      'sustainability',
      'purpose',
      'gratitude',
      'church',
      'mosque',
      'giving back',
    ],
  },
  {
    key: 'nightlife_hangouts',
    label: 'Rooftops & Hangouts',
    blackboardTopic: 'Hangouts',
    keywords: [
      'hangout',
      'hangouts',
      'rooftop',
      'nightlife',
      'westlands',
      'kilimani',
      'lavington',
      'dunga',
      'vibe',
      'vibes',
      'chill',
      'lounge',
      'party',
      'friday',
      'saturday',
      'drinks',
      'club',
      'pop-up',
      'social',
    ],
  },
  {
    key: 'pets_nature',
    label: 'Nature & Outdoors',
    blackboardTopic: 'Health',
    keywords: [
      'pets',
      'dog',
      'dogs',
      'cat',
      'cats',
      'nature',
      'forest',
      'park',
      'garden',
      'plants',
      'wildlife',
      'birds',
      'camping',
      'sunrise',
      'outdoors',
    ],
  },
  {
    key: 'family_relationships',
    label: 'Connection & Conversation',
    blackboardTopic: 'Hangouts',
    keywords: [
      'family',
      'relationship',
      'relationships',
      'dating',
      'date',
      'dinner date',
      'conversation',
      'banter',
      'laughter',
      'honest',
      'real talks',
      'partner',
      'companion',
      'romance',
    ],
  },
] as const;

const CLUSTER_BY_KEY = new Map<string, InterestCluster>(
  INTEREST_CLUSTERS.map((c) => [c.key, c])
);

export function getClusterLabel(topicKey: string): string {
  const cluster = CLUSTER_BY_KEY.get(topicKey);
  if (cluster) return cluster.label;
  // Seed keywords might also be stored directly as raw topic_keys (e.g. 'coffee', 'karura')
  const matched = findClusterForRawKeyword(topicKey);
  if (matched) return matched.label;
  return topicKey
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function getClusterBlackboardTopic(
  topicKey: string
): BlackboardTopic | null {
  const direct = CLUSTER_BY_KEY.get(topicKey);
  if (direct) return direct.blackboardTopic;
  const matched = findClusterForRawKeyword(topicKey);
  return matched ? matched.blackboardTopic : null;
}

export function findClusterForRawKeyword(raw: string): InterestCluster | null {
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;
  if (CLUSTER_BY_KEY.has(lower)) {
    return CLUSTER_BY_KEY.get(lower)!;
  }
  for (const cluster of INTEREST_CLUSTERS) {
    if (
      cluster.keywords.some(
        (kw) => lower === kw || lower.includes(kw) || kw.includes(lower)
      )
    ) {
      return cluster;
    }
  }
  return null;
}

/**
 * Extracts matching interest cluster keys from freeform chat or Blackboard text.
 */
export function extractInterestTopicsFromText(text: string): string[] {
  const normalized = text.toLowerCase();
  const found: string[] = [];

  for (const cluster of INTEREST_CLUSTERS) {
    const hit = cluster.keywords.some((kw) => {
      if (kw.includes(' ') || kw.includes('-')) {
        return normalized.includes(kw);
      }
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
    });
    if (hit) {
      found.push(cluster.key);
    }
  }

  return found;
}

/**
 * Mines chat or Blackboard text for interest clusters and increments user_chat_topics
 * weights dynamically in SQLite. Returns human-friendly labels of newly mined topics.
 */
export function mineChatInterests(
  userId: string,
  text: string,
  weightIncrement = 1.5
): string[] {
  if (!userId || !text || !text.trim()) return [];

  const matchedKeys = extractInterestTopicsFromText(text);
  if (matchedKeys.length === 0) return [];

  const db = getDb();
  const nowIso = new Date().toISOString();

  const upsert = db.prepare(
    `INSERT INTO user_chat_topics (user_id, topic_key, weight, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, topic_key)
     DO UPDATE SET
       weight = MIN(25.0, user_chat_topics.weight + excluded.weight),
       updated_at = excluded.updated_at`
  );

  for (const key of matchedKeys) {
    upsert.run(userId, key, weightIncrement, nowIso);
  }

  return matchedKeys.map((key) => getClusterLabel(key));
}

/**
 * Loads a user's normalized cluster interest vector (mapping cluster.key -> weight),
 * automatically folding any seeded raw keywords (e.g. 'coffee', 'karura') into their
 * canonical cluster keys so seeded users and live-chatting users align cleanly.
 */
export function getUserInterestVector(userId: string): Map<string, number> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT topic_key, weight
       FROM user_chat_topics
       WHERE user_id = ?
       ORDER BY weight DESC`
    )
    .all(userId) as unknown as Array<{ topic_key: string; weight: number }>;

  const vector = new Map<string, number>();

  for (const row of rows) {
    const rawKey = String(row.topic_key || '').trim().toLowerCase();
    const weight = Number(row.weight ?? 1);
    if (!rawKey || !Number.isFinite(weight) || weight <= 0) continue;

    const cluster = findClusterForRawKeyword(rawKey);
    const canonicalKey = cluster ? cluster.key : rawKey;
    vector.set(canonicalKey, (vector.get(canonicalKey) ?? 0) + weight);
  }

  return vector;
}

/**
 * Returns top human-readable interest labels for a user.
 */
export function getUserTopInterestLabels(userId: string, limit = 6): string[] {
  const vector = getUserInterestVector(userId);
  return [...vector.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => getClusterLabel(key));
}

// ============================================================================
// Community Positivity & Safety Guard
// ============================================================================

const SEVERE_ABUSE_PATTERNS: readonly RegExp[] = [
  /\b(kill yourself|kys|go die|i will kill you|murder you)\b/i,
  /\b(rape|rapist)\b/i,
  /\b(nigger|faggot|kike|retard)\b/i,
  /\b(terrorist attack|bomb threat)\b/i,
];

export interface PositivityCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Friendly community safety guard — gently blocks severe slurs, violent threats,
 * and extreme abuse while allowing normal Kenyan banter, politics, and sports debate.
 */
export function checkPositivity(text: string): PositivityCheckResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Message cannot be empty.' };
  }

  for (const pattern of SEVERE_ABUSE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason:
          '47 Cities keeps conversations respectful and safe. Please rephrase without abusive language or threats.',
      };
    }
  }

  return { allowed: true };
}
