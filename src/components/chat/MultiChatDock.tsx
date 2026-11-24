import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  HardDrive,
  Layers,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  ChatThread,
  PublicMemberProfile,
  SessionImageBudget,
} from '../../shared/types';
import {
  IMAGE_TTL_SECONDS,
  MAX_SESSION_IMAGE_BYTES,
  MAX_SIMULTANEOUS_CHATS,
} from '../../shared/types';
import {
  clearSessionImages,
  getChatThreads,
  getNearbyMembers,
} from '../../lib/api';
import {
  ChatWindow,
  formatBytes,
  formatExpiryCountdown,
  type LightboxImagePayload,
} from './ChatWindow';

interface MultiChatDockProps {
  openPeers: PublicMemberProfile[];
  onClosePeer: (peerId: string) => void;
  onOpenPeer: (peer: PublicMemberProfile, prefillText?: string) => void;
  prefillByPeerId: Record<string, string>;
  onClearPrefill: (peerId: string) => void;
  onMessageSent: () => void;
  fullPageMode?: boolean;
}

const DEFAULT_BUDGET: SessionImageBudget = {
  usedBytes: 0,
  maxBytes: MAX_SESSION_IMAGE_BYTES,
  remainingBytes: MAX_SESSION_IMAGE_BYTES,
  activeImageCount: 0,
  ttlSeconds: IMAGE_TTL_SECONDS,
};

export function MultiChatDock({
  openPeers,
  onClosePeer,
  onOpenPeer,
  prefillByPeerId,
  onClearPrefill,
  onMessageSent,
  fullPageMode = false,
}: MultiChatDockProps) {
  const visiblePeers = useMemo(
    () => openPeers.slice(0, MAX_SIMULTANEOUS_CHATS),
    [openPeers]
  );

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [nearbyMembers, setNearbyMembers] = useState<PublicMemberProfile[]>([]);
  const [budget, setBudget] = useState<SessionImageBudget>(DEFAULT_BUDGET);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  // Dock-mode state
  const [collapsedById, setCollapsedById] = useState<Record<string, boolean>>({});
  const [dockPickerOpen, setDockPickerOpen] = useState(false);

  // Mobile full-page active tab state (3-window tab switcher)
  const [mobileActivePeerId, setMobileActivePeerId] = useState<string | null>(
    visiblePeers[0]?.id ?? null
  );

  // Ephemeral image clearing & refresh propagation
  const [clearingImages, setClearingImages] = useState(false);
  const [clearNotice, setClearNotice] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Lightbox modal for ephemeral image preview
  const [lightboxImage, setLightboxImage] =
    useState<LightboxImagePayload | null>(null);

  const loadThreadsAndMembers = useCallback(
    async (includeNearby: boolean) => {
      if (includeNearby) setLoadingDirectory(true);
      try {
        const [threadsRes, nearbyRes] = await Promise.all([
          getChatThreads(),
          includeNearby
            ? getNearbyMembers('all').catch(() => null)
            : Promise.resolve(null),
        ]);
        setThreads(threadsRes.threads);
        if (threadsRes.budget) {
          setBudget(threadsRes.budget);
        }
        if (nearbyRes?.members) {
          setNearbyMembers(nearbyRes.members);
        }
      } catch {
        // Keep existing state quietly if offline or location gate toggled
      } finally {
        if (includeNearby) setLoadingDirectory(false);
      }
    },
    []
  );

  // Fetch threads + budget on mount and when switching modes
  useEffect(() => {
    void loadThreadsAndMembers(Boolean(fullPageMode));
  }, [fullPageMode, loadThreadsAndMembers]);

  // Keep mobile active tab synced when peers open/close
  useEffect(() => {
    if (visiblePeers.length === 0) {
      setMobileActivePeerId(null);
      return;
    }
    setMobileActivePeerId((current) => {
      if (current && visiblePeers.some((p) => p.id === current)) {
        return current;
      }
      return visiblePeers[visiblePeers.length - 1].id;
    });
  }, [visiblePeers]);

  // Automatically expand a collapsed dock window if prefill arrives for it
  useEffect(() => {
    const prefilledIds = Object.keys(prefillByPeerId).filter(
      (id) => Boolean(prefillByPeerId[id])
    );
    if (prefilledIds.length === 0) return;

    setCollapsedById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of prefilledIds) {
        if (next[id]) {
          next[id] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    // Also focus that peer on mobile full-page mode
    const latestPrefilled = prefilledIds[prefilledIds.length - 1];
    if (visiblePeers.some((p) => p.id === latestPrefilled)) {
      setMobileActivePeerId(latestPrefilled);
    }
  }, [prefillByPeerId, visiblePeers]);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImage(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [lightboxImage]);

  const handleBudgetUpdate = useCallback((nextBudget: SessionImageBudget) => {
    setBudget(nextBudget);
  }, []);

  const handleMessageSentWrapped = useCallback(() => {
    onMessageSent();
    void loadThreadsAndMembers(false);
  }, [onMessageSent, loadThreadsAndMembers]);

  const handleClearSessionImages = async () => {
    if (clearingImages) return;
    setClearingImages(true);
    setClearNotice(null);
    try {
      const res = await clearSessionImages();
      if (res.budget) {
        setBudget(res.budget);
      }
      setRefreshSignal((n) => n + 1);
      setClearNotice(
        res.clearedCount > 0
          ? `Cleared ${res.clearedCount} ephemeral image${res.clearedCount === 1 ? '' : 's'} — 20 MB budget reset.`
          : 'Session image vault is already clear (0 KB used).'
      );
      window.setTimeout(() => setClearNotice(null), 4500);
    } catch {
      setClearNotice('Could not clear session images right now.');
    } finally {
      setClearingImages(false);
    }
  };

  const toggleCollapse = (peerId: string) => {
    setCollapsedById((prev) => ({ ...prev, [peerId]: !prev[peerId] }));
  };

  // Merge recent threads + nearby members for quick launch strip (deduplicated)
  const quickLaunchItems = useMemo(() => {
    const seen = new Set<string>();
    const list: {
      peer: PublicMemberProfile;
      subtitle: string;
      hasThread: boolean;
    }[] = [];

    for (const thread of threads) {
      if (seen.has(thread.peer.id)) continue;
      seen.add(thread.peer.id);
      const last = thread.lastMessage;
      let subtitle = 'Recent chat';
      if (last) {
        if (last.type === 'voice') subtitle = '🎤 Voice note';
        else if (last.type === 'image')
          subtitle = last.imageUrl ? '🖼️ Ephemeral photo' : '🖼️ Photo cleared';
        else if (last.text) subtitle = last.text;
      }
      list.push({ peer: thread.peer, subtitle, hasThread: true });
    }

    for (const member of nearbyMembers) {
      if (seen.has(member.id)) continue;
      seen.add(member.id);
      list.push({
        peer: member,
        subtitle: member.isOnline ? 'Online • Within 10 km' : 'Within 10 km',
        hasThread: false,
      });
    }

    return list;
  }, [threads, nearbyMembers]);

  const usedPercent = Math.min(
    100,
    Math.round(
      (budget.usedBytes / Math.max(1, budget.maxBytes || MAX_SESSION_IMAGE_BYTES)) *
        100
    )
  );

  const meterBarClass =
    usedPercent >= 85
      ? 'from-rose-500 to-amber-500'
      : usedPercent >= 60
        ? 'from-amber-500 to-yellow-400'
        : 'from-emerald-400 to-cyan-400';

  const openIdSet = useMemo(
    () => new Set(visiblePeers.map((p) => p.id)),
    [visiblePeers]
  );

  // Lightbox Modal (shared between Floating Dock & Full-Page Mode)
  const lightboxModal = lightboxImage ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ephemeral image preview"
      onClick={() => setLightboxImage(null)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel animate-slide-up relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-theme px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-theme-primary">
              Ephemeral Photo • {lightboxImage.senderName}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-theme-muted">
              <span>{formatBytes(lightboxImage.sizeBytes)}</span>
              <span aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1 text-amber-400">
                <Clock className="h-3 w-3" />
                {formatExpiryCountdown(lightboxImage.expiresAt, Date.now())}
              </span>
              <span aria-hidden="true">•</span>
              <span>Clears on logout</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            aria-label="Close image preview"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-theme surface-subtle text-theme-secondary hover:text-rose-400 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-black/40 p-3">
          <img
            src={lightboxImage.url}
            alt="Full size ephemeral chat attachment"
            className="max-h-[72vh] w-auto max-w-full rounded-xl object-contain"
          />
        </div>
      </div>
    </div>
  ) : null;

  // ============================================================================
  // MODE A: FLOATING DOCK MODE (!fullPageMode, PC >= 1024px)
  // ============================================================================
  if (!fullPageMode) {
    if (visiblePeers.length === 0 && threads.length === 0) {
      return lightboxModal;
    }

    return (
      <>
        <div
          data-testid="multi-chat-floating-dock"
          className="pointer-events-none fixed bottom-0 right-4 z-40 hidden lg:flex items-end gap-3"
        >
          {visiblePeers.length === 0 ? (
            <div className="pointer-events-auto relative mb-3">
              {dockPickerOpen && (
                <div className="glass-panel animate-slide-up absolute bottom-full right-0 mb-2 w-72 rounded-2xl p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between border-b border-theme pb-2">
                    <span className="font-display text-xs font-bold text-theme-primary">
                      Recent Chats (Open up to 3)
                    </span>
                    <button
                      type="button"
                      onClick={() => setDockPickerOpen(false)}
                      aria-label="Close recent chats"
                      className="rounded p-0.5 text-theme-muted hover:text-theme-primary cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-60 space-y-1.5 overflow-y-auto">
                    {threads.slice(0, 6).map((thread) => (
                      <button
                        key={thread.threadId}
                        type="button"
                        onClick={() => {
                          onOpenPeer(thread.peer);
                          setDockPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-transparent p-2 text-left transition surface-hover hover:border-amber-500/30 cursor-pointer"
                      >
                        <div className="relative shrink-0">
                          <img
                            src={thread.peer.avatarUrl}
                            alt={thread.peer.nickname}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-primary)] ${
                              thread.peer.isOnline
                                ? 'bg-emerald-400'
                                : 'bg-slate-400'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-theme-primary">
                            {thread.peer.nickname}
                          </p>
                          <p className="truncate text-[10px] text-theme-muted">
                            {thread.peer.gender} • {thread.peer.ageRange} • Within 10 km
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setDockPickerOpen((v) => !v)}
                className="glass-panel glow-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-theme-primary shadow-xl transition hover:scale-[1.02] cursor-pointer"
              >
                <MessageSquare className="h-4 w-4 text-amber-400" />
                <span>Multi-Chat</span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  {threads.length} recent
                </span>
              </button>
            </div>
          ) : (
            visiblePeers.map((peer) => (
              <div key={peer.id} className="pointer-events-auto">
                <ChatWindow
                  peer={peer}
                  mode="dock"
                  collapsed={Boolean(collapsedById[peer.id])}
                  onToggleCollapse={() => toggleCollapse(peer.id)}
                  onClose={() => onClosePeer(peer.id)}
                  prefillText={prefillByPeerId[peer.id]}
                  onClearPrefill={() => onClearPrefill(peer.id)}
                  budget={budget}
                  onBudgetUpdate={handleBudgetUpdate}
                  onMessageSent={handleMessageSentWrapped}
                  onPreviewImage={setLightboxImage}
                  refreshSignal={refreshSignal}
                />
              </div>
            ))
          )}
        </div>
        {lightboxModal}
      </>
    );
  }

  // ============================================================================
  // MODE B: FULL-PAGE WORKSPACE MODE (fullPageMode === true, PC & Mobile)
  // ============================================================================
  const desktopGridClass =
    visiblePeers.length === 3
      ? 'lg:grid-cols-3'
      : visiblePeers.length === 2
        ? 'lg:grid-cols-2'
        : 'lg:grid-cols-1';

  return (
    <div
      data-testid="multi-chat-workspace"
      className="w-full max-w-full min-w-0 space-y-3 overflow-x-hidden"
    >
      {/* Top Control Bar: Active Sessions (X/3) + 20 MB Ephemeral Image Budget Meter + Clear Button */}
      <div className="glass-card w-full min-w-0 p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Active Sessions Counter */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/25 via-rose-500/20 to-cyan-500/25 border border-amber-500/35 text-[var(--savannah-gold)]">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold text-theme-primary">
                  Multi-Window Chat
                </h2>
                <span
                  data-testid="active-sessions-badge"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-[var(--savannah-gold)]"
                >
                  {visiblePeers.length} / {MAX_SIMULTANEOUS_CHATS} Side-by-Side
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-theme-muted">
                <div className="flex items-center gap-1" aria-hidden="true">
                  {[0, 1, 2].map((slot) => (
                    <span
                      key={slot}
                      className={`h-2 w-5 rounded-full transition-all ${
                        slot < visiblePeers.length
                          ? 'bg-gradient-to-r from-amber-400 to-cyan-400'
                          : 'bg-slate-500/25 border border-theme'
                      }`}
                    />
                  ))}
                </div>
                <span className="truncate">
                  Up to 3 simultaneous proximity chats
                </span>
              </div>
            </div>
          </div>

          {/* 20 MB Ephemeral Image Budget Meter + Clear Session Images Button */}
          <div className="flex min-w-0 flex-col gap-2 sm:items-end">
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-theme-primary">
                <HardDrive className="h-3.5 w-3.5 shrink-0 text-[var(--rift-cyan)]" />
                <span data-testid="image-budget-text">
                  {formatBytes(budget.usedBytes)} / 20 MB used
                </span>
              </span>

              <button
                type="button"
                disabled={clearingImages}
                onClick={handleClearSessionImages}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/12 px-2.5 py-1.5 text-[11px] font-bold text-[var(--maasai-coral)] transition hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
              >
                {clearingImages ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Clear Session Images</span>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full sm:w-64">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-500/20">
                <div
                  className={`h-full rounded-full bg-gradient-to-r transition-all duration-300 ${meterBarClass}`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <p className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-theme-muted">
                <span>Auto-clears in 2h or session end</span>
                <span>
                  {budget.activeImageCount} active photo
                  {budget.activeImageCount === 1 ? '' : 's'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {clearNotice && (
          <div
            role="status"
            className="animate-slide-up mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-xs font-medium text-[var(--cyber-emerald)]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{clearNotice}</span>
          </div>
        )}
      </div>

      {/* Quick-Launch Strip: Recent Conversations & Nearby Singles (Toggle up to 3) */}
      <div className="glass-card w-full min-w-0 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-theme-primary">
            <Users className="h-3.5 w-3.5 text-[var(--rift-cyan)]" />
            <span>Recent & Nearby (Tap to Toggle Open)</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--cyber-emerald)]">
            <ShieldCheck className="h-3 w-3" />
            Within 10 km only
          </span>
        </div>

        {loadingDirectory && quickLaunchItems.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-xs text-theme-muted">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            Loading nearby conversations...
          </div>
        ) : quickLaunchItems.length === 0 ? (
          <p className="py-1 text-xs text-theme-muted">
            No nearby conversations yet. Visit 10 km Radar or AI Match to start chatting!
          </p>
        ) : (
          <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 no-scrollbar">
            {quickLaunchItems.map(({ peer, subtitle }) => {
              const isOpen = openIdSet.has(peer.id);
              return (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => {
                    if (isOpen) {
                      setMobileActivePeerId(peer.id);
                    } else {
                      onOpenPeer(peer);
                    }
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition cursor-pointer ${
                    isOpen
                      ? 'border-amber-500/50 bg-amber-500/15 shadow-sm'
                      : 'border-theme surface-subtle hover:border-cyan-500/40'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={peer.avatarUrl}
                      alt={peer.nickname}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-primary)] ${
                        peer.isOnline ? 'bg-emerald-400' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 max-w-[125px]">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs font-bold text-theme-primary">
                        {peer.nickname}
                      </span>
                      {isOpen && (
                        <span className="shrink-0 rounded bg-amber-500/25 px-1 py-0.2 text-[9px] font-bold uppercase text-amber-400">
                          Open
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-theme-muted">
                      {peer.gender} • {peer.ageRange}
                    </p>
                    <p className="truncate text-[10px] text-theme-secondary">
                      {subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Active Chat Windows Area */}
      {visiblePeers.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center px-5 py-12 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-3xl border border-amber-500/35 bg-gradient-to-br from-amber-500/20 to-cyan-500/20 text-amber-400">
            <MessageSquarePlus className="h-7 w-7" />
          </div>
          <h3 className="font-display text-lg font-bold text-theme-primary">
            Open up to 3 Simultaneous Chats
          </h3>
          <p className="mt-1.5 max-w-md text-xs text-theme-muted leading-relaxed">
            Chat side-by-side with up to 3 verified singles within 10 km — complete with emojis, voice notes, AI Kenyan openers, and 20 MB ephemeral photos that auto-clear in 2 hours.
          </p>

          {quickLaunchItems.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {quickLaunchItems.slice(0, 3).map(({ peer }) => (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => onOpenPeer(peer)}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-theme-primary transition hover:bg-amber-500/20 cursor-pointer"
                >
                  <img
                    src={peer.avatarUrl}
                    alt={peer.nickname}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span>Chat with {peer.nickname}</span>
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* PC (>= 1024px): True Side-by-Side Grid (1, 2, or 3 simultaneous interactive windows) */}
          <div
            data-testid="desktop-multichat-grid"
            className={`hidden lg:grid w-full min-w-0 gap-3 ${desktopGridClass}`}
          >
            {visiblePeers.map((peer) => (
              <div key={peer.id} className="min-w-0">
                <ChatWindow
                  peer={peer}
                  mode="fullpage"
                  onClose={() => onClosePeer(peer.id)}
                  prefillText={prefillByPeerId[peer.id]}
                  onClearPrefill={() => onClearPrefill(peer.id)}
                  budget={budget}
                  onBudgetUpdate={handleBudgetUpdate}
                  onMessageSent={handleMessageSentWrapped}
                  onPreviewImage={setLightboxImage}
                  refreshSignal={refreshSignal}
                />
              </div>
            ))}
          </div>

          {/* Mobile (< 1024px): 3-Window Horizontal Session Tab Bar + Active Chat Window (Zero Overflow) */}
          <div
            data-testid="mobile-multichat-tabs"
            className="w-full min-w-0 space-y-2.5 lg:hidden"
          >
            <div
              role="tablist"
              aria-label="Open simultaneous chats"
              className="grid w-full min-w-0 gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${visiblePeers.length}, minmax(0, 1fr))`,
              }}
            >
              {visiblePeers.map((peer) => {
                const isActive =
                  (mobileActivePeerId ?? visiblePeers[0]?.id) === peer.id;
                return (
                  <div
                    key={peer.id}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={0}
                    onClick={() => setMobileActivePeerId(peer.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setMobileActivePeerId(peer.id);
                      }
                    }}
                    className={`flex min-w-0 items-center justify-between gap-1 rounded-xl border px-2 py-2 transition cursor-pointer ${
                      isActive
                        ? 'border-amber-500/60 bg-amber-500/15 text-theme-primary shadow-sm'
                        : 'border-theme surface-subtle text-theme-muted'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="relative shrink-0">
                        <img
                          src={peer.avatarUrl}
                          alt={peer.nickname}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[var(--bg-primary)] ${
                            peer.isOnline ? 'bg-emerald-400' : 'bg-slate-400'
                          }`}
                        />
                      </div>
                      <span className="truncate text-[11px] font-bold">
                        {peer.nickname}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClosePeer(peer.id);
                      }}
                      aria-label={`Close ${peer.nickname} tab`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-theme-muted hover:bg-rose-500/20 hover:text-rose-400 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Keep all open mobile chats mounted so drafts/voice/openers persist seamlessly across tab switches */}
            {visiblePeers.map((peer) => {
              const isActive =
                (mobileActivePeerId ?? visiblePeers[0]?.id) === peer.id;
              return (
                <div
                  key={peer.id}
                  className={isActive ? 'block min-w-0' : 'hidden'}
                >
                  <ChatWindow
                    peer={peer}
                    mode="fullpage"
                    onClose={() => onClosePeer(peer.id)}
                    prefillText={prefillByPeerId[peer.id]}
                    onClearPrefill={() => onClearPrefill(peer.id)}
                    budget={budget}
                    onBudgetUpdate={handleBudgetUpdate}
                    onMessageSent={handleMessageSentWrapped}
                    onPreviewImage={setLightboxImage}
                    refreshSignal={refreshSignal}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {lightboxModal}
    </div>
  );
}
