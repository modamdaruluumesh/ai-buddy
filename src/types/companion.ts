export type CompanionMode = 'supportive' | 'hard_truth' | 'growth_guide' | 'chill';

export type CompanionNeed =
  | 'talk'
  | 'listen'
  | 'figure_out'
  | 'distract'
  | 'hard_truth'
  | 'play'
  | 'unsure';

export type CompanionVisualState =
  | 'resting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'playful';

export type AccentTheme = 'gold' | 'violet' | 'sage' | 'slate';

export type NavSection =
  | 'sanctuary'
  | 'chat'
  | 'voice'
  | 'mood'
  | 'growth'
  | 'games'
  | 'memory'
  | 'settings';

export interface ChatMessage {
  id: string;
  role: 'user' | 'companion';
  content: string;
  timestamp: string;
  mode: CompanionMode;
  viaVoice?: boolean;
}

export interface ConversationThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeMode: CompanionMode;
  justListen: boolean;
  messages: ChatMessage[];
}

export type MemoryCategory =
  | 'personality'
  | 'interests'
  | 'goals'
  | 'life_events'
  | 'patterns'
  | 'coping'
  | 'unfinished';

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  confidence: 'user_verified' | 'inferred';
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  sourceNote?: string;
}

export interface MemoryConsentSettings {
  enabled: boolean;
  autoExtract: boolean;
  allowedCategories: Record<MemoryCategory, boolean>;
}

export type StandardMoodLabel =
  | 'Happy'
  | 'Calm'
  | 'Motivated'
  | 'Neutral'
  | 'Lonely'
  | 'Sad'
  | 'Anxious'
  | 'Frustrated'
  | 'Overwhelmed'
  | 'Empty'
  | 'Tired'
  | 'Hopeful';

export interface MoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  mood: string;
  intensity: number; // 1-10
  energy: number; // 1-10
  stress: number; // 1-10
  whatHappened: string;
  whatBothers: string;
  whatWentWell: string;
  improveTomorrow: string;
  journalNote: string;
  viaVoice?: boolean;
}

export interface PersonalGoal {
  id: string;
  title: string;
  whyItMatters: string;
  progress: number; // 0-100
  nextTinyStep: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GentleHabit {
  id: string;
  title: string;
  cadence: 'daily' | 'weekly';
  completedDates: string[]; // YYYY-MM-DD
  createdAt: string;
}

export interface GrowthExerciseEntry {
  id: string;
  type: 'untangler' | 'perspective_10_10_10' | 'confidence_win' | 'decision_matrix';
  title: string;
  notes: Record<string, string>;
  createdAt: string;
}

export interface ProactiveSettings {
  enabled: boolean;
  morningGreeting: boolean;
  eveningReflection: boolean;
  gentleCheckIns: boolean;
  breakReminders: boolean;
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string; // HH:mm
  frequency: 'minimal' | 'balanced';
}

export interface VoiceSettings {
  speechRate: number; // 0.8 - 1.3
  speechPitch: number; // 0.85 - 1.15
  preferredVoiceName: string;
  autoSpeakReplies: boolean;
  voiceProcessingEnabled: boolean;
}

export interface SecuritySettings {
  lockEnabled: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  encryptionSalt: string | null;
  biometricEnabled: boolean;
  biometricCredentialId: string | null;
  lockPrivateJournal: boolean;
  autoLockMinutes: 0 | 1 | 5 | 15;
}

export interface CompanionProfile {
  companionName: string;
  userName: string;
  defaultMode: CompanionMode;
  accentTheme: AccentTheme;
  colorScheme: 'dark' | 'light';
  reducedMotion: boolean;
  preferredModel: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
  unlockedGameThemes: string[];
  activeGameTheme: 'obsidian' | 'brass' | 'twilight';
  gamesPlayedCount: number;
}

export interface SanctuaryVaultData {
  profile: CompanionProfile;
  threads: ConversationThread[];
  memories: MemoryItem[];
  memoryConsent: MemoryConsentSettings;
  moods: MoodEntry[];
  goals: PersonalGoal[];
  habits: GentleHabit[];
  exercises: GrowthExerciseEntry[];
  proactive: ProactiveSettings;
  voice: VoiceSettings;
  lastMoodInsight?: {
    text: string;
    generatedAt: string;
  };
}
