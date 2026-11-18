import { useState } from 'react';
import { Fingerprint, Lock, Delete } from 'lucide-react';
import { CompanionOrb } from './CompanionOrb';
import type { AccentTheme, SecuritySettings } from '../types/companion';

interface VaultLockScreenProps {
  companionName: string;
  accent: AccentTheme;
  security: SecuritySettings;
  title?: string;
  subtitle?: string;
  onUnlockWithPin: (pin: string) => Promise<boolean>;
  onUnlockWithBiometric: () => Promise<boolean>;
  onCancel?: () => void;
}

export function VaultLockScreen({
  companionName,
  accent,
  security,
  title = 'Sanctuary Locked',
  subtitle = 'Your journals, memories, and conversations are encrypted on this device.',
  onUnlockWithPin,
  onUnlockWithBiometric,
  onCancel,
}: VaultLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleDigit = async (digit: string) => {
    if (busy || pin.length >= 6) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4 || next.length === 6) {
      // Wait for submit on 4-6 or auto-check at 4? Let user tap Unlock or auto-submit if 4+?
      // Better: explicit Submit button + Enter key so both 4 and 6 digit PINs work smoothly.
    }
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      const ok = await onUnlockWithPin(pin);
      if (!ok) {
        setError('Incorrect passcode. Please try again.');
        setPin('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decrypt sanctuary.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const handleBiometric = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const ok = await onUnlockWithBiometric();
      if (!ok) {
        setError('Biometric verification did not complete. Enter your passcode.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric unlock unavailable here. Use passcode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F6F5F1] dark:bg-[#0B0C10] px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#13151B]/95 backdrop-blur-md p-8 flex flex-col items-center text-center shadow-2xl">
        <CompanionOrb state="resting" accent={accent} size="sm" companionName={companionName} />

        <div className="mt-5 flex items-center gap-2 text-xs text-[#646975] dark:text-[#9CA0AA]">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Encrypted Vault</span>
        </div>

        <h1 className="mt-2 font-display text-2xl font-medium text-[#18191D] dark:text-[#EAE7E1]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#646975] dark:text-[#9CA0AA] leading-relaxed max-w-xs">
          {subtitle}
        </p>

        {/* PIN indicators */}
        <div className="mt-6 flex items-center justify-center gap-3 min-h-[24px]" aria-label="Passcode length">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, idx) => (
            <span
              key={idx}
              className={`w-3 h-3 rounded-full border transition-colors ${
                idx < pin.length
                  ? 'bg-[#D4A359] border-[#D4A359]'
                  : 'border-black/20 dark:border-white/20 bg-transparent'
              }`}
            />
          ))}
        </div>

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          placeholder="Enter 4–6 digit passcode"
          aria-label="Enter 4 to 6 digit passcode"
          className="mt-4 w-full max-w-[240px] text-center font-mono-tabular tracking-widest text-base px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] text-[#18191D] dark:text-[#EAE7E1] focus:outline-none focus:ring-2 focus:ring-[#D4A359]/50"
        />

        {error && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        )}

        {/* Tactile keypad */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 w-full max-w-[240px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="min-h-[46px] rounded-xl border border-black/8 dark:border-white/8 bg-[#F6F5F1] dark:bg-[#1A1D26] hover:bg-black/5 dark:hover:bg-white/8 text-base font-medium font-mono-tabular text-[#18191D] dark:text-[#EAE7E1] transition-colors cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setPin((p) => p.slice(0, -1));
              setError('');
            }}
            aria-label="Backspace"
            className="min-h-[46px] rounded-xl border border-black/8 dark:border-white/8 bg-[#F6F5F1] dark:bg-[#1A1D26] hover:bg-black/5 dark:hover:bg-white/8 flex items-center justify-center text-[#646975] dark:text-[#9CA0AA] transition-colors cursor-pointer"
          >
            <Delete className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="min-h-[46px] rounded-xl border border-black/8 dark:border-white/8 bg-[#F6F5F1] dark:bg-[#1A1D26] hover:bg-black/5 dark:hover:bg-white/8 text-base font-medium font-mono-tabular text-[#18191D] dark:text-[#EAE7E1] transition-colors cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            disabled={pin.length < 4 || busy}
            onClick={handleSubmit}
            className="min-h-[46px] rounded-xl bg-[#D4A359] text-[#0B0C10] font-semibold text-xs disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer"
          >
            {busy ? '...' : 'Unlock'}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {security.biometricEnabled && security.biometricCredentialId && (
            <button
              type="button"
              onClick={handleBiometric}
              disabled={busy}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D4A359]/40 text-xs font-medium text-[#B88435] dark:text-[#D4A359] hover:bg-[#D4A359]/10 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Fingerprint className="w-4 h-4" />
              <span>Use Face / Fingerprint</span>
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] px-4 py-2 text-xs text-[#646975] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1] transition-colors cursor-pointer"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
