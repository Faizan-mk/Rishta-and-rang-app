import { supabase } from './supabase';

export interface DailyLikeState {
  date: string;
  count: number;
}

interface DailyLikeRow {
  date: string;
  count: number;
}

async function fetchState(profileId: string): Promise<DailyLikeState | null> {
  const { data, error } = await supabase.from('daily_likes').select('date, count').eq('id', profileId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as DailyLikeRow;
  return { date: row.date, count: row.count };
}

// There is no `setState` any more. Since supabase/29_entitlements.sql the
// counter has no insert or update policy: it is written inside `like_profile`,
// which is the only place a like is actually recorded, so the cap cannot be
// lifted by writing `count = 0`. This service reads it, and nothing else.
export const likeLimitService = { fetchState };