import type { RishtaReadiness, UserProfile } from '../types/user';

// Readiness values that count as "actually looking". `browsing` is what a new
// account starts on, so it is the one value that does not.
const COMMITTED_READINESS: RishtaReadiness[] = ['few_months', 'ready_now'];

/** Filled in, rather than present-but-blank — spaces are not an answer. */
function filled(value: string | undefined): boolean {
  return Boolean(value && value.trim() !== '');
}

/**
 * Whether this member has filled in the rishta half of their profile.
 *
 * The same four fields `public.rishta_profile_complete` checks
 * (supabase/32_rishta_notifications.sql), for the same reason: a Move to Rishta
 * request asks the other person to consider exactly these, so asking without
 * them is asking them to decide on nothing. The database is what enforces it —
 * this copy is so the button can say so before the round trip, rather than
 * turning a tap into an error message.
 */
export function rishtaProfileComplete(user: UserProfile | null | undefined): boolean {
  if (!user?.rishta) return false;
  const { religion, education, familyBackground, readiness } = user.rishta;
  return (
    filled(religion) &&
    filled(education) &&
    filled(familyBackground) &&
    COMMITTED_READINESS.includes(readiness)
  );
}
