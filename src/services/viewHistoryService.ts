import { supabase } from './supabase';
import type { ViewedProfile } from '../types/content';

const MAX_HISTORY = 60;

interface ViewHistoryRow {
  viewed_id: string;
  kind: ViewedProfile['kind'];
  name: string;
  age: number;
  city: string;
  photo: string;
  viewed_at: string;
}

function mapEntry(row: ViewHistoryRow): ViewedProfile {
  return { id: row.viewed_id, kind: row.kind, name: row.name, age: row.age, city: row.city, photo: row.photo, viewedAt: row.viewed_at };
}

async function fetchHistory(profileId: string): Promise<ViewedProfile[]> {
  const { data, error } = await supabase
    .from('view_history')
    .select('viewed_id, kind, name, age, city, photo, viewed_at')
    .eq('profile_id', profileId)
    .order('viewed_at', { ascending: false })
    .limit(MAX_HISTORY)
    .returns<ViewHistoryRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapEntry);
}

async function recordView(profileId: string, profile: Omit<ViewedProfile, 'viewedAt'>): Promise<void> {
  const { error } = await supabase.from('view_history').upsert(
    {
      profile_id: profileId,
      viewed_id: profile.id,
      kind: profile.kind,
      name: profile.name,
      age: profile.age,
      city: profile.city,
      photo: profile.photo,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,viewed_id' }
  );
  if (error) throw error;

  // Keep only the most recent MAX_HISTORY rows for this user.
  const { data: overflow } = await supabase
    .from('view_history')
    .select('viewed_id')
    .eq('profile_id', profileId)
    .order('viewed_at', { ascending: false })
    .range(MAX_HISTORY, MAX_HISTORY + 500)
    .returns<{ viewed_id: string }[]>();
  if (overflow?.length) {
    await supabase
      .from('view_history')
      .delete()
      .eq('profile_id', profileId)
      .in('viewed_id', overflow.map((r) => r.viewed_id));
  }
}

async function clearHistory(profileId: string): Promise<void> {
  const { error } = await supabase.from('view_history').delete().eq('profile_id', profileId);
  if (error) throw error;
}

export const viewHistoryService = { fetchHistory, recordView, clearHistory };
