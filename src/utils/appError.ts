import type { Translate } from '../i18n';

/**
 * An error whose message is a translation key rather than finished English.
 *
 * Services run outside React, so they can't reach `useLanguage`. Throwing the
 * key and resolving it at the screen keeps authored copy in the dictionaries —
 * without it, every service-side message renders in English no matter which
 * language the member picked.
 */
export class AppError extends Error {
  readonly key: string;
  readonly params?: Record<string, string | number>;

  constructor(key: string, params?: Record<string, string | number>) {
    super(key);
    this.name = 'AppError';
    this.key = key;
    this.params = params;
  }
}

/**
 * Turns whatever a `catch` caught into a line to put in front of the member.
 *
 * `AppError` is translated; anything else falls back to `fallbackKey`. Raw
 * errors are Supabase/Postgres server strings ("new row violates row-level
 * security policy for table …", constraint and column names), which leak the
 * schema and mean nothing to a member, so they only go to the dev console.
 */
export function errorMessage(
  error: unknown,
  t: Translate,
  fallbackKey = 'common.somethingWentWrong'
): string {
  if (error instanceof AppError) return t(error.key, error.params);
  // The one server word worth its own line: the database's rate-limit
  // triggers (supabase/53_rate_limits.sql) raise exactly this.
  if (error instanceof Error && error.message.includes('rate_limited')) return t('common.tooManyRequests');
  if (__DEV__) console.warn('[error]', error);
  return t(fallbackKey);
}
