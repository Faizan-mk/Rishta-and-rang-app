// The CNIC hash behind supabase/56_cnic_unique.sql's cnic_registry. Shared by
// auth-otp (signup) and cnic (check / claim / backfill), so both always agree
// on what "the same CNIC" means.
//
// Keyed with CNIC_SECRET, which must never change once set: every stored hash
// is made with it, so a new secret would make every registered CNIC look free.

/** The 13 digits, or null for anything that isn't a CNIC. Dashes optional. */
export function cnicDigits(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\d{5}-?\d{7}-?\d$/.test(trimmed)) return null;
  return trimmed.replace(/-/g, '');
}

/** 12345-1234567-1 — the form the app shows and profile_verification stores. */
export function cnicDisplay(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

let key: Promise<CryptoKey> | null = null;

export function cnicSecret(): string {
  const secret = Deno.env.get('CNIC_SECRET') ?? '';
  if (!secret) throw new Error('CNIC_SECRET is not set');
  return secret;
}

export async function cnicHash(digits: string): Promise<string> {
  key ??= crypto.subtle.importKey('raw', new TextEncoder().encode(cnicSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', await key, new TextEncoder().encode(`cnic:${digits}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}
