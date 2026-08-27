import type { Intent, RishtaReadiness } from '../../types/user';

// Shared shape of the Home deck's browse controls (the Filters and Sort chips in
// the top bar), kept out of the screen so the sheets and the screen agree on one
// definition. The filter set is the roadmap's V1 manual filters — age, city,
// intent, sect and readiness — plus two trust/activity switches.

export type BrowseSortKey =
  | 'recommended'
  | 'bestMatch'
  | 'ageAsc'
  | 'ageDesc'
  | 'nearest'
  | 'freeToChat'
  | 'justJoined'
  | 'active'
  | 'verified'
  | 'completeBio';

export const AGE_FLOOR = 18;
export const AGE_CEILING = 60;

export interface BrowseFilters {
  ageMin: number;
  ageMax: number;
  city: string | null;
  intent: Intent | null;
  // Rishta-mode only — sect and readiness are matrimonial signals.
  sect: string | null;
  readiness: RishtaReadiness | null;
  verifiedOnly: boolean;
  activeToday: boolean;
}

export const DEFAULT_BROWSE_FILTERS: BrowseFilters = {
  ageMin: AGE_FLOOR,
  ageMax: AGE_CEILING,
  city: null,
  intent: null,
  sect: null,
  readiness: null,
  verifiedOnly: false,
  activeToday: false,
};

export const DEFAULT_BROWSE_SORT: BrowseSortKey = 'recommended';

// How many filters differ from the defaults — drives the count on the Filters chip.
export function countActiveFilters(filters: BrowseFilters): number {
  let count = 0;
  if (filters.ageMin !== AGE_FLOOR || filters.ageMax !== AGE_CEILING) count += 1;
  if (filters.city) count += 1;
  if (filters.intent) count += 1;
  if (filters.sect) count += 1;
  if (filters.readiness) count += 1;
  if (filters.verifiedOnly) count += 1;
  if (filters.activeToday) count += 1;
  return count;
}

export const INTENT_OPTIONS: { key: Intent; labelKey: string }[] = [
  { key: 'casual', labelKey: 'intent.casualTitle' },
  { key: 'serious', labelKey: 'intent.seriousTitle' },
  { key: 'matrimonial', labelKey: 'intent.matrimonialTitle' },
];

export const READINESS_OPTIONS: { key: RishtaReadiness; labelKey: string }[] = [
  { key: 'browsing', labelKey: 'profile.readinessBrowsing' },
  { key: 'few_months', labelKey: 'profile.readinessFewMonths' },
  { key: 'ready_now', labelKey: 'profile.readinessNow' },
];

// Row order of the Sort sheet.
export const SORT_OPTIONS: { key: BrowseSortKey; labelKey: string }[] = [
  { key: 'recommended', labelKey: 'discover.sortRecommended' },
  { key: 'bestMatch', labelKey: 'discover.sortBestMatch' },
  { key: 'ageAsc', labelKey: 'discover.sortAgeAsc' },
  { key: 'ageDesc', labelKey: 'discover.sortAgeDesc' },
  { key: 'nearest', labelKey: 'discover.sortNearest' },
  { key: 'freeToChat', labelKey: 'discover.sortFreeToChat' },
  { key: 'justJoined', labelKey: 'discover.sortJustJoined' },
  { key: 'active', labelKey: 'discover.sortActiveFirst' },
  { key: 'verified', labelKey: 'discover.sortVerified' },
  { key: 'completeBio', labelKey: 'discover.sortCompleteBio' },
];
