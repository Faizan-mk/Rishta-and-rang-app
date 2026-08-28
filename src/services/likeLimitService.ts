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

async function setState(profileId: string, next: DailyLikeState): Promise<void> {
  const { error } = await supabase
    .from('daily_likes')
    .upsert({ id: profileId, date: next.date, count: next.count }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export const likeLimitService = { fetchState, setState };