-- ============================================================================
-- 66. Clear out like notifications for likes that no longer exist.
--
-- Likes taken back before 65_withdraw_like.sql (or before its latest version)
-- left their notifications behind on both sides: "X liked your profile" for
-- the one who was liked, and "Interest sent to X" for the one who liked. The
-- like is gone, so these point at nothing. A pair that has matched keeps its
-- rows: that like did happen.
--
-- One-off tidy-up. Safe to run more than once.
-- ============================================================================

delete from public.notifications n
where n.type = 'like'
  and n.related_id is not null
  -- "Interest sent" (mine, about them) and "liked your profile" (theirs, about me)
  and not exists (
    select 1 from public.likes l
    where (l.liker_id = n.profile_id and l.target_id = n.related_id)
       or (l.liker_id = n.related_id and l.target_id = n.profile_id)
  )
  and not exists (
    select 1 from public.matches m
    where (m.user_a = n.profile_id and m.user_b = n.related_id)
       or (m.user_a = n.related_id and m.user_b = n.profile_id)
  );
