import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, SlidersHorizontal, Square, VolumeX } from 'lucide-react';
import { CompanionOrb } from './CompanionOrb';
import { streamCompanionChat } from '../services/apiClient';
import { createId, MODE_META } from '../services/defaultData';
import {
  createSpeechRecognizer,
  getAvailableVoices,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  type SpeechRecognizerHandle,
} from '../services/speechService';
import type {
  ChatMessage,
  CompanionMode,
  CompanionVisualState,
  ConversationThread,
  SanctuaryVaultData,
  VoiceSettings,
} from '../types/companion';

interface VoiceRoomProps {
  vault: SanctuaryVaultData;
  activeThreadId: string;
  onUpdateThread: (threadId: string, updater: (t: ConversationThread) => ConversationThread) => void;
  onUpdateVoiceSettings: (patch: Partial<VoiceSettings>) => void;
}

export function VoiceRoom({
  vault,
  activeThreadId,
  onUpdateThread,
  onUpdateVoiceSettings,
}: VoiceRoomProps) {
  const thread = vault.threads.find((t) => t.id === activeThreadId) ?? vault.threads[0];

  const [phase, setPhase] = useState<CompanionVisualState>('resting');
  const [handsFree, setHandsFree] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastUserLine, setLastUserLine] = useState('');
  const [companionLine, setCompanionLine] = useState(
    `Take your time. Speak whenever you feel ready, or switch tones above.`
  );
  const [typedFallback, setTypedFallback] = useState('');
  const [audioEnergy, setAudioEnergy] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);
  const phaseRef = useRef<CompanionVisualState>('resting');
  const handsFreeRef = useRef(handsFree);
  const audioEnergyRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  phaseRef.current = phase;
  handsFreeRef.current = handsFree;

  useEffect(() => {
    const refreshVoices = () => setVoices(getAvailableVoices());
    refreshVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
    return () => {
      abortRef.current?.abort();
      recognizerRef.current?.abort();
      stopSpeaking();
      micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Reactive 60fps canvas waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let t = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const currentPhase = phaseRef.current;
      const baseAmp =
        currentPhase === 'listening'
          ? 14 + audioEnergyRef.current * 28
          : currentPhase === 'speaking'
            ? 16 + Math.sin(t * 0.28) * 10
            : currentPhase === 'thinking'
              ? 8
              : 4;

      const midY = h / 2;
      const layers = [
        { color: 'rgba(212, 163, 89, 0.55)', freq: 0.018, speed: 0.045, ampScale: 1.0 },
        { color: 'rgba(139, 130, 184, 0.35)', freq: 0.025, speed: -0.032, ampScale: 0.72 },
        { color: 'rgba(234, 231, 225, 0.16)', freq: 0.012, speed: 0.02, ampScale: 0.45 },
      ];

      for (const layer of layers) {
        ctx.beginPath();
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = 1.6;
        for (let x = 0; x <= w; x += 4) {
          const normX = (x / w) * 2 - 1;
          const envelope = Math.max(0, 1 - normX * normX);
          const y =
            midY +
            Math.sin(x * layer.freq + t * layer.speed * 10) *
              baseAmp *
              layer.ampScale *
              envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.restore();
      t += 0.08;
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!thread) return null;

  const startMicAnalyser = async () => {
    try {
      if (micStreamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const sample = () => {
        if (!micStreamRef.current) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        const energy = Math.min(1, sum / (data.length * 110));
        audioEnergyRef.current = energy;
        setAudioEnergy(energy);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    } catch {
      // Analyser is purely visual enhancement; speech recognition still runs
    }
  };

  const stopListening = () => {
    recognizerRef.current?.stop();
    if (phaseRef.current === 'listening') {
      setPhase('resting');
    }
  };

  const beginListening = () => {
    if (!vault.voice.voiceProcessingEnabled) {
      setErrorMsg('Voice processing is disabled in Settings & Privacy.');
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setErrorMsg('Live speech recognition is unavailable in this browser. Use the text input below.');
      return;
    }

    stopSpeaking();
    setErrorMsg('');
    setInterimTranscript('');
    startMicAnalyser();

    const handle = createSpeechRecognizer({
      continuous: false,
      onInterim: (txt) => setInterimTranscript(txt),
      onFinal: (finalTxt) => {
        setInterimTranscript('');
        handleSpokenTurn(finalTxt);
      },
      onError: (msg) => {
        setErrorMsg(msg);
        setPhase('resting');
      },
      onEnd: () => {
        if (phaseRef.current === 'listening') {
          setPhase('resting');
        }
      },
    });

    if (handle) {
      recognizerRef.current = handle;
      setPhase('listening');
      handle.start();
    }
  };

  const handleSpokenTurn = async (spokenText: string) => {
    const clean = spokenText.trim();
    if (!clean) return;

    recognizerRef.current?.abort();
    setLastUserLine(clean);
    setPhase('thinking');
    setCompanionLine('');

    const userMsg: ChatMessage = {
      id: createId('msg'),
      role: 'user',
      content: clean,
      timestamp: new Date().toISOString(),
      mode: thread.activeMode,
      viaVoice: true,
    };

    const nextMessages = [...thread.messages, userMsg];
    onUpdateThread(thread.id, (t) => ({
      ...t,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    await streamCompanionChat(
      {
        companionName: vault.profile.companionName,
        userName: vault.profile.userName,
        mode: thread.activeMode,
        justListen: thread.justListen,
        messages: nextMessages,
        memories: vault.memories,
        recentMoods: vault.moods.slice(0, 5),
        goals: vault.goals,
        viaVoice: true,
        preferredModel: vault.profile.preferredModel,
      },
      {
        signal: controller.signal,
        onChunk: (chunk) => {
          setCompanionLine((prev) => prev + chunk);
        },
        onDone: (fullText) => {
          const reply = fullText.trim();
          if (!reply) {
            setPhase('resting');
            return;
          }
          setCompanionLine(reply);

          const replyMsg: ChatMessage = {
            id: createId('msg'),
            role: 'companion',
            content: reply,
            timestamp: new Date().toISOString(),
            mode: thread.activeMode,
            viaVoice: true,
          };

          onUpdateThread(thread.id, (t) => ({
            ...t,
            updatedAt: new Date().toISOString(),
            messages: [...nextMessages, replyMsg],
          }));

          if (vault.voice.voiceProcessingEnabled && isSpeechSynthesisSupported()) {
            speakText(reply, {
              rate: vault.voice.speechRate,
              pitch: vault.voice.speechPitch,
              voiceName: vault.voice.preferredVoiceName,
              onStart: () => setPhase('speaking'),
              onEnd: () => {
                setPhase('resting');
                if (handsFreeRef.current && isSpeechRecognitionSupported()) {
                  setTimeout(() => beginListening(), 280);
                }
              },
              onError: () => setPhase('resting'),
            });
          } else {
            setPhase('resting');
          }
        },
        onError: (msg) => {
          setErrorMsg(msg);
          setPhase('resting');
        },
      }
    );
  };

  const interruptCompanion = () => {
    abortRef.current?.abort();
    stopSpeaking();
    setPhase('resting');
  };

  return (
    <div className="relative rounded-3xl border border-black/10 dark:border-white/10 bg-[#11131A] text-[#EAE7E1] overflow-hidden min-h-[calc(100vh-140px)] flex flex-col justify-between p-6 sm:p-10">
      {/* Ambient radial lighting */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            phase === 'listening'
              ? 'radial-gradient(circle at 50% 42%, rgba(212,163,89,0.16), transparent 64%)'
              : phase === 'speaking'
                ? 'radial-gradient(circle at 50% 42%, rgba(139,130,184,0.18), transparent 64%)'
                : 'radial-gradient(circle at 50% 42%, rgba(212,163,89,0.09), transparent 60%)',
        }}
      />

      {/* Top Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/6 border border-white/8 overflow-x-auto">
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
                  active ? 'bg-[#D4A359] text-[#0B0C10]' : 'text-[#B8BCC6] hover:text-white'
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
            onClick={() => setHandsFree((h) => !h)}
            aria-pressed={handsFree}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              handsFree
                ? 'border-[#D4A359]/60 bg-[#D4A359]/14 text-[#D4A359]'
                : 'border-white/12 text-[#B8BCC6] hover:text-white'
            }`}
          >
            {handsFree ? 'Hands-free loop on' : 'Push-to-talk'}
          </button>

          <button
            type="button"
            onClick={() => setShowControls((s) => !s)}
            aria-label="Voice tuning controls"
            className="min-h-[38px] min-w-[38px] rounded-xl border border-white/12 flex items-center justify-center text-[#B8BCC6] hover:text-white cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Optional Voice Controls Panel */}
      {showControls && (
        <div className="relative z-10 mt-4 p-4 rounded-2xl border border-white/10 bg-[#181B24] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <label className="space-y-1.5 block">
            <span className="text-[#9CA0AA] flex justify-between">
              <span>Speech speed</span>
              <span className="font-mono-tabular text-[#EAE7E1]">{vault.voice.speechRate.toFixed(2)}x</span>
            </span>
            <input
              type="range"
              min="0.75"
              max="1.35"
              step="0.05"
              value={vault.voice.speechRate}
              onChange={(e) => onUpdateVoiceSettings({ speechRate: Number(e.target.value) })}
              className="w-full accent-[#D4A359]"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-[#9CA0AA] flex justify-between">
              <span>Tone pitch</span>
              <span className="font-mono-tabular text-[#EAE7E1]">{vault.voice.speechPitch.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min="0.85"
              max="1.15"
              step="0.05"
              value={vault.voice.speechPitch}
              onChange={(e) => onUpdateVoiceSettings({ speechPitch: Number(e.target.value) })}
              className="w-full accent-[#D4A359]"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-[#9CA0AA]">Voice selection</span>
            <select
              value={vault.voice.preferredVoiceName}
              onChange={(e) => onUpdateVoiceSettings({ preferredVoiceName: e.target.value })}
              className="w-full rounded-lg bg-[#0B0C10] border border-white/10 px-2.5 py-1.5 text-xs text-[#EAE7E1]"
            >
              <option value="">Automatic natural voice</option>
              {voices
                .filter((v) => v.lang.startsWith('en'))
                .map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}

      {/* Center Presence & Live Waveform */}
      <div className="relative z-10 my-6 flex flex-col items-center justify-center text-center space-y-6">
        <CompanionOrb
          state={phase}
          accent={vault.profile.accentTheme}
          size="lg"
          companionName={vault.profile.companionName}
          showCaption
          audioEnergy={audioEnergy}
        />

        <canvas
          ref={canvasRef}
          className="w-full max-w-xl h-20 pointer-events-none"
          aria-hidden="true"
        />

        <div className="max-w-xl space-y-3 min-h-[84px]">
          {(interimTranscript || lastUserLine) && (
            <p className="text-xs text-[#9CA0AA]">
              {interimTranscript ? `Hearing: “${interimTranscript}”` : `You: “${lastUserLine}”`}
            </p>
          )}
          <p className="font-display text-lg sm:text-xl text-[#EAE7E1] leading-relaxed">
            {companionLine || '…'}
          </p>
        </div>

        {errorMsg && (
          <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 px-4 py-2 rounded-xl">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Bottom Voice Action Dock + Typed Fallback */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          {phase === 'listening' ? (
            <button
              type="button"
              onClick={stopListening}
              className="min-h-[52px] px-6 py-3 rounded-full bg-[#D4A359] text-[#0B0C10] text-sm font-semibold flex items-center gap-2.5 shadow-lg cursor-pointer whitespace-nowrap"
            >
              <MicOff className="w-4 h-4" />
              <span>Pause Listening</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={beginListening}
              className="min-h-[52px] px-6 py-3 rounded-full bg-[#D4A359] text-[#0B0C10] text-sm font-semibold flex items-center gap-2.5 hover:opacity-90 transition-opacity shadow-lg cursor-pointer whitespace-nowrap"
            >
              <Mic className="w-4 h-4" />
              <span>{phase === 'speaking' ? 'Interrupt & Speak' : 'Speak'}</span>
            </button>
          )}

          {(phase === 'speaking' || phase === 'thinking') && (
            <button
              type="button"
              onClick={interruptCompanion}
              className="min-h-[52px] px-4 py-3 rounded-full border border-white/15 bg-white/8 text-xs font-medium text-[#EAE7E1] hover:bg-white/14 flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {phase === 'speaking' ? <VolumeX className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              <span>Stop</span>
            </button>
          )}
        </div>

        {/* Quiet typed input fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!typedFallback.trim()) return;
            const txt = typedFallback.trim();
            setTypedFallback('');
            handleSpokenTurn(txt);
          }}
          className="w-full max-w-lg flex items-center gap-2"
        >
          <input
            type="text"
            value={typedFallback}
            onChange={(e) => setTypedFallback(e.target.value)}
            placeholder="Prefer typing quietly here? Press Enter…"
            className="flex-1 min-h-[42px] rounded-xl border border-white/10 bg-white/5 px-4 text-xs text-[#EAE7E1] placeholder:text-[#8E93A0] focus:outline-none focus:ring-1 focus:ring-[#D4A359]/60"
          />
          <button
            type="submit"
            disabled={!typedFallback.trim()}
            aria-label="Send quiet message"
            className="min-h-[42px] min-w-[42px] rounded-xl border border-white/10 bg-white/8 flex items-center justify-center text-[#EAE7E1] disabled:opacity-35 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
