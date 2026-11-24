import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MessageCircle,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  BlackboardTopic,
  CreateStoryPayload,
  PublicMemberProfile,
  StoryItem,
} from '../../shared/types';
import { BLACKBOARD_TOPICS } from '../../shared/kenya-data';
import { createStory, getStories, markStoryViewed } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface StoriesStripProps {
  onOpenChat: (peer: PublicMemberProfile) => void;
}

interface GradientPreset {
  id: string;
  label: string;
  from: string;
  to: string;
}

const STORY_GRADIENTS: readonly GradientPreset[] = [
  { id: 'savannah', label: 'Savannah', from: '#F59E0B', to: '#F43F5E' },
  { id: 'rift', label: 'Rift Cyan', from: '#06B6D4', to: '#10B981' },
  { id: 'nairobi', label: 'Nairobi Dusk', from: '#8B5CF6', to: '#EC4899' },
  { id: 'coast', label: 'Coastal', from: '#0EA5E9', to: '#F59E0B' },
  { id: 'kilimani', label: 'Emerald', from: '#10B981', to: '#3B82F6' },
  { id: 'maasai', label: 'Sunset', from: '#F43F5E', to: '#F97316' },
];

const STORY_DURATION_MS = 6500;

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function StoriesStrip({ onOpenChat }: StoriesStripProps) {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewer modal state
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  // Creator modal state
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [topic, setTopic] = useState<BlackboardTopic>('Hangouts');
  const [selectedGradient, setSelectedGradient] = useState<GradientPreset>(STORY_GRADIENTS[0]);
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewedSentRef = useRef<Set<string>>(new Set());

  const fetchStories = useCallback(async () => {
    try {
      setError(null);
      const res = await getStories();
      const list = Array.isArray(res) ? res : res.stories ?? [];
      setStories(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load nearby stories.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStories();
  }, [fetchStories]);

  const activeStory = useMemo(
    () => (activeIndex !== null && stories[activeIndex] ? stories[activeIndex] : null),
    [activeIndex, stories]
  );

  // Mark story viewed when opened
  useEffect(() => {
    if (!activeStory) return;
    if (!activeStory.viewed && !viewedSentRef.current.has(activeStory.id)) {
      viewedSentRef.current.add(activeStory.id);
      setStories((prev) =>
        prev.map((s) => (s.id === activeStory.id ? { ...s, viewed: true } : s))
      );
      void markStoryViewed(activeStory.id).catch(() => {
        // Non-blocking
      });
    }
  }, [activeStory]);

  // Auto-advance progress bar for story viewer
  useEffect(() => {
    if (activeIndex === null) {
      setProgress(0);
      return;
    }
    setProgress(0);
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null || paused) return;

    const tickMs = 50;
    const step = (tickMs / STORY_DURATION_MS) * 100;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          if (activeIndex < stories.length - 1) {
            setActiveIndex(activeIndex + 1);
            return 0;
          }
          setActiveIndex(null);
          return 0;
        }
        return prev + step;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [activeIndex, paused, stories.length]);

  // Keyboard navigation in Story Viewer
  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveIndex(null);
      if (e.key === 'ArrowRight') {
        setActiveIndex((idx) =>
          idx === null ? null : idx < stories.length - 1 ? idx + 1 : null
        );
      }
      if (e.key === 'ArrowLeft') {
        setActiveIndex((idx) => (idx === null ? null : Math.max(0, idx - 1)));
      }
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, stories.length]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCreateError('Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCreateError('Story photo must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setCreateError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = caption.trim();
    if (!trimmed) {
      setCreateError('Write a quick vibe caption first.');
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const payload: CreateStoryPayload = {
        caption: trimmed,
        topic,
        accentFrom: selectedGradient.from,
        accentTo: selectedGradient.to,
        imageUrl: imageUrl.trim() || null,
      };
      const res = await createStory(payload);
      const created = 'story' in res ? res.story : (res as StoryItem);
      setStories((prev) => [created, ...prev]);
      setCaption('');
      setImageUrl('');
      setCreatorOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not publish vibe.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-label="Proximity Stories"
      className="glass-card w-full max-w-full overflow-hidden p-3 sm:p-4"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--savannah-gold)]" />
          <h2 className="font-display text-sm font-semibold tracking-tight text-theme-primary truncate">
            10 km Proximity Vibes
          </h2>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium surface-subtle text-theme-muted">
            <ShieldCheck className="h-3 w-3 text-[var(--cyber-emerald)]" />
            24h Stories
          </span>
        </div>
        <span className="text-[11px] font-medium text-theme-muted shrink-0">
          {stories.length} live nearby
        </span>
      </div>

      {/* Horizontal scrollable glowing story strip — strictly contained */}
      <div className="flex w-full max-w-full items-start gap-3.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        {/* + Share Vibe CTA */}
        <button
          type="button"
          onClick={() => setCreatorOpen(true)}
          className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5 text-center focus:outline-none"
        >
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[var(--savannah-gold)]/70 bg-[var(--bg-subtle)] transition-all duration-200 group-hover:scale-105 group-hover:border-[var(--rift-cyan)] group-hover:shadow-[var(--shadow-glow)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--savannah-gold)] via-[var(--maasai-coral)] to-[var(--rift-cyan)] text-white shadow-md">
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </div>
          </div>
          <span className="w-full truncate text-xs font-semibold text-theme-primary">
            Share Vibe
          </span>
          <span className="text-[10px] font-medium text-[var(--savannah-gold)]">
            + Story
          </span>
        </button>

        {/* Loading skeleton */}
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`story-skel-${i}`}
              className="flex w-[74px] shrink-0 flex-col items-center gap-1.5"
            >
              <div className="h-16 w-16 rounded-full animate-shimmer surface-subtle" />
              <div className="h-3 w-12 rounded animate-shimmer surface-subtle" />
            </div>
          ))}

        {/* Error state */}
        {!loading && error && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-theme-muted surface-subtle">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void fetchStories()}
              className="font-semibold text-[var(--rift-cyan)] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Active nearby stories */}
        {!loading &&
          !error &&
          stories.map((story, idx) => (
            <button
              key={story.id}
              type="button"
              onClick={() => {
                setPaused(false);
                setActiveIndex(idx);
              }}
              className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5 text-center focus:outline-none"
            >
              <div className="relative">
                <div className={story.viewed ? 'story-ring-seen' : 'story-ring'}>
                  <div className="rounded-full bg-[var(--bg-primary)] p-[2px]">
                    <img
                      src={story.author.avatarUrl}
                      alt={story.author.nickname}
                      className="h-[58px] w-[58px] rounded-full object-cover"
                    />
                  </div>
                </div>
                {story.author.isOnline && (
                  <span
                    title="Online now"
                    className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-primary)] bg-[var(--cyber-emerald)] shadow-sm"
                  />
                )}
              </div>
              <span className="w-full truncate text-xs font-medium text-theme-primary group-hover:text-[var(--savannah-gold)] transition-colors">
                {story.author.nickname}
              </span>
              <span className="w-full truncate text-[10px] text-theme-muted">
                {story.author.ageRange}
              </span>
            </button>
          ))}

        {!loading && !error && stories.length === 0 && (
          <div className="flex h-16 items-center px-2 text-xs text-theme-muted">
            No nearby vibes yet — drop the first 24h vibe in your 10 km radius!
          </div>
        )}
      </div>

      {/* ====================================================================
          FULLSCREEN STORY VIEWER MODAL
          ==================================================================== */}
      {activeStory && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Story by ${activeStory.author.nickname}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-xl animate-slide-up"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative flex h-[min(660px,92vh)] w-full max-w-[420px] flex-col overflow-hidden rounded-3xl border border-white/15 shadow-2xl"
            style={{
              background: `linear-gradient(155deg, ${activeStory.accentFrom || '#F59E0B'} 0%, ${activeStory.accentTo || '#06B6D4'} 100%)`,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {/* Optional background photo */}
            {activeStory.imageUrl && (
              <img
                src={activeStory.imageUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-85"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/65 via-black/25 to-black/85" />

            {/* Multi-segment progress bar */}
            <div className="relative z-10 flex gap-1.5 px-4 pt-3.5">
              {stories.map((s, idx) => (
                <div
                  key={s.id}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
                >
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
                    style={{
                      width:
                        idx < activeIndex
                          ? '100%'
                          : idx === activeIndex
                            ? `${Math.min(100, progress)}%`
                            : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Privacy-safe author header (ONLY Photo, Nickname, Gender, Age Range, Online, Within 10 km) */}
            <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="relative shrink-0">
                  <img
                    src={activeStory.author.avatarUrl}
                    alt={activeStory.author.nickname}
                    className="h-10 w-10 rounded-full border-2 border-white/80 object-cover"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black/70 ${
                      activeStory.author.isOnline
                        ? 'bg-[var(--cyber-emerald)]'
                        : 'bg-slate-400'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-display text-sm font-bold text-white">
                      {activeStory.author.nickname}
                    </span>
                    <span className="text-[11px] text-white/75">
                      • {formatRelativeTime(activeStory.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/90">
                    <span>
                      {activeStory.author.gender} • {activeStory.author.ageRange}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-400/30">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Within 10 km
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? 'Resume story' : 'Pause story'}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55 transition-colors"
                >
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  aria-label="Close story viewer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Center Story Content */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
              {activeStory.topic && (
                <span className="mb-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md border border-white/20">
                  #{activeStory.topic}
                </span>
              )}
              <p className="font-display text-xl sm:text-2xl font-bold leading-snug text-white drop-shadow-md">
                {activeStory.caption}
              </p>
            </div>

            {/* Bottom Controls & Chat Now CTA */}
            <div className="relative z-10 flex items-center justify-between gap-3 px-4 pb-5 pt-2">
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                aria-label="Previous story"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/55 disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {user && activeStory.author.id === user.id ? (
                <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md border border-white/25">
                  <Sparkles className="h-4 w-4 text-[var(--savannah-gold)]" />
                  Your Active 24h Vibe
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const target = activeStory.author;
                    setActiveIndex(null);
                    onOpenChat(target);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--savannah-gold)] via-[var(--maasai-coral)] to-[var(--rift-cyan)] px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Chat Now with {activeStory.author.nickname}
                </button>
              )}

              <button
                type="button"
                disabled={activeIndex >= stories.length - 1}
                onClick={() =>
                  setActiveIndex((i) =>
                    i !== null && i < stories.length - 1 ? i + 1 : i
                  )
                }
                aria-label="Next story"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/55 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          STORY CREATOR MODAL (+ Share Vibe)
          ==================================================================== */}
      {creatorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share a 24h Proximity Vibe"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-slide-up"
          onClick={() => setCreatorOpen(false)}
        >
          <div
            className="glass-panel w-full max-w-md overflow-hidden rounded-3xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-theme-primary">
                  Share a 10 km Vibe
                </h3>
                <p className="text-xs text-theme-muted">
                  Visible for 24h to nearby matches • Exact location stays hidden
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatorOpen(false)}
                aria-label="Close story creator"
                className="flex h-8 w-8 items-center justify-center rounded-full surface-subtle text-theme-secondary hover:text-theme-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStory} className="space-y-4">
              {/* Live Gradient Preview */}
              <div
                className="relative flex h-36 w-full flex-col items-center justify-center overflow-hidden rounded-2xl p-4 text-center shadow-inner"
                style={{
                  background: `linear-gradient(145deg, ${selectedGradient.from}, ${selectedGradient.to})`,
                }}
              >
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Story preview"
                    className="absolute inset-0 h-full w-full object-cover opacity-80"
                  />
                )}
                <div className="absolute inset-0 bg-black/30" />
                <span className="relative z-10 mb-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                  #{topic}
                </span>
                <p className="relative z-10 line-clamp-3 font-display text-base font-bold text-white drop-shadow">
                  {caption.trim() || 'What is the move in your city tonight?'}
                </p>
              </div>

              {/* Caption */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="story-caption"
                    className="text-xs font-semibold text-theme-secondary"
                  >
                    Vibe Caption
                  </label>
                  <span className="text-[11px] text-theme-muted">
                    {caption.length}/220
                  </span>
                </div>
                <textarea
                  id="story-caption"
                  rows={3}
                  maxLength={220}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Coffee run in Westlands or sunset stroll? Drop your vibe..."
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted surface-subtle focus:border-[var(--savannah-gold)] focus:outline-none"
                />
              </div>

              {/* Topic Selector */}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-theme-secondary">
                  Topic Pill
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {BLACKBOARD_TOPICS.map((t) => {
                    const active = topic === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTopic(t)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? 'bg-[var(--savannah-gold)] text-slate-950 shadow-sm'
                            : 'surface-subtle text-theme-secondary hover:text-theme-primary'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gradient Accent Picker */}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-theme-secondary">
                  Aura Gradient
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {STORY_GRADIENTS.map((preset) => {
                    const active = selectedGradient.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedGradient(preset)}
                        title={preset.label}
                        className={`h-9 w-full rounded-xl transition-transform ${
                          active
                            ? 'scale-105 ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-primary)]'
                            : 'opacity-85 hover:opacity-100'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Optional Photo */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold surface-subtle text-theme-secondary hover:text-theme-primary transition"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-[var(--rift-cyan)]" />
                  {imageUrl ? 'Change Photo' : 'Add Photo (Optional)'}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs font-medium text-[var(--maasai-coral)] hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              {createError && (
                <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-medium text-[var(--maasai-coral)] border border-rose-500/25">
                  {createError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !caption.trim()}
                className="w-full rounded-2xl bg-gradient-to-r from-[var(--savannah-gold)] via-[var(--maasai-coral)] to-[var(--rift-cyan)] px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? 'Publishing Vibe...' : 'Publish 24h Story'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
