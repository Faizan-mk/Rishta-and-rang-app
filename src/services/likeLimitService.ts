import { supabase } from './supabase';

interface DailyLikeState {
  date: string;
  count: number;
}

interface DailyLikesRow {
  date: string;
  count: number;
}

async function fetchState(profileId: string): Promise<DailyLikeState | null> {
  const { data, error } = await supabase
    .from('daily_likes')
    .select('date, count')
    .eq('profile_id', profileId)
    .maybeSingle<DailyLikesRow>();
  if (error) throw error;
  return data ? { date: data.date, count: data.count } : null;
}

async function setState(profileId: string, next: DailyLikeState): Promise<void> {
  const { error } = await supabase
    .from('daily_likes')
    .upsert({ profile_id: profileId, date: next.date, count: next.count }, { onConflict: 'profile_id' });
  if (error) throw error;
}

export const likeLimitService = { fetchState, setState };
export type { DailyLikeState };
