import { useState } from 'react';
import type { AccentTheme, CompanionVisualState } from '../types/companion';

const CORE_IMAGE_PATH = '/src/assets/images/companion_presence_core_1795006423003.jpg';

const ACCENT_GLOW: Record<AccentTheme, { ring: string; ambient: string }> = {
  gold: {
    ring: 'rgba(212, 163, 89, 0.35)',
    ambient: 'radial-gradient(circle, rgba(212,163,89,0.22) 0%, rgba(139,130,184,0.08) 52%, transparent 74%)',
  },
  violet: {
    ring: 'rgba(139, 130, 184, 0.38)',
    ambient: 'radial-gradient(circle, rgba(139,130,184,0.24) 0%, rgba(212,163,89,0.08) 52%, transparent 74%)',
  },
  sage: {
    ring: 'rgba(116, 168, 146, 0.35)',
    ambient: 'radial-gradient(circle, rgba(116,168,146,0.22) 0%, rgba(139,130,184,0.08) 52%, transparent 74%)',
  },
  slate: {
    ring: 'rgba(148, 163, 184, 0.35)',
    ambient: 'radial-gradient(circle, rgba(148,163,184,0.22) 0%, rgba(212,163,89,0.08) 52%, transparent 74%)',
  },
};

const STATE_LABEL: Record<CompanionVisualState, string> = {
  resting: 'Present & unhurried',
  listening: 'Listening closely',
  thinking: 'Reflecting',
  speaking: 'Speaking',
  playful: 'Playful headspace',
};

interface CompanionOrbProps {
  state?: CompanionVisualState;
  accent?: AccentTheme;
  size?: 'sm' | 'md' | 'lg';
  companionName?: string;
  showCaption?: boolean;
  audioEnergy?: number; // 0..1
}

export function CompanionOrb({
  state = 'resting',
  accent = 'gold',
  size = 'md',
  companionName = 'Sora',
  showCaption = false,
  audioEnergy = 0,
}: CompanionOrbProps) {
  const [imgError, setImgError] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-12 h-12'
      : size === 'lg'
        ? 'w-44 h-44 sm:w-52 sm:h-52'
        : 'w-24 h-24 sm:w-28 sm:h-28';

  const palette = ACCENT_GLOW[accent];
  const dynamicScale =
    state === 'speaking' || state === 'listening'
      ? 1 + Math.min(0.14, audioEnergy * 0.16)
      : state === 'thinking'
        ? 1.03
        : 1;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className={`relative flex items-center justify-center ${dims}`}>
        {/* Ambient radial backdrop */}
        <div
          className={`absolute inset-[-24%] rounded-full pointer-events-none transition-transform duration-300 ${
            state === 'resting' ? 'animate-sanctuary-breath' : ''
          }`}
          style={{
            background: palette.ambient,
            transform: `scale(${dynamicScale})`,
          }}
        />

        {/* Subtle geometric outer ring */}
        <div
          className="absolute inset-[-6%] rounded-full border transition-transform duration-300 pointer-events-none"
          style={{
            borderColor: palette.ring,
            transform: `scale(${state === 'thinking' ? 1.05 : dynamicScale})`,
          }}
        />

        {/* Core sculptural presence */}
        <div className="relative w-full h-full rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-[#14161D] shadow-lg">
          {!imgError ? (
            <img
              src={CORE_IMAGE_PATH}
              alt={`${companionName} companion visual presence`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                state === 'thinking' ? 'scale-105' : 'scale-100'
              }`}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: palette.ambient }}
            >
              <span className="font-display text-xl text-[#D4A359]">
                {companionName.slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}
          {/* Measured soft vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>

      {showCaption && (
        <div className="flex items-center gap-2 text-xs text-[#646975] dark:text-[#9CA0AA]">
          <span className="font-medium text-[#18191D] dark:text-[#EAE7E1]">{companionName}</span>
          <span aria-hidden="true">·</span>
          <span>{STATE_LABEL[state]}</span>
        </div>
      )}
    </div>
  );
}
