import type { UserProfile } from '../types/user';

export function profileCompletion(user: UserProfile): number {
  const checks: boolean[] = [
    user.photos.length >= 2,
    user.bio.trim().length > 0,
    user.selfieVerified,
    user.city.trim().length > 0,
    user.activeMode === 'dating'
      ? user.dating.vibeTags.length > 0
      : Boolean(user.rishta.religion && user.rishta.sect && user.rishta.education),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
