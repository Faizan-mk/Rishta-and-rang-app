import type { UserProfile } from '../types/user';
import type { BrowseProfile, DiscoverProfile, RishtaListingProfile } from '../types/content';
import { ageFromDob } from './date';

// One comparison drives both the match score and the "things you share" list,
// so the number and the reasons shown under it can never disagree.
//
// It used to weigh only age, city and (Rishta) religion/sect or (Friends) vibe
// tags. Most members fill few of those, so nearly every card scored the same
// 50–55. It now also counts language, education, profession, practice, diet,
// smoking, drinking, nationality and Rishta readiness. A field either side
// left empty simply adds nothing, so a sparse profile scores low rather than
// pretending to match.

function clampScore(score: number): number {
  return Math.max(5, Math.min(99, Math.round(score)));
}

const lc = (s: string | undefined | null) => (s ?? '').trim().toLowerCase();
const same = (a: string | undefined | null, b: string | undefined | null) => Boolean(lc(a)) && lc(a) === lc(b);

/** A shared trait, as a dictionary key and its params, ready for the screen's `t`. */
export interface SharedTrait {
  key: string;
  params?: Record<string, string | number>;
  /** Plain text when there's no sentence to wrap it in (a religion or sect name). */
  text?: string;
}

const READINESS_LABEL: Record<string, string> = {
  browsing: 'profile.readinessBrowsing',
  few_months: 'profile.readinessFewMonths',
  ready_now: 'profile.readinessNow',
};

interface Comparison {
  points: number;
  traits: SharedTrait[];
}

function compare(user: UserProfile, profile: BrowseProfile, mode: 'dating' | 'rishta'): Comparison {
  const rishta = mode === 'rishta';
  let points = 30;
  const traits: SharedTrait[] = [];

  const userAge = ageFromDob(user.dob);
  if (userAge !== null) {
    const diff = Math.abs(userAge - profile.age);
    points += diff <= 3 ? 15 : diff <= 7 ? 8 : diff <= 12 ? 3 : 0;
    if (diff <= 3) traits.push({ key: diff === 0 ? 'discover.similarAgeSame' : 'discover.similarAge', params: { years: diff } });
  }

  if (same(user.city, profile.city)) {
    points += 10;
    traits.push({ key: 'discover.similarCity', params: { city: profile.city } });
  }

  const userLanguages = new Set((user.languages ?? []).map(lc));
  const sharedLanguage = (profile.languages ?? []).find((l) => userLanguages.has(lc(l)));
  if (sharedLanguage) {
    points += 8;
    traits.push({ key: 'discover.similarLanguage', params: { language: sharedLanguage } });
  }

  const theirEducation = profile.educationLevel || profile.education;
  if (same(user.educationLevel, theirEducation)) {
    points += 5;
    traits.push({ key: 'discover.similarEducation', params: { education: theirEducation ?? '' } });
  }

  if (same(user.jobTitle, profile.jobTitle)) {
    points += 3;
    traits.push({ key: 'discover.similarJob', params: { job: profile.jobTitle ?? '' } });
  }

  if (user.practising === true && profile.practising === true) {
    points += rishta ? 8 : 6;
    traits.push({ key: 'discover.similarPractising' });
  }
  if (user.halalOnly === true && profile.halalOnly === true) {
    points += 4;
    traits.push({ key: 'discover.similarHalal' });
  }
  if (user.smoking === false && profile.smoking === false) {
    points += 4;
    traits.push({ key: 'discover.similarNonSmoker' });
  }
  if (user.drinking === false && profile.drinking === false) {
    points += 3;
    traits.push({ key: 'discover.similarNonDrinker' });
  }
  if (same(user.nationality, profile.nationality)) {
    points += 3;
    traits.push({ key: 'discover.similarNationality', params: { nationality: profile.nationality ?? '' } });
  }

  if (rishta) {
    if (same(user.rishta.religion, profile.religion)) {
      points += 12;
      traits.push({ key: '', text: profile.religion });
    }
    if (same(user.rishta.sect, profile.sect)) {
      points += 10;
      traits.push({ key: '', text: profile.sect });
    }
    const readiness = profile.readiness;
    if (readiness && readiness === user.rishta.readiness && readiness !== 'browsing') {
      points += 6;
      traits.push({ key: 'discover.similarReadiness', params: { readiness: READINESS_LABEL[readiness] } });
    }
  } else {
    const userTags = new Set(user.dating.vibeTags.map(lc));
    const theirTags = profile.vibeTags ?? [];
    const shared = theirTags.filter((tag) => userTags.has(lc(tag)));
    const base = Math.max(userTags.size, theirTags.length, 1);
    points += Math.round((shared.length / base) * 15);
    shared.forEach((tag) => traits.push({ key: 'discover.similarTag', params: { tag } }));
  }

  return { points, traits };
}

export function datingCompatibility(user: UserProfile, profile: DiscoverProfile): number {
  return clampScore(compare(user, profile, 'dating').points);
}

export function rishtaCompatibility(user: UserProfile, profile: RishtaListingProfile): number {
  return clampScore(compare(user, profile, 'rishta').points);
}

/** What the viewer and this profile have in common, for the "things you share" card. */
export function sharedTraits(user: UserProfile, profile: BrowseProfile, mode: 'dating' | 'rishta'): SharedTrait[] {
  return compare(user, profile, mode).traits;
}
