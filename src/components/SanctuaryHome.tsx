import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Compass,
  Gamepad2,
  HeartHandshake,
  MessageCircle,
  Mic,
  Sparkles,
  X,
} from 'lucide-react';
import { CompanionOrb } from './CompanionOrb';
import { requestProactivePrompt } from '../services/apiClient';
import { MODE_META, todayIsoDate } from '../services/defaultData';
import type {
  CompanionMode,
  CompanionNeed,
  NavSection,
  SanctuaryVaultData,
} from '../types/companion';

const SANCTUARY_BACKDROP = '/src/assets/images/companion_ambient_sanctuary_1795006424318.jpg';

const NEED_OPTIONS: Array<{
  need: CompanionNeed;
  label: string;
  hint: string;
  mode?: CompanionMode;
  target: 'chat' | 'games';
}> = [
  { need: 'talk', label: 'I want to talk', hint: 'Open conversation', target: 'chat' },
  { need: 'listen', label: 'Just listen', hint: 'Minimal replies, no fixing', mode: 'supportive', target: 'chat' },
  { need: 'figure_out', label: 'Help me figure this out', hint: 'Clear perspective', mode: 'growth_guide', target: 'chat' },
  { need: 'distract', label: 'Distract me', hint: 'Light talk, no prying', mode: 'chill', target: 'chat' },
  { need: 'hard_truth', label: 'Give me the hard truth', hint: 'Direct honesty', mode: 'hard_truth', target: 'chat' },
  { need: 'play', label: "Let's play something", hint: 'Offline games together', target: 'games' },
  { need: 'unsure', label: "I don't know how I feel", hint: 'Zero pressure', mode: 'supportive', target: 'chat' },
];

function getTimeContext(): {
  period: 'morning' | 'afternoon' | 'evening' | 'late_night';
  greeting: string;
} {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { period: 'morning', greeting: 'Quiet morning' };
  if (hour >= 12 && hour < 17) return { period: 'afternoon', greeting: 'Easy afternoon' };
  if (hour >= 17 && hour < 22) return { period: 'evening', greeting: 'Unwinding evening' };
  return { period: 'late_night', greeting: 'Late night stillness' };
}

function isWithinQuietHours(start: string, end: string): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const sMin = (sh || 0) * 60 + (sm || 0);
  const eMin = (eh || 0) * 60 + (em || 0);
  if (sMin < eMin) return cur >= sMin && cur <= eMin;
  return cur >= sMin || cur <= eMin;
}

interface SanctuaryHomeProps {
  vault: SanctuaryVaultData;
  onNavigate: (section: NavSection) => void;
  onSelectNeed: (need: CompanionNeed, mode?: CompanionMode, target?: 'chat' | 'games') => void;
  onSwitchMode: (mode: CompanionMode) => void;
}

export function SanctuaryHome({
  vault,
  onNavigate,
  onSelectNeed,
  onSwitchMode,
}: SanctuaryHomeProps) {
  const { profile, moods, goals, memories, proactive } = vault;
  const [backdropErr, setBackdropErr] = useState(false);
  const [proactiveNote, setProactiveNote] = useState<{
    kind: string;
    title: string;
    message: string;
    suggestedAction: string;
  } | null>(null);
  const [proactiveDismissed, setProactiveDismissed] = useState(false);
  const [loadingNote, setLoadingNote] = useState(false);

  const timeCtx = getTimeContext();
  const todayMood = moods.find((m) => m.date === todayIsoDate());
  const activeGoals = goals.filter((g) => !g.completed);
  const quietNow = isWithinQuietHours(proactive.quietHoursStart, proactive.quietHoursEnd);

  useEffect(() => {
    if (!proactive.enabled || quietNow || proactiveDismissed || proactiveNote) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const sessionKey = `solace_proactive_${todayIsoDate()}_${timeCtx.period}`;
    const cached = sessionStorage.getItem(sessionKey);
    if (cached) {
      try {
        setProactiveNote(JSON.parse(cached));
        return;
      } catch {
        // ignore invalid cache
      }
    }

    let cancelled = false;
    setLoadingNote(true);
    requestProactivePrompt({
      companionName: profile.companionName,
      userName: profile.userName,
      mode: profile.defaultMode,
      timeOfDay: timeCtx.period,
      memories,
      recentMoods: moods.slice(0, 3),
      goals: activeGoals,
    })
      .then((res) => {
        if (!cancelled && res.message) {
          setProactiveNote(res);
          sessionStorage.setItem(sessionKey, JSON.stringify(res));
        }
      })
      .catch(() => {
        // Silent optional note failure—never block home view
      })
      .finally(() => {
        if (!cancelled) setLoadingNote(false);
      });

    return () => {
      cancelled = true;
    };
  }, [proactive.enabled, quietNow, proactiveDismissed]);

  return (
    <div className="space-y-8 pb-8">
      {/* Cinematic Sanctuary Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-[#13151B]">
        {!backdropErr && (
          <img
            src={SANCTUARY_BACKDROP}
            alt="Quiet midnight architectural sanctuary with warm candlelight"
            referrerPolicy="no-referrer"
            onError={() => setBackdropErr(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-[#0B0C10]/75 to-[#0B0C10]/35" />

        <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-2xl space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#C6C9D0]">
              <span>{timeCtx.greeting}</span>
              <span aria-hidden="true">·</span>
              <span>{MODE_META[profile.defaultMode].label} mode</span>
              {todayMood && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Today feels {todayMood.mood.toLowerCase()}</span>
                </>
              )}
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#EAE7E1] tracking-tight leading-tight text-balance">
              {profile.userName
                ? `Take a breath, ${profile.userName}. You have a quiet room here.`
                : 'Take a breath. You have a quiet room here.'}
            </h1>

            <p className="text-sm sm:text-base text-[#C6C9D0] leading-relaxed max-w-xl">
              {profile.companionName} is ready for whatever pace fits right now—real conversation,
              honest perspective, voice reflection, or a zero-pressure game.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4A359] text-[#0B0C10] text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Talk with {profile.companionName}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('voice')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-white/15 bg-white/8 text-[#EAE7E1] text-sm font-medium hover:bg-white/12 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Mic className="w-4 h-4" />
                <span>Enter Voice Room</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center lg:items-end shrink-0">
            <CompanionOrb
              state="resting"
              accent={profile.accentTheme}
              size="lg"
              companionName={profile.companionName}
              showCaption={false}
            />
          </div>
        </div>
      </section>

      {/* Optional Companion-Initiated Note */}
      {proactive.enabled && !quietNow && !proactiveDismissed && (proactiveNote || loadingNote) && (
        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-[#646975] dark:text-[#9CA0AA]">
              <span>Note from {profile.companionName}</span>
              <span aria-hidden="true">·</span>
              <span>Optional</span>
            </div>
            {loadingNote ? (
              <div className="h-5 w-64 rounded bg-black/5 dark:bg-white/5 animate-pulse" />
            ) : (
              <>
                <h2 className="text-base font-semibold text-[#18191D] dark:text-[#EAE7E1]">
                  {proactiveNote?.title}
                </h2>
                <p className="text-sm text-[#4B505C] dark:text-[#B8BCC6] leading-relaxed">
                  {proactiveNote?.message}
                </p>
              </>
            )}
          </div>
          {!loadingNote && proactiveNote && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSelectNeed('talk')}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium text-[#18191D] dark:text-[#EAE7E1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>{proactiveNote.suggestedAction}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setProactiveDismissed(true)}
                aria-label="Dismiss companion note"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#646975] dark:text-[#9CA0AA] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* What do you need right now? */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-medium text-[#18191D] dark:text-[#EAE7E1]">
              What do you need right now?
            </h2>
            <p className="text-sm text-[#646975] dark:text-[#9CA0AA] mt-0.5">
              Optional shortcuts so you never have to figure out how to start.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {NEED_OPTIONS.map((item) => (
            <button
              key={item.need}
              type="button"
              onClick={() => onSelectNeed(item.need, item.mode, item.target)}
              className="group text-left min-h-[76px] p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] hover:border-[#D4A359]/50 transition-colors flex flex-col justify-between cursor-pointer"
            >
              <span className="text-sm font-medium text-[#18191D] dark:text-[#EAE7E1] group-hover:text-[#B88435] dark:group-hover:text-[#D4A359] transition-colors">
                {item.label}
              </span>
              <span className="text-xs text-[#646975] dark:text-[#9CA0AA] mt-1">
                {item.hint}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Quiet Mode & Quick Sanctuary Snapshot */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Companion Mode Switcher */}
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
              Conversation Tone
            </h2>
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">
              Switch anytime
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(Object.keys(MODE_META) as CompanionMode[]).map((modeKey) => {
              const active = profile.defaultMode === modeKey;
              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => onSwitchMode(modeKey)}
                  className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? 'border-[#D4A359]/70 bg-[#D4A359]/10'
                      : 'border-black/8 dark:border-white/8 hover:bg-black/3 dark:hover:bg-white/4'
                  }`}
                >
                  <div className="text-sm font-medium text-[#18191D] dark:text-[#EAE7E1]">
                    {MODE_META[modeKey].label}
                  </div>
                  <div className="text-xs text-[#646975] dark:text-[#9CA0AA] mt-0.5">
                    {MODE_META[modeKey].shortDesc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sanctuary Touchpoints */}
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
              Your Quiet Space
            </h2>
            <p className="text-xs text-[#646975] dark:text-[#9CA0AA]">
              {moods.length} mood check-ins · {activeGoals.length} active goals · {memories.length} saved memories
            </p>
          </div>

          <div className="divide-y divide-black/8 dark:divide-white/8">
            <button
              type="button"
              onClick={() => onNavigate('mood')}
              className="w-full py-3.5 flex items-center justify-between text-left hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <HeartHandshake className="w-4 h-4 text-[#D4A359]" />
                <div>
                  <div className="text-sm font-medium text-[#18191D] dark:text-[#EAE7E1]">
                    {todayMood ? `Today logged: ${todayMood.mood}` : 'Log today’s emotional check-in'}
                  </div>
                  <div className="text-xs text-[#646975] dark:text-[#9CA0AA]">
                    Mood calendar, energy trends, and private reflection
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#646975] dark:text-[#9CA0AA]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('growth')}
              className="w-full py-3.5 flex items-center justify-between text-left hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Compass className="w-4 h-4 text-[#8B82B8]" />
                <div>
                  <div className="text-sm font-medium text-[#18191D] dark:text-[#EAE7E1]">
                    Growth & Overthinking Tools
                  </div>
                  <div className="text-xs text-[#646975] dark:text-[#9CA0AA]">
                    Untangle spirals, set gentle intentions, review patterns
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#646975] dark:text-[#9CA0AA]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('games')}
              className="w-full py-3.5 flex items-center justify-between text-left hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-4 h-4 text-[#D4A359]" />
                <div>
                  <div className="text-sm font-medium text-[#18191D] dark:text-[#EAE7E1]">
                    Offline Game Room
                  </div>
                  <div className="text-xs text-[#646975] dark:text-[#9CA0AA]">
                    Chess, Connect Four, Sudoku, 20 Questions, Word Guess & more
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#646975] dark:text-[#9CA0AA]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('memory')}
              className="w-full pt-3.5 flex items-center justify-between text-left hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-[#8B82B8]" />
                <div>
                  <div className="text-sm font-medium text-[#18191D] dark:text-[#EAE7E1]">
                    Memory Vault
                  </div>
                  <div className="text-xs text-[#646975] dark:text-[#9CA0AA]">
                    See, edit, or delete what {profile.companionName} remembers
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#646975] dark:text-[#9CA0AA]" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
