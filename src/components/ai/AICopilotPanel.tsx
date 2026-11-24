import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BrainCircuit,
  Compass,
  Flame,
  Loader2,
  MessageCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import type {
  AIMatchSuggestion,
  BlackboardTopic,
  CountyPulseTopic,
  PublicMemberProfile,
  WhatsNextPrediction,
} from '../../shared/types';
import { getAIIcebreaker, getAIMatches, getWhatsNext } from '../../lib/api';

interface AICopilotPanelProps {
  mode: 'rail' | 'full';
  onOpenChat: (peer: PublicMemberProfile, prefillText?: string) => void;
  onSelectTopic: (topic: BlackboardTopic) => void;
  refreshKey: number;
}

// ============================================================================
// SVG Circular Compatibility Ring
// ============================================================================

function CompatibilityRing({ score, size = 50 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const gradId = `compat-grad-${clamped}-${size}`;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`${clamped}% compatibility`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--savannah-gold)" />
            <stop offset="50%" stopColor="var(--maasai-coral)" />
            <stop offset="100%" stopColor="var(--rift-cyan)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-glass)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
      </svg>
      <span className="absolute font-display text-[11px] font-bold text-theme-primary">
        {clamped}%
      </span>
    </div>
  );
}

// ============================================================================
// Main AI Co-Pilot Panel (Rail & Full Dashboard Modes)
// ============================================================================

export function AICopilotPanel({
  mode,
  onOpenChat,
  onSelectTopic,
  refreshKey,
}: AICopilotPanelProps) {
  const [matches, setMatches] = useState<AIMatchSuggestion[]>([]);
  const [minedInterests, setMinedInterests] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<WhatsNextPrediction[]>([]);
  const [countyPulse, setCountyPulse] = useState<CountyPulseTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-match alternate icebreaker state
  const [customOpeners, setCustomOpeners] = useState<Record<string, string[]>>({});
  const [openerIndex, setOpenerIndex] = useState<Record<string, number>>({});
  const [loadingOpenerId, setLoadingOpenerId] = useState<string | null>(null);

  const isRail = mode === 'rail';

  const loadCopilotData = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setSyncing(true);
    }
    setError(null);
    try {
      const [matchRes, nextRes] = await Promise.all([
        getAIMatches(),
        getWhatsNext(),
      ]);
      setMatches(matchRes.matches ?? []);
      setMinedInterests(matchRes.minedInterests ?? []);
      setPredictions(nextRes.predictions ?? []);
      setCountyPulse(nextRes.countyPulse ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to sync AI Co-Pilot right now.'
      );
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadCopilotData(refreshKey === 0 && matches.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, loadCopilotData]);

  const handleCycleIcebreaker = async (memberId: string) => {
    const existing = customOpeners[memberId];
    if (existing && existing.length > 1) {
      setOpenerIndex((prev) => ({
        ...prev,
        [memberId]: ((prev[memberId] ?? 0) + 1) % existing.length,
      }));
      return;
    }

    setLoadingOpenerId(memberId);
    try {
      const res = await getAIIcebreaker(memberId);
      if (res.openers && res.openers.length > 0) {
        setCustomOpeners((prev) => ({ ...prev, [memberId]: res.openers }));
        setOpenerIndex((prev) => ({ ...prev, [memberId]: 0 }));
      }
    } catch {
      // Fall back to default match.icebreaker silently
    } finally {
      setLoadingOpenerId(null);
    }
  };

  const getActiveIcebreaker = (match: AIMatchSuggestion): string => {
    const list = customOpeners[match.member.id];
    if (list && list.length > 0) {
      const idx = openerIndex[match.member.id] ?? 0;
      return list[idx % list.length] ?? match.icebreaker;
    }
    return match.icebreaker;
  };

  const handlePredictionClick = (pred: WhatsNextPrediction) => {
    if (pred.actionType === 'chat') {
      const matched =
        (pred.targetId
          ? matches.find((m) => m.member.id === pred.targetId)
          : undefined) ?? matches[0];
      if (matched) {
        onOpenChat(matched.member, getActiveIcebreaker(matched));
        return;
      }
    }
    if (pred.topic) {
      onSelectTopic(pred.topic);
      return;
    }
    if (pred.actionType === 'blackboard' || pred.actionType === 'topic') {
      onSelectTopic('Hangouts');
      return;
    }
    if (matches[0]) {
      onOpenChat(matches[0].member, getActiveIcebreaker(matches[0]));
    } else {
      onSelectTopic('Hangouts');
    }
  };

  const getPredictionIcon = (type: WhatsNextPrediction['actionType']) => {
    switch (type) {
      case 'chat':
        return MessageCircle;
      case 'discover':
        return Radio;
      case 'story':
        return Sparkles;
      case 'blackboard':
      case 'topic':
      default:
        return Compass;
    }
  };

  const getPredictionActionLabel = (pred: WhatsNextPrediction): string => {
    if (pred.actionType === 'chat') return 'Start Chat';
    if (pred.topic) return `Explore ${pred.topic}`;
    if (pred.actionType === 'discover') return 'Explore Nearby';
    if (pred.actionType === 'story') return 'Check Vibes';
    return 'Open Blackboard';
  };

  const visibleMatches = isRail ? matches.slice(0, 3) : matches;
  const visiblePredictions = isRail ? predictions.slice(0, 3) : predictions;

  return (
    <div className="w-full max-w-full space-y-4">
      {/* AI Co-Pilot Header Card */}
      <section className="glass-card glow-ring p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--savannah-gold)] via-[var(--maasai-coral)] to-[var(--rift-cyan)] text-white shadow-md">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate font-display text-sm sm:text-base font-bold text-theme-primary">
                  AI Co-Pilot
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-[var(--rift-cyan)] border border-cyan-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--rift-cyan)] animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-theme-muted">
                Auto-linking nearby companions &amp; predicting what&rsquo;s next
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadCopilotData(false)}
            disabled={syncing}
            title="Refresh AI signals"
            aria-label="Refresh AI signals"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl surface-subtle text-theme-secondary hover:text-theme-primary transition"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[var(--savannah-gold)] ${
                syncing ? 'animate-spin' : ''
              }`}
            />
          </button>
        </div>

        {/* Mined Interests Pills (User's own learned signals) */}
        {minedInterests.length > 0 && (
          <div className="mt-3 border-t border-theme pt-2.5">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-theme-muted">
              Your AI-Learned Vibe Signals
            </span>
            <div className="flex flex-wrap gap-1.5">
              {minedInterests.slice(0, isRail ? 5 : 10).map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-[var(--savannah-gold)] surface-subtle"
                >
                  <Zap className="h-2.5 w-2.5" />
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Error State */}
      {error && (
        <div className="glass-card border-rose-500/30 p-4 text-center">
          <p className="text-xs font-medium text-[var(--maasai-coral)]">{error}</p>
          <button
            type="button"
            onClick={() => void loadCopilotData(true)}
            className="mt-2 rounded-xl px-3 py-1.5 text-xs font-bold surface-subtle text-theme-primary"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`ai-skel-${idx}`} className="glass-card p-4 space-y-2.5">
              <div className="h-4 w-36 rounded animate-shimmer surface-subtle" />
              <div className="h-12 w-full rounded-xl animate-shimmer surface-subtle" />
              <div className="h-8 w-28 rounded-xl animate-shimmer surface-subtle" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className={isRail ? 'space-y-4' : 'grid grid-cols-1 gap-4 lg:grid-cols-12'}>
          {/* ================================================================
              SECTION 1: "What's Next" Predictive Engine
              ================================================================ */}
          <section
            className={`glass-card p-4 ${isRail ? '' : 'lg:col-span-5'}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[var(--savannah-gold)]" />
                <h3 className="font-display text-sm font-bold text-theme-primary">
                  What&rsquo;s Next Engine
                </h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rift-cyan)]">
                Predictive
              </span>
            </div>

            {visiblePredictions.length === 0 ? (
              <p className="text-xs text-theme-muted">
                Interact on the Blackboard or chat to sharpen your live predictions.
              </p>
            ) : (
              <div className="space-y-2.5">
                {visiblePredictions.map((pred) => {
                  const Icon = getPredictionIcon(pred.actionType);
                  const conf = Math.round(
                    pred.confidence <= 1 ? pred.confidence * 100 : pred.confidence
                  );
                  return (
                    <div
                      key={pred.id}
                      className="group rounded-2xl p-3 surface-subtle transition hover:border-[var(--border-strong)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-[var(--savannah-gold)]">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <h4 className="truncate font-display text-xs sm:text-sm font-bold text-theme-primary">
                            {pred.title}
                          </h4>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-[var(--cyber-emerald)] border border-emerald-500/30">
                          {conf}%
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-theme-secondary">
                        {pred.subtitle}
                      </p>
                      <button
                        type="button"
                        onClick={() => handlePredictionClick(pred)}
                        className="mt-2.5 inline-flex items-center gap-1 rounded-xl bg-[var(--bg-hover)] px-3 py-1.5 text-[11px] font-bold text-[var(--savannah-gold)] transition hover:bg-amber-500/20"
                      >
                        <span>{getPredictionActionLabel(pred)}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ================================================================
              SECTION 2: AI Auto-Linked Companions (Privacy-Shielded)
              ================================================================ */}
          <section
            className={`glass-card p-4 ${isRail ? '' : 'lg:col-span-7'}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-[var(--maasai-coral)]" />
                <h3 className="font-display text-sm font-bold text-theme-primary">
                  AI Auto-Linked Companions
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--cyber-emerald)]">
                <ShieldCheck className="h-3 w-3" />
                10 km Shield
              </span>
            </div>

            {visibleMatches.length === 0 ? (
              <p className="text-xs text-theme-muted">
                No nearby compatible matches detected right now. Keep exploring or
                chatting to build affinity signals.
              </p>
            ) : (
              <div
                className={
                  isRail ? 'space-y-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'
                }
              >
                {visibleMatches.map((match) => {
                  const activeOpener = getActiveIcebreaker(match);
                  const isRefreshingOpener = loadingOpenerId === match.member.id;

                  return (
                    <article
                      key={match.member.id}
                      className="flex flex-col justify-between gap-3 rounded-2xl p-3.5 surface-subtle transition hover:border-[var(--border-strong)]"
                    >
                      <div className="space-y-2.5">
                        {/* Privacy-safe member row + Compatibility Ring */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="relative shrink-0">
                              <img
                                src={match.member.avatarUrl}
                                alt={match.member.nickname}
                                className="h-11 w-11 rounded-full border border-[var(--border-glass)] object-cover"
                              />
                              <span
                                title={match.member.isOnline ? 'Online' : 'Offline'}
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-primary)] ${
                                  match.member.isOnline
                                    ? 'bg-[var(--cyber-emerald)]'
                                    : 'bg-slate-400'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="truncate font-display text-sm font-bold text-theme-primary">
                                {match.member.nickname}
                              </h4>
                              <p className="text-[11px] text-theme-muted">
                                {match.member.gender} • {match.member.ageRange}
                              </p>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--cyber-emerald)]">
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Within 10 km
                              </span>
                            </div>
                          </div>

                          <CompatibilityRing score={match.compatibilityScore} size={48} />
                        </div>

                        {/* Vibe Label */}
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--savannah-gold)] border border-amber-500/25">
                          <Sparkles className="h-2.5 w-2.5" />
                          {match.vibeLabel}
                        </div>

                        {/* Privacy-safe reason chips */}
                        {match.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {match.reasons.slice(0, 3).map((reason, idx) => (
                              <span
                                key={`${match.member.id}-r-${idx}`}
                                className="rounded-lg bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-theme-secondary"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Shared Topics */}
                        {match.sharedTopics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {match.sharedTopics.map((topic) => (
                              <button
                                key={`${match.member.id}-t-${topic}`}
                                type="button"
                                onClick={() => onSelectTopic(topic)}
                                className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--rift-cyan)] hover:bg-cyan-500/20 transition"
                              >
                                #{topic}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Preview of AI Icebreaker */}
                        <div className="rounded-xl bg-[var(--bg-primary)]/50 p-2 text-[11px] italic text-theme-secondary border border-theme">
                          &ldquo;{activeOpener}&rdquo;
                        </div>
                      </div>

                      {/* Send AI Icebreaker + Shuffle Opener CTA */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenChat(match.member, activeOpener)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--savannah-gold)] via-[var(--maasai-coral)] to-[var(--rift-cyan)] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          ✨ Send AI Icebreaker
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCycleIcebreaker(match.member.id)}
                          disabled={isRefreshingOpener}
                          title="Generate another AI opener"
                          aria-label="Generate another AI opener"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl surface-subtle text-theme-secondary hover:text-[var(--savannah-gold)] transition"
                        >
                          {isRefreshingOpener ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* ================================================================
              SECTION 3: 47 Cities Topic Pulse (Live Momentum Bars)
              ================================================================ */}
          <section
            className={`glass-card p-4 ${isRail ? '' : 'lg:col-span-12'}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-[var(--rift-cyan)]" />
                <h3 className="font-display text-sm font-bold text-theme-primary">
                  47 Cities Topic Pulse
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-theme-muted">
                Tap topic to filter Blackboard
              </span>
            </div>

            {countyPulse.length === 0 ? (
              <p className="text-xs text-theme-muted">
                Topic momentum will populate as the Blackboard heats up.
              </p>
            ) : (
              <div
                className={
                  isRail ? 'space-y-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
                }
              >
                {countyPulse.map((pulse) => {
                  const pct = Math.max(8, Math.min(100, Math.round(pulse.momentumScore)));
                  return (
                    <button
                      key={pulse.topic}
                      type="button"
                      onClick={() => onSelectTopic(pulse.topic)}
                      className="group w-full rounded-2xl p-3 text-left surface-subtle transition hover:border-[var(--border-strong)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-xs font-bold text-theme-primary group-hover:text-[var(--savannah-gold)] transition-colors">
                          {pulse.topic}
                        </span>
                        <span className="text-[10px] font-semibold text-[var(--rift-cyan)]">
                          {pulse.trendingTag}
                        </span>
                      </div>

                      {/* Momentum Bar */}
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-hover)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--savannah-gold)] via-[var(--maasai-coral)] to-[var(--rift-cyan)] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-theme-muted">
                        <span>{pulse.postCount} posts</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-[var(--savannah-gold)]">
                          <Star className="h-3 w-3 fill-[var(--savannah-gold)]" />
                          {pulse.totalStars}
                        </span>
                      </div>

                      {!isRail && pulse.summary && (
                        <p className="mt-1.5 line-clamp-2 text-[11px] text-theme-secondary">
                          {pulse.summary}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
