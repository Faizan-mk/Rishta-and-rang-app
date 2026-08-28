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
  return {
    id: row.viewed_id,
    kind: row.kind,
    name: row.name,
    age: row.age,
    city: row.city,
    photo: row.photo,
    viewedAt: row.viewed_at,
  };
}

async function fetchHistory(profileId: string): Promise<ViewedProfile[]> {
  const { data, error } = await supabase
    .from('view_history')
    .select('viewed_id, kind, name, age, city, photo, viewed_at')
    .eq('profile_id', profileId)
    .order('viewed_at', { ascending: false })
    .limit(MAX_HISTORY);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapEntry(row as unknown as ViewHistoryRow));
}

async function recordView(profileId: string, profile: Omit<ViewedProfile, 'viewedAt'>): Promise<void> {
  // Unique on (profile_id, viewed_id), so re-viewing bumps the timestamp on the
  // existing entry instead of adding a duplicate.
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
  if (error) throw new Error(error.message);

  // Trim anything past the newest MAX_HISTORY entries.
  const { data, error: fetchError } = await supabase
    .from('view_history')
    .select('id')
    .eq('profile_id', profileId)
    .order('viewed_at', { ascending: false });
  if (fetchError) throw new Error(fetchError.message);
  const overflow = (data ?? []).slice(MAX_HISTORY).map((row) => row.id);
  if (overflow.length) {
    await supabase.from('view_history').delete().in('id', overflow).eq('profile_id', profileId);
  }
}

async function clearHistory(profileId: string): Promise<void> {
  const { error } = await supabase.from('view_history').delete().eq('profile_id', profileId);
  if (error) throw new Error(error.message);
}

export const viewHistoryService = { fetchHistory, recordView, clearHistory };