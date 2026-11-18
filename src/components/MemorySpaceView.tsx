import { useMemo, useState } from 'react';
import { Download, Edit3, Pin, Plus, Search, Trash2, Check, X } from 'lucide-react';
import { createId } from '../services/defaultData';
import type { MemoryCategory, MemoryConsentSettings, MemoryItem, SanctuaryVaultData } from '../types/companion';

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  personality: 'Personality & Tone',
  interests: 'Likes & Interests',
  goals: 'Goals & Dreams',
  life_events: 'Life Events',
  patterns: 'Emotional Patterns',
  coping: 'What Helps / Doesn’t',
  unfinished: 'Unfinished Threads',
};

interface MemorySpaceViewProps {
  vault: SanctuaryVaultData;
  onAddMemory: (item: MemoryItem) => void;
  onUpdateMemory: (id: string, patch: Partial<MemoryItem>) => void;
  onDeleteMemory: (id: string) => void;
  onUpdateConsent: (patch: Partial<MemoryConsentSettings>) => void;
}

export function MemorySpaceView({
  vault,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  onUpdateConsent,
}: MemorySpaceViewProps) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<MemoryCategory | 'all'>('all');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('personality');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const filtered = useMemo(() => {
    return vault.memories
      .filter((m) => (filterCat === 'all' ? true : m.category === filterCat))
      .filter((m) =>
        search.trim() ? m.content.toLowerCase().includes(search.trim().toLowerCase()) : true
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [vault.memories, filterCat, search]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    const now = new Date().toISOString();
    onAddMemory({
      id: createId('mem'),
      category: newCategory,
      content: newContent.trim(),
      confidence: 'user_verified',
      pinned: false,
      createdAt: now,
      updatedAt: now,
      sourceNote: 'Added directly by you',
    });
    setNewContent('');
  };

  const handleExportMemories = () => {
    const blob = new Blob([JSON.stringify(vault.memories, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solace-memories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs text-[#646975] dark:text-[#9CA0AA]">
            Transparent Memory · User-Controlled
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#18191D] dark:text-[#EAE7E1] mt-1">
            Memory Vault
          </h1>
          <p className="text-sm text-[#646975] dark:text-[#9CA0AA] mt-1 max-w-2xl">
            Everything {vault.profile.companionName} remembers lives right here. You can correct, pin, pause, export, or delete any memory at any time.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportMemories}
          className="min-h-[40px] px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium text-[#18191D] dark:text-[#EAE7E1] hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 self-start sm:self-auto cursor-pointer whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Memories</span>
        </button>
      </section>

      {/* Consent & Privacy Controls */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#18191D] dark:text-[#EAE7E1]">
              Memory Consent & Extraction
            </h2>
            <p className="text-xs text-[#646975] dark:text-[#9CA0AA] mt-0.5">
              Only durable, meaningful context is extracted—never every casual line.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateConsent({ enabled: !vault.memoryConsent.enabled })}
              aria-pressed={vault.memoryConsent.enabled}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                vault.memoryConsent.enabled
                  ? 'border-[#D4A359] bg-[#D4A359]/12 text-[#B88435] dark:text-[#D4A359]'
                  : 'border-black/10 dark:border-white/10 text-[#646975] dark:text-[#9CA0AA]'
              }`}
            >
              {vault.memoryConsent.enabled ? 'Memory Active' : 'Memory Paused'}
            </button>
            <button
              type="button"
              onClick={() => onUpdateConsent({ autoExtract: !vault.memoryConsent.autoExtract })}
              aria-pressed={vault.memoryConsent.autoExtract}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                vault.memoryConsent.autoExtract
                  ? 'border-[#74A892]/60 bg-[#74A892]/12 text-[#74A892]'
                  : 'border-black/10 dark:border-white/10 text-[#646975] dark:text-[#9CA0AA]'
              }`}
            >
              {vault.memoryConsent.autoExtract ? 'Auto-learn On' : 'Manual Only'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-black/8 dark:border-white/8">
          {(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map((cat) => {
            const allowed = vault.memoryConsent.allowedCategories[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  onUpdateConsent({
                    allowedCategories: {
                      ...vault.memoryConsent.allowedCategories,
                      [cat]: !allowed,
                    },
                  })
                }
                className={`px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                  allowed
                    ? 'border-[#D4A359]/50 bg-[#D4A359]/8 text-[#18191D] dark:text-[#EAE7E1]'
                    : 'border-black/8 dark:border-white/8 text-[#8E93A0] line-through'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </section>

      {/* Add Manual Memory */}
      <form
        onSubmit={handleAdd}
        className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-5 flex flex-col sm:flex-row gap-3"
      >
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
          className="min-h-[42px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-xs text-[#18191D] dark:text-[#EAE7E1]"
        >
          {(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={`Teach ${vault.profile.companionName} something you want remembered…`}
          className="flex-1 min-h-[42px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-sm text-[#18191D] dark:text-[#EAE7E1]"
        />

        <button
          type="submit"
          disabled={!newContent.trim()}
          className="min-h-[42px] px-5 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold disabled:opacity-35 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Save Memory</span>
        </button>
      </form>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#8E93A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved memories…"
            className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] pl-10 pr-3.5 text-xs text-[#18191D] dark:text-[#EAE7E1]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilterCat('all')}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer ${
              filterCat === 'all'
                ? 'bg-[#D4A359] text-[#0B0C10] font-semibold'
                : 'text-[#646975] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1]'
            }`}
          >
            All ({vault.memories.length})
          </button>
          {(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer ${
                filterCat === cat
                  ? 'bg-[#D4A359] text-[#0B0C10] font-semibold'
                  : 'text-[#646975] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1]'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Memory List */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] divide-y divide-black/8 dark:divide-white/8">
        {filtered.length === 0 ? (
          <div className="p-8 text-center space-y-1">
            <p className="text-sm text-[#18191D] dark:text-[#EAE7E1]">No memories in this view yet.</p>
            <p className="text-xs text-[#646975] dark:text-[#9CA0AA]">
              As you talk with {vault.profile.companionName}, meaningful preferences, goals, and patterns will appear here for your review.
            </p>
          </div>
        ) : (
          filtered.map((mem) => (
            <div key={mem.id} className="p-5 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#646975] dark:text-[#9CA0AA]">
                  <span className="font-medium text-[#B88435] dark:text-[#D4A359]">
                    {CATEGORY_LABELS[mem.category]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{mem.confidence === 'user_verified' ? 'Verified by you' : 'Inferred'}</span>
                  {mem.sourceNote && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{mem.sourceNote}</span>
                    </>
                  )}
                </div>

                {editingId === mem.id ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="flex-1 min-h-[38px] rounded-lg border border-[#D4A359]/60 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-sm text-[#18191D] dark:text-[#EAE7E1]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editDraft.trim()) {
                          onUpdateMemory(mem.id, {
                            content: editDraft.trim(),
                            confidence: 'user_verified',
                            updatedAt: new Date().toISOString(),
                          });
                        }
                        setEditingId(null);
                      }}
                      aria-label="Save edit"
                      className="p-2 rounded-lg bg-[#D4A359] text-[#0B0C10] cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel edit"
                      className="p-2 rounded-lg text-[#646975] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[#18191D] dark:text-[#EAE7E1] leading-relaxed">
                    {mem.content}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateMemory(mem.id, { pinned: !mem.pinned })}
                  aria-label={mem.pinned ? 'Unpin memory' : 'Pin memory'}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    mem.pinned
                      ? 'text-[#D4A359]'
                      : 'text-[#646975] hover:text-[#18191D] dark:hover:text-[#EAE7E1]'
                  }`}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(mem.id);
                    setEditDraft(mem.content);
                  }}
                  aria-label="Edit memory"
                  className="p-2 rounded-lg text-[#646975] hover:text-[#18191D] dark:hover:text-[#EAE7E1] cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMemory(mem.id)}
                  aria-label="Delete memory"
                  className="p-2 rounded-lg text-[#646975] hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
