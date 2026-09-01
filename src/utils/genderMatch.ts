import type { Gender } from '../types/user';

// Straight matching for V1, and the single source of truth for who a member can
// browse — the Supabase query in discoveryService filters on the same list so a
// row that reaches a screen was already the right gender when it left the table.
//
//   male   -> female listings
//   female -> male listings
//   other  -> both male and female listings
//
// 'other' rows are never listed to anyone: the only accounts carrying that gender
// besides self-identified members are login's placeholder rows (see authService),
// which hold no member-entered detail and are not browsable content.
export function targetGenders(viewerGender?: Gender): Gender[] {
  if (viewerGender === 'male') return ['female'];
  if (viewerGender === 'female') return ['male'];
  return ['male', 'female'];
}

export function oppositeGenderProfiles<T extends { gender: Gender }>(profiles: T[], viewerGender?: Gender): T[] {
  const targets = targetGenders(viewerGender);
  return profiles.filter((p) => targets.includes(p.gender));
}
