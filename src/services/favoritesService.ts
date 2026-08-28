import { supabase } from './supabase';
import type { FavoriteProfile } from '../types/content';

interface FavoriteRow {
  target_id: string;
  kind: FavoriteProfile['kind'];
  name: string;
  age: number;
  city: string;
  photo: string;
}

function mapFavorite(row: FavoriteRow): FavoriteProfile {
  return {
    id: row.target_id,
    kind: row.kind,
    name: row.name,
    age: row.age,
    city: row.city,
    photo: row.photo,
  };
}

async function fetchFavorites(profileId: string): Promise<FavoriteProfile[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('target_id, kind, name, age, city, photo, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapFavorite(row as unknown as FavoriteRow));
}

async function addFavorite(profileId: string, profile: FavoriteProfile): Promise<void> {
  // Unique on (profile_id, target_id), so favouriting twice overwrites rather
  // than stacking duplicates.
  const { error } = await supabase.from('favorites').upsert(
    {
      profile_id: profileId,
      target_id: profile.id,
      kind: profile.kind,
      name: profile.name,
      age: profile.age,
      city: profile.city,
      photo: profile.photo,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,target_id' }
  );
  if (error) throw new Error(error.message);
}

// Patches only `kind`, so a favourite that crosses into Rishta keeps its
// original `created_at` and stays where it was in the list.
async function updateFavoriteKind(profileId: string, targetId: string, kind: FavoriteProfile['kind']): Promise<void> {
  const { error } = await supabase.from('favorites').update({ kind }).eq('profile_id', profileId).eq('target_id', targetId);
  if (error) throw new Error(error.message);
}

async function removeFavorite(profileId: string, targetId: string): Promise<void> {
  const { error } = await supabase.from('favorites').delete().eq('profile_id', profileId).eq('target_id', targetId);
  if (error) throw new Error(error.message);
}

export const favoritesService = { fetchFavorites, addFavorite, updateFavoriteKind, removeFavorite };