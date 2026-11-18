import { useEffect, useState } from 'react';
import { Download, Fingerprint, Lock, ShieldCheck, Trash2, Unlock } from 'lucide-react';
import { isBiometricSupported } from '../services/cryptoVault';
import type {
  AccentTheme,
  CompanionMode,
  CompanionProfile,
  ProactiveSettings,
  SanctuaryVaultData,
  SecuritySettings,
  VoiceSettings,
} from '../types/companion';

interface SettingsPrivacyViewProps {
  vault: SanctuaryVaultData;
  security: SecuritySettings;
  onUpdateProfile: (patch: Partial<CompanionProfile>) => void;
  onUpdateProactive: (patch: Partial<ProactiveSettings>) => void;
  onUpdateVoice: (patch: Partial<VoiceSettings>) => void;
  onEnablePinLock: (pin: string) => Promise<void>;
  onDisablePinLock: () => Promise<void>;
  onToggleBiometric: (enable: boolean) => Promise<void>;
  onUpdateSecurity: (patch: Partial<SecuritySettings>) => void;
  onClearMoodHistory: () => void;
  onDeleteAllMemories: () => void;
  onWipeAccount: () => void;
}

export function SettingsPrivacyView({
  vault,
  security,
  onUpdateProfile,
  onUpdateProactive,
  onUpdateVoice,
  onEnablePinLock,
  onDisablePinLock,
  onToggleBiometric,
  onUpdateSecurity,
  onClearMoodHistory,
  onDeleteAllMemories,
  onWipeAccount,
}: SettingsPrivacyViewProps) {
  const [pinDraft, setPinDraft] = useState('');
  const [secMsg, setSecMsg] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState<'none' | 'moods' | 'memories' | 'account'>('none');

  useEffect(() => {
    isBiometricSupported().then(setBioAvailable);
  }, []);

  const handleExportAll = () => {
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinsvale-sanctuary-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-8 max-w-4xl">
      <section>
        <div className="text-xs text-[#646975] dark:text-[#9CA0AA]">
          Identity, Security & Data Sovereignty
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#18191D] dark:text-[#EAE7E1] mt-1">
          Settings & Privacy
        </h1>
      </section>

      {/* Companion Identity & Appearance */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-5">
        <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
          Companion Identity & Sanctuary Theme
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5 block">
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">Companion Name</span>
            <input
              type="text"
              value={vault.profile.companionName}
              onChange={(e) => onUpdateProfile({ companionName: e.target.value || 'Sora' })}
              className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-sm"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">What should they call you?</span>
            <input
              type="text"
              value={vault.profile.userName}
              onChange={(e) => onUpdateProfile({ userName: e.target.value })}
              placeholder="Optional name or nickname"
              className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-sm"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">Default Mode</span>
            <select
              value={vault.profile.defaultMode}
              onChange={(e) => onUpdateProfile({ defaultMode: e.target.value as CompanionMode })}
              className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-sm"
            >
              <option value="supportive">Supportive</option>
              <option value="hard_truth">Hard Truth</option>
              <option value="growth_guide">Growth Guide</option>
              <option value="chill">Chill / Casual</option>
            </select>
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">Free AI Engine Model</span>
            <select
              value={vault.profile.preferredModel}
              onChange={(e) =>
                onUpdateProfile({
                  preferredModel: e.target.value as 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
                })
              }
              className="w-full min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-sm"
            >
              <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Nuanced, Balanced)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra Fast)</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-black/8 dark:border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">Accent:</span>
            {(['gold', 'violet', 'sage', 'slate'] as AccentTheme[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onUpdateProfile({ accentTheme: a })}
                className={`px-3 py-1.5 rounded-lg border text-xs capitalize cursor-pointer ${
                  vault.profile.accentTheme === a
                    ? 'border-[#D4A359] bg-[#D4A359]/12 font-medium'
                    : 'border-black/10 dark:border-white/10 text-[#646975] dark:text-[#9CA0AA]'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateProfile({
                  colorScheme: vault.profile.colorScheme === 'dark' ? 'light' : 'dark',
                })
              }
              className="min-h-[38px] px-3.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium cursor-pointer"
            >
              Appearance: {vault.profile.colorScheme === 'dark' ? 'Midnight Dark' : 'Warm Light'}
            </button>

            <button
              type="button"
              onClick={() => onUpdateProfile({ reducedMotion: !vault.profile.reducedMotion })}
              className="min-h-[38px] px-3.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium cursor-pointer"
            >
              Motion: {vault.profile.reducedMotion ? 'Reduced' : 'Fluid'}
            </button>
          </div>
        </div>
      </section>

      {/* Proactive Companion Preferences */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
              Companion-Initiated Notes
            </h2>
            <p className="text-xs text-[#646975] dark:text-[#9CA0AA]">
              Optional greetings and reflections—never guilt-tripping or demanding attention.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateProactive({ enabled: !vault.proactive.enabled })}
            className={`min-h-[36px] px-3.5 rounded-xl border text-xs font-medium cursor-pointer ${
              vault.proactive.enabled
                ? 'border-[#D4A359] bg-[#D4A359]/12 text-[#B88435] dark:text-[#D4A359]'
                : 'border-black/10 dark:border-white/10 text-[#646975]'
            }`}
          >
            {vault.proactive.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-xl border border-black/8 dark:border-white/8">
            <span>Morning & evening check-ins</span>
            <input
              type="checkbox"
              checked={vault.proactive.morningGreeting}
              onChange={(e) => onUpdateProactive({ morningGreeting: e.target.checked })}
              className="accent-[#D4A359]"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-black/8 dark:border-white/8">
            <span>Suggest gentle breaks</span>
            <input
              type="checkbox"
              checked={vault.proactive.breakReminders}
              onChange={(e) => onUpdateProactive({ breakReminders: e.target.checked })}
              className="accent-[#D4A359]"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-black/8 dark:border-white/8">
            <span>Quiet hours start</span>
            <input
              type="time"
              value={vault.proactive.quietHoursStart}
              onChange={(e) => onUpdateProactive({ quietHoursStart: e.target.value })}
              className="bg-transparent font-mono-tabular"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-black/8 dark:border-white/8">
            <span>Quiet hours end</span>
            <input
              type="time"
              value={vault.proactive.quietHoursEnd}
              onChange={(e) => onUpdateProactive({ quietHoursEnd: e.target.value })}
              className="bg-transparent font-mono-tabular"
            />
          </label>
        </div>
      </section>

      {/* Voice Controls */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-4">
        <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
          Voice & Speech
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-xl border border-black/8 dark:border-white/8">
            <span>Enable browser voice input & speech</span>
            <input
              type="checkbox"
              checked={vault.voice.voiceProcessingEnabled}
              onChange={(e) => onUpdateVoice({ voiceProcessingEnabled: e.target.checked })}
              className="accent-[#D4A359]"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-black/8 dark:border-white/8">
            <span>Auto-speak replies in chat</span>
            <input
              type="checkbox"
              checked={vault.voice.autoSpeakReplies}
              onChange={(e) => onUpdateVoice({ autoSpeakReplies: e.target.checked })}
              className="accent-[#D4A359]"
            />
          </label>
        </div>
      </section>

      {/* Encryption & Biometric Security */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#D4A359]" />
          <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
            Encryption & Biometric Lock
          </h2>
        </div>

        <p className="text-xs text-[#646975] dark:text-[#9CA0AA] leading-relaxed">
          Enabling a Passcode encrypts your stored conversations, memories, and journals on this device using PBKDF2 + AES-GCM (256-bit). Passcodes are hashed locally and never stored in plaintext. Biometrics use your device’s native WebAuthn authenticator without storing biometric templates.
        </p>

        {!security.lockEnabled ? (
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="password"
              inputMode="numeric"
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Choose a 4–6 digit passcode"
              className="flex-1 min-h-[42px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-sm font-mono-tabular"
            />
            <button
              type="button"
              disabled={pinDraft.length < 4}
              onClick={async () => {
                await onEnablePinLock(pinDraft);
                setPinDraft('');
                setSecMsg('Vault encryption enabled.');
              }}
              className="min-h-[42px] px-5 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold disabled:opacity-35 flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Enable Encrypted Lock</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  await onDisablePinLock();
                  setSecMsg('Vault lock removed.');
                }}
                className="min-h-[40px] px-4 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Disable Passcode Lock</span>
              </button>

              {bioAvailable && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onToggleBiometric(!security.biometricEnabled);
                      setSecMsg(
                        !security.biometricEnabled
                          ? 'Biometric passkey registered.'
                          : 'Biometric unlock disabled.'
                      );
                    } catch (err) {
                      setSecMsg(
                        err instanceof Error ? err.message : 'Unable to configure biometrics here.'
                      );
                    }
                  }}
                  className={`min-h-[40px] px-4 rounded-xl border text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
                    security.biometricEnabled
                      ? 'border-[#D4A359] bg-[#D4A359]/12 text-[#B88435] dark:text-[#D4A359]'
                      : 'border-black/10 dark:border-white/10'
                  }`}
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>
                    {security.biometricEnabled ? 'Biometric Unlock Active' : 'Add Face / Fingerprint'}
                  </span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl border border-black/8 dark:border-white/8">
                <span>Require unlock for Mood Journal</span>
                <input
                  type="checkbox"
                  checked={security.lockPrivateJournal}
                  onChange={(e) => onUpdateSecurity({ lockPrivateJournal: e.target.checked })}
                  className="accent-[#D4A359]"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-black/8 dark:border-white/8">
                <span>Auto-lock inactivity</span>
                <select
                  value={security.autoLockMinutes}
                  onChange={(e) =>
                    onUpdateSecurity({
                      autoLockMinutes: Number(e.target.value) as 0 | 1 | 5 | 15,
                    })
                  }
                  className="bg-transparent"
                >
                  <option value={0}>Manual only</option>
                  <option value={1}>1 minute</option>
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {secMsg && <p className="text-xs text-[#74A892]">{secMsg}</p>}
      </section>

      {/* Transparency & Data Management */}
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] p-6 space-y-4">
        <h2 className="font-display text-lg font-medium text-[#18191D] dark:text-[#EAE7E1]">
          Privacy Transparency & Data Controls
        </h2>
        <p className="text-xs text-[#646975] dark:text-[#9CA0AA] leading-relaxed">
          Local vs. Remote Processing: Your mood entries, goals, offline games, and saved memories live locally in your browser storage. When you send a message or request an AI mood reflection, that prompt and consented context are transmitted over HTTPS to Google’s Gemini API via the backend server to generate a reply. Because AI inference happens remotely, conversations are not end-to-end encrypted during model inference.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportAll}
            className="min-h-[40px] px-4 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export All Data (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmWipe('moods')}
            className="min-h-[40px] px-4 rounded-xl border border-black/10 dark:border-white/10 text-xs text-rose-500 cursor-pointer"
          >
            Clear Mood History
          </button>

          <button
            type="button"
            onClick={() => setConfirmWipe('memories')}
            className="min-h-[40px] px-4 rounded-xl border border-black/10 dark:border-white/10 text-xs text-rose-500 cursor-pointer"
          >
            Delete All Memories
          </button>

          <button
            type="button"
            onClick={() => setConfirmWipe('account')}
            className="min-h-[40px] px-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs font-medium text-rose-500 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Entire Local Account</span>
          </button>
        </div>

        {confirmWipe !== 'none' && (
          <div className="p-4 rounded-xl border border-rose-500/35 bg-rose-500/8 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-rose-400">
              {confirmWipe === 'account'
                ? 'Erase all conversations, moods, memories, goals, and security settings permanently?'
                : confirmWipe === 'memories'
                  ? 'Delete every saved long-term memory?'
                  : 'Clear all recorded mood check-ins?'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirmWipe === 'moods') onClearMoodHistory();
                  if (confirmWipe === 'memories') onDeleteAllMemories();
                  if (confirmWipe === 'account') onWipeAccount();
                  setConfirmWipe('none');
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium cursor-pointer"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmWipe('none')}
                className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
