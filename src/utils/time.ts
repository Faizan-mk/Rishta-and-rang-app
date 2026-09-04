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

/**
 * The "Active today" browse filter.
 *
 * Deliberately the same rule as the badge rather than a 24-hour window: a
 * filter labelled "Active today" that returns cards reading "Active yesterday"
 * is broken on its face. Undefined/blank timestamps (demo or legacy records)
 * count as not-active so the filter stays honest.
 */
export function isActiveToday(isoDate?: string): boolean {
  const level = activityLevel(isoDate);
  return level === 'online' || level === 'today';
}

/** Seen within this long counts as "right now" rather than "today". */
const ONLINE_WINDOW_MS = 10 * 60 * 1000;

export type ActivityLevel = 'online' | 'today' | 'yesterday' | 'week';

/**
 * How recently the profile was seen, for the card's activity badge.
 *
 * **Today means today, not "within 24 hours".** Those are different things and
 * the difference is exactly where a badge starts lying: at 9am, someone last
 * seen at 11pm the night before is inside 24 hours, and saying "Active today"
 * about them is wrong in the way a reader would notice if they knew. The day
 * boundaries are real calendar days in the reader's own timezone.
 *
 * **Null past a week** is the other rule worth stating. A green live-dot pill
 * saying "active" over someone last seen in March is the kind of thing that
 * decides whether a person bothers messaging, so beyond a week the badge does
 * not render at all rather than reaching for a vaguer word.
 *
 * `null` is also what an absent or unparseable timestamp gives — which is what a
 * member who has turned "Show when I'm online" off now has
 * (supabase/34_last_active.sql), so their card simply carries no badge.
 */
export function activityLevel(isoDate?: string): ActivityLevel | null {
  if (!isoDate) return null;
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return null;

  // A clock ahead of the server's would otherwise read as "not yet active".
  const elapsed = Date.now() - ts;
  if (elapsed < ONLINE_WINDOW_MS) return 'online';

  const now = new Date();
  const key = dayKey(isoDate);
  if (key === dayKey(now.toISOString())) return 'today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === dayKey(yesterday.toISOString())) return 'yesterday';

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
