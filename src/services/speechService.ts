export interface SpeechRecognizerHandle {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getRecognitionCtor());
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function normalizeSpokenPunctuation(raw: string): string {
  let text = raw.trim();
  if (!text) return '';
  text = text.replace(/\s+/g, ' ');
  // Capitalize first letter
  text = text.charAt(0).toUpperCase() + text.slice(1);
  // Capitalize standalone 'i'
  text = text.replace(/\bi\b/g, 'I').replace(/\bi'm\b/gi, "I'm").replace(/\bi've\b/gi, "I've");
  if (!/[.!?]$/.test(text)) {
    const questionStarters = /^(who|what|when|where|why|how|is|are|do|does|did|can|could|would|will|should)\b/i;
    text += questionStarters.test(text) ? '?' : '.';
  }
  return text;
}

export function createSpeechRecognizer(callbacks: {
  continuous?: boolean;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): SpeechRecognizerHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = callbacks.continuous ?? false;
  rec.interimResults = true;
  rec.lang = 'en-US';

  rec.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) {
        finalText += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    if (interim.trim()) {
      callbacks.onInterim(interim.trim());
    }
    if (finalText.trim()) {
      callbacks.onFinal(normalizeSpokenPunctuation(finalText));
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') {
      return;
    }
    if (event.error === 'not-allowed') {
      callbacks.onError('Microphone permission was denied. Allow microphone access in your browser settings.');
      return;
    }
    callbacks.onError(`Voice recognition paused (${event.error}).`);
  };

  rec.onend = () => {
    callbacks.onEnd();
  };

  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
    abort: () => rec.abort(),
  };
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakText(
  text: string,
  options: {
    rate: number;
    pitch: number;
    voiceName?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): void {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.();
    return;
  }
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[*_`#]/g, '').trim();
  if (!cleanText) {
    options.onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = Math.min(1.4, Math.max(0.7, options.rate));
  utterance.pitch = Math.min(1.2, Math.max(0.8, options.pitch));

  const voices = window.speechSynthesis.getVoices();
  if (options.voiceName) {
    const match = voices.find((v) => v.name === options.voiceName);
    if (match) utterance.voice = match;
  } else {
    const preferred =
      voices.find((v) => v.lang.startsWith('en') && /natural|samantha|daniel|google/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
  }

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();

  window.speechSynthesis.speak(utterance);
}
