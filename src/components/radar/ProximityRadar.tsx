import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  MessageCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { PublicMemberProfile } from '../../shared/types';
import { getNearbyMembers } from '../../lib/api';

interface ProximityRadarProps {
  onOpenChat: (peer: PublicMemberProfile) => void;
  activeChatIds: string[];
}

type RadarFilter = 'all' | 'online' | 'offline';

export function ProximityRadar({ onOpenChat, activeChatIds }: ProximityRadarProps) {
  const [filter, setFilter] = useState<RadarFilter>('all');
  const [members, setMembers] = useState<PublicMemberProfile[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [offlineCount, setOfflineCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNearby = useCallback(async (statusFilter: RadarFilter, silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await getNearbyMembers(statusFilter);
      setMembers(res.members ?? []);
      setOnlineCount(res.onlineCount ?? 0);
      setOfflineCount(res.offlineCount ?? 0);
      setTotalCount(res.totalCount ?? res.members?.length ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to scan nearby members right now.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNearby(filter);
  }, [filter, loadNearby]);

  const filterTabs: { key: RadarFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Nearby', count: totalCount },
    { key: 'online', label: 'Online Now', count: onlineCount },
    { key: 'offline', label: 'Offline', count: offlineCount },
  ];

  return (
    <div className="w-full max-w-full space-y-4">
      {/* Futuristic Animated 10 km Radar Banner */}
      <section className="glass-card glow-ring relative overflow-hidden p-4 sm:p-5">
        {/* Ambient radar pulse backdrop */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[var(--rift-cyan)]/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-[var(--savannah-gold)]/10 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {/* Animated Concentric Radar Ring */}
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-[var(--rift-cyan)]/60 animate-pulse-radar" />
              <span
                className="absolute inset-1.5 rounded-full border border-[var(--cyber-emerald)]/50 animate-pulse-radar"
                style={{ animationDelay: '0.8s' }}
              />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--rift-cyan)] to-[var(--cyber-emerald)] text-white shadow-lg">
                <Radio className="h-5 w-5" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-bold text-theme-primary">
                  10 km Proximity Radar
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--cyber-emerald)] border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--cyber-emerald)] animate-pulse" />
                  Live Scan
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-medium text-theme-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5 text-[var(--cyber-emerald)]" />
                  <strong className="text-theme-primary">{onlineCount}</strong> Online
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <WifiOff className="h-3.5 w-3.5 text-theme-muted" />
                  <strong className="text-theme-primary">{offlineCount}</strong> Offline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[var(--savannah-gold)]" />
                  <strong className="text-theme-primary">{totalCount}</strong> Within 10 km
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadNearby(filter, true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-1.5 self-start sm:self-center rounded-xl px-3.5 py-2 text-xs font-semibold surface-subtle text-theme-primary hover:bg-[var(--bg-hover)] transition shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[var(--rift-cyan)] ${refreshing ? 'animate-spin' : ''}`} />
            Rescan
          </button>
        </div>

        {/* Explicit Privacy Shield Badge */}
        <div className="relative z-10 mt-4 flex items-start sm:items-center gap-2 rounded-xl px-3 py-2 text-[11px] sm:text-xs text-theme-secondary surface-subtle">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--cyber-emerald)] mt-0.5 sm:mt-0" />
          <span>
            Locations hidden • Only 10 km proximity confirmed • Filtered strictly to your
            &lsquo;Interested In&rsquo; preference
          </span>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {filterTabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-gradient-to-r from-[var(--savannah-gold)] to-[var(--maasai-coral)] text-white shadow-md'
                  : 'glass-card text-theme-secondary hover:text-theme-primary'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-black/20 text-white' : 'surface-subtle text-theme-muted'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="glass-card border-rose-500/30 p-4 text-center">
          <p className="text-sm font-medium text-[var(--maasai-coral)]">{error}</p>
          <button
            type="button"
            onClick={() => void loadNearby(filter)}
            className="mt-2 rounded-xl px-4 py-1.5 text-xs font-semibold surface-subtle text-theme-primary hover:bg-[var(--bg-hover)]"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`radar-skel-${i}`} className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full animate-shimmer surface-subtle shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 rounded animate-shimmer surface-subtle" />
                  <div className="h-3 w-36 rounded animate-shimmer surface-subtle" />
                </div>
              </div>
              <div className="h-10 w-full rounded-xl animate-shimmer surface-subtle" />
            </div>
          ))}
        </div>
      )}

      {/* Responsive Nearby Member Cards (STRICT PRIVACY: ONLY Avatar, Nickname, Gender, Age Range, Online/Offline, Within 10 km) */}
      {!loading && !error && members.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {members.map((member) => {
            const isChatOpen = activeChatIds.includes(member.id);
            return (
              <article
                key={member.id}
                className="glass-card group flex flex-col justify-between gap-4 p-4 transition-all duration-200 hover:border-[var(--border-strong)]"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Profile Photo + Online Ring */}
                  <div className="relative shrink-0">
                    <div
                      className={`rounded-full p-[2px] ${
                        member.isOnline
                          ? 'bg-gradient-to-tr from-[var(--cyber-emerald)] via-[var(--rift-cyan)] to-[var(--savannah-gold)]'
                          : 'bg-[var(--border-glass)]'
                      }`}
                    >
                      <img
                        src={member.avatarUrl}
                        alt={member.nickname}
                        className="h-14 w-14 rounded-full border-2 border-[var(--bg-primary)] object-cover"
                      />
                    </div>
                    <span
                      title={member.isOnline ? 'Online' : 'Offline'}
                      className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-primary)] ${
                        member.isOnline
                          ? 'bg-[var(--cyber-emerald)]'
                          : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* Strictly Privacy-Safe Identity Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-display text-base font-bold text-theme-primary">
                        {member.nickname}
                      </h3>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          member.isOnline
                            ? 'bg-emerald-500/15 text-[var(--cyber-emerald)] border border-emerald-500/30'
                            : 'surface-subtle text-theme-muted'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            member.isOnline ? 'bg-[var(--cyber-emerald)]' : 'bg-slate-400'
                          }`}
                        />
                        {member.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-theme-secondary">
                      {member.gender} • {member.ageRange} yrs
                    </p>

                    <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[var(--rift-cyan)] surface-subtle">
                      <ShieldCheck className="h-3 w-3 text-[var(--cyber-emerald)]" />
                      Within 10 km
                    </div>
                  </div>
                </div>

                {/* Chat CTA */}
                <button
                  type="button"
                  onClick={() => onOpenChat(member)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition active:scale-[0.98] ${
                    isChatOpen
                      ? 'bg-emerald-500/15 text-[var(--cyber-emerald)] border border-emerald-500/35 hover:bg-emerald-500/20'
                      : 'bg-gradient-to-r from-[var(--savannah-gold)] to-[var(--maasai-coral)] text-white shadow-sm hover:brightness-110'
                  }`}
                >
                  {isChatOpen ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Chat Open
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4" />
                      Open Chat
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && members.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl surface-subtle text-[var(--rift-cyan)]">
            <Radio className="h-6 w-6" />
          </div>
          <h3 className="font-display text-base font-bold text-theme-primary">
            No {filter === 'all' ? 'nearby' : filter} members in this filter
          </h3>
          <p className="mt-1 max-w-sm text-xs text-theme-muted">
            Everyone shown here is verified within 10 km and matches your &lsquo;Interested
            In&rsquo; setting. Try switching filters or rescanning.
          </p>
          {filter !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-3 rounded-xl bg-[var(--savannah-gold)] px-4 py-2 text-xs font-bold text-slate-950 transition hover:brightness-110"
            >
              Show All Nearby
            </button>
          )}
        </div>
      )}
    </div>
  );
}
