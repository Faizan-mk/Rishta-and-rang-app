import type { Gender } from '../types/user';

const OPPOSITE: Partial<Record<Gender, Gender>> = { male: 'female', female: 'male' };

// Straight matching for V1: a male account sees female listings and vice versa.
// Accounts with gender 'other' (or no signed-in user yet) see everyone.
export function oppositeGenderProfiles<T extends { gender: Gender }>(profiles: T[], viewerGender?: Gender): T[] {
  const target = viewerGender ? OPPOSITE[viewerGender] : undefined;
  if (!target) return profiles;
  return profiles.filter((p) => p.gender === target);
}
