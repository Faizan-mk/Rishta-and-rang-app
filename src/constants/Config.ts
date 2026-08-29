// App-wide configuration. Environment values come from .env via Expo's
// EXPO_PUBLIC_* convention, which inlines them into the bundle at build time —
// so only public-by-design values belong here (Supabase's RLS and storage
// policies are what protect the data).

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
} as const;

/** Storage buckets — mirrored in supabase/schema.sql. */
export const buckets = {
  public: 'public-media',
  verification: 'private-verification',
} as const;

/** Deep-link scheme, kept in step with `expo.scheme` in app.json. */
export const APP_SCHEME = 'rishtaandrang';

/** Signup collects this many profile photos before the account is created. */
export const MIN_SIGNUP_PHOTOS = 2;
export const MAX_SIGNUP_PHOTOS = 4;
