-- ============================================================================
-- 60. The caller's own outgoing likes, as ids.
--
-- `likes_select` (24_matching.sql) lets a member read only the likes aimed at
-- them, so the app has been inferring "have I liked this person?" from its own
-- `favorites` rows. Those are written separately and best-effort, and can be
-- removed from the Favorites screen without touching the like, so plenty of
-- real likes had no favourite behind them and showed an empty heart.
--
-- This returns only `target_id`s where the caller is the liker: their own
-- actions, nothing about who liked anyone else. The table policy stays as it is.
--
-- Safe to run more than once.
-- ============================================================================

create or replace function public.my_liked_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select l.target_id from public.likes l where l.liker_id = auth.uid();
$$;

revoke all on function public.my_liked_ids() from public, anon;
grant execute on function public.my_liked_ids() to authenticated;
