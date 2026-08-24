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
  return { id: row.target_id, kind: row.kind, name: row.name, age: row.age, city: row.city, photo: row.photo };
}

async function fetchFavorites(profileId: string): Promise<FavoriteProfile[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('target_id, kind, name, age, city, photo')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .returns<FavoriteRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapFavorite);
}

async function addFavorite(profileId: string, profile: FavoriteProfile): Promise<void> {
  const { error } = await supabase.from('favorites').upsert(
    {
      profile_id: profileId,
      target_id: profile.id,
      kind: profile.kind,
      name: profile.name,
      age: profile.age,
      city: profile.city,
      photo: profile.photo,
    },
    { onConflict: 'profile_id,target_id' }
  );
  if (error) throw error;
}

async function removeFavorite(profileId: string, targetId: string): Promise<void> {
  const { error } = await supabase.from('favorites').delete().eq('profile_id', profileId).eq('target_id', targetId);
  if (error) throw error;
}

export const favoritesService = { fetchFavorites, addFavorite, removeFavorite };
