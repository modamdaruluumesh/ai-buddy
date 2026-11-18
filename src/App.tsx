import { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Compass,
  Gamepad2,
  HeartHandshake,
  Home,
  Lock,
  Menu,
  MessageCircle,
  Mic,
  Settings,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ConversationView } from './components/ConversationView';
import { GameRoomView } from './components/GameRoomView';
import { GrowthSpaceView } from './components/GrowthSpaceView';
import { MemorySpaceView } from './components/MemorySpaceView';
import { MoodJournalView } from './components/MoodJournalView';
import { SanctuaryHome } from './components/SanctuaryHome';
import { SettingsPrivacyView } from './components/SettingsPrivacyView';
import { VaultLockScreen } from './components/VaultLockScreen';
import { VoiceRoom } from './components/VoiceRoom';
import {
  DEFAULT_SECURITY_SETTINGS,
  decryptVaultData,
  generateSaltB64,
  hasEncryptedVault,
  hashPin,
  loadEncryptedPayload,
  loadPlainVault,
  loadSecuritySettings,
  persistVault,
  registerBiometricPasskey,
  saveSecuritySettings,
  verifyBiometricPasskey,
  verifyPin,
  wipeAllVaultStorage,
} from './services/cryptoVault';
import { createId, createInitialVaultData, todayIsoDate } from './services/defaultData';
import type {
  CompanionMode,
  CompanionNeed,
  ConversationThread,
  NavSection,
  SanctuaryVaultData,
  SecuritySettings,
} from './types/companion';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'sanctuary', label: 'Sanctuary', icon: Home },
  { id: 'chat', label: 'Conversation', icon: MessageCircle },
  { id: 'voice', label: 'Voice Room', icon: Mic },
  { id: 'mood', label: 'Mood Journal', icon: HeartHandshake },
  { id: 'growth', label: 'Growth Space', icon: Compass },
  { id: 'games', label: 'Game Room', icon: Gamepad2 },
  { id: 'memory', label: 'Memory Vault', icon: Brain },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [security, setSecurity] = useState<SecuritySettings>(() => loadSecuritySettings());
  const [vault, setVault] = useState<SanctuaryVaultData | null>(() => {
    const sec = loadSecuritySettings();
    if (sec.lockEnabled && hasEncryptedVault()) {
      return null; // Require unlock
    }
    return loadPlainVault() ?? createInitialVaultData();
  });
  const [activePin, setActivePin] = useState<string | null>(null);
  const [journalUnlocked, setJournalUnlocked] = useState(false);

  const [nav, setNav] = useState<NavSection>('sanctuary');
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [pendingNeed, setPendingNeed] = useState<CompanionNeed | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const lastActivityRef = useRef<number>(Date.now());

  // Initialize active thread id once vault is available
  useEffect(() => {
    if (vault && vault.threads.length > 0 && !vault.threads.some((t) => t.id === activeThreadId)) {
      setActiveThreadId(vault.threads[0].id);
    }
  }, [vault, activeThreadId]);

  // Sync dark/light class with document root
  useEffect(() => {
    const scheme = vault?.profile.colorScheme ?? 'dark';
    document.documentElement.classList.toggle('dark', scheme === 'dark');
  }, [vault?.profile.colorScheme]);

  // Real online/offline listener
  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  // Persist vault whenever it changes
  useEffect(() => {
    if (!vault) return;
    persistVault(vault, security, activePin).catch(() => {});
  }, [vault, security, activePin]);

  // Auto-lock inactivity monitor
  useEffect(() => {
    if (!security.lockEnabled || security.autoLockMinutes === 0 || !vault) return;
    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('pointerdown', markActive);
    window.addEventListener('keydown', markActive);

    const timer = setInterval(() => {
      const elapsedMs = Date.now() - lastActivityRef.current;
      if (elapsedMs >= security.autoLockMinutes * 60_000) {
        setVault(null);
        setActivePin(null);
        setJournalUnlocked(false);
      }
    }, 15_000);

    return () => {
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
      clearInterval(timer);
    };
  }, [security.lockEnabled, security.autoLockMinutes, vault]);

  const handleUnlockWithPin = async (pin: string): Promise<boolean> => {
    const ok = await verifyPin(pin, security);
    if (!ok) return false;
    const payload = loadEncryptedPayload();
    if (payload && security.encryptionSalt) {
      const decrypted = await decryptVaultData(payload, pin, security.encryptionSalt);
      setVault(decrypted);
    } else {
      setVault(loadPlainVault() ?? createInitialVaultData());
    }
    setActivePin(pin);
    setJournalUnlocked(true);
    lastActivityRef.current = Date.now();
    return true;
  };

  const handleUnlockWithBiometric = async (): Promise<boolean> => {
    if (!security.biometricCredentialId) return false;
    const ok = await verifyBiometricPasskey(security.biometricCredentialId);
    if (!ok) return false;
    // Biometric passkey verified user presence; if vault is encrypted with PIN, fallback to PIN if no cached vault
    // Note: WebAuthn itself confirms identity; if encrypted payload exists and pin isn't cached, prompt PIN once for decryption key
    if (!vault) {
      throw new Error('Biometric confirmed. Enter your passcode once to derive the decryption key.');
    }
    setJournalUnlocked(true);
    return true;
  };

  // Locked App Screen
  if (!vault) {
    return (
      <VaultLockScreen
        companionName="Sora"
        accent="gold"
        security={security}
        onUnlockWithPin={handleUnlockWithPin}
        onUnlockWithBiometric={handleUnlockWithBiometric}
      />
    );
  }

  const updateVault = (updater: (prev: SanctuaryVaultData) => SanctuaryVaultData) => {
    setVault((prev) => (prev ? updater(prev) : prev));
  };

  const handleSelectNeed = (
    need: CompanionNeed,
    mode?: CompanionMode,
    target?: 'chat' | 'games'
  ) => {
    if (target === 'games') {
      setNav('games');
      return;
    }
    setPendingNeed(need);
    if (mode && activeThreadId) {
      updateVault((v) => ({
        ...v,
        threads: v.threads.map((t) =>
          t.id === activeThreadId
            ? { ...t, activeMode: mode, justListen: need === 'listen' }
            : t
        ),
      }));
    }
    setNav('chat');
  };

  const handleCreateThread = (mode?: CompanionMode) => {
    const now = new Date().toISOString();
    const newThread: ConversationThread = {
      id: createId('thread'),
      title: 'Quiet conversation',
      createdAt: now,
      updatedAt: now,
      activeMode: mode ?? vault.profile.defaultMode,
      justListen: false,
      messages: [
        {
          id: createId('msg'),
          role: 'companion',
          mode: mode ?? vault.profile.defaultMode,
          timestamp: now,
          content: "Fresh slate. Take your time—what's on your mind?",
        },
      ],
    };
    updateVault((v) => ({
      ...v,
      threads: [newThread, ...v.threads],
    }));
    setActiveThreadId(newThread.id);
  };

  const handleDeleteThread = (id: string) => {
    updateVault((v) => {
      const remaining = v.threads.filter((t) => t.id !== id);
      return {
        ...v,
        threads: remaining.length > 0 ? remaining : v.threads,
      };
    });
  };

  const handleEnablePinLock = async (pin: string) => {
    const pinSalt = generateSaltB64();
    const encryptionSalt = generateSaltB64();
    const pinHash = await hashPin(pin, pinSalt);
    const nextSec: SecuritySettings = {
      ...security,
      lockEnabled: true,
      pinHash,
      pinSalt,
      encryptionSalt,
    };
    saveSecuritySettings(nextSec);
    setSecurity(nextSec);
    setActivePin(pin);
    await persistVault(vault, nextSec, pin);
  };

  const handleDisablePinLock = async () => {
    const nextSec: SecuritySettings = {
      ...DEFAULT_SECURITY_SETTINGS,
    };
    saveSecuritySettings(nextSec);
    setSecurity(nextSec);
    setActivePin(null);
    await persistVault(vault, nextSec, null);
  };

  const handleToggleBiometric = async (enable: boolean) => {
    if (enable) {
      const credId = await registerBiometricPasskey(vault.profile.userName || 'Sanctuary Owner');
      const nextSec: SecuritySettings = {
        ...security,
        biometricEnabled: true,
        biometricCredentialId: credId,
      };
      saveSecuritySettings(nextSec);
      setSecurity(nextSec);
    } else {
      const nextSec: SecuritySettings = {
        ...security,
        biometricEnabled: false,
        biometricCredentialId: null,
      };
      saveSecuritySettings(nextSec);
      setSecurity(nextSec);
    }
  };

  const handleUpdateSecurity = (patch: Partial<SecuritySettings>) => {
    const next = { ...security, ...patch };
    saveSecuritySettings(next);
    setSecurity(next);
  };

  const handleWipeAccount = () => {
    wipeAllVaultStorage();
    const fresh = createInitialVaultData();
    setSecurity(DEFAULT_SECURITY_SETTINGS);
    setActivePin(null);
    setVault(fresh);
    setNav('sanctuary');
  };

  const showJournalLock =
    nav === 'mood' && security.lockEnabled && security.lockPrivateJournal && !journalUnlocked;

  const mobileTabs: NavSection[] = ['sanctuary', 'chat', 'voice', 'mood', 'games'];

  return (
    <div className="min-h-screen bg-[#F6F5F1] dark:bg-[#0B0C10] text-[#18191D] dark:text-[#EAE7E1] flex flex-col lg:flex-row">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex lg:flex-col lg:justify-between lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r border-black/8 dark:border-white/8 bg-white/60 dark:bg-[#101218] px-5 py-7">
        <div className="space-y-8">
          <div className="px-2">
            <button
              type="button"
              onClick={() => setNav('sanctuary')}
              className="font-display text-2xl font-medium tracking-tight text-[#18191D] dark:text-[#EAE7E1] cursor-pointer whitespace-nowrap"
            >
              Kinsvale
            </button>
            <p className="text-xs text-[#646975] dark:text-[#9CA0AA] mt-0.5">
              with {vault.profile.companionName}
            </p>
          </div>

          <nav className="space-y-1" aria-label="Sanctuary navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = nav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setNav(item.id)}
                  className={`w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center gap-3 text-sm transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#D4A359]/14 text-[#B88435] dark:text-[#D4A359] font-medium'
                      : 'text-[#4B505C] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1] hover:bg-black/4 dark:hover:bg-white/4'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 px-2">
          {!isOnline && (
            <div className="text-xs text-[#D4A359]">
              Offline mode · Journals & games active
            </div>
          )}
          {security.lockEnabled && (
            <button
              type="button"
              onClick={() => {
                setVault(null);
                setActivePin(null);
                setJournalUnlocked(false);
              }}
              className="w-full min-h-[40px] px-3 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium text-[#646975] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Sanctuary</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Compact Header (<= 56px) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 px-4 border-b border-black/8 dark:border-white/8 bg-[#F6F5F1]/90 dark:bg-[#0B0C10]/90 backdrop-blur-md flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setNav('sanctuary')}
          className="font-display text-xl font-medium text-[#18191D] dark:text-[#EAE7E1] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Kinsvale
        </button>

        <span className="text-xs font-medium text-[#646975] dark:text-[#9CA0AA] truncate">
          {NAV_ITEMS.find((n) => n.id === nav)?.label}
        </span>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-label="Toggle sanctuary menu"
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#18191D] dark:text-[#EAE7E1] cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Slide-Down Drawer for Growth / Memory / Settings */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-14 z-40 border-b border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#13151B] p-4 space-y-1 shadow-xl">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = nav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm cursor-pointer ${
                  active
                    ? 'bg-[#D4A359]/14 text-[#B88435] dark:text-[#D4A359] font-medium'
                    : 'text-[#4B505C] dark:text-[#C6C9D0]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          {security.lockEnabled && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setVault(null);
                setActivePin(null);
              }}
              className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[#D4A359] cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Lock Sanctuary</span>
            </button>
          )}
        </div>
      )}

      {/* Main Content Canvas */}
      <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-10 py-6 pb-24 lg:pb-8">
        <div className="max-w-6xl mx-auto">
          {showJournalLock ? (
            <VaultLockScreen
              companionName={vault.profile.companionName}
              accent={vault.profile.accentTheme}
              security={security}
              title="Private Mood Journal"
              subtitle="Verify your passcode or biometric passkey to open your personal emotional entries."
              onUnlockWithPin={async (pin) => {
                const ok = await verifyPin(pin, security);
                if (ok) setJournalUnlocked(true);
                return ok;
              }}
              onUnlockWithBiometric={async () => {
                if (!security.biometricCredentialId) return false;
                const ok = await verifyBiometricPasskey(security.biometricCredentialId);
                if (ok) setJournalUnlocked(true);
                return ok;
              }}
              onCancel={() => setNav('sanctuary')}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={nav}
                initial={vault.profile.reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={vault.profile.reducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {nav === 'sanctuary' && (
                  <SanctuaryHome
                    vault={vault}
                    onNavigate={setNav}
                    onSelectNeed={handleSelectNeed}
                    onSwitchMode={(mode) =>
                      updateVault((v) => ({
                        ...v,
                        profile: { ...v.profile, defaultMode: mode },
                      }))
                    }
                  />
                )}

                {nav === 'chat' && (
                  <ConversationView
                    vault={vault}
                    activeThreadId={activeThreadId}
                    pendingNeed={pendingNeed}
                    onClearPendingNeed={() => setPendingNeed(undefined)}
                    onSelectThread={setActiveThreadId}
                    onCreateThread={handleCreateThread}
                    onDeleteThread={handleDeleteThread}
                    onUpdateThread={(id, updater) =>
                      updateVault((v) => ({
                        ...v,
                        threads: v.threads.map((t) => (t.id === id ? updater(t) : t)),
                      }))
                    }
                    onAddMemories={(items) =>
                      updateVault((v) => ({
                        ...v,
                        memories: [...items, ...v.memories],
                      }))
                    }
                    onOpenMemorySpace={() => setNav('memory')}
                  />
                )}

                {nav === 'voice' && (
                  <VoiceRoom
                    vault={vault}
                    activeThreadId={activeThreadId}
                    onUpdateThread={(id, updater) =>
                      updateVault((v) => ({
                        ...v,
                        threads: v.threads.map((t) => (t.id === id ? updater(t) : t)),
                      }))
                    }
                    onUpdateVoiceSettings={(patch) =>
                      updateVault((v) => ({
                        ...v,
                        voice: { ...v.voice, ...patch },
                      }))
                    }
                  />
                )}

                {nav === 'mood' && (
                  <MoodJournalView
                    vault={vault}
                    onAddMood={(entry) =>
                      updateVault((v) => ({ ...v, moods: [entry, ...v.moods] }))
                    }
                    onDeleteMood={(id) =>
                      updateVault((v) => ({
                        ...v,
                        moods: v.moods.filter((m) => m.id !== id),
                      }))
                    }
                    onSaveInsight={(text) =>
                      updateVault((v) => ({
                        ...v,
                        lastMoodInsight: { text, generatedAt: new Date().toISOString() },
                      }))
                    }
                  />
                )}

                {nav === 'growth' && (
                  <GrowthSpaceView
                    vault={vault}
                    onAddGoal={(goal) =>
                      updateVault((v) => ({ ...v, goals: [goal, ...v.goals] }))
                    }
                    onUpdateGoal={(id, patch) =>
                      updateVault((v) => ({
                        ...v,
                        goals: v.goals.map((g) =>
                          g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g
                        ),
                      }))
                    }
                    onDeleteGoal={(id) =>
                      updateVault((v) => ({
                        ...v,
                        goals: v.goals.filter((g) => g.id !== id),
                      }))
                    }
                    onAddHabit={(habit) =>
                      updateVault((v) => ({ ...v, habits: [habit, ...v.habits] }))
                    }
                    onToggleHabitToday={(id) => {
                      const today = todayIsoDate();
                      updateVault((v) => ({
                        ...v,
                        habits: v.habits.map((h) => {
                          if (h.id !== id) return h;
                          const exists = h.completedDates.includes(today);
                          return {
                            ...h,
                            completedDates: exists
                              ? h.completedDates.filter((d) => d !== today)
                              : [...h.completedDates, today],
                          };
                        }),
                      }));
                    }}
                    onDeleteHabit={(id) =>
                      updateVault((v) => ({
                        ...v,
                        habits: v.habits.filter((h) => h.id !== id),
                      }))
                    }
                    onAddExercise={(entry) =>
                      updateVault((v) => ({ ...v, exercises: [entry, ...v.exercises] }))
                    }
                  />
                )}

                {nav === 'games' && (
                  <GameRoomView
                    vault={vault}
                    onRecordGamePlayed={() =>
                      updateVault((v) => {
                        const count = v.profile.gamesPlayedCount + 1;
                        const unlocked = new Set(v.profile.unlockedGameThemes);
                        if (count >= 1) unlocked.add('brass');
                        if (count >= 3) unlocked.add('twilight');
                        return {
                          ...v,
                          profile: {
                            ...v.profile,
                            gamesPlayedCount: count,
                            unlockedGameThemes: Array.from(unlocked),
                          },
                        };
                      })
                    }
                    onChangeGameTheme={(theme) =>
                      updateVault((v) => ({
                        ...v,
                        profile: { ...v.profile, activeGameTheme: theme },
                      }))
                    }
                  />
                )}

                {nav === 'memory' && (
                  <MemorySpaceView
                    vault={vault}
                    onAddMemory={(item) =>
                      updateVault((v) => ({ ...v, memories: [item, ...v.memories] }))
                    }
                    onUpdateMemory={(id, patch) =>
                      updateVault((v) => ({
                        ...v,
                        memories: v.memories.map((m) => (m.id === id ? { ...m, ...patch } : m)),
                      }))
                    }
                    onDeleteMemory={(id) =>
                      updateVault((v) => ({
                        ...v,
                        memories: v.memories.filter((m) => m.id !== id),
                      }))
                    }
                    onUpdateConsent={(patch) =>
                      updateVault((v) => ({
                        ...v,
                        memoryConsent: { ...v.memoryConsent, ...patch },
                      }))
                    }
                  />
                )}

                {nav === 'settings' && (
                  <SettingsPrivacyView
                    vault={vault}
                    security={security}
                    onUpdateProfile={(patch) =>
                      updateVault((v) => ({
                        ...v,
                        profile: { ...v.profile, ...patch },
                      }))
                    }
                    onUpdateProactive={(patch) =>
                      updateVault((v) => ({
                        ...v,
                        proactive: { ...v.proactive, ...patch },
                      }))
                    }
                    onUpdateVoice={(patch) =>
                      updateVault((v) => ({
                        ...v,
                        voice: { ...v.voice, ...patch },
                      }))
                    }
                    onEnablePinLock={handleEnablePinLock}
                    onDisablePinLock={handleDisablePinLock}
                    onToggleBiometric={handleToggleBiometric}
                    onUpdateSecurity={handleUpdateSecurity}
                    onClearMoodHistory={() =>
                      updateVault((v) => ({ ...v, moods: [], lastMoodInsight: undefined }))
                    }
                    onDeleteAllMemories={() =>
                      updateVault((v) => ({ ...v, memories: [] }))
                    }
                    onWipeAccount={handleWipeAccount}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation Bar (<= 64px) */}
      <nav
        aria-label="Primary mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-black/8 dark:border-white/8 bg-[#F6F5F1]/92 dark:bg-[#0B0C10]/92 backdrop-blur-md grid grid-cols-5 items-center"
      >
        {mobileTabs.map((tabId) => {
          const item = NAV_ITEMS.find((n) => n.id === tabId)!;
          const Icon = item.icon;
          const active = nav === tabId;
          return (
            <button
              key={tabId}
              type="button"
              onClick={() => setNav(tabId)}
              className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
                active
                  ? 'text-[#B88435] dark:text-[#D4A359]'
                  : 'text-[#646975] dark:text-[#9CA0AA]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1 truncate max-w-[64px]">
                {tabId === 'sanctuary'
                  ? 'Home'
                  : tabId === 'chat'
                    ? 'Talk'
                    : tabId === 'voice'
                      ? 'Voice'
                      : tabId === 'mood'
                        ? 'Mood'
                        : 'Games'}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
