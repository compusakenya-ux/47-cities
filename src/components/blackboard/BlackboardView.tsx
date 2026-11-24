import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Bookmark,
  Check,
  Eye,
  Heart,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  MessageSquare,
  Repeat2,
  Send,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Star,
  TrendingUp,
  Wand2,
  X,
} from 'lucide-react';
import type {
  AIPolishResponse,
  BlackboardComment,
  BlackboardPost,
  BlackboardTopic,
  PublicMemberProfile,
  ReactionType,
} from '../../shared/types';
import { BLACKBOARD_TOPICS } from '../../shared/kenya-data';
import {
  addPostComment,
  createBlackboardPost,
  getBlackboardPosts,
  getPostComments,
  polishPost,
  recordPostView,
  togglePostBookmark,
  togglePostReaction,
  togglePostRepost,
  togglePostStar,
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface BlackboardViewProps {
  onOpenChat: (peer: PublicMemberProfile) => void;
  initialTopic?: BlackboardTopic | 'All';
  onPostInteraction?: () => void;
}

type SortOption = 'forYou' | 'latest' | 'stars';

const REACTION_META: {
  type: ReactionType;
  emoji: string;
  label: string;
  activeClass: string;
}[] = [
  {
    type: 'love',
    emoji: '❤️',
    label: 'Love',
    activeClass: 'bg-rose-500/15 text-[var(--maasai-coral)] border-rose-500/35',
  },
  {
    type: 'fire',
    emoji: '🔥',
    label: 'Fire',
    activeClass: 'bg-amber-500/15 text-[var(--savannah-gold)] border-amber-500/35',
  },
  {
    type: 'vibe',
    emoji: '✨',
    label: 'Vibe',
    activeClass: 'bg-cyan-500/15 text-[var(--rift-cyan)] border-cyan-500/35',
  },
  {
    type: 'laugh',
    emoji: '😂',
    label: 'Laugh',
    activeClass: 'bg-yellow-500/15 text-[var(--savannah-gold)] border-yellow-500/35',
  },
  {
    type: 'inspire',
    emoji: '💡',
    label: 'Inspire',
    activeClass: 'bg-emerald-500/15 text-[var(--cyber-emerald)] border-emerald-500/35',
  },
];

const TOPIC_COLORS: Record<BlackboardTopic, string> = {
  Politics: 'bg-cyan-500/15 text-[var(--rift-cyan)] border-cyan-500/30',
  Health: 'bg-emerald-500/15 text-[var(--cyber-emerald)] border-emerald-500/30',
  Sports: 'bg-amber-500/15 text-[var(--savannah-gold)] border-amber-500/30',
  Lifestyle: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Hangouts: 'bg-rose-500/15 text-[var(--maasai-coral)] border-rose-500/30',
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

function renderHighlightedContent(content: string) {
  const parts = content.split(/(#[A-Za-z0-9_]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('#') && part.length > 1) {
      return (
        <span
          key={`tag-${idx}`}
          className="font-semibold text-[var(--rift-cyan)] hover:underline"
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={`txt-${idx}`}>{part}</React.Fragment>;
  });
}

// ============================================================================
// Single Hybrid Blackboard Post Card (FB + X + IG DNA + View Milestones)
// ============================================================================

interface PostCardProps {
  post: BlackboardPost;
  currentUserId: string | null;
  milestoneBanner: 10 | 100 | null;
  onUpdatePost: (updated: BlackboardPost, unlockedMilestone?: 10 | 100 | null) => void;
  onRecordViewOnce: (postId: string) => void;
  onOpenChat: (peer: PublicMemberProfile) => void;
  onInteraction: () => void;
}

function BlackboardPostCard({
  post,
  currentUserId,
  milestoneBanner,
  onUpdatePost,
  onRecordViewOnce,
  onOpenChat,
  onInteraction,
}: PostCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Comments drawer state
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<BlackboardComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const isOwnPost = currentUserId !== null && post.author.id === currentUserId;
  const isLongPost = post.content.length > 260;

  // Clean automatic view tracking once when card scrolls into viewport
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let timerId: number | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          timerId = window.setTimeout(() => {
            onRecordViewOnce(post.id);
          }, 300);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
      observer.disconnect();
    };
  }, [post.id, onRecordViewOnce]);

  const totalReactions = useMemo(() => {
    return Object.values(post.reactions ?? {}).reduce((sum, n) => sum + (n || 0), 0);
  }, [post.reactions]);

  const topReactionBadges = useMemo(() => {
    return REACTION_META.filter((r) => (post.reactions?.[r.type] ?? 0) > 0)
      .sort((a, b) => (post.reactions?.[b.type] ?? 0) - (post.reactions?.[a.type] ?? 0))
      .slice(0, 3);
  }, [post.reactions]);

  const activeReactionMeta = useMemo(
    () => REACTION_META.find((r) => r.type === post.userReaction) ?? null,
    [post.userReaction]
  );

  const handleStar = async () => {
    if (busyAction === 'star') return;
    setBusyAction('star');
    try {
      onRecordViewOnce(post.id);
      const res = await togglePostStar(post.id);
      onUpdatePost(res.post);
      onInteraction();
    } finally {
      setBusyAction(null);
    }
  };

  const handleReaction = async (reaction: ReactionType) => {
    setReactionTrayOpen(false);
    if (busyAction === 'react') return;
    setBusyAction('react');
    try {
      onRecordViewOnce(post.id);
      const res = await togglePostReaction(post.id, reaction);
      onUpdatePost(res.post);
      onInteraction();
    } finally {
      setBusyAction(null);
    }
  };

  const handlePhotoDoubleTap = () => {
    setHeartBurst(true);
    window.setTimeout(() => setHeartBurst(false), 650);
    if (post.userReaction !== 'love') {
      void handleReaction('love');
    }
  };

  const handleRepost = async () => {
    if (busyAction === 'repost') return;
    setBusyAction('repost');
    try {
      const res = await togglePostRepost(post.id);
      onUpdatePost(res.post);
      onInteraction();
    } finally {
      setBusyAction(null);
    }
  };

  const handleBookmark = async () => {
    if (busyAction === 'bookmark') return;
    setBusyAction('bookmark');
    try {
      const res = await togglePostBookmark(post.id);
      onUpdatePost(res.post);
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleComments = async () => {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    onRecordViewOnce(post.id);
    if (nextOpen && !commentsLoaded) {
      setCommentsLoading(true);
      setCommentError(null);
      try {
        const res = await getPostComments(post.id);
        setComments(res.comments ?? []);
        setCommentsLoaded(true);
      } catch (err) {
        setCommentError(
          err instanceof Error ? err.message : 'Unable to load replies right now.'
        );
      } finally {
        setCommentsLoading(false);
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || replySubmitting) return;
    setReplySubmitting(true);
    setCommentError(null);
    try {
      const res = await addPostComment(post.id, trimmed);
      setComments((prev) => [...prev, res.comment]);
      setReplyText('');
      onUpdatePost({
        ...post,
        commentCount:
          typeof res.commentCount === 'number'
            ? res.commentCount
            : post.commentCount + 1,
      });
      onInteraction();
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : 'Could not post comment.'
      );
    } finally {
      setReplySubmitting(false);
    }
  };

  const viewsTo10 = Math.max(0, 10 - post.viewCount);
  const viewsTo100 = Math.max(0, 100 - post.viewCount);

  return (
    <article
      ref={cardRef}
      className="glass-card w-full max-w-full overflow-hidden p-4 transition-all duration-200 hover:border-[var(--border-strong)]"
    >
      {/* Milestone Unlocked Celebration Toast */}
      {milestoneBanner && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-cyan-500/20 px-3 py-2 text-xs font-bold text-[var(--savannah-gold)] border border-[var(--border-strong)] animate-slide-up">
          <Award className="h-4 w-4 shrink-0" />
          <span>
            {milestoneBanner === 100
              ? '100-View Milestone Unlocked! +10 Cumulative Stars awarded!'
              : '10-View Milestone Unlocked! +1 Cumulative Star awarded!'}
          </span>
        </div>
      )}

      {/* Privacy-Safe Author Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0">
            <img
              src={post.author.avatarUrl}
              alt={post.author.nickname}
              className="h-10 w-10 rounded-full border border-[var(--border-glass)] object-cover"
            />
            <span
              title={post.author.isOnline ? 'Online' : 'Offline'}
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-primary)] ${
                post.author.isOnline ? 'bg-[var(--cyber-emerald)]' : 'bg-slate-400'
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="truncate font-display text-sm font-bold text-theme-primary">
                {post.author.nickname}
              </span>
              <span className="text-[11px] text-theme-muted">
                • {formatRelativeTime(post.createdAt)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-theme-muted">
              <span>
                {post.author.gender} • {post.author.ageRange}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--cyber-emerald)]">
                <ShieldCheck className="h-3 w-3" />
                Within 10 km
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              TOPIC_COLORS[post.topic] ?? 'surface-subtle text-theme-secondary'
            }`}
          >
            {post.topic}
          </span>
          {!isOwnPost && (
            <button
              type="button"
              onClick={() => onOpenChat(post.author)}
              title={`Message ${post.author.nickname}`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold surface-subtle text-theme-primary hover:border-[var(--savannah-gold)] hover:text-[var(--savannah-gold)] transition"
            >
              <MessageCircle className="h-3 w-3" />
              <span className="hidden sm:inline">Message</span>
            </button>
          )}
        </div>
      </div>

      {/* Post Body */}
      <div className="mt-3">
        <p
          className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-theme-primary ${
            isLongPost && !expanded ? 'line-clamp-4' : ''
          }`}
        >
          {renderHighlightedContent(post.content)}
        </p>
        {isLongPost && (
          <button
            type="button"
            onClick={() => {
              setExpanded((prev) => !prev);
              onRecordViewOnce(post.id);
            }}
            className="mt-1 text-xs font-semibold text-[var(--savannah-gold)] hover:underline"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Optional IG-Style Edge-to-Edge Photo with Double-Tap Heart Burst */}
      {post.imageUrl && (
        <div
          onDoubleClick={handlePhotoDoubleTap}
          className="relative -mx-4 mt-3 cursor-pointer select-none overflow-hidden bg-black/20"
          title="Double-tap to Love"
        >
          <img
            src={post.imageUrl}
            alt={`${post.topic} post by ${post.author.nickname}`}
            className="max-h-[420px] w-full object-cover"
            loading="lazy"
          />
          {heartBurst && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
              <Heart className="h-20 w-20 fill-[var(--maasai-coral)] text-[var(--maasai-coral)] drop-shadow-[0_0_20px_rgba(244,63,94,0.8)] animate-heart-pop" />
            </div>
          )}
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
            Double-tap ❤️
          </span>
        </div>
      )}

      {/* Cumulative Stars & View Milestones Strip */}
      <div className="mt-3.5 rounded-2xl p-2.5 sm:p-3 surface-subtle">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Live Views + Cumulative Star Counter + Breakdown Tooltip */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-theme-secondary">
              <Eye className="h-3.5 w-3.5 text-[var(--rift-cyan)]" />
              <span>{post.viewCount.toLocaleString()}</span>
              <span className="text-theme-muted font-normal">views</span>
            </span>

            <span
              title={`${post.readerStars} Reader Stars + ${post.viewMilestoneStars} View Milestone Bonus Stars`}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 font-bold text-[var(--savannah-gold)] border border-amber-500/30"
            >
              <Star className="h-3.5 w-3.5 fill-[var(--savannah-gold)]" />
              <span>{post.starCount}</span>
              <span className="hidden sm:inline text-[10px] font-medium opacity-85">
                ({post.readerStars} reader + {post.viewMilestoneStars} milestone)
              </span>
            </span>
          </div>

          {/* Interactive Give Star Button */}
          <button
            type="button"
            onClick={() => void handleStar()}
            disabled={busyAction === 'star'}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
              post.userHasStarred
                ? 'bg-[var(--savannah-gold)] text-slate-950 shadow-sm'
                : 'border border-[var(--border-strong)] bg-amber-500/10 text-[var(--savannah-gold)] hover:bg-amber-500/20'
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 ${post.userHasStarred ? 'fill-slate-950' : ''}`}
            />
            {post.userHasStarred ? 'Starred' : 'Give Star'}
          </button>
        </div>

        {/* 10 Views & 100 Views Glowing Milestone Badges */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition ${
              post.milestone10Unlocked
                ? 'bg-emerald-500/15 text-[var(--cyber-emerald)] border-emerald-500/35 shadow-[0_0_12px_-4px_rgba(16,185,129,0.5)]'
                : 'border-[var(--border-glass)] text-theme-muted'
            }`}
          >
            <Award className="h-3 w-3" />
            {post.milestone10Unlocked
              ? '10 Views Milestone (+1 ⭐)'
              : `10 Views: ${viewsTo10} left (+1 ⭐)`}
          </span>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition ${
              post.milestone100Unlocked
                ? 'bg-amber-500/20 text-[var(--savannah-gold)] border-amber-500/45 shadow-[0_0_14px_-4px_rgba(245,158,11,0.6)]'
                : 'border-[var(--border-glass)] text-theme-muted'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            {post.milestone100Unlocked
              ? '100 Views Milestone (+10 ⭐)'
              : `100 Views: ${viewsTo100} left (+10 ⭐)`}
          </span>
        </div>
      </div>

      {/* FB + X Action Bar */}
      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-theme pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Reaction Picker Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setReactionTrayOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                activeReactionMeta
                  ? activeReactionMeta.activeClass
                  : 'border-transparent surface-subtle text-theme-secondary hover:text-theme-primary'
              }`}
            >
              {activeReactionMeta ? (
                <>
                  <span>{activeReactionMeta.emoji}</span>
                  <span>{activeReactionMeta.label}</span>
                </>
              ) : (
                <>
                  <SmilePlus className="h-3.5 w-3.5" />
                  <span>React</span>
                </>
              )}
              {totalReactions > 0 && (
                <span className="ml-0.5 text-[11px] opacity-85">{totalReactions}</span>
              )}
            </button>

            {reactionTrayOpen && (
              <div className="glass-panel absolute bottom-full left-0 z-20 mb-2 flex items-center gap-1 rounded-2xl p-1.5 shadow-xl animate-slide-up">
                {REACTION_META.map((r) => {
                  const selected = post.userReaction === r.type;
                  const count = post.reactions?.[r.type] ?? 0;
                  return (
                    <button
                      key={r.type}
                      type="button"
                      onClick={() => void handleReaction(r.type)}
                      title={`${r.label} (${count})`}
                      className={`flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold transition hover:scale-110 ${
                        selected
                          ? 'bg-[var(--bg-hover)] ring-1 ring-[var(--savannah-gold)]'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span className="text-base leading-none">{r.emoji}</span>
                      {count > 0 && (
                        <span className="text-[10px] text-theme-secondary">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inline top reaction chips */}
          {topReactionBadges.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {topReactionBadges.map((r) => (
                <button
                  key={`chip-${r.type}`}
                  type="button"
                  onClick={() => void handleReaction(r.type)}
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] surface-subtle text-theme-muted hover:text-theme-primary"
                >
                  <span>{r.emoji}</span>
                  <span>{post.reactions[r.type]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Threaded Comments Button */}
          <button
            type="button"
            onClick={() => void handleToggleComments()}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              commentsOpen
                ? 'bg-cyan-500/15 text-[var(--rift-cyan)] border border-cyan-500/30'
                : 'surface-subtle text-theme-secondary hover:text-theme-primary'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{post.commentCount}</span>
          </button>

          {/* Repost / Echo Button */}
          <button
            type="button"
            onClick={() => void handleRepost()}
            disabled={busyAction === 'repost'}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              post.userHasReposted
                ? 'bg-emerald-500/15 text-[var(--cyber-emerald)] border border-emerald-500/30'
                : 'surface-subtle text-theme-secondary hover:text-theme-primary'
            }`}
          >
            <Repeat2 className="h-3.5 w-3.5" />
            <span>{post.repostCount}</span>
          </button>
        </div>

        {/* Bookmark Toggle */}
        <button
          type="button"
          onClick={() => void handleBookmark()}
          disabled={busyAction === 'bookmark'}
          aria-label={post.userHasBookmarked ? 'Remove bookmark' : 'Bookmark post'}
          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
            post.userHasBookmarked
              ? 'bg-amber-500/15 text-[var(--savannah-gold)] border border-amber-500/30'
              : 'surface-subtle text-theme-secondary hover:text-theme-primary'
          }`}
        >
          <Bookmark
            className={`h-3.5 w-3.5 ${
              post.userHasBookmarked ? 'fill-[var(--savannah-gold)]' : ''
            }`}
          />
          <span className="hidden sm:inline">
            {post.userHasBookmarked ? 'Saved' : 'Save'}
          </span>
        </button>
      </div>

      {/* Threaded Comments Drawer */}
      {commentsOpen && (
        <div className="mt-3 space-y-3 border-t border-theme pt-3 animate-slide-up">
          {commentsLoading && (
            <div className="flex items-center gap-2 text-xs text-theme-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--rift-cyan)]" />
              Loading replies...
            </div>
          )}

          {commentError && (
            <p className="text-xs font-medium text-[var(--maasai-coral)]">{commentError}</p>
          )}

          {!commentsLoading && comments.length === 0 && (
            <p className="text-xs text-theme-muted">
              No replies yet — start the conversation!
            </p>
          )}

          {!commentsLoading && comments.length > 0 && (
            <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2.5 rounded-xl p-2.5 surface-subtle"
                >
                  <div className="relative shrink-0">
                    <img
                      src={c.author.avatarUrl}
                      alt={c.author.nickname}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[var(--bg-primary)] ${
                        c.author.isOnline ? 'bg-[var(--cyber-emerald)]' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
                      <span className="font-bold text-theme-primary">
                        {c.author.nickname}
                      </span>
                      <span className="text-theme-muted">
                        {c.author.gender} • {c.author.ageRange}
                      </span>
                      <span className="text-theme-muted">
                        • {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-xs text-theme-secondary">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a respectful reply..."
              maxLength={400}
              className="min-w-0 flex-1 rounded-xl px-3 py-2 text-xs text-theme-primary placeholder:text-theme-muted surface-subtle focus:border-[var(--rift-cyan)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={replySubmitting || !replyText.trim()}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[var(--rift-cyan)] px-3 py-2 text-xs font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-45"
            >
              {replySubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Reply
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

// ============================================================================
// Main Public Blackboard View
// ============================================================================

export function BlackboardView({
  onOpenChat,
  initialTopic = 'All',
  onPostInteraction,
}: BlackboardViewProps) {
  const { user } = useAuth();

  const [selectedTopic, setSelectedTopic] = useState<BlackboardTopic | 'All'>(initialTopic);
  const [sort, setSort] = useState<SortOption>('forYou');
  const [posts, setPosts] = useState<BlackboardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [draft, setDraft] = useState('');
  const [composerTopic, setComposerTopic] = useState<BlackboardTopic>('Hangouts');
  const [photoMode, setPhotoMode] = useState<'none' | 'url'>('none');
  const [photoUrl, setPhotoUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // AI Polish state
  const [polishing, setPolishing] = useState(false);
  const [polishSuggestion, setPolishSuggestion] = useState<AIPolishResponse | null>(null);

  // View milestone celebrations & deduplicated view tracker
  const [unlockedBanners, setUnlockedBanners] = useState<Record<string, 10 | 100>>({});
  const recordedViewsRef = useRef<Set<string>>(new Set());
  const photoFileRef = useRef<HTMLInputElement | null>(null);

  // Sync external topic selection (e.g., from AI Co-Pilot)
  useEffect(() => {
    setSelectedTopic(initialTopic);
    if (initialTopic !== 'All') {
      setComposerTopic(initialTopic);
    }
  }, [initialTopic]);

  const fetchPosts = useCallback(
    async (topicArg: BlackboardTopic | 'All', sortArg: SortOption) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getBlackboardPosts(topicArg, sortArg);
        setPosts(res.posts ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load the Blackboard feed.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchPosts(selectedTopic, sort);
  }, [selectedTopic, sort, fetchPosts]);

  const handleUpdatePost = useCallback(
    (updated: BlackboardPost, unlockedMilestone?: 10 | 100 | null) => {
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (unlockedMilestone) {
        setUnlockedBanners((prev) => ({ ...prev, [updated.id]: unlockedMilestone }));
      }
    },
    []
  );

  const handleRecordViewOnce = useCallback(
    (postId: string) => {
      if (recordedViewsRef.current.has(postId)) return;
      recordedViewsRef.current.add(postId);
      void recordPostView(postId)
        .then((res) => {
          handleUpdatePost(res.post, res.unlockedMilestone);
        })
        .catch(() => {
          // Allow retry later if transient network error
          recordedViewsRef.current.delete(postId);
        });
    },
    [handleUpdatePost]
  );

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setComposerError('Please choose a valid image file.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setComposerError('Post image should be 3 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
        setPhotoMode('none');
        setComposerError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAIPolish = async () => {
    const trimmed = draft.trim();
    if (!trimmed || polishing) return;
    setPolishing(true);
    setComposerError(null);
    try {
      const suggestion = await polishPost(trimmed, composerTopic);
      setPolishSuggestion(suggestion);
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : 'AI Polish is temporarily unavailable.'
      );
    } finally {
      setPolishing(false);
    }
  };

  const handleApplyPolish = () => {
    if (!polishSuggestion) return;
    const tagsSuffix =
      polishSuggestion.suggestedTags.length > 0 &&
      !polishSuggestion.polished.includes('#')
        ? ` ${polishSuggestion.suggestedTags
            .slice(0, 3)
            .map((t) => (t.startsWith('#') ? t : `#${t}`))
            .join(' ')}`
        : '';
    setDraft(`${polishSuggestion.polished}${tagsSuffix}`);
    setComposerTopic(polishSuggestion.suggestedTopic);
    setPolishSuggestion(null);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || publishing) return;
    setPublishing(true);
    setComposerError(null);
    try {
      const res = await createBlackboardPost({
        topic: composerTopic,
        content: trimmed,
        imageUrl: photoUrl.trim() || null,
      });
      if (selectedTopic === 'All' || selectedTopic === res.post.topic) {
        setPosts((prev) => [res.post, ...prev]);
      } else {
        setSelectedTopic(res.post.topic);
      }
      setDraft('');
      setPhotoUrl('');
      setPhotoMode('none');
      setPolishSuggestion(null);
      onPostInteraction?.();
    } catch (err) {
      setComposerError(
        err instanceof Error ? err.message : 'Could not publish your post.'
      );
    } finally {
      setPublishing(false);
    }
  };

  const allTopics: (BlackboardTopic | 'All')[] = ['All', ...BLACKBOARD_TOPICS];

  return (
    <div className="w-full max-w-full space-y-4">
      {/* Unified Blackboard Composer */}
      <section className="glass-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--savannah-gold)] to-[var(--maasai-coral)] text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-theme-primary">
                47 Cities Public Blackboard
              </h2>
              <p className="text-[11px] text-theme-muted">
                Earn cumulative ⭐ from readers + 10 &amp; 100 view milestones
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-theme-muted">
            {draft.length}/500
          </span>
        </div>

        <form onSubmit={handlePublish} className="space-y-3">
          <textarea
            rows={3}
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share a city pulse, sports take, hangout plan, or wellness tip... #47Cities"
            className="w-full resize-none rounded-2xl px-3.5 py-2.5 text-sm text-theme-primary placeholder:text-theme-muted surface-subtle focus:border-[var(--savannah-gold)] focus:outline-none"
          />

          {/* AI Polish Suggestion Panel */}
          {polishSuggestion && (
            <div className="rounded-2xl border border-[var(--border-strong)] bg-amber-500/10 p-3 space-y-2 animate-slide-up">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--savannah-gold)]">
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>AI Polish ({polishSuggestion.tone})</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] surface-subtle text-theme-primary">
                    Topic: {polishSuggestion.suggestedTopic}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPolishSuggestion(null)}
                  aria-label="Dismiss AI polish"
                  className="text-theme-muted hover:text-theme-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs leading-relaxed text-theme-primary">
                {polishSuggestion.polished}
              </p>
              {polishSuggestion.suggestedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {polishSuggestion.suggestedTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--rift-cyan)] surface-subtle"
                    >
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApplyPolish}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--savannah-gold)] px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:brightness-110"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply Polish
                </button>
                <button
                  type="button"
                  onClick={() => setPolishSuggestion(null)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-theme-muted hover:text-theme-primary"
                >
                  Keep Original
                </button>
              </div>
            </div>
          )}

          {/* Optional Photo URL input */}
          {photoMode === 'url' && (
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="Paste image URL (https://...)"
                className="min-w-0 flex-1 rounded-xl px-3 py-2 text-xs text-theme-primary placeholder:text-theme-muted surface-subtle focus:border-[var(--rift-cyan)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setPhotoMode('none')}
                className="rounded-xl px-2.5 py-2 text-xs text-theme-muted hover:text-theme-primary"
              >
                Done
              </button>
            </div>
          )}

          {/* Photo Preview */}
          {photoUrl && (
            <div className="relative overflow-hidden rounded-2xl border border-theme">
              <img
                src={photoUrl}
                alt="Post attachment preview"
                className="max-h-52 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotoUrl('')}
                aria-label="Remove photo"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Composer Topic Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {BLACKBOARD_TOPICS.map((t) => {
              const active = composerTopic === t;
              return (
                <button
                  key={`compose-${t}`}
                  type="button"
                  onClick={() => setComposerTopic(t)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
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

          {composerError && (
            <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-medium text-[var(--maasai-coral)] border border-rose-500/25">
              {composerError}
            </p>
          )}

          {/* Composer Bottom Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <input
                ref={photoFileRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => photoFileRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold surface-subtle text-theme-secondary hover:text-theme-primary transition"
              >
                <ImageIcon className="h-3.5 w-3.5 text-[var(--rift-cyan)]" />
                Photo
              </button>
              <button
                type="button"
                onClick={() =>
                  setPhotoMode((m) => (m === 'url' ? 'none' : 'url'))
                }
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold surface-subtle text-theme-secondary hover:text-theme-primary transition"
              >
                <Link2 className="h-3.5 w-3.5 text-[var(--cyber-emerald)]" />
                URL
              </button>
              <button
                type="button"
                onClick={() => void handleAIPolish()}
                disabled={polishing || !draft.trim()}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-[var(--savannah-gold)] transition hover:bg-amber-500/20 disabled:opacity-45"
              >
                {polishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                ✨ AI Polish
              </button>
            </div>

            <button
              type="submit"
              disabled={publishing || !draft.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--savannah-gold)] via-[var(--maasai-coral)] to-[var(--rift-cyan)] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-45"
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Post to Blackboard
            </button>
          </div>
        </form>
      </section>

      {/* Topic Filter Pills + Sort Pills */}
      <div className="space-y-2.5">
        <div className="flex w-full max-w-full items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {allTopics.map((topic) => {
            const active = selectedTopic === topic;
            return (
              <button
                key={`filter-${topic}`}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-gradient-to-r from-[var(--savannah-gold)] to-[var(--maasai-coral)] text-white shadow-sm'
                    : 'glass-card text-theme-secondary hover:text-theme-primary'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: 'forYou', label: 'For You (AI)', icon: Sparkles },
                { key: 'latest', label: 'Latest', icon: TrendingUp },
                { key: 'stars', label: 'Top Stars', icon: Star },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = sort === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSort(opt.key)}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-cyan-500/15 text-[var(--rift-cyan)] border border-cyan-500/35'
                      : 'surface-subtle text-theme-muted hover:text-theme-primary'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <span className="hidden sm:inline text-[11px] font-medium text-theme-muted">
            {posts.length} posts
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`post-skel-${i}`} className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full animate-shimmer surface-subtle" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 rounded animate-shimmer surface-subtle" />
                  <div className="h-3 w-40 rounded animate-shimmer surface-subtle" />
                </div>
              </div>
              <div className="h-14 w-full rounded-xl animate-shimmer surface-subtle" />
              <div className="h-10 w-full rounded-xl animate-shimmer surface-subtle" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="glass-card border-rose-500/30 p-5 text-center">
          <p className="text-sm font-medium text-[var(--maasai-coral)]">{error}</p>
          <button
            type="button"
            onClick={() => void fetchPosts(selectedTopic, sort)}
            className="mt-3 rounded-xl px-4 py-2 text-xs font-bold surface-subtle text-theme-primary hover:bg-[var(--bg-hover)]"
          >
            Reload Blackboard
          </button>
        </div>
      )}

      {/* Posts Feed */}
      {!loading && !error && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => (
            <BlackboardPostCard
              key={post.id}
              post={post}
              currentUserId={user?.id ?? null}
              milestoneBanner={unlockedBanners[post.id] ?? null}
              onUpdatePost={handleUpdatePost}
              onRecordViewOnce={handleRecordViewOnce}
              onOpenChat={onOpenChat}
              onInteraction={() => onPostInteraction?.()}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && posts.length === 0 && (
        <div className="glass-card p-8 text-center">
          <p className="font-display text-base font-bold text-theme-primary">
            No posts in {selectedTopic} yet
          </p>
          <p className="mt-1 text-xs text-theme-muted">
            Be the first to spark a conversation on the 47 Cities Blackboard!
          </p>
        </div>
      )}
    </div>
  );
}
