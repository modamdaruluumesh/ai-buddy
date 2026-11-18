import type { CompanionMode, SanctuaryVaultData } from '../types/companion';

export const MODE_META: Record<
  CompanionMode,
  {
    label: string;
    shortDesc: string;
    toneNote: string;
  }
> = {
  supportive: {
    label: 'Supportive',
    shortDesc: 'Calm, attentive, non-judgmental',
    toneNote: 'Listens closely without rushing to fix.',
  },
  hard_truth: {
    label: 'Hard Truth',
    shortDesc: 'Direct, honest, no blind validation',
    toneNote: 'Challenges excuses while respecting your dignity.',
  },
  growth_guide: {
    label: 'Growth Guide',
    shortDesc: 'Pattern clarity & quiet discipline',
    toneNote: 'Tracks habits, blind spots, and realistic steps.',
  },
  chill: {
    label: 'Chill',
    shortDesc: 'Playful, dry humor, low stakes',
    toneNote: 'Easy banter about music, games, movies, and life.',
  },
};

export const CONVERSATION_STARTERS: string[] = [
  'My head feels noisy tonight, and I am not even sure why.',
  'Give me a random thoughtful question to chew on.',
  'I have been procrastinating on something I care about.',
  'Tell me something interesting about movies, music, or human nature.',
  'I just want to sit quietly and bounce a few small thoughts around.',
];

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createInitialVaultData(): SanctuaryVaultData {
  const nowIso = new Date().toISOString();
  return {
    profile: {
      companionName: 'Sora',
      userName: '',
      defaultMode: 'supportive',
      accentTheme: 'gold',
      colorScheme: 'dark',
      reducedMotion: false,
      preferredModel: 'gemini-4-hydrogen',
      unlockedGameThemes: ['obsidian'],
      activeGameTheme: 'obsidian',
      gamesPlayedCount: 0,
    },
    threads: [
      {
        id: createId('thread'),
        title: 'First quiet conversation',
        createdAt: nowIso,
        updatedAt: nowIso,
        activeMode: 'supportive',
        justListen: false,
        messages: [
          {
            id: createId('msg'),
            role: 'companion',
            mode: 'supportive',
            timestamp: nowIso,
            content:
              "Hey. No need to perform or summarize your whole life right now. You can vent, think out loud, ask for an honest reality check, or just play a quiet game if talking feels like too much. What kind of headspace are you in today?",
          },
        ],
      },
    ],
    memories: [],
    memoryConsent: {
      enabled: true,
      autoExtract: true,
      allowedCategories: {
        personality: true,
        interests: true,
        goals: true,
        life_events: true,
        patterns: true,
        coping: true,
        unfinished: true,
      },
    },
    moods: [],
    goals: [],
    habits: [],
    exercises: [],
    proactive: {
      enabled: true,
      morningGreeting: true,
      eveningReflection: true,
      gentleCheckIns: true,
      breakReminders: true,
      quietHoursStart: '22:30',
      quietHoursEnd: '08:00',
      frequency: 'minimal',
    },
    voice: {
      speechRate: 1.0,
      speechPitch: 1.0,
      preferredVoiceName: '',
      autoSpeakReplies: false,
      voiceProcessingEnabled: true,
    },
  };
}
