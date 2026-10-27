import type { BrowseProfile } from '../../types/content';
import type { Intent, ProfileMode, RishtaReadiness, UserProfile } from '../../types/user';
import { activityLevel, isActiveToday } from '../../utils/time';

// Shared shape of the browse controls (Home's Sort and Filters buttons and
// Explore's Filters chip), kept out of the screens so the
// sheet and both screens agree on one definition. The roadmap's V1 manual
// filters — age, city, intent, sect and readiness — plus the trust/activity
// switches, and the matrimonial basics members of Shaadi.com / Muzz / Hinge
// expect to narrow by: height, marital status, education, profession,
// language, nationality, children, relocation, practice, diet, drinking,
// smoking and who is online right now.

export const AGE_FLOOR = 18;
export const AGE_CEILING = 60;
// Wide enough that the defaults filter nobody out; Edit Profile accepts 100–250.
export const HEIGHT_FLOOR_CM = 140;
export const HEIGHT_CEILING_CM = 200;
export const HEIGHT_STEP_CM = 5;

export type MaritalStatus = NonNullable<UserProfile['maritalStatus']>;

// "Newest" is the order the deck already arrives in (discoveryService orders
// by created_at), so it costs nothing and stays the default. "Best match" uses
// the same score the match card shows (utils/compatibility).
export type BrowseSort = 'newest' | 'bestMatch' | 'recentlyActive' | 'youngest' | 'oldest';

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
  heightMin: number;
  heightMax: number;
  maritalStatus: MaritalStatus | null;
  education: string | null;
  jobTitle: string | null;
  language: string | null;
  nationality: string | null;
  noChildren: boolean;
  openToRelocate: boolean;
  halalOnly: boolean;
  nonDrinkersOnly: boolean;
  onlineNow: boolean;
  practisingOnly: boolean;
  nonSmokersOnly: boolean;
  sort: BrowseSort;
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
  heightMin: HEIGHT_FLOOR_CM,
  heightMax: HEIGHT_CEILING_CM,
  maritalStatus: null,
  education: null,
  jobTitle: null,
  language: null,
  nationality: null,
  noChildren: false,
  openToRelocate: false,
  halalOnly: false,
  nonDrinkersOnly: false,
  onlineNow: false,
  practisingOnly: false,
  nonSmokersOnly: false,
  sort: 'newest',
};

export function heightFiltered(filters: BrowseFilters): boolean {
  return filters.heightMin !== HEIGHT_FLOOR_CM || filters.heightMax !== HEIGHT_CEILING_CM;
}

// How many filters differ from the defaults — drives the count on the Filters
// button. The sort isn't one: it has its own button (HomeTopBar's sortActive).
// Sect and readiness only ever filter the Rishta deck (see HomeScreen's
// visibleProfiles), so counting them on the Friends side would show an "active"
// badge for a filter that isn't actually doing anything to that deck.
// Without a mode (Home's mixed deck) they always count.
export function countActiveFilters(filters: BrowseFilters, mode?: ProfileMode): number {
  let count = 0;
  if (filters.ageMin !== AGE_FLOOR || filters.ageMax !== AGE_CEILING) count += 1;
  if (filters.city) count += 1;
  if (filters.intent) count += 1;
  if (mode !== 'dating' && filters.sect) count += 1;
  if (mode !== 'dating' && filters.readiness) count += 1;
  if (filters.verifiedOnly) count += 1;
  if (filters.activeToday) count += 1;
  if (heightFiltered(filters)) count += 1;
  if (filters.maritalStatus) count += 1;
  if (filters.education) count += 1;
  if (filters.jobTitle) count += 1;
  if (filters.language) count += 1;
  if (filters.nationality) count += 1;
  if (filters.noChildren) count += 1;
  if (filters.openToRelocate) count += 1;
  if (filters.halalOnly) count += 1;
  if (filters.nonDrinkersOnly) count += 1;
  if (filters.onlineNow) count += 1;
  if (filters.practisingOnly) count += 1;
  if (filters.nonSmokersOnly) count += 1;
  return count;
}

/**
 * The filters, run client-side over whatever pages have been fetched. A
 * profile that never filled a field in doesn't pass a filter on that field:
 * "5'6" and up" shouldn't show someone whose height is unknown.
 */
export function applyBrowseFilters<P extends BrowseProfile>(profiles: P[], filters: BrowseFilters): P[] {
  const city = filters.city?.toLowerCase();
  const sect = filters.sect?.toLowerCase();
  const education = filters.education?.toLowerCase();
  const jobTitle = filters.jobTitle?.toLowerCase();
  const language = filters.language?.toLowerCase();
  const nationality = filters.nationality?.toLowerCase();
  const byHeight = heightFiltered(filters);
  return profiles.filter((p) => {
    if (p.age < filters.ageMin || p.age > filters.ageMax) return false;
    if (city && p.city?.toLowerCase() !== city) return false;
    if (filters.intent && p.intent !== filters.intent) return false;
    if (sect && p.sect?.toLowerCase() !== sect) return false;
    if (filters.readiness && p.readiness !== filters.readiness) return false;
    if (filters.verifiedOnly && !(p.selfieVerified || p.bureauVerified)) return false;
    if (filters.activeToday && !isActiveToday(p.lastActiveAt)) return false;
    if (byHeight && (p.heightCm === undefined || p.heightCm < filters.heightMin || p.heightCm > filters.heightMax)) return false;
    if (filters.maritalStatus && p.maritalStatus !== filters.maritalStatus) return false;
    // Rishta signup writes `education`, Edit Profile writes `educationLevel`.
    if (education && p.educationLevel?.toLowerCase() !== education && p.education?.toLowerCase() !== education) return false;
    if (jobTitle && p.jobTitle?.toLowerCase() !== jobTitle) return false;
    if (language && !p.languages?.some((l) => l.toLowerCase() === language)) return false;
    if (nationality && p.nationality?.toLowerCase() !== nationality) return false;
    if (filters.noChildren && p.hasChildren !== false) return false;
    if (filters.openToRelocate && p.openToRelocate !== true) return false;
    if (filters.halalOnly && p.halalOnly !== true) return false;
    if (filters.nonDrinkersOnly && p.drinking !== false) return false;
    // Same rule as the card's "Online" badge, so the two never disagree.
    if (filters.onlineNow && activityLevel(p.lastActiveAt, p.isOnline) !== 'online') return false;
    if (filters.practisingOnly && p.practising !== true) return false;
    if (filters.nonSmokersOnly && p.smoking !== false) return false;
    return true;
  });
}

function time(iso?: string): number {
  return iso ? new Date(iso).getTime() : 0;
}

/**
 * Orders profiles by a non-default sort; 'newest' keeps the order they came in.
 * 'bestMatch' needs the viewer's score for each profile, so the screen that
 * knows the viewer passes it in; without it that sort is left as it came.
 */
export function compareBySort<P extends BrowseProfile>(
  sort: BrowseSort,
  scoreOf?: (p: P) => number
): ((a: P, b: P) => number) | null {
  switch (sort) {
    case 'bestMatch':
      return scoreOf ? (a, b) => scoreOf(b) - scoreOf(a) : null;
    case 'recentlyActive':
      return (a, b) => time(b.lastActiveAt) - time(a.lastActiveAt);
    case 'youngest':
      return (a, b) => a.age - b.age;
    case 'oldest':
      return (a, b) => b.age - a.age;
    default:
      return null;
  }
}

/** Centimetres as the feet-and-inches people in Pakistan actually say. */
export function feetInches(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
}

export const SORT_OPTIONS: { key: BrowseSort; labelKey: string }[] = [
  { key: 'newest', labelKey: 'discover.sortNewest' },
  { key: 'bestMatch', labelKey: 'discover.sortBestMatch' },
  { key: 'recentlyActive', labelKey: 'discover.sortRecentlyActive' },
  { key: 'youngest', labelKey: 'discover.sortYoungest' },
  { key: 'oldest', labelKey: 'discover.sortOldest' },
];

export const MARITAL_OPTIONS: { key: MaritalStatus; labelKey: string }[] = [
  { key: 'single', labelKey: 'attributes.maritalStatusSingle' },
  { key: 'divorced', labelKey: 'attributes.maritalStatusDivorced' },
  { key: 'widowed', labelKey: 'attributes.maritalStatusWidowed' },
];

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
