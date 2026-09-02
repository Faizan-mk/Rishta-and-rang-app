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
 * `AppError` is translated; anything else keeps its own message (Supabase's
 * server strings, which we don't author and can't translate) and an error with
 * nothing to say falls back to `fallbackKey`.
 */
export function errorMessage(
  error: unknown,
  t: Translate,
  fallbackKey = 'common.somethingWentWrong'
): string {
  if (error instanceof AppError) return t(error.key, error.params);
  if (error instanceof Error && error.message) return error.message;
  return t(fallbackKey);
}
