-- ============================================================================
-- 65. Taking back a like.
--
-- The app withdrew a like by deleting its own rows (likes, likes_received)
-- straight from the client. That left the other member's "X liked your
-- profile" notification behind, and if that like had used one of their three
-- free trials (61), the trial was gone for a like that no longer existed.
--
-- withdraw_like does the whole thing in one place:
--   · the like and the "who liked you" card go
--   · the like notification sent to them goes, and the liker's own
--     "interest sent" row about them
--   · the trial it used, if any, is given back
--
-- A like that already made a match is not withdrawn: that is a conversation
-- now, and ending it is unmatch / block. The day's like count is not refunded
-- either, or like-and-take-back would get round the free limit.
--
-- Run after 61_like_reveals.sql. Safe to run more than once.
-- ============================================================================

create or replace function public.withdraw_like(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if exists (
    select 1 from public.matches m
    where (m.user_a = v_me and m.user_b = p_target)
       or (m.user_a = p_target and m.user_b = v_me)
  ) then
    raise exception 'already_matched';
  end if;

  delete from public.likes l where l.liker_id = v_me and l.target_id = p_target;
  delete from public.likes_received r where r.profile_id = p_target and r.liker_id = v_me::text;
  delete from public.notifications n
  where (n.profile_id = p_target and n.type = 'like' and n.related_id = v_me)
     or (n.profile_id = v_me and n.type = 'like' and n.related_id = p_target);
  delete from public.like_reveals r where r.viewer_id = p_target and r.liker_id = v_me;
end;
$$;

revoke all on function public.withdraw_like(uuid) from public, anon;
grant execute on function public.withdraw_like(uuid) to authenticated;
