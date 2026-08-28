import { supabase } from './supabase';

// A member's profile-boost wallet: how many boosts they still hold, and when the
// running one (if any) expires. Owner-only, like the daily-like counter.
export interface BoostState {
  boostsLeft: number;
  // ISO timestamp, or null when no boost is running.
  activeUntil: string | null;
}

interface BoostRow {
  boosts_left: number | null;
  active_until: string | null;
}

async function fetchState(profileId: string): Promise<BoostState | null> {
  const { data, error } = await supabase
    .from('boost_state')
    .select('boosts_left, active_until')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as BoostRow;
  return {
    boostsLeft: typeof row.boosts_left === 'number' ? row.boosts_left : 0,
    activeUntil: typeof row.active_until === 'string' ? row.active_until : null,
  };
}

async function setState(profileId: string, next: BoostState): Promise<void> {
  const { error } = await supabase
    .from('boost_state')
    .upsert({ id: profileId, boosts_left: next.boostsLeft, active_until: next.activeUntil }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export const boostService = { fetchState, setState };