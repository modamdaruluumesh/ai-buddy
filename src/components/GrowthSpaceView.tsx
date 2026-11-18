import { useState } from 'react';
import { Check, Compass, Plus, Trash2 } from 'lucide-react';
import { createId, todayIsoDate } from '../services/defaultData';
import type {
  GentleHabit,
  GrowthExerciseEntry,
  PersonalGoal,
  SanctuaryVaultData,
} from '../types/companion';

interface GrowthSpaceViewProps {
  vault: SanctuaryVaultData;
  onAddGoal: (goal: PersonalGoal) => void;
  onUpdateGoal: (id: string, patch: Partial<PersonalGoal>) => void;
  onDeleteGoal: (id: string) => void;
  onAddHabit: (habit: GentleHabit) => void;
  onToggleHabitToday: (id: string) => void;
  onDeleteHabit: (id: string) => void;
  onAddExercise: (entry: GrowthExerciseEntry) => void;
}

export function GrowthSpaceView({
  vault,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onAddHabit,
  onToggleHabitToday,
  onDeleteHabit,
  onAddExercise,
}: GrowthSpaceViewProps) {
  const [goalTitle, setGoalTitle] = useState('');
  const [goalWhy, setGoalWhy] = useState('');
  const [goalStep, setGoalStep] = useState('');
  const [habitTitle, setHabitTitle] = useState('');

  // Overthinking & Decision Tool State
  const [activeTool, setActiveTool] = useState<'untangler' | 'perspective_10_10_10' | 'confidence_win'>(
    'untangler'
  );
  const [fieldA, setFieldA] = useState('');
  const [fieldB, setFieldB] = useState('');
  const [fieldC, setFieldC] = useState('');

  const today = todayIsoDate();

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    const now = new Date().toISOString();
    onAddGoal({
      id: createId('goal'),
      title: goalTitle.trim(),
      whyItMatters: goalWhy.trim(),
      nextTinyStep: goalStep.trim(),
      progress: 0,
      completed: false,
      createdAt: now,
      updatedAt: now,
    });
    setGoalTitle('');
    setGoalWhy('');
    setGoalStep('');
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitTitle.trim()) return;
    onAddHabit({
      id: createId('hab'),
      title: habitTitle.trim(),
      cadence: 'daily',
      completedDates: [],
      createdAt: new Date().toISOString(),
    });
    setHabitTitle('');
  };

  const handleSaveExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldA.trim() && !fieldB.trim()) return;
    const title =
      activeTool === 'untangler'
        ? 'Thought Untangler'
        : activeTool === 'perspective_10_10_10'
          ? '10-10-10 Perspective'
          : 'Quiet Win';

    onAddExercise({
      id: createId('ex'),
      type: activeTool,
      title,
      notes: {
        first: fieldA.trim(),
        second: fieldB.trim(),
        third: fieldC.trim(),
      },
      createdAt: new Date().toISOString(),
    });
    setFieldA('');
    setFieldB('');
    setFieldC('');
  };

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#646975] dark:text-[#9CA0AA]">
            <Compass className="w-3.5 h-3.5 text-[#8B82B8]" />
            <span>Quiet Growth · No Toxic Hustle</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#18191D] dark:text-[#EAE7E1] mt-1">
            Growth Space & Clarity Tools
          </h1>
        </div>
        <div className="text-xs font-mono-tabular text-[#646975] dark:text-[#9CA0AA]">
          {vault.goals.filter((g) => g.completed).length} completed · {vault.exercises.length} reflections
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Goals */}
        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-5">
          <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
            Personal Goals & Intentions
          </h2>

          <form onSubmit={handleCreateGoal} className="space-y-3">
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="A realistic goal that genuinely matters to you…"
              className="w-full min-h-[42px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-sm text-[#18191D] dark:text-[#EAE7E1]"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={goalWhy}
                onChange={(e) => setGoalWhy(e.target.value)}
                placeholder="Why this matters (optional)"
                className="min-h-[38px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
              />
              <input
                type="text"
                value={goalStep}
                onChange={(e) => setGoalStep(e.target.value)}
                placeholder="Next tiny step (10 mins)"
                className="min-h-[38px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
              />
            </div>
            <button
              type="submit"
              disabled={!goalTitle.trim()}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold disabled:opacity-35 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Goal</span>
            </button>
          </form>

          <div className="divide-y divide-black/8 dark:divide-white/8">
            {vault.goals.length === 0 ? (
              <p className="text-xs text-[#646975] dark:text-[#9CA0AA] py-4">
                No goals added yet. Start with one honest priority rather than ten overwhelming ones.
              </p>
            ) : (
              vault.goals.map((goal) => (
                <div key={goal.id} className="py-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateGoal(goal.id, {
                            completed: !goal.completed,
                            progress: !goal.completed ? 100 : goal.progress,
                          })
                        }
                        className="flex items-center gap-2 text-left cursor-pointer"
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            goal.completed
                              ? 'bg-[#D4A359] border-[#D4A359] text-[#0B0C10]'
                              : 'border-black/25 dark:border-white/25'
                          }`}
                        >
                          {goal.completed && <Check className="w-3 h-3" />}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            goal.completed
                              ? 'line-through text-[#646975] dark:text-[#9CA0AA]'
                              : 'text-[#18191D] dark:text-[#EAE7E1]'
                          }`}
                        >
                          {goal.title}
                        </span>
                      </button>
                      {goal.whyItMatters && (
                        <p className="text-xs text-[#646975] dark:text-[#9CA0AA] pl-6">
                          Why: {goal.whyItMatters}
                        </p>
                      )}
                      {goal.nextTinyStep && (
                        <p className="text-xs text-[#B88435] dark:text-[#D4A359] pl-6">
                          Tiny step: {goal.nextTinyStep}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      aria-label="Delete goal"
                      className="p-1.5 text-[#646975] hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="pl-6 flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={goal.progress}
                      onChange={(e) =>
                        onUpdateGoal(goal.id, {
                          progress: Number(e.target.value),
                          completed: Number(e.target.value) === 100,
                        })
                      }
                      className="flex-1 accent-[#D4A359]"
                    />
                    <span className="text-xs font-mono-tabular text-[#646975] dark:text-[#9CA0AA] w-9 text-right">
                      {goal.progress}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Gentle Habits */}
        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
              Gentle Habits
            </h2>
            <p className="text-xs text-[#646975] dark:text-[#9CA0AA] mt-0.5">
              Track consistency without punishing broken-streak counters.
            </p>
          </div>

          <form onSubmit={handleCreateHabit} className="flex gap-2">
            <input
              type="text"
              value={habitTitle}
              onChange={(e) => setHabitTitle(e.target.value)}
              placeholder="e.g., 15-minute evening walk, read 5 pages…"
              className="flex-1 min-h-[42px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-sm text-[#18191D] dark:text-[#EAE7E1]"
            />
            <button
              type="submit"
              disabled={!habitTitle.trim()}
              className="min-h-[42px] px-4 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold disabled:opacity-35 cursor-pointer"
            >
              Add
            </button>
          </form>

          <div className="divide-y divide-black/8 dark:divide-white/8">
            {vault.habits.length === 0 ? (
              <p className="text-xs text-[#646975] dark:text-[#9CA0AA] py-4">
                Add a gentle daily habit when you are ready—missing a day never erases your effort.
              </p>
            ) : (
              vault.habits.map((habit) => {
                const doneToday = habit.completedDates.includes(today);
                return (
                  <div key={habit.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleHabitToday(habit.id)}
                        className="flex items-center gap-2.5 text-left cursor-pointer"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            doneToday
                              ? 'bg-[#74A892] border-[#74A892] text-[#0B0C10]'
                              : 'border-black/20 dark:border-white/20'
                          }`}
                        >
                          {doneToday && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="text-sm font-medium text-[#18191D] dark:text-[#EAE7E1] truncate">
                          {habit.title}
                        </span>
                      </button>

                      {/* 7-day quiet dots */}
                      <div className="pl-7 flex items-center gap-1.5">
                        {last7Days.map((d) => {
                          const hit = habit.completedDates.includes(d);
                          return (
                            <span
                              key={d}
                              title={d}
                              className={`w-2.5 h-2.5 rounded-sm ${
                                hit
                                  ? 'bg-[#74A892]'
                                  : 'bg-black/8 dark:bg-white/10'
                              }`}
                            />
                          );
                        })}
                        <span className="text-[11px] font-mono-tabular text-[#646975] dark:text-[#9CA0AA] ml-1">
                          {habit.completedDates.length} total
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteHabit(habit.id)}
                      aria-label="Delete habit"
                      className="p-1.5 text-[#646975] hover:text-rose-500 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Overthinking & Decision Exercises */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
              Overthinking & Decision Tools
            </h2>
            <p className="text-xs text-[#646975] dark:text-[#9CA0AA]">
              Structured clarity exercises when your mind is looping.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F6F5F1] dark:bg-[#0B0C10]">
            {[
              { id: 'untangler' as const, label: 'Thought Untangler' },
              { id: 'perspective_10_10_10' as const, label: '10-10-10 Rule' },
              { id: 'confidence_win' as const, label: 'Quiet Wins' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTool(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTool === tab.id
                    ? 'bg-white dark:bg-[#1A1D26] text-[#18191D] dark:text-[#EAE7E1] shadow-sm'
                    : 'text-[#646975] dark:text-[#9CA0AA]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSaveExercise} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-1.5 block">
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">
              {activeTool === 'untangler'
                ? 'What thought is looping right now?'
                : activeTool === 'perspective_10_10_10'
                  ? 'How will this matter in 10 days?'
                  : 'One quiet win or difficult thing you handled'}
            </span>
            <textarea
              rows={3}
              value={fieldA}
              onChange={(e) => setFieldA(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] p-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">
              {activeTool === 'untangler'
                ? 'What part is outside your control?'
                : activeTool === 'perspective_10_10_10'
                  ? 'How will this matter in 10 months?'
                  : 'What personal quality made that possible?'}
            </span>
            <textarea
              rows={3}
              value={fieldB}
              onChange={(e) => setFieldB(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] p-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">
              {activeTool === 'untangler'
                ? 'One grounded action within your control'
                : activeTool === 'perspective_10_10_10'
                  ? 'How will this matter in 10 years?'
                  : 'Note to remember when doubting yourself'}
            </span>
            <textarea
              rows={3}
              value={fieldC}
              onChange={(e) => setFieldC(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] p-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
            />
          </label>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="min-h-[40px] px-5 py-2 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold cursor-pointer"
            >
              Save Reflection
            </button>
          </div>
        </form>

        {vault.exercises.length > 0 && (
          <div className="pt-4 border-t border-black/8 dark:border-white/8 space-y-3">
            <div className="text-xs text-[#646975] dark:text-[#9CA0AA]">Recent Clarity Entries</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vault.exercises.slice(0, 4).map((ex) => (
                <div
                  key={ex.id}
                  className="p-4 rounded-xl border border-black/8 dark:border-white/8 bg-[#F6F5F1]/50 dark:bg-[#0B0C10]/50 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs text-[#646975] dark:text-[#9CA0AA]">
                    <span className="font-medium text-[#18191D] dark:text-[#EAE7E1]">{ex.title}</span>
                    <span className="font-mono-tabular">
                      {new Date(ex.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {ex.notes.first && (
                    <p className="text-xs text-[#4B505C] dark:text-[#C6C9D0]">{ex.notes.first}</p>
                  )}
                  {ex.notes.third && (
                    <p className="text-xs text-[#B88435] dark:text-[#D4A359]">{ex.notes.third}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
