-- ============================================================================
-- 55. Security hardening from the full-app review.
--
-- 1. moderate_profile was callable by any member. 21_reports.sql revoked it
--    from `authenticated` and `anon`, but Postgres grants EXECUTE on every new
--    function to PUBLIC, and both roles inherit from PUBLIC, so the revoke did
--    nothing: one RPC call could hide any profile (or un-hide a reported one)
--    and rewrite its reports' status. Revoked from PUBLIC now, and the function
--    refuses a member's session outright in case a grant ever comes back.
--
-- 2. is_blocked_pair / is_mutual_like / are_connected answered for any two
--    people. Meant for policies, where the caller is always one of the pair,
--    but callable as RPCs with any ids: "has A blocked B?", "did A and B like
--    each other?", "are A and B matched?" for strangers. They now only answer
--    for a pair the caller belongs to (and fully for service role and
--    database-internal calls, where there is no member session).
--
-- 3. chat_messages had an update policy that let a sender rewrite any column
--    of their own message: its text after it was read, its photo URL, or its
--    match_id, moving it into a conversation they are not part of (the insert
--    policy checks membership; update never did). The app never edits a
--    message, so the policy goes.
--
-- 4. likes_received could be written directly. It is the denormalised "who
--    liked you" card (name, age, city, photo), filled in by like_profile /
--    send_profile_note, which run as the owner. The member insert/update
--    policies let anyone post a card under their own id carrying someone
--    else's name and photo. Members keep delete (withdrawing a like).
--
-- Safe to run more than once.
-- ============================================================================

-- 1 ---------------------------------------------------------------------------

create or replace function public.moderate_profile(
  p_target_id uuid,
  p_hidden boolean,
  p_status text default 'reviewing'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Studio's SQL editor and the service role have no member session; a
  -- member's (or a visitor's) JWT does.
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'not_allowed';
  end if;

  update public.profiles
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end,
      hidden_reason = case when p_hidden then 'manual:review' else null end
  where id = p_target_id;

  update public.reports
  set status = p_status
  where target_id = p_target_id and status in ('pending', 'reviewing');
end;
$$;

revoke all on function public.moderate_profile(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.moderate_profile(uuid, boolean, text) to service_role;

-- 2 ---------------------------------------------------------------------------
-- auth.uid() is null for service-role and internal calls, which keep the full
-- answer. A member only learns about pairs that include themselves; for any
-- other pair the answer is "no", which every call site already handles — they
-- all pass the caller as one side.

create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (
       select 1 from public.blocked_users bu
       where (bu.profile_id = a and bu.blocked_user_id = b)
          or (bu.profile_id = b and bu.blocked_user_id = a)
     );
$$;

create or replace function public.is_mutual_like(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (select 1 from public.likes l where l.liker_id = a and l.target_id = b)
     and exists (select 1 from public.likes l where l.liker_id = b and l.target_id = a);
$$;

create or replace function public.are_connected(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (
       select 1 from public.matches m
       where m.user_a = least(a, b) and m.user_b = greatest(a, b)
     )
     and not public.is_blocked_pair(a, b);
$$;

revoke all on function public.is_blocked_pair(uuid, uuid) from public, anon;
revoke all on function public.is_mutual_like(uuid, uuid) from public, anon;
revoke all on function public.are_connected(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_mutual_like(uuid, uuid) to authenticated, service_role;
grant execute on function public.are_connected(uuid, uuid) to authenticated, service_role;

-- 3 ---------------------------------------------------------------------------

drop policy if exists "messages_update" on public.chat_messages;

-- 4 ---------------------------------------------------------------------------

drop policy if exists "likes_received_insert" on public.likes_received;
drop policy if exists "likes_received_update" on public.likes_received;
