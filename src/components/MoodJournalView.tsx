import { useMemo, useRef, useState } from 'react';
import { Calendar, Mic, MicOff, Sparkles, Trash2 } from 'lucide-react';
import { requestMoodInsight } from '../services/apiClient';
import { createId, todayIsoDate } from '../services/defaultData';
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  type SpeechRecognizerHandle,
} from '../services/speechService';
import type { MoodEntry, SanctuaryVaultData, StandardMoodLabel } from '../types/companion';

const JOURNAL_COVER = '/src/assets/images/sanctuary_journal_cover_1795006424563.jpg';

const MOOD_LABELS: StandardMoodLabel[] = [
  'Calm',
  'Happy',
  'Motivated',
  'Hopeful',
  'Neutral',
  'Tired',
  'Lonely',
  'Sad',
  'Anxious',
  'Frustrated',
  'Overwhelmed',
  'Empty',
];

function moodToneColor(mood: string): string {
  const lower = mood.toLowerCase();
  if (['happy', 'motivated', 'hopeful', 'calm'].includes(lower)) return '#D4A359';
  if (['anxious', 'frustrated', 'overwhelmed'].includes(lower)) return '#C97B63';
  if (['sad', 'lonely', 'empty', 'tired'].includes(lower)) return '#8B82B8';
  return '#7D8596';
}

interface MoodJournalViewProps {
  vault: SanctuaryVaultData;
  onAddMood: (entry: MoodEntry) => void;
  onDeleteMood: (id: string) => void;
  onSaveInsight: (text: string) => void;
}

export function MoodJournalView({
  vault,
  onAddMood,
  onDeleteMood,
  onSaveInsight,
}: MoodJournalViewProps) {
  const [selectedMood, setSelectedMood] = useState<string>('Calm');
  const [customMood, setCustomMood] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [whatHappened, setWhatHappened] = useState('');
  const [whatBothers, setWhatBothers] = useState('');
  const [whatWentWell, setWhatWentWell] = useState('');
  const [improveTomorrow, setImproveTomorrow] = useState('');
  const [journalNote, setJournalNote] = useState('');
  const [viaVoice, setViaVoice] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [trendRange, setTrendRange] = useState<'7d' | '30d'>('7d');
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [coverErr, setCoverErr] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const recRef = useRef<SpeechRecognizerHandle | null>(null);

  const handleVoiceJournal = () => {
    if (!vault.voice.voiceProcessingEnabled) {
      setVoiceError('Voice processing is disabled in Settings & Privacy.');
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setVoiceError('Voice dictation is not supported in this browser.');
      return;
    }
    if (isRecording) {
      recRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setVoiceError('');
    const rec = createSpeechRecognizer({
      continuous: true,
      onInterim: () => {},
      onFinal: (text) => {
        setViaVoice(true);
        setJournalNote((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      },
      onError: (msg) => {
        setVoiceError(msg);
        setIsRecording(false);
      },
      onEnd: () => setIsRecording(false),
    });

    if (rec) {
      recRef.current = rec;
      setIsRecording(true);
      rec.start();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMood = customMood.trim() || selectedMood;
    const entry: MoodEntry = {
      id: createId('mood'),
      date: todayIsoDate(),
      createdAt: new Date().toISOString(),
      mood: finalMood,
      intensity,
      energy,
      stress,
      whatHappened: whatHappened.trim(),
      whatBothers: whatBothers.trim(),
      whatWentWell: whatWentWell.trim(),
      improveTomorrow: improveTomorrow.trim(),
      journalNote: journalNote.trim(),
      viaVoice,
    };
    onAddMood(entry);
    setCustomMood('');
    setWhatHappened('');
    setWhatBothers('');
    setWhatWentWell('');
    setImproveTomorrow('');
    setJournalNote('');
    setViaVoice(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleGenerateInsight = async () => {
    setInsightLoading(true);
    setInsightError('');
    try {
      const text = await requestMoodInsight({
        companionName: vault.profile.companionName,
        moods: vault.moods,
        goals: vault.goals,
      });
      if (text) onSaveInsight(text);
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : 'Unable to reflect right now.');
    } finally {
      setInsightLoading(false);
    }
  };

  // Calendar grid for current month
  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    const cells: Array<{ day: number | null; dateStr?: string; entry?: MoodEntry }> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d += 1) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
      const entry = vault.moods.find((m) => m.date === dateStr);
      cells.push({ day: d, dateStr, entry });
    }
    return {
      monthLabel: now.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      cells,
    };
  }, [vault.moods]);

  const trendEntries = useMemo(() => {
    const limit = trendRange === '7d' ? 7 : 30;
    return [...vault.moods].slice(0, limit).reverse();
  }, [vault.moods, trendRange]);

  const moodFrequency = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of vault.moods) {
      counts.set(m.mood, (counts.get(m.mood) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [vault.moods]);

  return (
    <div className="space-y-8 pb-8">
      {/* Editorial Header */}
      <section className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-[#13151B]">
        {!coverErr && (
          <img
            src={JOURNAL_COVER}
            alt="Minimalist dark cloth-bound journal on slate stone"
            referrerPolicy="no-referrer"
            onError={() => setCoverErr(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C10]/95 via-[#0B0C10]/80 to-[#0B0C10]/55" />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="text-xs text-[#C6C9D0]">Private Emotional Space · No Streaks, No Scores</div>
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#EAE7E1]">
              Mood Journal & Patterns
            </h1>
            <p className="text-sm text-[#B8BCC6]">
              Check in honestly—whether today felt steady, lonely, heavy, or unexpectedly bright.
            </p>
          </div>
          <div className="text-xs font-mono-tabular text-[#C6C9D0] shrink-0">
            {vault.moods.length} {vault.moods.length === 1 ? 'entry' : 'entries'} logged
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
        {/* Daily Check-In Composer */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
              Daily Check-In
            </h2>
            <span className="text-xs font-mono-tabular text-[#646975] dark:text-[#9CA0AA]">
              {todayIsoDate()}
            </span>
          </div>

          {/* Mood Labels */}
          <div className="space-y-2.5">
            <label className="block text-xs font-medium text-[#646975] dark:text-[#9CA0AA]">
              How does today feel?
            </label>
            <div className="flex flex-wrap gap-2">
              {MOOD_LABELS.map((m) => {
                const active = selectedMood === m && !customMood.trim();
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSelectedMood(m);
                      setCustomMood('');
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-[#D4A359] bg-[#D4A359]/14 text-[#B88435] dark:text-[#D4A359]'
                        : 'border-black/10 dark:border-white/10 text-[#4B505C] dark:text-[#B8BCC6] hover:border-black/25 dark:hover:border-white/25'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={customMood}
              onChange={(e) => setCustomMood(e.target.value)}
              placeholder="Or name your own feeling (e.g., Quietly restless, Relieved)…"
              className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-xs text-[#18191D] dark:text-[#EAE7E1] placeholder:text-[#8E93A0] focus:outline-none focus:ring-1 focus:ring-[#D4A359]/50"
            />
          </div>

          {/* Intensity, Energy, Stress Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <label className="space-y-1.5 block text-xs">
              <span className="flex justify-between text-[#646975] dark:text-[#9CA0AA]">
                <span>Intensity</span>
                <span className="font-mono-tabular text-[#18191D] dark:text-[#EAE7E1]">{intensity}/10</span>
              </span>
              <input
                type="range"
                min="1"
                max="10"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-[#D4A359]"
              />
            </label>

            <label className="space-y-1.5 block text-xs">
              <span className="flex justify-between text-[#646975] dark:text-[#9CA0AA]">
                <span>Energy</span>
                <span className="font-mono-tabular text-[#18191D] dark:text-[#EAE7E1]">{energy}/10</span>
              </span>
              <input
                type="range"
                min="1"
                max="10"
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                className="w-full accent-[#74A892]"
              />
            </label>

            <label className="space-y-1.5 block text-xs">
              <span className="flex justify-between text-[#646975] dark:text-[#9CA0AA]">
                <span>Stress</span>
                <span className="font-mono-tabular text-[#18191D] dark:text-[#EAE7E1]">{stress}/10</span>
              </span>
              <input
                type="range"
                min="1"
                max="10"
                value={stress}
                onChange={(e) => setStress(Number(e.target.value))}
                className="w-full accent-[#C97B63]"
              />
            </label>
          </div>

          {/* Gentle Prompts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="space-y-1 block">
              <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">What happened today?</span>
              <input
                type="text"
                value={whatHappened}
                onChange={(e) => setWhatHappened(e.target.value)}
                placeholder="Optional brief note…"
                className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">What is bothering you?</span>
              <input
                type="text"
                value={whatBothers}
                onChange={(e) => setWhatBothers(e.target.value)}
                placeholder="Optional…"
                className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">What went well?</span>
              <input
                type="text"
                value={whatWentWell}
                onChange={(e) => setWhatWentWell(e.target.value)}
                placeholder="Even something small…"
                className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">Small shift for tomorrow?</span>
              <input
                type="text"
                value={improveTomorrow}
                onChange={(e) => setImproveTomorrow(e.target.value)}
                placeholder="Optional intention…"
                className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
              />
            </label>
          </div>

          {/* Freeform + Voice Journal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#646975] dark:text-[#9CA0AA]">
                Journal / Voice Reflection
              </label>
              <button
                type="button"
                onClick={handleVoiceJournal}
                className={`min-h-[34px] px-3 py-1 rounded-lg border text-xs flex items-center gap-1.5 cursor-pointer ${
                  isRecording
                    ? 'border-[#D4A359] bg-[#D4A359]/15 text-[#D4A359]'
                    : 'border-black/10 dark:border-white/10 text-[#646975] dark:text-[#9CA0AA]'
                }`}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isRecording ? 'Stop Voice' : 'Voice Journal'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={journalNote}
              onChange={(e) => setJournalNote(e.target.value)}
              placeholder="Write or dictate freely. Everything stays stored privately on your device."
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] p-3.5 text-sm text-[#18191D] dark:text-[#EAE7E1] placeholder:text-[#8E93A0] focus:outline-none focus:ring-1 focus:ring-[#D4A359]/50"
            />
            {voiceError && <p className="text-xs text-rose-500">{voiceError}</p>}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#74A892]">
              {savedNotice ? 'Check-in saved privately.' : ''}
            </span>
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#D4A359] text-[#0B0C10] text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Save Check-In
            </button>
          </div>
        </form>

        {/* Visual Analytics & Companion Pattern Reflection */}
        <div className="space-y-6">
          {/* AI Non-Diagnostic Reflection */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-[#646975] dark:text-[#9CA0AA]">
                <Sparkles className="w-3.5 h-3.5 text-[#D4A359]" />
                <span>Pattern Reflection from {vault.profile.companionName}</span>
              </div>
              <button
                type="button"
                disabled={insightLoading || vault.moods.length === 0}
                onClick={handleGenerateInsight}
                className="min-h-[34px] px-3 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium text-[#18191D] dark:text-[#EAE7E1] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {insightLoading ? 'Reflecting…' : 'Reflect on week'}
              </button>
            </div>
            <p className="text-sm text-[#4B505C] dark:text-[#C6C9D0] leading-relaxed">
              {vault.lastMoodInsight?.text ||
                (vault.moods.length === 0
                  ? 'Log a couple of check-ins and I will gently notice patterns across your energy, stress, and resilience—without medical labels or scoreboards.'
                  : 'Tap "Reflect on week" whenever you want a calm observation across your recent entries.')}
            </p>
            {insightError && <p className="text-xs text-rose-500">{insightError}</p>}
          </div>

          {/* Mood Calendar */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4A359]" />
                <h2 className="text-sm font-semibold text-[#18191D] dark:text-[#EAE7E1]">
                  {calendarDays.monthLabel}
                </h2>
              </div>
              <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">Mood calendar</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-[#646975] dark:text-[#9CA0AA]">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="py-1">
                  {d}
                </div>
              ))}
              {calendarDays.cells.map((cell, i) =>
                cell.day === null ? (
                  <div key={i} />
                ) : (
                  <div
                    key={cell.dateStr}
                    title={cell.entry ? `${cell.dateStr}: ${cell.entry.mood}` : cell.dateStr}
                    className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-xs font-mono-tabular ${
                      cell.entry
                        ? 'border-[#D4A359]/40 bg-[#D4A359]/10 text-[#18191D] dark:text-[#EAE7E1]'
                        : 'border-black/5 dark:border-white/5 text-[#8E93A0]'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {cell.entry && (
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-0.5"
                        style={{ backgroundColor: moodToneColor(cell.entry.mood) }}
                      />
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Energy vs Stress SVG Trend */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#18191D] dark:text-[#EAE7E1]">
                Energy & Stress Trends
              </h2>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#F6F5F1] dark:bg-[#0B0C10]">
                {(['7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTrendRange(r)}
                    className={`px-2.5 py-1 rounded-md text-xs cursor-pointer ${
                      trendRange === r
                        ? 'bg-white dark:bg-[#1A1D26] text-[#18191D] dark:text-[#EAE7E1]'
                        : 'text-[#646975] dark:text-[#9CA0AA]'
                    }`}
                  >
                    {r === '7d' ? '7 days' : '30 days'}
                  </button>
                ))}
              </div>
            </div>

            {trendEntries.length < 2 ? (
              <p className="text-xs text-[#646975] dark:text-[#9CA0AA] py-6 text-center">
                Log at least two check-ins to visualize energy and stress curves over time.
              </p>
            ) : (
              <div className="space-y-3">
                <svg viewBox="0 0 320 110" className="w-full h-28 overflow-visible">
                  {[25, 55, 85].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="320"
                      y2={y}
                      stroke="currentColor"
                      className="text-black/8 dark:text-white/8"
                      strokeDasharray="3 3"
                    />
                  ))}
                  {/* Energy Line */}
                  <polyline
                    fill="none"
                    stroke="#74A892"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={trendEntries
                      .map((m, i) => {
                        const x = (i / Math.max(1, trendEntries.length - 1)) * 310 + 5;
                        const y = 100 - (m.energy / 10) * 86;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                  {/* Stress Line */}
                  <polyline
                    fill="none"
                    stroke="#C97B63"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={trendEntries
                      .map((m, i) => {
                        const x = (i / Math.max(1, trendEntries.length - 1)) * 310 + 5;
                        const y = 100 - (m.stress / 10) * 86;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                </svg>
                <div className="flex items-center gap-4 text-xs text-[#646975] dark:text-[#9CA0AA]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-[#74A892]" /> Energy
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-[#C97B63]" /> Stress
                  </span>
                </div>
              </div>
            )}

            {moodFrequency.length > 0 && (
              <div className="pt-3 border-t border-black/8 dark:border-white/8 space-y-2">
                <div className="text-xs text-[#646975] dark:text-[#9CA0AA]">Frequent moods</div>
                <div className="space-y-1.5">
                  {moodFrequency.map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-[#18191D] dark:text-[#EAE7E1]">{label}</span>
                      <span className="font-mono-tabular text-[#646975] dark:text-[#9CA0AA]">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emotional Timeline History */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-4">
        <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
          Check-In Timeline
        </h2>
        {vault.moods.length === 0 ? (
          <p className="text-sm text-[#646975] dark:text-[#9CA0AA] py-4">
            Your emotional timeline will appear here as you check in.
          </p>
        ) : (
          <div className="divide-y divide-black/8 dark:divide-white/8">
            {vault.moods.map((entry) => (
              <div key={entry.id} className="py-4 flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#646975] dark:text-[#9CA0AA]">
                    <span className="font-semibold text-sm text-[#18191D] dark:text-[#EAE7E1]">
                      {entry.mood}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{entry.date}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      Intensity {entry.intensity}/10 · Energy {entry.energy}/10 · Stress {entry.stress}/10
                    </span>
                  </div>
                  {entry.whatHappened && (
                    <p className="text-xs text-[#4B505C] dark:text-[#B8BCC6]">
                      Happened: {entry.whatHappened}
                    </p>
                  )}
                  {entry.whatWentWell && (
                    <p className="text-xs text-[#74A892]">Went well: {entry.whatWentWell}</p>
                  )}
                  {entry.journalNote && (
                    <p className="text-sm text-[#18191D] dark:text-[#EAE7E1] leading-relaxed pt-1">
                      {entry.journalNote}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteMood(entry.id)}
                  aria-label="Delete mood entry"
                  className="p-2 rounded-lg text-[#646975] hover:text-rose-500 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
