import type { SanctuaryVaultData, SecuritySettings } from '../types/companion';

const STORAGE_PLAIN_KEY = 'solace_sanctuary_vault_v1';
const STORAGE_ENC_KEY = 'solace_sanctuary_vault_enc_v1';
const STORAGE_SECURITY_KEY = 'solace_security_settings_v1';

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  lockEnabled: false,
  pinHash: null,
  pinSalt: null,
  encryptionSalt: null,
  biometricEnabled: false,
  biometricCredentialId: null,
  lockPrivateJournal: false,
  autoLockMinutes: 5,
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSaltB64(length = 16): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return toBase64(arr);
}

async function deriveKeyFromPin(pin: string, saltB64: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveKey',
    'deriveBits',
  ]);
  const saltBytes = fromBase64(saltB64);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: 150000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

export async function hashPin(pin: string, saltB64: string): Promise<string> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const saltBytes = fromBase64(saltB64);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: 150000,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );
  return toBase64(new Uint8Array(bits));
}

export async function verifyPin(pin: string, security: SecuritySettings): Promise<boolean> {
  if (!security.pinHash || !security.pinSalt) return false;
  const candidate = await hashPin(pin, security.pinSalt);
  return candidate === security.pinHash;
}

export async function encryptVaultData(
  data: SanctuaryVaultData,
  pin: string,
  encryptionSalt: string
): Promise<string> {
  const key = await deriveKeyFromPin(pin, encryptionSalt, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoded
  );
  return JSON.stringify({
    v: 1,
    iv: toBase64(iv),
    cipher: toBase64(new Uint8Array(cipherBuffer)),
  });
}

export async function decryptVaultData(
  payloadStr: string,
  pin: string,
  encryptionSalt: string
): Promise<SanctuaryVaultData> {
  const payload = JSON.parse(payloadStr) as { v: number; iv: string; cipher: string };
  const key = await deriveKeyFromPin(pin, encryptionSalt, ['decrypt']);
  const iv = fromBase64(payload.iv);
  const cipher = fromBase64(payload.cipher);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipher as BufferSource
  );
  const json = new TextDecoder().decode(plainBuffer);
  return JSON.parse(json) as SanctuaryVaultData;
}

export function loadSecuritySettings(): SecuritySettings {
  try {
    const raw = localStorage.getItem(STORAGE_SECURITY_KEY);
    if (!raw) return DEFAULT_SECURITY_SETTINGS;
    return { ...DEFAULT_SECURITY_SETTINGS, ...(JSON.parse(raw) as Partial<SecuritySettings>) };
  } catch {
    return DEFAULT_SECURITY_SETTINGS;
  }
}

export function saveSecuritySettings(settings: SecuritySettings): void {
  localStorage.setItem(STORAGE_SECURITY_KEY, JSON.stringify(settings));
}

export function loadPlainVault(): SanctuaryVaultData | null {
  try {
    const raw = localStorage.getItem(STORAGE_PLAIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SanctuaryVaultData;
  } catch {
    return null;
  }
}

export function hasEncryptedVault(): boolean {
  return Boolean(localStorage.getItem(STORAGE_ENC_KEY));
}

export function loadEncryptedPayload(): string | null {
  return localStorage.getItem(STORAGE_ENC_KEY);
}

export async function persistVault(
  data: SanctuaryVaultData,
  security: SecuritySettings,
  activePin: string | null
): Promise<void> {
  if (security.lockEnabled && security.encryptionSalt && activePin) {
    const encrypted = await encryptVaultData(data, activePin, security.encryptionSalt);
    localStorage.setItem(STORAGE_ENC_KEY, encrypted);
    localStorage.removeItem(STORAGE_PLAIN_KEY);
  } else {
    localStorage.setItem(STORAGE_PLAIN_KEY, JSON.stringify(data));
  }
}

export function wipeAllVaultStorage(): void {
  localStorage.removeItem(STORAGE_PLAIN_KEY);
  localStorage.removeItem(STORAGE_ENC_KEY);
  localStorage.removeItem(STORAGE_SECURITY_KEY);
}

// Platform Biometric / WebAuthn Passkey helpers (never stores raw biometric data)
export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerBiometricPasskey(userName: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Solace Companion Sanctuary',
      },
      user: {
        id: userId,
        name: userName || 'sanctuary-owner',
        displayName: userName || 'Sanctuary Owner',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Biometric registration was cancelled.');
  }
  return toBase64(new Uint8Array(credential.rawId));
}

export async function verifyBiometricPasskey(credentialIdB64: string): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credId = fromBase64(credentialIdB64);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: credId as BufferSource,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  });

  return Boolean(assertion);
}
