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

/** Support inbox — also the contact address printed in the legal documents. */
export const SUPPORT_EMAIL = 'support@rishtaandrang.app';

/**
 * Where the hosted Privacy Policy and Terms of Service live.
 *
 * The app carries the full text of both (see the Legal screen), but the app
 * stores require a public URL for each, and the signup consent line has to
 * point somewhere a person can read before they agree. Set these per build via
 * .env; `supabase/19_legal_docs.sql` creates the bucket the default URLs point
 * at, and `docs/legal/` holds the pages to upload.
 */
export const LEGAL_URLS = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '',
  terms: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
} as const;
