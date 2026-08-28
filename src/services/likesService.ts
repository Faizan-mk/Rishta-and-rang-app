import { supabase } from './supabase';
import type { ProfileMode } from '../types/user';

// ---------------------------------------------------------------------------
// "See who liked you" — the paid half of Explore+.
//
// A member's own favourites live in the `favorites` table, which nobody else
// can read. So a like is mirrored onto the *target*: a `likes_received` row
// owned by them. RLS lets the liker create and delete only their own row
// (liker_id = auth.uid()), and only the owner read the list (see supabase/14_likes_received.sql).
//
// The card details are denormalised into the row — all of it is public profile
// data anyway — so the list renders without a second lookup per liker.
// ---------------------------------------------------------------------------

export interface LikeReceived {
  id: string;
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
  likedAt: string;
}

interface LikeRow {
  liker_id: string;
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
  created_at: string;
}

async function fetchLikesReceived(profileId: string): Promise<LikeReceived[]> {
  const { data, error } = await supabase
    .from('likes_received')
    .select('liker_id, kind, name, age, city, photo, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const entry = row as unknown as LikeRow;
    return {
      id: entry.liker_id,
      kind: entry.kind,
      name: entry.name,
      age: entry.age,
      city: entry.city,
      photo: entry.photo,
      likedAt: entry.created_at,
    };
  });
}

async function sendLike(targetId: string, liker: Omit<LikeReceived, 'likedAt'>): Promise<void> {
  // Upsert keyed on (profile_id, liker_id), so re-liking overwrites the row.
  const { error } = await supabase.from('likes_received').upsert(
    {
      profile_id: targetId,
      liker_id: liker.id,
      kind: liker.kind,
      name: liker.name,
      age: liker.age,
      city: liker.city,
      photo: liker.photo,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,liker_id' }
  );
  if (error) throw new Error(error.message);
}

async function withdrawLike(targetId: string, likerId: string): Promise<void> {
  const { error } = await supabase
    .from('likes_received')
    .delete()
    .eq('profile_id', targetId)
    .eq('liker_id', likerId);
  if (error) throw new Error(error.message);
}

export const likesService = { fetchLikesReceived, sendLike, withdrawLike };