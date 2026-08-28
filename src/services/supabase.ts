import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Supabase bootstrap.
//
// Config comes from .env (see .env.example):
//   EXPO_PUBLIC_SUPABASE_URL        Supabase Dashboard → Settings → API → Project URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY   Supabase Dashboard → Settings → API → anon public key
//
// Session persistence is pinned to AsyncStorage (the way Firebase pinned it),
// so the sign-in survives reloads on native. On web the URL detection flag is
// harmless to leave off — this app doesn't use magic-link deep links.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const missing = [
  !supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
  !supabaseAnonKey && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
].filter(Boolean);

if (missing.length) {
  throw new Error(
    `Missing Supabase config (${missing.join(', ')}) — set the EXPO_PUBLIC_SUPABASE_* keys in .env and restart the dev server with \`npx expo start -c\`.`
  );
}

// The project's auth service runs a second or two ahead of the API that
// validates the tokens it signs, so a freshly minted token can come back
// rejected as "JWT issued at future" for the first moments of its life — the
// window every call right after sign-in lands in. Waiting for the clocks to
// meet and replaying the request is the whole fix, and it belongs here rather
// than at each call site so reads, writes, RPCs and uploads all get it.
const JWT_NOT_YET_VALID = /jwt issued at future|token used before issued/i;
const CLOCK_SKEW_RETRIES = 3;
const CLOCK_SKEW_WAIT_MS = 1200;

async function fetchWithClockSkewRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response = await fetch(input, init);

  // A stream body is consumed by the first attempt and can't be replayed.
  const replayable = !(init?.body instanceof ReadableStream);

  for (let attempt = 0; attempt < CLOCK_SKEW_RETRIES && replayable; attempt += 1) {
    if (response.status !== 401 && response.status !== 403) break;
    if (!JWT_NOT_YET_VALID.test(await response.clone().text())) break;
    await new Promise((resolve) => setTimeout(resolve, CLOCK_SKEW_WAIT_MS));
    response = await fetch(input, init);
  }

  return response;
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  global: { fetch: fetchWithClockSkewRetry },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export const PUBLIC_BUCKET = 'public-media';
export const VERIFICATION_BUCKET = 'private-verification';

/**
 * Public URL for a path inside the public-media bucket. These URLs are what the
 * app stores in rows (profile photos, chat media) so other members can render
 * them directly.
 */
export function publicMediaUrl(path: string): string {
  return supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}