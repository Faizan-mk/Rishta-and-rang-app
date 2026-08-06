import type { UserProfile } from '../types/user';
import type { DiscoverProfile, RishtaListingProfile } from '../types/content';
import { ageFromDob } from './date';

function clampScore(score: number): number {
  return Math.max(5, Math.min(99, Math.round(score)));
}

export function datingCompatibility(user: UserProfile, profile: DiscoverProfile): number {
  let score = 30;

  const userAge = ageFromDob(user.dob);
  if (userAge !== null) {
    const diff = Math.abs(userAge - profile.age);
    score += diff <= 3 ? 25 : diff <= 7 ? 15 : diff <= 12 ? 5 : 0;
  }

  if (user.city && profile.city && user.city.toLowerCase() === profile.city.toLowerCase()) {
    score += 20;
  }

  const userTags = new Set(user.dating.vibeTags.map((tag) => tag.toLowerCase()));
  const overlap = profile.vibeTags.filter((tag) => userTags.has(tag.toLowerCase())).length;
  const base = Math.max(userTags.size, profile.vibeTags.length, 1);
  score += Math.round((overlap / base) * 25);

  return clampScore(score);
}

export function rishtaCompatibility(user: UserProfile, profile: RishtaListingProfile): number {
  let score = 30;

  const userAge = ageFromDob(user.dob);
  if (userAge !== null) {
    const diff = Math.abs(userAge - profile.age);
    score += diff <= 3 ? 20 : diff <= 7 ? 10 : 0;
  }

  if (user.city && profile.city && user.city.toLowerCase() === profile.city.toLowerCase()) {
    score += 15;
  }
  if (user.rishta.religion && user.rishta.religion.toLowerCase() === profile.religion.toLowerCase()) {
    score += 20;
  }
  if (user.rishta.sect && user.rishta.sect.toLowerCase() === profile.sect.toLowerCase()) {
    score += 15;
  }

  return clampScore(score);
}
