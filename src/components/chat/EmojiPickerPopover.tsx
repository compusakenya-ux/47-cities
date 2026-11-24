import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { CHAT_EMOJIS } from '../../shared/kenya-data';

type EmojiCategory = 'all' | 'vibes' | 'fun' | 'kenya';

const CATEGORY_TABS: { id: EmojiCategory; label: string; emojis: readonly string[] }[] = [
  {
    id: 'all',
    label: 'All',
    emojis: CHAT_EMOJIS,
  },
  {
    id: 'vibes',
    label: 'Vibes',
    emojis: ['🔥', '💛', '😍', '🫶', '❤️‍🔥', '✨', '🌟', '💯'],
  },
  {
    id: 'fun',
    label: 'Fun',
    emojis: ['😂', '😎', '😉', '🥳', '👀', '🙌', '💬', '🤝'],
  },
  {
    id: 'kenya',
    label: 'Kenya',
    emojis: ['🇰🇪', '🥂', '☕', '🎉', '🚀', '🎶', '🌴', '⚡'],
  },
];

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPickerPopover({ onSelect, disabled }: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<EmojiCategory>('all');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const activeTab =
    CATEGORY_TABS.find((tab) => tab.id === category) ?? CATEGORY_TABS[0];

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open emoji picker"
        aria-expanded={open}
        title="Insert emoji"
        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
          open
            ? 'border-amber-500/50 bg-amber-500/15 text-[var(--savannah-gold)]'
            : 'border-theme surface-subtle text-theme-secondary hover:text-[var(--savannah-gold)] hover:border-amber-500/40'
        }`}
      >
        <Smile className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className="glass-panel animate-slide-up absolute bottom-full left-0 z-40 mb-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-2xl p-2.5 shadow-2xl"
        >
          {/* Category pills */}
          <div className="mb-2 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-theme pb-2">
            {CATEGORY_TABS.map((tab) => {
              const isActive = tab.id === category;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/20 text-[var(--savannah-gold)] border border-amber-500/35'
                      : 'text-theme-muted hover:text-theme-primary surface-hover border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-6 gap-1">
            {activeTab.emojis.map((emoji) => (
              <button
                key={`${category}-${emoji}`}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                aria-label={`Insert emoji ${emoji}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-transform hover:scale-115 surface-hover cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
