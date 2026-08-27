export function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
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
