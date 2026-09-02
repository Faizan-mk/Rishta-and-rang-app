import type { Translate } from '../i18n';

/**
 * "3h ago", in whichever language is live. Callers pass their screen's `t` —
 * the unit words and their order differ per language, so the whole phrase has
 * to come out of the dictionary rather than a number with a suffix glued on.
 */
export function timeAgo(isoDate: string, t: Translate): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('time.daysAgo', { count: days });
  const weeks = Math.floor(days / 7);
  return t('time.weeksAgo', { count: weeks });
}

// True when the profile was seen within the last 24h. Undefined/blank timestamps
// (demo or legacy records) count as not-active so the badge stays honest.
export function isActiveToday(isoDate?: string): boolean {
  if (!isoDate) return false;
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < 24 * 60 * 60 * 1000;
}

// How recently the profile was seen, for the card's activity badge. Undefined or
// unparseable timestamps return null so the badge simply doesn't render.
export function activityLevel(isoDate?: string): 'today' | 'week' | null {
  if (!isoDate) return null;
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return null;
  const elapsed = Date.now() - ts;
  if (elapsed < 24 * 60 * 60 * 1000) return 'today';
  if (elapsed < 7 * 24 * 60 * 60 * 1000) return 'week';
  return null;
}
