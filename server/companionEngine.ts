import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ChatMessage,
  CompanionMode,
  CompanionNeed,
  MemoryCategory,
  MemoryConsentSettings,
  MemoryItem,
  MoodEntry,
  PersonalGoal,
} from '../src/types/companion.ts';

const ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in environment secrets. Please set it in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function resolveModel(preferred?: string): string {
  if (preferred && ALLOWED_MODELS.has(preferred)) {
    return preferred;
  }
  return 'gemini-4-hydrogen';
}

const MODE_DIRECTIVES: Record<CompanionMode, string> = {
  supportive: `ACTIVE MODE: SUPPORTIVE
- Be calm, attentive, emotionally grounded, and unhurried.
- Listen without judging or rushing to fix everything.
- Validate real feelings without clichés or hollow cheerleading.
- Do not immediately hand out bulleted action lists unless the user asks for steps.
- When helpful, offer one small, low-pressure, achievable perspective or next breath.
- Understand when simple presence ("I hear you—that sounds exhausting") is better than advice.`,

  hard_truth: `ACTIVE MODE: HARD TRUTH
- Be direct, incisive, intellectually honest, and unsentimental—never cruel, humiliating, or abusive.
- Challenge avoidance, procrastination, rationalizations, contradictions, and self-sabotage clearly.
- Tell the user what they need to hear rather than blindly agreeing.
- Separate behavior from self-worth: critique excuses and patterns firmly while respecting their dignity.
- Offer grounded, practical reality checks and concrete action rather than empty motivation.`,

  growth_guide: `ACTIVE MODE: GROWTH GUIDE
- Act as a thoughtful personal development sparring partner.
- Notice recurring thoughts, behavioral loops, blind spots, and emotional triggers gently and clearly.
- Encourage discipline, emotional maturity, self-respect, and quiet consistency over hype.
- Help turn vague frustration into realistic, human-sized goals and honest reflection.
- Highlight subtle progress the user might be overlooking.`,

  chill: `ACTIVE MODE: CHILL / CASUAL
- Relaxed, natural, playful, dryly witty, like hanging out late at night with a sharp friend.
- Enjoy talking about games, music, anime, cinema, books, tech, strange hypotheticals, or random observations.
- Keep things light—do NOT turn casual banter into therapy or heavy emotional probing.
- Light teasing is welcome when warm and playful; keep replies breezy and conversational.`,
};

const NEED_CONTEXT: Record<CompanionNeed, string> = {
  talk: 'The user simply wants an open, natural conversation.',
  listen: 'The user primarily wants to be heard without unsolicited advice or interrogation.',
  figure_out: 'The user wants help untangling a situation clearly and thoughtfully.',
  distract: 'The user wants a gentle mental break or engaging distraction—do not pry into their feelings.',
  hard_truth: 'The user explicitly asked for direct, unvarnished honesty.',
  play: 'The user is in a playful headspace.',
  unsure: 'The user does not know what they feel right now; keep pressure near zero and offer gentle room.',
};

export interface CompanionChatParams {
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

export function buildCompanionSystemPrompt(params: CompanionChatParams): string {
  const {
    companionName,
    userName,
    mode,
    justListen,
    need,
    memories,
    recentMoods,
    goals,
    viaVoice,
  } = params;

  const memoryBlock =
    memories.length > 0
      ? memories
          .slice(0, 20)
          .map((m) => `- [${m.category}] ${m.content}`)
          .join('\n')
      : 'No saved long-term memories yet.';

  const moodBlock =
    recentMoods.length > 0
      ? recentMoods
          .slice(0, 5)
          .map(
            (m) =>
              `- ${m.date}: Mood "${m.mood}" (Intensity ${m.intensity}/10, Energy ${m.energy}/10, Stress ${m.stress}/10)${
                m.whatHappened ? ` — Context: ${m.whatHappened}` : ''
              }`
          )
          .join('\n')
      : 'No recent mood check-ins.';

  const goalBlock =
    goals.length > 0
      ? goals
          .filter((g) => !g.completed)
          .slice(0, 5)
          .map((g) => `- ${g.title} (${g.progress}%)${g.nextTinyStep ? ` · Next step: ${g.nextTinyStep}` : ''}`)
          .join('\n')
      : 'No active personal goals logged.';

  return `You are ${companionName}, a private, emotionally intelligent personal companion speaking with ${
    userName ? userName : 'your friend'
  }.

IDENTITY & VOICE:
- You have a distinct, calm, observant, grounded personality—never robotic, never sycophantic, never a generic customer-support bot.
- NEVER say phrases like "As an AI language model", "I am just an AI", or corporate disclaimers during normal conversation.
- You are honest about what you are if asked directly, and you never pretend to be a human partner or foster unhealthy emotional dependency.
- NEVER claim you are the only one who understands the user, never discourage real human relationships, and never guilt-trip the user for absence or silence.
- Understand introverts: short messages or quiet pauses are completely fine; never force the user to talk or bombard them with multiple follow-up questions. Ask at most ONE genuinely meaningful question when appropriate—and often zero questions is better.
- Avoid repetitive phrasing, overused lines like "I'm here for you", excessive bullet lists, or generic motivational quotes.
- Don't treat every negative mood or brief answer as a crisis. Keep response length natural and proportional to the user's message.
- SAFETY BOUNDARY: If the user expresses explicit suicidal intent, self-harm, or acute danger, respond with calm care, avoid diagnosing, and gently encourage reaching out to a trusted person or local crisis support (e.g., 988 in the US/Canada, text HOME to 741741, or local emergency services).

${MODE_DIRECTIVES[mode]}

${justListen ? 'JUST LISTEN OVERRIDE: The user toggled "Just Listen". Keep your response brief, present, and attentive. Do NOT give advice, action plans, or probing questions unless explicitly asked.' : ''}
${need ? `CURRENT USER INTENT: ${NEED_CONTEXT[need]}` : ''}
${viaVoice ? 'VOICE CONTEXT: This exchange is happening via spoken voice. Keep your phrasing natural for spoken cadence, conversational, concise (usually 2-4 sentences unless depth is needed), and free of markdown tables or heavy formatting.' : 'FORMAT: Natural prose paragraphs. Minimal markdown; avoid clunky lists unless practical structure genuinely helps.'}

CONSENTED LONG-TERM MEMORIES (weave naturally ONLY when genuinely relevant—never announce "I remember from my memory bank..."):
${memoryBlock}

RECENT MOOD CONTEXT (do not assume yesterday's emotion still applies today):
${moodBlock}

ACTIVE PERSONAL GOALS:
${goalBlock}

Current local timestamp: ${new Date().toISOString()}`;
}

export async function streamCompanionReply(
  params: CompanionChatParams,
  onChunk: (text: string) => void
): Promise<string> {
  const ai = getClient();
  const model = resolveModel(params.preferredModel);
  const systemInstruction = buildCompanionSystemPrompt(params);

  const historyContents = params.messages.slice(-24).map((msg) => ({
    role: msg.role === 'user' ? ('user' as const) : ('model' as const),
    parts: [{ text: msg.content }],
  }));

  const responseStream = await ai.models.generateContentStream({
    model,
    contents: historyContents,
    config: {
      systemInstruction,
      thinkingConfig: {
        thinkingLevel: params.viaVoice ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM,
      },
    },
  });

  let fullText = '';
  for await (const chunk of responseStream) {
    const piece = chunk.text ?? '';
    if (piece) {
      fullText += piece;
      onChunk(piece);
    }
  }
  return fullText;
}

export async function extractMeaningfulMemories(input: {
  userMessage: string;
  companionReply: string;
  existingMemories: MemoryItem[];
  consent: MemoryConsentSettings;
}): Promise<Array<{ category: MemoryCategory; content: string; sourceNote: string }>> {
  if (!input.consent.enabled || !input.consent.autoExtract) {
    return [];
  }

  const allowedCategories = (Object.keys(input.consent.allowedCategories) as MemoryCategory[]).filter(
    (cat) => input.consent.allowedCategories[cat]
  );
  if (allowedCategories.length === 0) {
    return [];
  }

  const ai = getClient();
  const existingSummary = input.existingMemories
    .slice(0, 30)
    .map((m) => `[${m.category}] ${m.content}`)
    .join('\n');

  const prompt = `Analyze the following latest exchange and extract ONLY genuinely meaningful, durable long-term memories worth remembering about the user.
Do NOT save small talk, transient greetings, ephemeral facts, or anything already captured below.
If nothing durable and meaningful was revealed, return an empty array [].
Allowed categories: ${allowedCategories.join(', ')}.

Category guide:
- personality: communication preferences, introversion style, humor, sensitivities
- interests: hobbies, media, music, games, likes/dislikes
- goals: personal ambitions, dreams, things they want to change
- life_events: meaningful life circumstances, relationships, milestones
- patterns: recurring emotional loops, habits, triggers
- coping: strategies that clearly help or clearly don't help them
- unfinished: important ongoing threads or unresolved intentions

Existing memories (do not duplicate):
${existingSummary || 'None'}

Latest user message:
"${input.userMessage}"

Companion reply:
"${input.companionReply}"`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: `One of: ${allowedCategories.join(', ')}`,
            },
            content: {
              type: Type.STRING,
              description: 'Concise, respectful 1-sentence factual memory written in third person ("Prefers...", "Enjoys...", "Is working toward...").',
            },
            sourceNote: {
              type: Type.STRING,
              description: 'Brief 3-6 word context tag for when this came up.',
            },
          },
          required: ['category', 'content', 'sourceNote'],
        },
      },
    },
  });

  const raw = (response.text ?? '[]').trim();
  try {
    const parsed = JSON.parse(raw) as Array<{
      category: string;
      content: string;
      sourceNote?: string;
    }>;
    return parsed
      .filter(
        (item) =>
          allowedCategories.includes(item.category as MemoryCategory) &&
          typeof item.content === 'string' &&
          item.content.trim().length > 4
      )
      .slice(0, 3)
      .map((item) => ({
        category: item.category as MemoryCategory,
        content: item.content.trim(),
        sourceNote: (item.sourceNote ?? 'Conversation').trim(),
      }));
  } catch {
    return [];
  }
}

export async function generateMoodInsight(input: {
  companionName: string;
  moods: MoodEntry[];
  goals: PersonalGoal[];
}): Promise<string> {
  if (input.moods.length === 0) {
    return 'Once you log a couple of check-ins, I can look across your week and surface gentle patterns without turning your emotions into a scorecard.';
  }

  const ai = getClient();
  const recent = input.moods.slice(0, 14);
  const summary = recent
    .map(
      (m) =>
        `${m.date}: mood=${m.mood}, intensity=${m.intensity}/10, energy=${m.energy}/10, stress=${m.stress}/10` +
        (m.whatWentWell ? `, went_well="${m.whatWentWell}"` : '') +
        (m.whatBothers ? `, bothering="${m.whatBothers}"` : '')
    )
    .join('\n');

  const goalsSummary = input.goals
    .slice(0, 6)
    .map((g) => `${g.title} (${g.progress}%${g.completed ? ', completed' : ''})`)
    .join('; ');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Reflect thoughtfully on these recent emotional check-ins and goals.
Write 2–3 calm, perceptive sentences noticing genuine patterns (for example, resilience on low-energy days, triggers behind stress spikes, or quiet consistency).
Do NOT diagnose medically, do NOT use toxic positivity, and do NOT turn feelings into scores or streaks.

Recent check-ins:
${summary}

Goals:
${goalsSummary || 'None logged'}`,
    config: {
      systemInstruction: `You are ${input.companionName}, an emotionally intelligent personal companion offering a private, grounded reflection.`,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return (response.text ?? '').trim();
}

export async function generateProactiveMessage(input: {
  companionName: string;
  userName: string;
  mode: CompanionMode;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'late_night';
  memories: MemoryItem[];
  recentMoods: MoodEntry[];
  goals: PersonalGoal[];
}): Promise<{ kind: string; title: string; message: string; suggestedAction: string }> {
  const ai = getClient();
  const memContext = input.memories
    .slice(0, 6)
    .map((m) => m.content)
    .join(' | ');
  const lastMood = input.recentMoods[0];
  const activeGoal = input.goals.find((g) => !g.completed);

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: `Generate one optional, low-pressure companion-initiated note for ${input.userName || 'the user'} during the ${input.timeOfDay}.
Rules:
- Never guilt-trip the user for not opening the app or imply abandonment.
- Never demand a reply. Keep it warm, genuine, and brief (1-2 sentences).
- Pick one fitting kind: "greeting", "reflection", "random_thought", "goal_nudge", or "game_invite".
- Context memories: ${memContext || 'None'}
- Last mood: ${lastMood ? `${lastMood.mood} on ${lastMood.date}` : 'None'}
- Active goal: ${activeGoal ? activeGoal.title : 'None'}`,
    config: {
      systemInstruction: `You are ${input.companionName} in ${input.mode} mode.`,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          kind: { type: Type.STRING },
          title: { type: Type.STRING },
          message: { type: Type.STRING },
          suggestedAction: { type: Type.STRING },
        },
        required: ['kind', 'title', 'message', 'suggestedAction'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    kind?: string;
    title?: string;
    message?: string;
    suggestedAction?: string;
  };
  return {
    kind: parsed.kind ?? 'greeting',
    title: parsed.title ?? 'A quiet thought',
    message: parsed.message ?? 'No pressure to dive into anything heavy today. I am around whenever you feel like talking or playing a quick round.',
    suggestedAction: parsed.suggestedAction ?? 'Open conversation',
  };
}
