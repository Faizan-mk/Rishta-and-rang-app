-- ============================================================================
-- 35. Blocking keeps the thread instead of deleting it.
--
-- Until now the client's "block" both inserted the block row and deleted the
-- `matches` row outright (see `blockMatch` in MatchesContext.tsx), so
-- unblocking someone in Settings > Blocked users could never lead back to the
-- conversation — the row, and with it the whole message history, was gone.
-- The app now keeps the match; block only stops new messages, which
-- `messages_insert` (supabase/22_block_hardening.sql) already enforces via
-- `is_blocked_pair` with no change needed here.
--
-- What *does* need a change: `profiles_select` refuses a blocked pair's
-- profile row outright, so the counterpart's name/photo in the (now kept)
-- chat header would go blank the moment they're blocked. Loosening
-- `profiles_select` itself for a matched pair would also reopen their full
-- profile-detail screen while blocked, which is a bigger promise to break
-- than "the chat header still shows a name" — `blockConfirmBody` tells the
-- blocker the other person "won't be able to ... see your profile again",
-- and that has to stay true in both directions. This adds a narrow function
-- instead, in the same spirit as `is_blocked_pair`/`match_counterpart`: it
-- hands back only the two display fields a chat row has always shown, and
-- only for a match the caller is actually in.
--
-- Run after 22_block_hardening.sql and 24_matching.sql. Re-runnable.
-- ============================================================================

create or replace function public.match_counterpart_card(p_match_id uuid)
returns table (name text, photo text)
language sql
security definer
set search_path = ''
stable
as $$
  select p.full_name, coalesce(p.photos[1], '')
  from public.matches m
  join public.profiles p
    on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where m.id = p_match_id
    and (m.user_a = auth.uid() or m.user_b = auth.uid());
$$;

revoke all on function public.match_counterpart_card(uuid) from public;
grant execute on function public.match_counterpart_card(uuid) to authenticated;
