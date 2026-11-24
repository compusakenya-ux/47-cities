import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  MapPin,
  Maximize2,
  Send,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import type {
  AIIcebreakerResponse,
  ChatMessage,
  PublicMemberProfile,
  SessionImageBudget,
} from '../../shared/types';
import { MAX_SESSION_IMAGE_BYTES } from '../../shared/types';
import {
  ApiError,
  getAIIcebreaker,
  getChatMessages,
  getImageBudget,
  sendImageMessage,
  sendTextMessage,
  sendVoiceMessage,
} from '../../lib/api';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { VoiceRecorderButton, formatDuration } from './VoiceRecorderButton';

export interface LightboxImagePayload {
  url: string;
  sizeBytes: number | null;
  expiresAt: string | null;
  senderName: string;
}

interface ChatWindowProps {
  peer: PublicMemberProfile;
  mode: 'dock' | 'fullpage';
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose: () => void;
  prefillText?: string;
  onClearPrefill?: () => void;
  budget: SessionImageBudget | null;
  onBudgetUpdate: (budget: SessionImageBudget) => void;
  onMessageSent: () => void;
  onPreviewImage: (payload: LightboxImagePayload) => void;
  refreshSignal?: number;
}

const WAVEFORM_HEIGHTS = [35, 70, 50, 95, 65, 85, 45, 75, 40];

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

export function formatExpiryCountdown(
  expiresAt: string | null | undefined,
  nowMs: number
): string {
  if (!expiresAt) return 'Clears on logout';
  const targetMs = new Date(expiresAt).getTime();
  if (Number.isNaN(targetMs)) return 'Auto-clears in 2h';
  const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  if (diffSec <= 0) return 'Expiring now';
  const hours = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (hours > 0) return `Auto-clears in ${hours}h ${mins}m`;
  if (mins > 0) return `Auto-clears in ${mins}m`;
  return 'Auto-clears in <1m';
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatWindow({
  peer,
  mode,
  collapsed = false,
  onToggleCollapse,
  onClose,
  prefillText,
  onClearPrefill,
  budget,
  onBudgetUpdate,
  onMessageSent,
  onPreviewImage,
  refreshSignal = 0,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [minedToast, setMinedToast] = useState<string[] | null>(null);

  // AI Opener state
  const [aiOpeners, setAiOpeners] = useState<AIIcebreakerResponse | null>(null);
  const [loadingOpeners, setLoadingOpeners] = useState(false);
  const [showOpeners, setShowOpeners] = useState(false);

  // Live clock for ephemeral image countdown badges
  const [nowMs, setNowMs] = useState(() => Date.now());

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevCountRef = useRef<number>(0);
  const minedTimerRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  const fetchMessages = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await getChatMessages(peer.id);
        setMessages(res.messages);
        if (res.budget) {
          onBudgetUpdate(res.budget);
        }
        setErrorBanner((prev) =>
          prev && prev.includes('restricted') ? null : prev
        );
      } catch (err) {
        if (!silent) {
          if (err instanceof ApiError && err.status === 403) {
            setErrorBanner(
              'This member is currently outside your 10 km proximity radius or privacy gate.'
            );
          } else {
            setErrorBanner(
              err instanceof Error ? err.message : 'Unable to load messages.'
            );
          }
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [peer.id, onBudgetUpdate]
  );

  // Initial load + refreshSignal trigger (e.g. when session images cleared)
  useEffect(() => {
    void fetchMessages(false);
  }, [fetchMessages, refreshSignal]);

  // Gentle 4-second polling while window is open & expanded
  useEffect(() => {
    if (collapsed) return;
    const id = window.setInterval(() => {
      void fetchMessages(true);
    }, 4000);
    return () => window.clearInterval(id);
  }, [collapsed, fetchMessages]);

  // Live countdown ticker for active ephemeral images
  useEffect(() => {
    const hasActiveImage = messages.some(
      (msg) => msg.type === 'image' && Boolean(msg.imageUrl)
    );
    if (!hasActiveImage) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [messages]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      scrollToBottom(prevCountRef.current > 0);
    }
    prevCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // Honor prefillText from AI Co-Pilot rail
  useEffect(() => {
    if (prefillText && prefillText.trim().length > 0) {
      setText(prefillText);
      onClearPrefill?.();
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
    }
  }, [prefillText, onClearPrefill]);

  // Cleanup mined toast timer
  useEffect(() => {
    return () => {
      if (minedTimerRef.current !== null) {
        window.clearTimeout(minedTimerRef.current);
      }
    };
  }, []);

  const showMinedTopics = (topics: string[]) => {
    if (!topics.length) return;
    setMinedToast(topics);
    if (minedTimerRef.current !== null) {
      window.clearTimeout(minedTimerRef.current);
    }
    minedTimerRef.current = window.setTimeout(() => {
      setMinedToast(null);
    }, 5200);
  };

  const handleSendText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setErrorBanner(null);
    try {
      const res = await sendTextMessage(peer.id, trimmed);
      setMessages((prev) => [...prev, res.message]);
      setText('');
      setShowOpeners(false);
      if (res.extractedTopics?.length) {
        showMinedTopics(res.extractedTopics);
      }
      onMessageSent();
      window.setTimeout(() => scrollToBottom(true), 40);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to send message.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const input = inputRef.current;
    if (input && typeof input.selectionStart === 'number') {
      const start = input.selectionStart;
      const end = input.selectionEnd ?? start;
      const next = text.slice(0, start) + emoji + text.slice(end);
      setText(next);
      window.setTimeout(() => {
        input.focus();
        const pos = start + emoji.length;
        input.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setText((prev) => prev + emoji);
      input?.focus();
    }
  };

  const handleSendVoice = async (
    payload: FormData | { audioDataUrl: string; durationSec: number }
  ) => {
    setErrorBanner(null);
    try {
      const res = await sendVoiceMessage(peer.id, payload);
      setMessages((prev) => [...prev, res.message]);
      onMessageSent();
      window.setTimeout(() => scrollToBottom(true), 40);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to send voice note.';
      setErrorBanner(msg);
      throw err;
    }
  };

  const handleImageFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorBanner(null);

    if (!file.type.startsWith('image/')) {
      setErrorBanner('Please choose an image file (PNG, JPG, WebP, or GIF).');
      return;
    }

    const maxBytes = budget?.maxBytes ?? MAX_SESSION_IMAGE_BYTES;
    const usedBytes = budget?.usedBytes ?? 0;
    const remainingBytes = Math.max(0, maxBytes - usedBytes);

    if (file.size > remainingBytes) {
      setErrorBanner(
        `20 MB ephemeral session image limit exceeded — this photo is ${formatBytes(
          file.size
        )}, but only ${formatBytes(remainingBytes)} remains. Clear session images to send more.`
      );
      return;
    }

    setUploadingImage(true);
    try {
      const res = await sendImageMessage(peer.id, file);
      setMessages((prev) => [...prev, res.message]);
      if (res.budget) {
        onBudgetUpdate(res.budget);
      }
      setNowMs(Date.now());
      onMessageSent();
      window.setTimeout(() => scrollToBottom(true), 50);
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 413 || err.code === 'SESSION_IMAGE_LIMIT_EXCEEDED')
      ) {
        setErrorBanner(
          err.message ||
            '20 MB session image limit reached. Clear session images or wait for 2-hour auto-expiry.'
        );
        const maybeBudget = (err.details as { budget?: SessionImageBudget } | undefined)
          ?.budget;
        if (maybeBudget) {
          onBudgetUpdate(maybeBudget);
        } else {
          getImageBudget()
            .then((b) => onBudgetUpdate(b.budget))
            .catch(() => {});
        }
      } else {
        setErrorBanner(
          err instanceof Error ? err.message : 'Failed to upload ephemeral image.'
        );
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleToggleAIOpener = async () => {
    if (showOpeners && aiOpeners) {
      setShowOpeners(false);
      return;
    }
    setShowOpeners(true);
    if (aiOpeners) return;

    setLoadingOpeners(true);
    setErrorBanner(null);
    try {
      const res = await getAIIcebreaker(peer.id);
      setAiOpeners(res);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Could not fetch AI openers.'
      );
      setShowOpeners(false);
    } finally {
      setLoadingOpeners(false);
    }
  };

  const isDock = mode === 'dock';

  return (
    <section
      data-testid={`chat-window-${peer.id}`}
      aria-label={`Chat with ${peer.nickname}`}
      className={`glass-panel flex min-w-0 flex-col overflow-hidden transition-all ${
        isDock
          ? collapsed
            ? 'w-[280px] rounded-t-2xl border-b-0'
            : 'h-[470px] w-[320px] xl:w-[336px] rounded-t-2xl border-b-0 shadow-2xl'
          : 'h-[calc(100vh-290px)] min-h-[430px] max-h-[680px] w-full rounded-2xl'
      }`}
    >
      {/* STRICT PRIVACY-SHIELDED HEADER: ONLY photo, nickname, gender, ageRange, online status, Within 10 km */}
      <header
        className={`flex shrink-0 items-center justify-between gap-2 border-b border-theme px-3 py-2.5 ${
          isDock ? 'cursor-pointer select-none' : ''
        }`}
        style={{
          background:
            'linear-gradient(125deg, rgba(245, 158, 11, 0.11), rgba(6, 182, 212, 0.08))',
        }}
        onClick={isDock ? onToggleCollapse : undefined}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0">
            <img
              src={peer.avatarUrl}
              alt={peer.nickname}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-amber-500/40"
            />
            <span
              title={peer.isOnline ? 'Online now' : 'Offline'}
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-primary)] ${
                peer.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-display text-sm font-bold text-theme-primary">
                {peer.nickname}
              </h3>
              <span
                className={`shrink-0 text-[10px] font-semibold ${
                  peer.isOnline ? 'text-[var(--cyber-emerald)]' : 'text-theme-muted'
                }`}
              >
                {peer.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-theme-muted">
              <span>{peer.gender}</span>
              <span aria-hidden="true">•</span>
              <span>{peer.ageRange}</span>
              <span aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-0.5 font-medium text-[var(--rift-cyan)]">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                Within 10 km
              </span>
            </div>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {isDock && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={
                collapsed
                  ? `Expand chat with ${peer.nickname}`
                  : `Collapse chat with ${peer.nickname}`
              }
              title={collapsed ? 'Expand chat' : 'Minimize chat'}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-theme-muted hover:text-theme-primary surface-hover cursor-pointer"
            >
              {collapsed ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close chat with ${peer.nickname}`}
            title="Close chat window"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-theme-muted hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!collapsed && (
        <>
          {/* Compact Privacy & Ephemeral Notice Strip */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-theme px-3 py-1.5 text-[10px] text-theme-muted surface-subtle">
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <ShieldCheck className="h-3 w-3 shrink-0 text-[var(--cyber-emerald)]" />
              <span className="truncate">10 km shield active • Private profile hidden</span>
            </span>
            {budget && (
              <span className="shrink-0 font-mono text-[10px] font-semibold text-[var(--savannah-gold)]">
                {formatBytes(budget.usedBytes)} / 20 MB
              </span>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={scrollContainerRef}
            className="flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden px-3 py-3"
          >
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-theme-muted">
                <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                <span className="text-xs">Loading conversation...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-3 py-8 text-center">
                <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="font-display text-sm font-semibold text-theme-primary">
                  Say hi to {peer.nickname}
                </p>
                <p className="mt-1 max-w-[230px] text-xs text-theme-muted">
                  Send text, emojis, voice notes, or ephemeral photos (auto-clears in 2h).
                </p>
                <button
                  type="button"
                  onClick={handleToggleAIOpener}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/12 px-3 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  ✨ Get AI Kenyan Openers
                </button>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId !== peer.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex w-full min-w-0 ${
                      isMine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] min-w-0 rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
                        isMine
                          ? 'rounded-br-md bg-gradient-to-br from-amber-500/95 via-amber-600/95 to-rose-500/90 text-white'
                          : 'rounded-bl-md surface-subtle text-theme-primary'
                      }`}
                    >
                      {/* TEXT MESSAGE */}
                      {msg.type === 'text' && (
                        <p className="break-words whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}

                      {/* VOICE NOTE MESSAGE */}
                      {msg.type === 'voice' && (
                        <div className="space-y-1.5 min-w-[180px] max-w-full">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                              <Volume2 className="h-3.5 w-3.5 shrink-0" />
                              Voice Note
                            </span>
                            <div
                              className="flex h-4 items-end gap-[2px]"
                              aria-hidden="true"
                            >
                              {WAVEFORM_HEIGHTS.map((height, idx) => (
                                <span
                                  key={idx}
                                  className={`w-[3px] rounded-full ${
                                    isMine ? 'bg-white/80' : 'bg-cyan-400/80'
                                  }`}
                                  style={{ height: `${Math.round(height * 0.16)}px` }}
                                />
                              ))}
                            </div>
                            <span
                              className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                isMine
                                  ? 'bg-black/20 text-white'
                                  : 'bg-cyan-500/15 text-cyan-400'
                              }`}
                            >
                              {formatDuration(msg.audioDurationSec ?? 2)}
                            </span>
                          </div>
                          {msg.audioUrl ? (
                            <audio
                              controls
                              preload="metadata"
                              src={msg.audioUrl}
                              aria-label={`Voice note from ${
                                isMine ? 'you' : peer.nickname
                              }`}
                              className="h-8 w-full max-w-[220px] rounded-lg"
                            />
                          ) : (
                            <p className="text-[11px] italic opacity-80">
                              Voice note unavailable
                            </p>
                          )}
                        </div>
                      )}

                      {/* EPHEMERAL IMAGE MESSAGE */}
                      {msg.type === 'image' && (
                        <div className="space-y-1.5">
                          {msg.imageUrl ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  onPreviewImage({
                                    url: msg.imageUrl!,
                                    sizeBytes: msg.imageSizeBytes,
                                    expiresAt: msg.imageExpiresAt,
                                    senderName: isMine ? 'You' : peer.nickname,
                                  })
                                }
                                aria-label="Preview ephemeral image"
                                className="group relative block overflow-hidden rounded-xl border border-white/15 cursor-pointer"
                              >
                                <img
                                  src={msg.imageUrl}
                                  alt="Ephemeral chat attachment"
                                  className="max-h-48 w-full rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                                />
                                <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-lg bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                                  <Maximize2 className="h-2.5 w-2.5" />
                                  {formatBytes(msg.imageSizeBytes)}
                                </span>
                              </button>

                              <div
                                className={`flex flex-wrap items-center gap-1 text-[10px] font-medium ${
                                  isMine ? 'text-white/90' : 'text-amber-400'
                                }`}
                              >
                                <Clock className="h-2.5 w-2.5 shrink-0" />
                                <span>
                                  {formatExpiryCountdown(msg.imageExpiresAt, nowMs)}
                                </span>
                                <span aria-hidden="true">•</span>
                                <span>Clears on logout</span>
                              </div>
                            </>
                          ) : (
                            <div
                              data-testid="expired-image-placeholder"
                              className={`flex items-center gap-2 rounded-xl border border-dashed px-2.5 py-2 text-[11px] ${
                                isMine
                                  ? 'border-white/35 bg-black/15 text-white/90'
                                  : 'border-theme bg-black/10 text-theme-muted'
                              }`}
                            >
                              <ImageOff className="h-4 w-4 shrink-0 opacity-80" />
                              <div className="min-w-0">
                                <p className="font-semibold leading-tight">
                                  Ephemeral image cleared
                                </p>
                                <p className="text-[10px] opacity-80">
                                  Auto-expired (2h limit or session cleared)
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Timestamp */}
                      <div
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          isMine ? 'text-white/75' : 'text-theme-muted'
                        }`}
                      >
                        <span>{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Inline Error Alert (e.g. 413 20MB limit or 403 proximity) */}
          {errorBanner && (
            <div
              role="alert"
              className="mx-2.5 mb-2 flex items-start justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/12 px-2.5 py-2 text-[11px] text-[var(--maasai-coral)]"
            >
              <div className="flex min-w-0 items-start gap-1.5">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="break-words leading-snug">{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                aria-label="Dismiss error"
                className="shrink-0 rounded p-0.5 hover:bg-rose-500/20 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Subtle AI Chat-Interest Mined Pill */}
          {minedToast && minedToast.length > 0 && (
            <div
              role="status"
              className="animate-slide-up mx-2.5 mb-1.5 flex items-center justify-between gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/12 px-2.5 py-1.5 text-[11px] text-[var(--rift-cyan)]"
            >
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate font-medium">
                  AI tuned your interests: {minedToast.slice(0, 2).join(', ')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setMinedToast(null)}
                aria-label="Dismiss AI interest notice"
                className="shrink-0 opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* AI Icebreaker Quick-Chips Drawer */}
          {showOpeners && (
            <div className="animate-slide-up mx-2.5 mb-2 rounded-xl border border-amber-500/35 bg-amber-500/8 p-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--savannah-gold)]">
                  <Sparkles className="h-3 w-3" />
                  AI Kenyan Conversation Starters
                </span>
                <button
                  type="button"
                  onClick={() => setShowOpeners(false)}
                  aria-label="Close AI openers"
                  className="rounded p-0.5 text-theme-muted hover:text-theme-primary cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {loadingOpeners ? (
                <div className="flex items-center gap-2 py-2 text-[11px] text-theme-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                  Crafting personalized openers...
                </div>
              ) : aiOpeners ? (
                <div className="space-y-1.5">
                  {aiOpeners.contextHint && (
                    <p className="text-[10px] text-theme-muted">
                      {aiOpeners.contextHint}
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    {aiOpeners.openers.slice(0, 3).map((opener, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setText(opener);
                          setShowOpeners(false);
                          inputRef.current?.focus();
                        }}
                        className="w-full rounded-lg border border-theme surface-subtle px-2.5 py-1.5 text-left text-[11px] font-medium text-theme-primary transition hover:border-amber-500/45 hover:bg-amber-500/10 cursor-pointer"
                      >
                        {opener}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Composer Bar (2-row responsive layout: generous input width on both 320px dock & 390px mobile) */}
          <form
            onSubmit={handleSendText}
            className="relative flex shrink-0 flex-col gap-2 border-t border-theme p-2.5"
          >
            {/* Hidden file input for ephemeral images */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
              aria-label={`Upload ephemeral image to ${peer.nickname}`}
            />

            {/* Row 1: Media, Emoji, Voice & AI Opener toolbar */}
            <div className="flex w-full min-w-0 items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <EmojiPickerPopover
                  onSelect={handleEmojiSelect}
                  disabled={sending || uploadingImage}
                />

                <VoiceRecorderButton
                  disabled={sending || uploadingImage}
                  onSendVoice={handleSendVoice}
                />

                <button
                  type="button"
                  disabled={sending || uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Send ephemeral image (20 MB session max)"
                  title="Send ephemeral image (20 MB max • auto-clears in 2h)"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-theme surface-subtle text-theme-secondary transition hover:border-emerald-500/45 hover:text-emerald-400 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleAIOpener}
                aria-label="AI Opener suggestions"
                title="Generate 3 Kenyan AI conversation starters"
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition cursor-pointer ${
                  showOpeners
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                    : 'border-theme surface-subtle text-theme-secondary hover:border-amber-500/45 hover:text-amber-400'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>AI Opener</span>
              </button>
            </div>

            {/* Row 2: Full-width Message Input + Send Button */}
            <div className="flex w-full min-w-0 items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message ${peer.nickname}...`}
                aria-label={`Message ${peer.nickname}`}
                disabled={sending}
                className="h-10 min-w-0 flex-1 rounded-xl border border-theme surface-subtle px-3 text-xs text-theme-primary placeholder:text-theme-muted focus:border-amber-500/50 focus:outline-none"
              />

              <button
                type="submit"
                disabled={sending || !text.trim()}
                aria-label={`Send message to ${peer.nickname}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
