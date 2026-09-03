import { supabase } from './supabase';
import type { ProfileMode } from '../types/user';

// ---------------------------------------------------------------------------
// Likes, in two tables that answer two different questions.
//
// `likes` (supabase/24_matching.sql) is the canonical intent: liker → target,
// one standing row per pair. Nobody can read their own outgoing likes, so
// "did they like me back?" is never asked from here at all: `like_profile`
// answers it inside the database, where the answer and the match it produces
// cannot come apart.
//
// `likes_received` (supabase/14_likes_received.sql) is the *display* list
// behind Explore+'s "see who liked you". The card details are denormalised into
// it — all of it is public profile data anyway — so the list renders without a
// second lookup per liker.
//
// Both are written by the `like_profile` RPC in one transaction, so a like can
// never land without its match (supabase/27_like_profile.sql). Withdrawing
// clears both: leaving a row in `likes` behind would let a match form out of a
// like the member already took back.
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

/** What the RPC answers with: did this like complete a pair, and which thread. */
export interface LikeOutcome {
  matched: boolean;
  matchId: string | null;
  /** True only on the call that created the match — the cue to celebrate. */
  isNew: boolean;
  /** Free likes left today, as the server counts them; -1 when unlimited. */
  likesLeft: number;
}

/**
 * Likes someone, and matches the two of you if they had already liked back.
 *
 * One call rather than three: the like, the reciprocity check and the match all
 * happen inside the function's transaction, so there is no in-between state
 * where a like landed and its match did not. The liker is always the signed-in
 * member — it is not a parameter, and cannot be forged.
 *
 * The daily cap is counted and enforced in there too, so it rejects with
 * `daily_like_limit_reached` rather than trusting the caller to have checked.
 */
async function likeProfile(targetId: string, mode: ProfileMode): Promise<LikeOutcome> {
  const { data, error } = await supabase.rpc('like_profile', { p_target: targetId, p_mode: mode });
  if (error) throw new Error(error.message);
  // `returns table` comes back as a one-row array.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { matched: boolean; match_id: string | null; is_new: boolean; likes_left: number }
    | undefined;
  return {
    matched: row?.matched === true,
    matchId: row?.match_id ?? null,
    isNew: row?.is_new === true,
    likesLeft: typeof row?.likes_left === 'number' ? row.likes_left : -1,
  };
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

export const likesService = { fetchLikesReceived, likeProfile, withdrawLike };