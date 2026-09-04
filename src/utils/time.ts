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

/**
 * The calendar day an instant falls on, in the reader's own timezone.
 *
 * Deliberately built from the local parts rather than sliced off the ISO
 * string: `sentAt` is UTC, so `iso.slice(0, 10)` would put anything sent after
 * 5am PKT on the wrong day for a Pakistani reader — and put the day separator
 * in the wrong place with it.
 */
export function dayKey(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** True when the two instants fall on the same local day. */
export function sameDay(a: string, b: string): boolean {
  const keyA = dayKey(a);
  return keyA !== '' && keyA === dayKey(b);
}

/**
 * "Today", "Yesterday", or the date itself — the label on a chat's day divider.
 *
 * A bubble only carries a clock time, so without this a message from last week
 * at 12:48 reads exactly like one from this morning at 12:48. The year is
 * dropped within the current one, where it says nothing.
 */
export function dayLabel(isoDate: string, t: Translate): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const key = dayKey(isoDate);
  if (key === dayKey(now.toISOString())) return t('chat.today');

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === dayKey(yesterday.toISOString())) return t('chat.yesterday');

  const params = { day: date.getDate(), month: t(`calendar.month${date.getMonth()}`), year: date.getFullYear() };
  return date.getFullYear() === now.getFullYear() ? t('chat.dateShort', params) : t('chat.dateFull', params);
}
