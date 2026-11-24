import { Router, type Response } from 'express';
import { getDb, type UserRow } from '../db.js';
import {
  requireActiveLocation,
  requireAuth,
  type AuthRequest,
} from '../auth.js';
import { canAccessMember } from '../geo.js';
import {
  extractInterestTopicsFromText,
  getClusterBlackboardTopic,
  getUserTopInterestLabels,
} from '../ai/chat-miner.js';
import {
  generateLocalIcebreakers,
  getAIMatchesForUser,
} from '../ai/matcher.js';
import { getWhatsNextForUser } from '../ai/predictor.js';
import { BLACKBOARD_TOPICS } from '../../src/shared/kenya-data.js';
import type {
  AIIcebreakerResponse,
  AIPolishResponse,
  BlackboardTopic,
} from '../../src/shared/types.js';

export const aiRouter = Router();

const TOPIC_DEFAULT_TAGS: Record<BlackboardTopic, string[]> = {
  Politics: ['#47Cities', '#KenyaCivic', '#SmartCounties'],
  Health: ['#47Cities', '#NairobiWellness', '#HealthyKE'],
  Sports: ['#47Cities', '#ShujaaVibes', '#KenyanSports'],
  Lifestyle: ['#47Cities', '#AfroFutureKE', '#CityCulture'],
  Hangouts: ['#47Cities', '#KenyanHangouts', '#CityVibes'],
};

async function callGeminiJson<T>(prompt: string): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

function inferTopicFromContent(
  content: string,
  providedTopic?: string
): BlackboardTopic {
  if (
    providedTopic &&
    BLACKBOARD_TOPICS.includes(providedTopic as BlackboardTopic)
  ) {
    return providedTopic as BlackboardTopic;
  }

  const keys = extractInterestTopicsFromText(content);
  for (const key of keys) {
    const mapped = getClusterBlackboardTopic(key);
    if (mapped) return mapped;
  }

  const lower = content.toLowerCase();
  if (/\b(county|policy|road|traffic|budget|election|civic|gov)\b/.test(lower)) {
    return 'Politics';
  }
  if (/\b(gym|run|walk|yoga|sleep|water|health|wellness|diet)\b/.test(lower)) {
    return 'Health';
  }
  if (/\b(football|rugby|match|goal|arsenal|shujaa|turf|sport|f1)\b/.test(lower)) {
    return 'Sports';
  }
  if (/\b(meetup|hangout|coffee|brunch|dinner|rooftop|friday|saturday|chill)\b/.test(lower)) {
    return 'Hangouts';
  }
  return 'Lifestyle';
}

function buildLocalPolish(
  original: string,
  providedTopic?: string
): AIPolishResponse {
  const cleaned = original.trim().replace(/\s+/g, ' ');
  const suggestedTopic = inferTopicFromContent(cleaned, providedTopic);

  // Capitalize first letter cleanly
  let polished =
    cleaned.length > 0
      ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      : cleaned;

  // Ensure crisp ending punctuation
  if (polished && !/[.!?✨🔥🇰🇪☕🥂🌿⚽]$/.test(polished)) {
    polished = `${polished}.`;
  }

  // Add an inviting conversational hook if short and doesn't already ask a question
  let tone: AIPolishResponse['tone'] = 'warm';
  if (suggestedTopic === 'Politics') {
    tone = 'bold';
    if (!polished.includes('?') && polished.length < 180) {
      polished = `${polished} What is your take across the 47 counties?`;
    }
  } else if (suggestedTopic === 'Sports') {
    tone = 'witty';
    if (!polished.includes('?') && polished.length < 180) {
      polished = `${polished} Who is backing this call? ⚽🔥`;
    }
  } else if (suggestedTopic === 'Hangouts') {
    tone = 'warm';
    if (!polished.includes('?') && polished.length < 180) {
      polished = `${polished} Who is in for the vibe? ✨`;
    }
  } else if (suggestedTopic === 'Health') {
    tone = 'concise';
    if (!polished.includes('?') && polished.length < 180) {
      polished = `${polished} How are you keeping your energy up this week? 💚`;
    }
  } else {
    tone = 'warm';
    if (!polished.includes('?') && polished.length < 180) {
      polished = `${polished} Drop your vibe below ✨`;
    }
  }

  // Extract existing hashtags + merge topic Kenyan tags
  const existingTags = polished.match(/#[A-Za-z0-9_]+/g) ?? [];
  const suggestedTags = Array.from(
    new Set([...existingTags, ...TOPIC_DEFAULT_TAGS[suggestedTopic]])
  ).slice(0, 4);

  return {
    original,
    polished,
    tone,
    suggestedTopic,
    suggestedTags,
  };
}

// ============================================================================
// AI Endpoints (All require Auth + Active 10 km Location Gate)
// ============================================================================

aiRouter.get(
  '/matches',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const matches = getAIMatchesForUser(me, 10);
    const minedInterests = getUserTopInterestLabels(me.id, 6);
    res.json({ matches, minedInterests });
  }
);

aiRouter.get(
  '/whats-next',
  requireAuth,
  requireActiveLocation,
  (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const result = getWhatsNextForUser(me);
    res.json(result);
  }
);

aiRouter.post(
  '/icebreaker',
  requireAuth,
  requireActiveLocation,
  async (req: AuthRequest, res: Response) => {
    const me = req.userRow!;
    const targetMemberId =
      typeof req.body?.targetMemberId === 'string'
        ? req.body.targetMemberId.trim()
        : '';

    if (!targetMemberId) {
      res.status(400).json({
        error: 'TARGET_REQUIRED',
        message: 'targetMemberId is required.',
      });
      return;
    }

    const db = getDb();
    const targetRow = db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(targetMemberId) as UserRow | undefined;

    if (!targetRow || targetRow.id === me.id) {
      res.status(404).json({
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
      });
      return;
    }

    const access = canAccessMember(me, targetRow);
    if (!access.allowed) {
      res.status(403).json({
        error: 'PROFILE_RESTRICTED',
        message:
          access.reason ||
          'You can only generate icebreakers for compatible members within 10 km.',
      });
      return;
    }

    const local = generateLocalIcebreakers(me, targetRow);

    // Optional Gemini enhancement (strictly privacy-safe prompt: ONLY nickname + safe context hint)
    const geminiResult = await callGeminiJson<{
      openers?: string[];
      contextHint?: string;
    }>(
      `Generate 3 short, warm, respectful Kenyan social chat openers for a member nicknamed "${targetRow.nickname}" on a Nairobi/Kenya social app called 47 Cities.
Context hint: ${local.contextHint}.
STRICT PRIVACY RULE: Do NOT mention counties, exact locations, distances, children, email, or personal dealbreakers.
Return strict JSON: { "openers": [string, string, string], "contextHint": string }.`
    );

    const openers =
      Array.isArray(geminiResult?.openers) &&
      geminiResult.openers.length >= 3 &&
      geminiResult.openers.every((s) => typeof s === 'string' && s.trim().length > 0)
        ? geminiResult.openers.slice(0, 3).map((s) => s.trim())
        : local.openers;

    const contextHint =
      typeof geminiResult?.contextHint === 'string' &&
      geminiResult.contextHint.trim()
        ? geminiResult.contextHint.trim()
        : local.contextHint;

    const response: AIIcebreakerResponse = {
      targetMemberId: targetRow.id,
      openers,
      contextHint,
    };

    res.json(response);
  }
);

aiRouter.post(
  '/polish-post',
  requireAuth,
  requireActiveLocation,
  async (req: AuthRequest, res: Response) => {
    const content =
      typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const providedTopic =
      typeof req.body?.topic === 'string' ? req.body.topic.trim() : undefined;

    if (!content) {
      res.status(400).json({
        error: 'CONTENT_REQUIRED',
        message: 'Please write a short draft before polishing.',
      });
      return;
    }

    const local = buildLocalPolish(content, providedTopic);

    const geminiResult = await callGeminiJson<{
      polished?: string;
      tone?: AIPolishResponse['tone'];
      suggestedTopic?: BlackboardTopic;
      suggestedTags?: string[];
    }>(
      `Polish this public community Blackboard post for "47 Cities" (a futuristic Kenyan social hub). Keep it authentic, warm, punchy, and under 280 characters.
Draft: ${JSON.stringify(content)}
Preferred topic (if any): ${providedTopic || 'auto-detect'}
Allowed topics: Politics, Health, Sports, Lifestyle, Hangouts.
Allowed tones: bold, warm, witty, concise.
Return strict JSON: { "polished": string, "tone": "bold"|"warm"|"witty"|"concise", "suggestedTopic": "Politics"|"Health"|"Sports"|"Lifestyle"|"Hangouts", "suggestedTags": string[] }.`
    );

    const validTones: ReadonlyArray<AIPolishResponse['tone']> = [
      'bold',
      'warm',
      'witty',
      'concise',
    ];

    const response: AIPolishResponse = {
      original: content,
      polished:
        typeof geminiResult?.polished === 'string' &&
        geminiResult.polished.trim()
          ? geminiResult.polished.trim()
          : local.polished,
      tone:
        geminiResult?.tone && validTones.includes(geminiResult.tone)
          ? geminiResult.tone
          : local.tone,
      suggestedTopic:
        geminiResult?.suggestedTopic &&
        BLACKBOARD_TOPICS.includes(geminiResult.suggestedTopic)
          ? geminiResult.suggestedTopic
          : local.suggestedTopic,
      suggestedTags:
        Array.isArray(geminiResult?.suggestedTags) &&
        geminiResult.suggestedTags.length > 0
          ? geminiResult.suggestedTags
              .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
              .map((t) => (t.startsWith('#') ? t.trim() : `#${t.trim()}`))
              .slice(0, 4)
          : local.suggestedTags,
    };

    res.json(response);
  }
);
