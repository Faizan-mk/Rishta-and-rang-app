import { supabase } from './supabase';
import type { ProfileMode } from '../types/user';

// ---------------------------------------------------------------------------
// Likes, in two tables that answer two different questions.
//
// `likes` (supabase/24_matching.sql) is the canonical intent: liker → target,
// one standing row per pair. Nobody can read their own outgoing likes, so
// "did they like me back?" is asked through `is_mutual_like`, a yes/no RPC —
// that reciprocity is what lets a `matches` row be written at all.
//
// `likes_received` (supabase/14_likes_received.sql) is the *display* list
// behind Explore+'s "see who liked you". The card details are denormalised into
// it — all of it is public profile data anyway — so the list renders without a
// second lookup per liker.
//
// Every like writes both, and withdrawing clears both: leaving a row in `likes`
// behind would let a match form out of a like the member already took back.
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
  // The canonical row first: it is the one a match is allowed to form from, so
  // if only one of the two writes can land, this is the one that matters.
  const { error: likeError } = await supabase
    .from('likes')
    .upsert(
      { liker_id: liker.id, target_id: targetId, mode: liker.kind },
      { onConflict: 'liker_id,target_id' }
    );
  if (likeError) throw new Error(likeError.message);

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
  const { error: likeError } = await supabase
    .from('likes')
    .delete()
    .eq('liker_id', likerId)
    .eq('target_id', targetId);
  if (likeError) throw new Error(likeError.message);

  const { error } = await supabase
    .from('likes_received')
    .delete()
    .eq('profile_id', targetId)
    .eq('liker_id', likerId);
  if (error) throw new Error(error.message);
}

/**
 * Do these two like each other? Answered by the database rather than by reading
 * `likes`, because outgoing likes are deliberately unreadable — see the RPC in
 * supabase/24_matching.sql.
 */
async function isMutualLike(a: string, b: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_mutual_like', { a, b });
  if (error) throw new Error(error.message);
  return data === true;
}

export const likesService = { fetchLikesReceived, sendLike, withdrawLike, isMutualLike };