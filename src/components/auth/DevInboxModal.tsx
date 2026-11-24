import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Inbox, Mail, RefreshCw, Sparkles, X } from 'lucide-react';
import { getDevInbox } from '../../lib/api';
import type { DevEmailMessage } from '../../shared/types';

interface DevInboxModalProps {
  open: boolean;
  emailFilter?: string;
  onClose: () => void;
  onSelectCode: (code: string, email: string) => void;
}

export function DevInboxModal({
  open,
  emailFilter,
  onClose,
  onSelectCode,
}: DevInboxModalProps) {
  const [messages, setMessages] = useState<DevEmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetEmail = !showAll && emailFilter?.trim() ? emailFilter.trim() : undefined;
      const res = await getDevInbox(targetEmail);
      setMessages(res.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dev inbox.');
    } finally {
      setLoading(false);
    }
  }, [emailFilter, showAll]);

  useEffect(() => {
    if (open) {
      void loadMessages();
    }
  }, [open, loadMessages]);

  if (!open) return null;

  const handleCopyAndFill = async (msg: DevEmailMessage) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(msg.code);
      }
    } catch {
      // Clipboard optional in non-HTTPS contexts
    }
    setCopiedId(msg.id);
    onSelectCode(msg.code, msg.to);
    setTimeout(() => {
      setCopiedId(null);
      onClose();
    }, 220);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-inbox-title"
    >
      <div className="glass-panel animate-slide-up flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-theme px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Inbox className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 id="dev-inbox-title" className="font-display text-base font-bold text-theme-primary truncate">
                Dev Verification Inbox
              </h3>
              <p className="text-xs text-theme-muted truncate">
                Live local email preview — click a code to auto-fill instantly
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadMessages()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl surface-subtle surface-hover text-theme-secondary transition"
              title="Refresh inbox"
              aria-label="Refresh inbox"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl surface-subtle surface-hover text-theme-secondary transition"
              aria-label="Close inbox"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {emailFilter?.trim() && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme px-5 py-2.5 text-xs bg-amber-500/5">
            <span className="text-theme-secondary truncate">
              {showAll ? 'Showing all recent emails' : `Filtered for: ${emailFilter.trim()}`}
            </span>
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0"
            >
              {showAll ? 'Filter to my email' : 'Show all emails'}
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          {loading && messages.length === 0 ? (
            <div className="space-y-3">
              <div className="h-24 rounded-xl animate-shimmer border border-theme" />
              <div className="h-24 rounded-xl animate-shimmer border border-theme" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl surface-subtle px-6 py-10 text-center">
              <Mail className="h-9 w-9 text-theme-muted mb-2.5" />
              <p className="font-semibold text-sm text-theme-primary">No verification emails yet</p>
              <p className="text-xs text-theme-muted mt-1 max-w-xs">
                Register an account or request a password reset first, then refresh this inbox to view your 6-digit code.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isCopied = copiedId === msg.id;
              return (
                <div
                  key={msg.id}
                  className="rounded-xl surface-subtle p-4 space-y-3 transition hover:border-amber-500/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            msg.purpose === 'reset'
                              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          <Sparkles className="h-3 w-3" />
                          {msg.purpose === 'reset' ? 'Password Reset' : 'Email Verification'}
                        </span>
                        <span className="text-[11px] text-theme-muted">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-theme-primary break-words">
                        {msg.subject}
                      </p>
                      <p className="text-xs text-theme-muted truncate">To: {msg.to}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCopyAndFill(msg)}
                      data-testid={`dev-inbox-fill-${msg.code}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:brightness-110 shrink-0 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Filled!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy / Fill Code
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl bg-black/20 dark:bg-black/30 px-4 py-2.5 border border-theme">
                    <span className="text-xs uppercase tracking-wider text-theme-muted font-medium">
                      6-Digit Code
                    </span>
                    <span
                      className="font-display text-xl font-bold tracking-[0.28em] text-amber-400"
                      data-testid="dev-inbox-code"
                    >
                      {msg.code}
                    </span>
                  </div>

                  <p className="text-xs text-theme-secondary leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
