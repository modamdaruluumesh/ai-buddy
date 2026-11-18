import { useEffect, useRef, useState } from 'react';
import {
  Ear,
  Mic,
  MicOff,
  Plus,
  Send,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CompanionOrb } from './CompanionOrb';
import { requestMemoryExtraction, streamCompanionChat } from '../services/apiClient';
import { CONVERSATION_STARTERS, createId, MODE_META } from '../services/defaultData';
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  type SpeechRecognizerHandle,
} from '../services/speechService';
import type {
  ChatMessage,
  CompanionMode,
  CompanionNeed,
  CompanionVisualState,
  ConversationThread,
  MemoryItem,
  SanctuaryVaultData,
} from '../types/companion';

interface ConversationViewProps {
  vault: SanctuaryVaultData;
  activeThreadId: string;
  pendingNeed?: CompanionNeed;
  onClearPendingNeed: () => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: (mode?: CompanionMode) => void;
  onDeleteThread: (threadId: string) => void;
  onUpdateThread: (threadId: string, updater: (t: ConversationThread) => ConversationThread) => void;
  onAddMemories: (items: MemoryItem[]) => void;
  onOpenMemorySpace: () => void;
}

export function ConversationView({
  vault,
  activeThreadId,
  pendingNeed,
  onClearPendingNeed,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onUpdateThread,
  onAddMemories,
  onOpenMemorySpace,
}: ConversationViewProps) {
  const thread =
    vault.threads.find((t) => t.id === activeThreadId) ?? vault.threads[0];

  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [recentMemoryCount, setRecentMemoryCount] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const visualState: CompanionVisualState = isSpeaking
    ? 'speaking'
    : isStreaming
      ? 'thinking'
      : isListening
        ? 'listening'
        : thread?.activeMode === 'chill'
          ? 'playful'
          : 'resting';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length, streamingText]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognizerRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  if (!thread) return null;

  const handleToggleMic = () => {
    if (!vault.voice.voiceProcessingEnabled) {
      setErrorBanner('Voice processing is disabled in Settings & Privacy.');
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setErrorBanner('Speech recognition is not supported in this browser. You can type naturally below.');
      return;
    }
    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Interrupt companion playback if user starts speaking
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }

    setErrorBanner('');
    const handle = createSpeechRecognizer({
      continuous: false,
      onInterim: (interim) => {
        setInput(interim);
      },
      onFinal: (finalText) => {
        setInput((prev) => {
          const base = prev.trim();
          if (!base || base.toLowerCase() === finalText.toLowerCase().replace(/[.!?]$/, '')) {
            return finalText;
          }
          return `${base} ${finalText}`;
        });
      },
      onError: (msg) => {
        setErrorBanner(msg);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    if (handle) {
      recognizerRef.current = handle;
      setIsListening(true);
      handle.start();
    }
  };

  const handleSpeakMessage = (text: string) => {
    if (!vault.voice.voiceProcessingEnabled || !isSpeechSynthesisSupported()) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    speakText(text, {
      rate: vault.voice.speechRate,
      pitch: vault.voice.speechPitch,
      voiceName: vault.voice.preferredVoiceName,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const sendMessage = async (overrideText?: string, viaVoice = false) => {
    const content = (overrideText ?? input).trim();
    if (!content || isStreaming) return;

    setErrorBanner('');
    setRecentMemoryCount(0);
    if (!overrideText) setInput('');
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }

    const userMsg: ChatMessage = {
      id: createId('msg'),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      mode: thread.activeMode,
      viaVoice,
    };

    const nextMessages = [...thread.messages, userMsg];
    const autoTitle =
      thread.messages.length <= 1
        ? content.slice(0, 42) + (content.length > 42 ? '…' : '')
        : thread.title;

    onUpdateThread(thread.id, (t) => ({
      ...t,
      title: autoTitle,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    }));

    setIsStreaming(true);
    setStreamingText('');
    const controller = new AbortController();
    abortRef.current = controller;

    await streamCompanionChat(
      {
        companionName: vault.profile.companionName,
        userName: vault.profile.userName,
        mode: thread.activeMode,
        justListen: thread.justListen,
        need: pendingNeed,
        messages: nextMessages,
        memories: vault.memories,
        recentMoods: vault.moods.slice(0, 5),
        goals: vault.goals,
        viaVoice,
        preferredModel: vault.profile.preferredModel,
      },
      {
        signal: controller.signal,
        onChunk: (chunk) => {
          setStreamingText((prev) => prev + chunk);
        },
        onDone: async (fullText) => {
          const clean = fullText.trim();
          setIsStreaming(false);
          setStreamingText('');
          if (pendingNeed) onClearPendingNeed();

          if (!clean) return;

          const replyMsg: ChatMessage = {
            id: createId('msg'),
            role: 'companion',
            content: clean,
            timestamp: new Date().toISOString(),
            mode: thread.activeMode,
          };

          onUpdateThread(thread.id, (t) => ({
            ...t,
            updatedAt: new Date().toISOString(),
            messages: [...nextMessages, replyMsg],
          }));

          if (vault.voice.autoSpeakReplies && vault.voice.voiceProcessingEnabled) {
            speakText(clean, {
              rate: vault.voice.speechRate,
              pitch: vault.voice.speechPitch,
              voiceName: vault.voice.preferredVoiceName,
              onStart: () => setIsSpeaking(true),
              onEnd: () => setIsSpeaking(false),
              onError: () => setIsSpeaking(false),
            });
          }

          // Background memory extraction if consented
          if (vault.memoryConsent.enabled && vault.memoryConsent.autoExtract) {
            try {
              const extracted = await requestMemoryExtraction({
                userMessage: content,
                companionReply: clean,
                existingMemories: vault.memories,
                consent: vault.memoryConsent,
              });
              if (extracted.length > 0) {
                const now = new Date().toISOString();
                onAddMemories(
                  extracted.map((e) => ({
                    id: createId('mem'),
                    category: e.category,
                    content: e.content,
                    confidence: 'inferred',
                    pinned: false,
                    createdAt: now,
                    updatedAt: now,
                    sourceNote: e.sourceNote,
                  }))
                );
                setRecentMemoryCount(extracted.length);
              }
            } catch {
              // Silent background extraction failure
            }
          }
        },
        onError: (msg) => {
          setIsStreaming(false);
          setStreamingText('');
          setErrorBanner(msg);
        },
      }
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 min-h-[calc(100vh-140px)]">
      {/* Thread list & Companion presence rail */}
      <aside className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-4 flex flex-col justify-between gap-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-[#646975] dark:text-[#9CA0AA]">
              Conversations
            </h2>
            <button
              type="button"
              onClick={() => onCreateThread(thread.activeMode)}
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium text-[#18191D] dark:text-[#EAE7E1] hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-[240px] lg:max-h-[400px] overflow-y-auto pr-1">
            {vault.threads.map((t) => {
              const active = t.id === thread.id;
              return (
                <div
                  key={t.id}
                  className={`group rounded-xl border transition-colors flex items-center justify-between gap-2 px-3 py-2.5 ${
                    active
                      ? 'border-[#D4A359]/60 bg-[#D4A359]/10'
                      : 'border-transparent hover:bg-black/4 dark:hover:bg-white/4'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectThread(t.id)}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <div className="text-xs font-medium text-[#18191D] dark:text-[#EAE7E1] truncate">
                      {t.title}
                    </div>
                    <div className="text-[11px] text-[#646975] dark:text-[#9CA0AA] mt-0.5 truncate">
                      {MODE_META[t.activeMode].label} · {t.messages.length} msgs
                    </div>
                  </button>
                  {vault.threads.length > 1 && (
                    confirmDeleteId === t.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteThread(t.id);
                            setConfirmDeleteId(null);
                          }}
                          className="text-[11px] px-2 py-1 rounded bg-rose-600 text-white cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] px-1.5 py-1 text-[#646975] dark:text-[#9CA0AA] cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(t.id)}
                        aria-label={`Delete conversation ${t.title}`}
                        className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg text-[#646975] hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-center pt-4 border-t border-black/8 dark:border-white/8">
          <CompanionOrb
            state={visualState}
            accent={vault.profile.accentTheme}
            size="md"
            companionName={vault.profile.companionName}
            showCaption
          />
          <p className="mt-3 text-center text-xs text-[#646975] dark:text-[#9CA0AA] leading-relaxed">
            {MODE_META[thread.activeMode].toneNote}
          </p>
        </div>
      </aside>

      {/* Main Chat Canvas */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] flex flex-col overflow-hidden">
        {/* Mode Bar & Just Listen Control */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-black/8 dark:border-white/8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F6F5F1] dark:bg-[#0B0C10] overflow-x-auto max-w-full">
            {(Object.keys(MODE_META) as CompanionMode[]).map((modeKey) => {
              const active = thread.activeMode === modeKey;
              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() =>
                    onUpdateThread(thread.id, (t) => ({ ...t, activeMode: modeKey }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#1A1D26] text-[#18191D] dark:text-[#EAE7E1] shadow-sm'
                      : 'text-[#646975] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1]'
                  }`}
                >
                  {MODE_META[modeKey].label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateThread(thread.id, (t) => ({ ...t, justListen: !t.justListen }))
              }
              aria-pressed={thread.justListen}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                thread.justListen
                  ? 'border-[#D4A359] bg-[#D4A359]/12 text-[#B88435] dark:text-[#D4A359]'
                  : 'border-black/10 dark:border-white/10 text-[#646975] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1]'
              }`}
            >
              <Ear className="w-3.5 h-3.5" />
              <span>Just Listen</span>
            </button>

            {isSpeaking && (
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setIsSpeaking(false);
                }}
                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Stop Audio</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 max-h-[58vh] lg:max-h-[62vh]">
          {thread.messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 text-[11px] text-[#646975] dark:text-[#9CA0AA] mb-1.5 px-1">
                  <span>{isUser ? vault.profile.userName || 'You' : vault.profile.companionName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {!isUser && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{MODE_META[msg.mode].label}</span>
                    </>
                  )}
                </div>

                <div
                  className={`max-w-[88%] sm:max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#18191D] text-[#EAE7E1] dark:bg-[#232734] dark:text-[#EAE7E1]'
                      : 'bg-[#F6F5F1] text-[#18191D] dark:bg-[#1A1D26] dark:text-[#EAE7E1] border border-black/6 dark:border-white/6'
                  }`}
                >
                  {msg.content}
                </div>

                {!isUser && vault.voice.voiceProcessingEnabled && isSpeechSynthesisSupported() && (
                  <button
                    type="button"
                    onClick={() => handleSpeakMessage(msg.content)}
                    className="mt-1.5 px-2 py-1 text-[11px] text-[#646975] dark:text-[#9CA0AA] hover:text-[#B88435] dark:hover:text-[#D4A359] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Listen</span>
                  </button>
                )}
              </div>
            );
          })}

          {isStreaming && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 text-[11px] text-[#646975] dark:text-[#9CA0AA] mb-1.5 px-1">
                <span>{vault.profile.companionName}</span>
                <span aria-hidden="true">·</span>
                <span>{streamingText ? 'Writing' : 'Thinking'}</span>
              </div>
              <div className="max-w-[88%] sm:max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-[#F6F5F1] text-[#18191D] dark:bg-[#1A1D26] dark:text-[#EAE7E1] border border-black/6 dark:border-white/6">
                {streamingText || '...'}
              </div>
            </div>
          )}

          {recentMemoryCount > 0 && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={onOpenMemorySpace}
                className="text-xs text-[#646975] dark:text-[#9CA0AA] hover:text-[#D4A359] transition-colors py-1 px-3 cursor-pointer"
              >
                {vault.profile.companionName} remembered {recentMemoryCount} meaningful detail
                {recentMemoryCount > 1 ? 's' : ''} · Review or edit in Memory Vault
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Low-energy starters when conversation is fresh */}
        {thread.messages.length <= 2 && !isStreaming && (
          <div className="px-4 sm:px-6 pb-3 flex flex-wrap gap-2">
            {CONVERSATION_STARTERS.slice(0, 3).map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => sendMessage(starter)}
                className="text-left text-xs px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 text-[#4B505C] dark:text-[#B8BCC6] hover:border-[#D4A359]/50 hover:text-[#18191D] dark:hover:text-[#EAE7E1] transition-colors cursor-pointer"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {/* Error banner (honest upstream/offline messaging) */}
        {errorBanner && (
          <div
            role="alert"
            className="mx-4 sm:mx-6 mb-3 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner('')}
              className="text-xs underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Composer */}
        <div className="p-4 sm:px-6 border-t border-black/8 dark:border-white/8 bg-[#F6F5F1]/60 dark:bg-[#0B0C10]/60">
          <div className="flex items-end gap-2.5">
            <button
              type="button"
              onClick={handleToggleMic}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                isListening
                  ? 'border-[#D4A359] bg-[#D4A359]/20 text-[#D4A359]'
                  : 'border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] text-[#646975] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                isListening
                  ? 'Listening… speak naturally'
                  : thread.justListen
                    ? `Vent freely—${vault.profile.companionName} is just listening`
                    : `Say whatever is on your mind…`
              }
              className="flex-1 min-h-[44px] max-h-36 resize-none rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] px-4 py-2.5 text-sm text-[#18191D] dark:text-[#EAE7E1] placeholder:text-[#8E93A0] focus:outline-none focus:ring-2 focus:ring-[#D4A359]/40"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                  setIsStreaming(false);
                  setStreamingText('');
                }}
                aria-label="Stop generating"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-rose-600 text-white flex items-center justify-center hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!input.trim()}
                onClick={() => sendMessage()}
                aria-label="Send message"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#D4A359] text-[#0B0C10] flex items-center justify-center disabled:opacity-35 hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
