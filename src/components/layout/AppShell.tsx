import React, { useState } from 'react';
import {
  Flame,
  Loader2,
  LogOut,
  MapPin,
  MapPinOff,
  MessageSquare,
  Moon,
  Radio,
  Sparkles,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { MAX_SIMULTANEOUS_CHATS, PROXIMITY_RADIUS_KM } from '../../shared/types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export type AppTab = 'blackboard' | 'radar' | 'ai' | 'chats' | 'profile';

interface AppShellProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  openChatCount: number;
  rightRail?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  activeTab,
  onSelectTab,
  openChatCount,
  rightRail,
  children,
}: AppShellProps) {
  const { user, deactivateUserLocation, logoutUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [togglingLocation, setTogglingLocation] = useState(false);

  const handleTurnOffLocation = async () => {
    setTogglingLocation(true);
    try {
      await deactivateUserLocation();
    } finally {
      setTogglingLocation(false);
    }
  };

  const navItems: Array<{
    id: AppTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    {
      id: 'blackboard',
      label: 'Blackboard',
      mobileLabel: 'Board',
      icon: Flame,
    },
    {
      id: 'radar',
      label: `${PROXIMITY_RADIUS_KM}km Radar`,
      mobileLabel: 'Radar',
      icon: Radio,
    },
    {
      id: 'ai',
      label: 'AI Match & Next',
      mobileLabel: 'AI Next',
      icon: Sparkles,
    },
    {
      id: 'chats',
      label: `Multi-Chat (${openChatCount}/${MAX_SIMULTANEOUS_CHATS})`,
      mobileLabel: 'Chats',
      icon: MessageSquare,
      badge: openChatCount > 0 ? `${openChatCount}/${MAX_SIMULTANEOUS_CHATS}` : undefined,
    },
    {
      id: 'profile',
      label: 'My Profile',
      mobileLabel: 'Profile',
      icon: UserIcon,
    },
  ];

  const isWideWorkspace = activeTab === 'chats';

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col">
      {/* ======================== MOBILE STICKY TOP BAR (< 1024px) ======================== */}
      <header className="lg:hidden sticky top-0 z-30 glass-panel border-x-0 border-t-0 px-3.5 py-2.5 pt-safe">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab('blackboard')}
            className="flex items-center gap-2 min-w-0 cursor-pointer"
          >
            <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-cyan-400 p-[1.5px]">
              <div className="h-full w-full rounded-[6.5px] bg-[var(--bg-primary)] flex items-center justify-center">
                <span className="font-display font-extrabold text-[11px] gradient-text">47</span>
              </div>
            </div>
            <div className="text-left min-w-0">
              <div className="font-display text-sm font-bold text-theme-primary leading-tight truncate">
                47 Cities
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold truncate">
                {user?.activeCityLabel || '10 km Zone Active'}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleTurnOffLocation()}
              disabled={togglingLocation}
              data-testid="mobile-location-toggle"
              title="Tap to turn Location OFF and lock portal"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400 active:scale-95 transition cursor-pointer"
            >
              {togglingLocation ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span>Loc ON</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl surface-subtle text-theme-secondary cursor-pointer"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-cyan-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void logoutUser()}
              aria-label="Sign Out"
              title="Sign Out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl surface-subtle text-rose-400 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ======================== MAIN 3-COLUMN RESPONSIVE SHELL ======================== */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 py-4 lg:py-5 flex items-start gap-5 xl:gap-6">
        {/* LEFT STICKY NAVIGATION RAIL (PC >= 1024px) */}
        <aside className="hidden lg:flex w-60 shrink-0 sticky top-5 flex-col gap-4 max-h-[calc(100vh-2.5rem)] overflow-y-auto no-scrollbar">
          {/* Brand Header */}
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 via-rose-500 to-cyan-400 p-[2px] shadow-md">
              <div className="h-full w-full rounded-[10px] bg-[var(--bg-primary)] flex items-center justify-center">
                <span className="font-display font-extrabold text-sm gradient-text">47</span>
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-extrabold text-theme-primary leading-tight truncate">
                47 Cities
              </h1>
              <p className="text-[11px] text-theme-muted truncate">
                Kenya 10 km Social Hub
              </p>
            </div>
          </div>

          {/* Primary Nav */}
          <nav className="glass-card p-2 space-y-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  data-testid={`nav-${item.id}`}
                  className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-cyan-500/20 text-amber-400 border border-amber-500/35 shadow-sm'
                      : 'text-theme-secondary hover:text-theme-primary surface-hover border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-extrabold text-amber-400 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Live Location ON/OFF Control */}
          <div className="glass-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                Live Location ON
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-theme-muted leading-snug truncate">
              {user?.activeCityLabel || `${PROXIMITY_RADIUS_KM} km zone active`}
            </p>
            <button
              type="button"
              onClick={() => void handleTurnOffLocation()}
              disabled={togglingLocation}
              data-testid="desktop-location-off-btn"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
            >
              {togglingLocation ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPinOff className="h-3.5 w-3.5" />
              )}
              <span>Turn Location OFF</span>
            </button>
          </div>

          {/* Theme Toggle & User Mini-Card */}
          <div className="glass-card p-3.5 space-y-3">
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="desktop-theme-toggle"
              className="w-full flex items-center justify-between rounded-xl surface-subtle surface-hover px-3 py-2 text-xs font-bold text-theme-secondary transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {isDark ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-cyan-600" />
                )}
                <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
              </span>
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400 uppercase">
                {isDark ? 'Dark' : 'Light'}
              </span>
            </button>

            {user && (
              <div className="flex items-center gap-2.5 pt-1 border-t border-theme">
                <img
                  src={user.avatarUrl}
                  alt={user.nickname}
                  className="h-9 w-9 shrink-0 rounded-full object-cover border border-amber-500/40"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-theme-primary truncate">{user.nickname}</p>
                  <p className="text-[11px] text-theme-muted truncate">
                    {user.gender} • {user.ageRange}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void logoutUser()}
                  title="Sign Out"
                  aria-label="Sign Out"
                  data-testid="desktop-signout-btn"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg surface-subtle surface-hover text-rose-400 transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER MAIN STREAM */}
        <main
          className={`flex-1 min-w-0 w-full pb-24 lg:pb-12 ${
            isWideWorkspace ? 'max-w-none' : 'max-w-[680px] mx-auto xl:mx-0'
          }`}
        >
          {children}
        </main>

        {/* RIGHT STICKY AI CO-PILOT RAIL (PC >= 1280px, hidden during full-width chat workspace) */}
        {rightRail && !isWideWorkspace && (
          <aside className="hidden xl:block w-[340px] shrink-0 sticky top-5 max-h-[calc(100vh-2.5rem)] overflow-y-auto no-scrollbar">
            {rightRail}
          </aside>
        )}
      </div>

      {/* ======================== MOBILE BOTTOM NAVIGATION BAR (< 1024px) ======================== */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-panel border-x-0 border-b-0 px-1.5 pt-1.5 pb-safe"
      >
        <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                data-testid={`mobile-nav-${item.id}`}
                className={`relative flex flex-col items-center justify-center min-h-[48px] rounded-xl px-1 py-1 text-[10px] font-bold transition cursor-pointer ${
                  isActive
                    ? 'text-amber-400 bg-amber-500/12'
                    : 'text-theme-muted hover:text-theme-primary'
                }`}
              >
                <Icon className="h-4.5 w-4.5 mb-0.5 shrink-0" />
                <span className="truncate max-w-full">{item.mobileLabel}</span>
                {item.id === 'chats' && openChatCount > 0 && (
                  <span className="absolute top-1 right-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-extrabold text-slate-950">
                    {openChatCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
