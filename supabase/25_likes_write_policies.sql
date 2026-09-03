-- ============================================================================
-- 25. `likes` — let a member take their own like back.
--
-- 24_matching.sql gave `likes` insert-and-read-incoming only, because
-- withdrawing was not a surface at the time. It is: un-favouriting someone in
-- the app calls `withdrawLike`, and re-liking upserts on (liker_id, target_id).
-- Without an update and a delete policy the first silently fails and the second
-- leaves a like behind that can still form a match the member has walked away
-- from.
--
-- Both are scoped to rows the caller wrote. Nobody gains any new read.
--
-- Run after 24_matching.sql.
-- ============================================================================

drop policy if exists "likes_update" on public.likes;
create policy "likes_update" on public.likes
  for update to authenticated
  using (liker_id = auth.uid())
  -- The pair is fixed: an update may change `mode`, never who the like is from
  -- or aimed at.
  with check (
    liker_id = auth.uid()
    and not public.is_blocked_pair(auth.uid(), target_id)
  );

drop policy if exists "likes_delete" on public.likes;
create policy "likes_delete" on public.likes
  for delete to authenticated using (liker_id = auth.uid());
