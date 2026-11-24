import { getDb } from '../db.js';
import { canAccessMember, toPublicMemberProfile } from '../geo.js';
import {
  getClusterBlackboardTopic,
  getClusterLabel,
  getUserInterestVector,
} from './chat-miner.js';
import { AGE_RANGES } from '../../src/shared/kenya-data.js';
import type {
  AIMatchSuggestion,
  AgeRange,
  BlackboardTopic,
  HateWithPassionOption,
  LookingForOption,
} from '../../src/shared/types.js';

export interface DbUserRow {
  id: string;
  email: string;
  nickname: string;
  avatar_url: string;
  gender: string;
  age_range: string;
  interested_in: string;
  has_children: number;
  home_county: string;
  looking_for_json: string;
  hate_with_passion_json: string;
  bio: string | null;
  email_verified: number;
  location_active: number;
  lat: number | null;
  lng: number | null;
  active_city_label: string | null;
  is_online: number;
  last_active_at: string;
}

const COUNTY_REGIONS: Record<string, string> = {
  // Coast
  Mombasa: 'coast',
  Kwale: 'coast',
  Kilifi: 'coast',
  'Tana River': 'coast',
  Lamu: 'coast',
  'Taita-Taveta': 'coast',
  // North Eastern
  Garissa: 'north_eastern',
  Wajir: 'north_eastern',
  Mandera: 'north_eastern',
  // Upper Eastern
  Marsabit: 'eastern',
  Isiolo: 'eastern',
  Meru: 'eastern',
  'Tharaka-Nithi': 'eastern',
  Embu: 'eastern',
  // Lower Eastern
  Kitui: 'lower_eastern',
  Machakos: 'lower_eastern',
  Makueni: 'lower_eastern',
  // Central & Nairobi Metro
  Nyandarua: 'central',
  Nyeri: 'central',
  Kirinyaga: 'central',
  "Murang'a": 'central',
  Kiambu: 'nairobi_metro',
  Nairobi: 'nairobi_metro',
  Kajiado: 'nairobi_metro',
  // Rift Valley
  Turkana: 'rift',
  'West Pokot': 'rift',
  Samburu: 'rift',
  'Trans Nzoia': 'rift',
  'Uasin Gishu': 'rift',
  'Elgeyo-Marakwet': 'rift',
  Nandi: 'rift',
  Baringo: 'rift',
  Laikipia: 'rift',
  Nakuru: 'rift',
  Narok: 'rift',
  Kericho: 'rift',
  Bomet: 'rift',
  // Western
  Kakamega: 'western',
  Vihiga: 'western',
  Bungoma: 'western',
  Busia: 'western',
  // Nyanza
  Siaya: 'nyanza',
  Kisumu: 'nyanza',
  'Homa Bay': 'nyanza',
  Migori: 'nyanza',
  Kisii: 'nyanza',
  Nyamira: 'nyanza',
};

function safeParseArray<T extends string>(jsonStr: string | null | undefined): T[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function computeCosineAndShared(
  a: Map<string, number>,
  b: Map<string, number>
): { similarity: number; sharedKeys: string[] } {
  if (a.size === 0 || b.size === 0) {
    return { similarity: 0, sharedKeys: [] };
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  const sharedPairs: Array<{ key: string; weight: number }> = [];

  for (const [, va] of a) {
    normA += va * va;
  }
  for (const [, vb] of b) {
    normB += vb * vb;
  }

  for (const [key, va] of a) {
    const vb = b.get(key);
    if (vb !== undefined && vb > 0) {
      dot += va * vb;
      sharedPairs.push({ key, weight: va + vb });
    }
  }

  sharedPairs.sort((x, y) => y.weight - x.weight);

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  const similarity = denom > 0 ? dot / denom : 0;

  return {
    similarity,
    sharedKeys: sharedPairs.map((p) => p.key),
  };
}

function getAgeRangeIndex(ageRange: string): number {
  return AGE_RANGES.indexOf(ageRange as AgeRange);
}

function getVibeLabel(score: number): string {
  if (score >= 88) return 'Electric Wavelength';
  if (score >= 76) return 'High-Harmony Spark';
  if (score >= 64) return 'Warm City Match';
  if (score >= 52) return 'Fresh Nearby Energy';
  return 'Curious Connection';
}

function buildPrivacySafeIcebreaker(
  nickname: string,
  sharedKeys: string[],
  sharedTopics: BlackboardTopic[],
  isOnline: boolean
): string {
  const topKey = sharedKeys[0];
  if (topKey) {
    const label = getClusterLabel(topKey);
    const openersByCluster: Record<string, string> = {
      sports_athletics: `Hey ${nickname}! Looks like we both keep up with sports energy — what's been your top match or workout highlight this week?`,
      coffee_food: `Hey ${nickname}! Quick city test: iced coffee spot or legendary nyama choma for a laid-back weekend hangout?`,
      tech_startups: `Hey ${nickname}! Fellow tech-curious mind here — what's the coolest thing you've been building or geeking out on lately?`,
      music_concerts: `Hey ${nickname}! If you were passing the aux right now, which track is setting the mood?`,
      travel_roadtrips: `Hey ${nickname}! Spontaneous weekend escape — coast breeze, Rift Valley views, or hidden highland spot?`,
      fitness_outdoors: `Hey ${nickname}! Morning trail walk or sunset stretch — what's your favorite way to recharge in the city?`,
      politics_civic: `Hey ${nickname}! Love a sharp conversation — if you could upgrade one everyday city experience overnight, what's first?`,
      health_wellness: `Hey ${nickname}! What's one small wellness ritual that's been keeping your energy right this week?`,
      movies_art_books: `Hey ${nickname}! What's the last film, playlist, or creative spot that genuinely surprised you?`,
      business_finance: `Hey ${nickname}! Big energy — what exciting project or goal has your focus this season?`,
      nightlife_hangouts: `Hey ${nickname}! Rooftop sunset vibes or quiet courtyard dinner — what's your kind of evening?`,
    };
    if (openersByCluster[topKey]) {
      return openersByCluster[topKey];
    }
    return `Hey ${nickname}! Seems we're both into ${label} — what's your favorite part of it right now?`;
  }

  if (sharedTopics.length > 0) {
    return `Hey ${nickname}! Seeing great ${sharedTopics[0]} energy on the Blackboard lately — how's your day unfolding?`;
  }

  if (isOnline) {
    return `Hey ${nickname}! Spotted you active nearby on 47 Cities — how is the city treating you today?`;
  }

  return `Hey ${nickname}! Loving the vibe on 47 Cities — what's been the highlight of your week so far?`;
}

/**
 * Behind-the-hood AI Compatibility Engine.
 * Uses chat-mined interest vectors AND hidden private fields (home_county,
 * looking_for, hate_with_passion) strictly internally to compute 0-99% scores,
 * while guaranteeing zero leakage of private fields in the returned payload.
 */
export function getAIMatchesForUser(
  viewerRow: DbUserRow,
  limit = 10
): AIMatchSuggestion[] {
  const db = getDb();
  const candidates = db
    .prepare(
      `SELECT *
       FROM users
       WHERE id != ?
         AND email_verified = 1
         AND location_active = 1
         AND lat IS NOT NULL
         AND lng IS NOT NULL`
    )
    .all(viewerRow.id) as unknown as DbUserRow[];

  const viewerVector = getUserInterestVector(viewerRow.id);
  const viewerLookingFor = safeParseArray<LookingForOption>(
    viewerRow.looking_for_json
  );
  const viewerHates = safeParseArray<HateWithPassionOption>(
    viewerRow.hate_with_passion_json
  );
  const viewerAgeIdx = getAgeRangeIndex(viewerRow.age_range);
  const viewerCounty = (viewerRow.home_county || '').trim();
  const viewerRegion = COUNTY_REGIONS[viewerCounty] ?? '';

  const suggestions: AIMatchSuggestion[] = [];

  for (const candidate of candidates) {
    const access = canAccessMember(viewerRow, candidate);
    if (!access.allowed) continue;

    const candidateVector = getUserInterestVector(candidate.id);
    const { similarity, sharedKeys } = computeCosineAndShared(
      viewerVector,
      candidateVector
    );

    // 1. Chat-mined common interests (up to +38 pts)
    // Combine cosine similarity with shared-topic breadth so newly chatting users see instant lift
    const interestScore = Math.min(
      38,
      Math.round(similarity * 28 + Math.min(sharedKeys.length, 3) * 4)
    );

    // 2. Hidden Home County harmony (same county +18, neighboring region +8) — NEVER revealed!
    const candCounty = (candidate.home_county || '').trim();
    const candRegion = COUNTY_REGIONS[candCounty] ?? '';
    let countyScore = 0;
    if (viewerCounty && candCounty && viewerCounty.toLowerCase() === candCounty.toLowerCase()) {
      countyScore = 18;
    } else if (viewerRegion && candRegion && viewerRegion === candRegion) {
      countyScore = 8;
    }

    // 3. Age Range harmony (same +16, adjacent +11, 2 steps +5)
    const candAgeIdx = getAgeRangeIndex(candidate.age_range);
    let ageScore = 4;
    if (viewerAgeIdx >= 0 && candAgeIdx >= 0) {
      const diff = Math.abs(viewerAgeIdx - candAgeIdx);
      if (diff === 0) ageScore = 16;
      else if (diff === 1) ageScore = 11;
      else if (diff === 2) ageScore = 5;
      else ageScore = 2;
    }

    // 4. Hidden Looking For overlap (up to +18 pts) — NEVER revealed!
    const candLookingFor = safeParseArray<LookingForOption>(
      candidate.looking_for_json
    );
    const lookingOverlap = viewerLookingFor.filter((opt) =>
      candLookingFor.includes(opt)
    );
    const lookingScore =
      lookingOverlap.length >= 2 ? 18 : lookingOverlap.length === 1 ? 12 : 3;

    // 5. Hidden Hate With Passion silent safety check (penalizes clashes silently)
    const candHates = safeParseArray<HateWithPassionOption>(
      candidate.hate_with_passion_json
    );
    let silentPenalty = 0;
    const candBioLower = `${candidate.bio || ''} ${[...candidateVector.keys()].join(' ')}`.toLowerCase();
    if (
      viewerHates.includes('Alcoholic') &&
      /\b(club|drinks|cocktail|wine|nightlife)\b/.test(candBioLower)
    ) {
      silentPenalty += 6;
    }
    if (
      candHates.includes('Alcoholic') &&
      viewerVector.has('nightlife_hangouts')
    ) {
      silentPenalty += 4;
    }
    // Slight subtle penalty if one strictly hates "Ujinga" while looking-for intentions diverge completely
    if (
      (viewerHates.includes('Ujinga') || candHates.includes('Ujinga')) &&
      lookingOverlap.length === 0
    ) {
      silentPenalty += 4;
    }

    // 6. Online activity bonus (+10 pts)
    const onlineBonus = candidate.is_online ? 10 : 3;

    // Base warmth offset (+18) so compatible nearby singles sit naturally in 50–99%
    const rawTotal =
      18 +
      interestScore +
      countyScore +
      ageScore +
      lookingScore +
      onlineBonus -
      silentPenalty;

    const compatibilityScore = Math.max(25, Math.min(99, Math.round(rawTotal)));

    // Derive shared Blackboard topics cleanly from shared interest clusters
    const sharedTopicsSet = new Set<BlackboardTopic>();
    for (const key of sharedKeys) {
      const topic = getClusterBlackboardTopic(key);
      if (topic) sharedTopicsSet.add(topic);
    }
    if (sharedTopicsSet.size === 0) {
      for (const key of [...candidateVector.keys()].slice(0, 2)) {
        const topic = getClusterBlackboardTopic(key);
        if (topic) sharedTopicsSet.add(topic);
      }
    }
    const sharedTopics = [...sharedTopicsSet].slice(0, 3);

    // STRICTLY PRIVACY-SAFE REASONS (never mention county, children, lookingFor, hates, email, distance)
    const reasons: string[] = [];
    for (const key of sharedKeys.slice(0, 2)) {
      reasons.push(`Shared chat interest: ${getClusterLabel(key)}`);
    }
    if (countyScore >= 8 || lookingScore >= 12) {
      reasons.push('Strong background & vibe alignment');
    }
    if (ageScore >= 11) {
      reasons.push('Matching life-stage wavelength');
    }
    if (candidate.is_online) {
      reasons.push('Active nearby right now');
    }
    if (reasons.length === 0) {
      reasons.push('Fresh compatible vibe within 10 km');
    }

    const publicMember = toPublicMemberProfile(candidate);
    const icebreaker = buildPrivacySafeIcebreaker(
      publicMember.nickname,
      sharedKeys,
      sharedTopics,
      publicMember.isOnline
    );

    suggestions.push({
      member: publicMember,
      compatibilityScore,
      vibeLabel: getVibeLabel(compatibilityScore),
      reasons: reasons.slice(0, 3),
      sharedTopics,
      icebreaker,
    });
  }

  suggestions.sort((a, b) => {
    if (b.compatibilityScore !== a.compatibilityScore) {
      return b.compatibilityScore - a.compatibilityScore;
    }
    return Number(b.member.isOnline) - Number(a.member.isOnline);
  });

  return suggestions.slice(0, limit);
}

/**
 * Generates 3 privacy-safe, warm Kenyan conversation openers for a specific peer.
 */
export function generateLocalIcebreakers(
  viewerRow: DbUserRow,
  targetRow: DbUserRow
): { openers: string[]; contextHint: string } {
  const viewerVector = getUserInterestVector(viewerRow.id);
  const targetVector = getUserInterestVector(targetRow.id);
  const { sharedKeys } = computeCosineAndShared(viewerVector, targetVector);

  const nickname = targetRow.nickname;
  const openers: string[] = [];

  if (sharedKeys.length > 0) {
    const primaryLabel = getClusterLabel(sharedKeys[0]);
    openers.push(
      buildPrivacySafeIcebreaker(
        nickname,
        sharedKeys,
        [],
        Boolean(targetRow.is_online)
      )
    );
    openers.push(
      `Sasa ${nickname}! Our chats seem to orbit around ${primaryLabel} — got a hidden gem recommendation I should try this week?`
    );
    openers.push(
      `Hey ${nickname}, quick vibe check: what's one thing in the city that automatically puts you in a good mood? ✨`
    );
    return {
      openers: openers.slice(0, 3),
      contextHint: `Tailored around shared interest in ${primaryLabel} (private profile details stay shielded).`,
    };
  }

  const targetTopKey = [...targetVector.keys()][0];
  const targetHint = targetTopKey ? getClusterLabel(targetTopKey) : null;

  openers.push(
    `Hey ${nickname}! Spotted your profile nearby on 47 Cities — how's the week treating you so far? ✨`
  );
  openers.push(
    targetHint
      ? `Sasa ${nickname}! Are you more of a spontaneous weekend plan person or a slow ${targetHint.toLowerCase()} kind of vibe?`
      : `Sasa ${nickname}! Honest debate: golden-hour rooftop coffee or lively Friday hangout?`
  );
  openers.push(
    `Hey ${nickname}! If you had a free afternoon in the city right now with zero traffic, where are you heading first? 🇰🇪`
  );

  return {
    openers: openers.slice(0, 3),
    contextHint: 'Warm, privacy-safe Kenyan openers curated by 47 Cities AI.',
  };
}
