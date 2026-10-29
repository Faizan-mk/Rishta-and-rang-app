-- ============================================================================
-- 67. Old "Interest sent" notifications: link them, then clear the stale ones.
--
-- Before the app started saving who an "Interest sent" row is about, those
-- rows held only the text ("Romaisa will be notified…"). Every like
-- notification the server writes has related_id set (44), so a 'like' row
-- without one is one of these. Each is linked to the member whose name its
-- text carries (the longest name that fits, so "Ali Khan" wins over "Ali"),
-- which gives it a photo and lets 66's rule apply: one whose like no longer
-- exists, and was never a match, is deleted.
--
-- Run after 66_clean_withdrawn_like_notifications.sql. Safe to run more than once.
-- ============================================================================

update public.notifications n
set related_id = (
  select p.id
  from public.profiles p
  where p.id <> n.profile_id
    and coalesce(p.full_name, '') <> ''
    and position(p.full_name in n.body) > 0
  order by length(p.full_name) desc
  limit 1
)
where n.type = 'like'
  and n.related_id is null;

delete from public.notifications n
where n.type = 'like'
  and n.related_id is not null
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
