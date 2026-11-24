import { getDb } from '../db.js';
import {
  getClusterBlackboardTopic,
  getClusterLabel,
  getUserInterestVector,
} from './chat-miner.js';
import { getAIMatchesForUser, type DbUserRow } from './matcher.js';
import { BLACKBOARD_TOPICS } from '../../src/shared/kenya-data.js';
import type {
  BlackboardTopic,
  CountyPulseTopic,
  WhatsNextPrediction,
} from '../../src/shared/types.js';

interface TopicAggregateRow {
  topic: string;
  post_count: number;
  total_stars: number;
  total_views: number;
}

const TOPIC_TRENDING_TAGS: Record<BlackboardTopic, string> = {
  Politics: '#47CountiesCivic',
  Health: '#NairobiWellness',
  Sports: '#ShujaaEnergy',
  Lifestyle: '#AfroFutureKE',
  Hangouts: '#CityVibesKE',
};

const TOPIC_SUMMARIES: Record<BlackboardTopic, string> = {
  Politics: 'Smart city mobility, digital county services & sharp civic ideas.',
  Health: 'Morning runs, breathwork circles, hydration & balanced city energy.',
  Sports: 'Rugby 7s buzz, 5-a-side turf debates & weekend match squads.',
  Lifestyle: 'Vinyl pop-ups, electric transit, rhumba nights & skyline culture.',
  Hangouts: 'Karura trail coffee runs, rooftop sunsets & midweek dinner energy.',
};

function getEastAfricaHour(now = new Date()): number {
  const utcHour = now.getUTCHours();
  return (utcHour + 3) % 24;
}

function getEatTimePhase(eatHour: number): {
  label: string;
  greeting: string;
  recommendedTopic: BlackboardTopic;
  activityHint: string;
} {
  if (eatHour >= 5 && eatHour < 11) {
    return {
      label: 'Morning Pulse (EAT)',
      greeting: 'Fresh Kenyan morning momentum',
      recommendedTopic: 'Health',
      activityHint: 'Coffee runs, Karura trails & crisp morning check-ins peak now.',
    };
  }
  if (eatHour >= 11 && eatHour < 16) {
    return {
      label: 'Midday City Flow (EAT)',
      greeting: 'Midday Blackboard conversations',
      recommendedTopic: 'Politics',
      activityHint: 'Civic debates, startup banter & quick lunch-hour chats are buzzing.',
    };
  }
  if (eatHour >= 16 && eatHour < 20) {
    return {
      label: 'Golden Hour (EAT)',
      greeting: 'Sunset hangout & sports energy',
      recommendedTopic: 'Hangouts',
      activityHint: 'Rooftop meetups, sunset photo walks & after-work banter surge now.',
    };
  }
  return {
    label: 'Evening Glow (EAT)',
    greeting: 'Late-evening deep chats & vibes',
    recommendedTopic: 'Lifestyle',
    activityHint: 'Music playlists, vinyl lounges & relaxed 1-on-1 conversations peak tonight.',
  };
}

/**
 * Computes live momentum for each Blackboard topic based on posts, stars, and views.
 */
export function getCountyPulseTopics(): CountyPulseTopic[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT topic,
              COUNT(*) AS post_count,
              COALESCE(SUM(reader_stars + CASE WHEN milestone100_unlocked = 1 THEN 10 WHEN milestone10_unlocked = 1 THEN 1 ELSE 0 END), 0) AS total_stars,
              COALESCE(SUM(view_count), 0) AS total_views
       FROM blackboard_posts
       GROUP BY topic`
    )
    .all() as unknown as TopicAggregateRow[];

  const byTopic = new Map<string, TopicAggregateRow>(
    rows.map((r) => [r.topic, r])
  );

  const rawPulse = BLACKBOARD_TOPICS.map((topic) => {
    const agg = byTopic.get(topic);
    const postCount = Number(agg?.post_count ?? 0);
    const totalStars = Number(agg?.total_stars ?? 0);
    const totalViews = Number(agg?.total_views ?? 0);
    const rawScore = postCount * 14 + totalStars * 3 + Math.round(totalViews * 0.4);
    return {
      topic,
      postCount,
      totalStars,
      rawScore,
    };
  });

  const maxRaw = Math.max(1, ...rawPulse.map((p) => p.rawScore));

  return rawPulse
    .map((p) => ({
      topic: p.topic,
      momentumScore: Math.min(99, Math.max(24, Math.round((p.rawScore / maxRaw) * 95))),
      postCount: p.postCount,
      totalStars: p.totalStars,
      summary: TOPIC_SUMMARIES[p.topic],
      trendingTag: TOPIC_TRENDING_TAGS[p.topic],
    }))
    .sort((a, b) => b.momentumScore - a.momentumScore);
}

/**
 * "What's Next" Predictive Engine:
 * Combines East Africa Time (EAT), user's chat-mined interest vector, online
 * compatible matches, and rising Blackboard topics to output 4 dynamic cards.
 */
export function getWhatsNextForUser(viewerRow: DbUserRow): {
  predictions: WhatsNextPrediction[];
  countyPulse: CountyPulseTopic[];
} {
  const eatHour = getEastAfricaHour();
  const timePhase = getEatTimePhase(eatHour);
  const countyPulse = getCountyPulseTopics();
  const matches = getAIMatchesForUser(viewerRow, 5);
  const interestVector = getUserInterestVector(viewerRow.id);
  const topInterestKey = [...interestVector.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];
  const topInterestLabel = topInterestKey
    ? getClusterLabel(topInterestKey)
    : null;
  const topInterestTopic: BlackboardTopic =
    (topInterestKey ? getClusterBlackboardTopic(topInterestKey) : null) ??
    timePhase.recommendedTopic;

  const predictions: WhatsNextPrediction[] = [];

  // Card 1: Top online compatible match ready to chat right now
  const onlineMatch = matches.find((m) => m.member.isOnline) ?? matches[0];
  if (onlineMatch) {
    predictions.push({
      id: `pred-chat-${onlineMatch.member.id}`,
      title: `Start a spark with ${onlineMatch.member.nickname}`,
      subtitle: `${onlineMatch.compatibilityScore}% wavelength match • ${onlineMatch.reasons[0] ?? 'Active nearby right now'}`,
      actionType: 'chat',
      targetId: onlineMatch.member.id,
      confidence: Math.min(98, Math.max(72, onlineMatch.compatibilityScore)),
    });
  } else {
    predictions.push({
      id: 'pred-discover-radar',
      title: 'Scan your 10 km Proximity Radar',
      subtitle: 'Check who just came online around your active city zone.',
      actionType: 'discover',
      confidence: 86,
    });
  }

  // Card 2: Rising Blackboard topic aligned with top pulse
  const leadingPulse = countyPulse[0] ?? {
    topic: 'Hangouts' as BlackboardTopic,
    momentumScore: 88,
    totalStars: 20,
    postCount: 3,
    trendingTag: '#CityVibesKE',
  };
  predictions.push({
    id: `pred-topic-${leadingPulse.topic.toLowerCase()}`,
    title: `Jump into rising ${leadingPulse.topic} on Blackboard`,
    subtitle: `${leadingPulse.trendingTag} is surging with ${leadingPulse.totalStars}★ across ${leadingPulse.postCount} lively threads.`,
    actionType: 'topic',
    topic: leadingPulse.topic,
    confidence: Math.min(96, Math.max(76, leadingPulse.momentumScore)),
  });

  // Card 3: Personalized chat-mined interest or EAT time-of-day prediction
  if (topInterestLabel) {
    predictions.push({
      id: `pred-interest-${topInterestKey}`,
      title: `${timePhase.label}: ${topInterestLabel} wave`,
      subtitle: `Based on your recent vibes, ${topInterestTopic} posts & nearby fans match your rhythm right now.`,
      actionType: 'blackboard',
      topic: topInterestTopic,
      confidence: 91,
    });
  } else {
    predictions.push({
      id: `pred-eat-${eatHour}`,
      title: `${timePhase.label}: ${timePhase.greeting}`,
      subtitle: timePhase.activityHint,
      actionType: 'blackboard',
      topic: timePhase.recommendedTopic,
      confidence: 84,
    });
  }

  // Card 4: Second compatible connection or Proximity Story check-in
  const secondMatch = matches.find(
    (m) => m.member.id !== onlineMatch?.member.id
  );
  if (secondMatch) {
    predictions.push({
      id: `pred-second-${secondMatch.member.id}`,
      title: `Open a 2nd chat window with ${secondMatch.member.nickname}`,
      subtitle: `Multi-chat ready (up to 3 side-by-side) • ${secondMatch.vibeLabel} (${secondMatch.compatibilityScore}%).`,
      actionType: 'chat',
      targetId: secondMatch.member.id,
      confidence: Math.min(95, Math.max(70, secondMatch.compatibilityScore)),
    });
  } else {
    predictions.push({
      id: 'pred-story-vibe',
      title: 'Share a 24h Proximity Story vibe',
      subtitle: 'Let compatible singles within 10 km catch your current mood instantly.',
      actionType: 'story',
      topic: timePhase.recommendedTopic,
      confidence: 82,
    });
  }

  return {
    predictions: predictions.slice(0, 4),
    countyPulse,
  };
}
