import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import {
  MAX_SIMULTANEOUS_CHATS,
  type BlackboardTopic,
  type PublicMemberProfile,
} from './shared/types';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { LocationGate } from './components/location/LocationGate';
import { AppShell, type AppTab } from './components/layout/AppShell';
import { ProfileView } from './components/profile/ProfileView';
import { StoriesStrip } from './components/stories/StoriesStrip';
import { BlackboardView } from './components/blackboard/BlackboardView';
import { ProximityRadar } from './components/radar/ProximityRadar';
import { AICopilotPanel } from './components/ai/AICopilotPanel';
import { MultiChatDock } from './components/chat/MultiChatDock';

interface ToastState {
  id: number;
  message: string;
  tone: 'info' | 'warning' | 'success';
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<AppTab>('blackboard');
  const [selectedTopic, setSelectedTopic] = useState<BlackboardTopic | 'All'>('All');
  const [aiRefreshKey, setAiRefreshKey] = useState(0);
  const [openChatPeers, setOpenChatPeers] = useState<PublicMemberProfile[]>([]);
  const [prefillByPeerId, setPrefillByPeerId] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: ToastState['tone'] = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4200);
  }, []);

  // Reset active chats when user signs out or turns location OFF
  useEffect(() => {
    if (!user || !user.locationActive) {
      setOpenChatPeers([]);
      setPrefillByPeerId({});
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const bumpAiRefresh = useCallback(() => {
    setAiRefreshKey((k) => k + 1);
  }, []);

  const handleOpenChat = useCallback(
    (peer: PublicMemberProfile, prefillText?: string) => {
      if (user && peer.id === user.id) {
        showToast('That is your own profile!', 'info');
        return;
      }

      const exists = openChatPeers.some((p) => p.id === peer.id);
      if (!exists && openChatPeers.length >= MAX_SIMULTANEOUS_CHATS) {
        showToast(
          'Max 3 simultaneous chats reached — close one window to open a new chat',
          'warning'
        );
        return;
      }

      if (prefillText) {
        setPrefillByPeerId((prev) => ({ ...prev, [peer.id]: prefillText }));
      }

      setOpenChatPeers((prev) => {
        if (prev.some((p) => p.id === peer.id)) {
          return prev.map((p) => (p.id === peer.id ? peer : p));
        }
        if (prev.length >= MAX_SIMULTANEOUS_CHATS) {
          return prev;
        }
        return [...prev, peer];
      });

      // On mobile viewports, navigate directly to the Chats workspace so the user sees the opened chat
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setActiveTab('chats');
      }
    },
    [openChatPeers, showToast, user]
  );

  const handleClosePeer = useCallback((peerId: string) => {
    setOpenChatPeers((prev) => prev.filter((p) => p.id !== peerId));
    setPrefillByPeerId((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const handleClearPrefill = useCallback((peerId: string) => {
    setPrefillByPeerId((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const handleSelectTopic = useCallback((topic: BlackboardTopic) => {
    setSelectedTopic(topic);
    setActiveTab('blackboard');
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 p-6">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-cyan-400 p-[2px] shadow-xl">
          <div className="h-full w-full rounded-[14px] bg-[var(--bg-primary)] flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          </div>
        </div>
        <p className="font-display text-sm font-bold text-theme-secondary">
          Connecting to 47 Cities...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!user.locationActive) {
    return <LocationGate />;
  }

  const activeChatIds = openChatPeers.map((p) => p.id);

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        openChatCount={openChatPeers.length}
        rightRail={
          <AICopilotPanel
            mode="rail"
            onOpenChat={handleOpenChat}
            onSelectTopic={handleSelectTopic}
            refreshKey={aiRefreshKey}
          />
        }
      >
        {activeTab === 'blackboard' && (
          <div className="space-y-5">
            <StoriesStrip onOpenChat={(peer) => handleOpenChat(peer)} />
            <BlackboardView
              onOpenChat={(peer) => handleOpenChat(peer)}
              initialTopic={selectedTopic}
              onPostInteraction={bumpAiRefresh}
            />
          </div>
        )}

        {activeTab === 'radar' && (
          <ProximityRadar
            onOpenChat={(peer) => handleOpenChat(peer)}
            activeChatIds={activeChatIds}
          />
        )}

        {activeTab === 'ai' && (
          <AICopilotPanel
            mode="full"
            onOpenChat={handleOpenChat}
            onSelectTopic={handleSelectTopic}
            refreshKey={aiRefreshKey}
          />
        )}

        {activeTab === 'chats' && (
          <MultiChatDock
            openPeers={openChatPeers}
            onClosePeer={handleClosePeer}
            onOpenPeer={handleOpenChat}
            prefillByPeerId={prefillByPeerId}
            onClearPrefill={handleClearPrefill}
            onMessageSent={bumpAiRefresh}
            fullPageMode={true}
          />
        )}

        {activeTab === 'profile' && <ProfileView />}
      </AppShell>

      {/* PC Floating Side-by-Side Multi-Chat Dock (when browsing Blackboard/Radar/AI/Profile) */}
      {activeTab !== 'chats' && (
        <div className="hidden lg:block">
          <MultiChatDock
            openPeers={openChatPeers}
            onClosePeer={handleClosePeer}
            onOpenPeer={handleOpenChat}
            prefillByPeerId={prefillByPeerId}
            onClearPrefill={handleClearPrefill}
            onMessageSent={bumpAiRefresh}
            fullPageMode={false}
          />
        </div>
      )}

      {/* Global Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="app-toast"
          className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-slide-up"
        >
          <div
            className={`glass-panel flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold shadow-2xl border ${
              toast.tone === 'warning'
                ? 'border-amber-500/50 text-amber-300'
                : toast.tone === 'success'
                  ? 'border-emerald-500/50 text-emerald-300'
                  : 'border-cyan-500/50 text-cyan-300'
            }`}
          >
            {toast.tone === 'warning' ? (
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-400" />
            ) : toast.tone === 'success' ? (
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
            ) : (
              <Info className="h-4.5 w-4.5 shrink-0 text-cyan-400" />
            )}
            <span className="flex-1 text-theme-primary">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="text-theme-muted hover:text-theme-primary shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
