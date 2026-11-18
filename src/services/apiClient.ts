import type {
  ChatMessage,
  CompanionMode,
  CompanionNeed,
  MemoryCategory,
  MemoryConsentSettings,
  MemoryItem,
  MoodEntry,
  PersonalGoal,
} from '../types/companion';

export interface StreamChatRequest {
  companionName: string;
  userName: string;
  mode: CompanionMode;
  justListen: boolean;
  need?: CompanionNeed;
  messages: ChatMessage[];
  memories: MemoryItem[];
  recentMoods: MoodEntry[];
  goals: PersonalGoal[];
  viaVoice?: boolean;
  preferredModel?: string;
}

export async function streamCompanionChat(
  payload: StreamChatRequest,
  handlers: {
    onChunk: (text: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    handlers.onError(
      'You appear to be offline. Live AI conversation requires connectivity, though your mood journal, saved memories, and mini-games work offline.'
    );
    return;
  }

  try {
    const res = await fetch('/api/companion/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: handlers.signal,
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      handlers.onError(errData.error ?? `Request failed (${res.status}).`);
      return;
    }

    if (!res.body) {
      handlers.onError('Empty response stream from server.');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        try {
          const evt = JSON.parse(jsonStr) as {
            type: 'chunk' | 'done' | 'error';
            text?: string;
            fullText?: string;
            error?: string;
          };
          if (evt.type === 'chunk' && evt.text) {
            accumulated += evt.text;
            handlers.onChunk(evt.text);
          } else if (evt.type === 'done') {
            handlers.onDone(evt.fullText ?? accumulated);
            return;
          } else if (evt.type === 'error') {
            handlers.onError(evt.error ?? 'AI response failed.');
            return;
          }
        } catch {
          // Ignore malformed partial frame
        }
      }
    }
    handlers.onDone(accumulated);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    handlers.onError(err instanceof Error ? err.message : 'Unable to connect to companion server.');
  }
}

export async function requestMemoryExtraction(input: {
  userMessage: string;
  companionReply: string;
  existingMemories: MemoryItem[];
  consent: MemoryConsentSettings;
}): Promise<Array<{ category: MemoryCategory; content: string; sourceNote: string }>> {
  if (!input.consent.enabled || !input.consent.autoExtract) return [];
  if (typeof navigator !== 'undefined' && !navigator.onLine) return [];

  const res = await fetch('/api/companion/extract-memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    memories?: Array<{ category: MemoryCategory; content: string; sourceNote: string }>;
  };
  return data.memories ?? [];
}

export async function requestMoodInsight(input: {
  companionName: string;
  moods: MoodEntry[];
  goals: PersonalGoal[];
}): Promise<string> {
  const res = await fetch('/api/insights/mood', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { insight?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to generate mood reflection.');
  }
  return data.insight ?? '';
}

export async function requestProactivePrompt(input: {
  companionName: string;
  userName: string;
  mode: CompanionMode;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'late_night';
  memories: MemoryItem[];
  recentMoods: MoodEntry[];
  goals: PersonalGoal[];
}): Promise<{ kind: string; title: string; message: string; suggestedAction: string }> {
  const res = await fetch('/api/companion/proactive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    kind?: string;
    title?: string;
    message?: string;
    suggestedAction?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to load companion note.');
  }
  return {
    kind: data.kind ?? 'greeting',
    title: data.title ?? 'A quiet thought',
    message: data.message ?? '',
    suggestedAction: data.suggestedAction ?? 'Open conversation',
  };
}
