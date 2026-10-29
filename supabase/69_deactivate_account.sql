-- ============================================================================
-- 69. Deactivate instead of delete: a break of up to 30 days.
--
-- Delete is for good. Deactivate hides the member and keeps everything:
--
--   · deactivate_account() sets deactivated_until to 30 days from now. Until
--     then the profile is out of Home, Explore and "who liked you" for
--     everyone except people they've matched with (so those chats still have
--     a name and photo on them).
--   · Signing back in (touch_last_active runs on every open) brings the
--     profile straight back. Past the 30 days it comes back on its own.
--
-- Run after 68_enforce_privacy_switches.sql and 63_delivered_when_online.sql.
-- Safe to run more than once.
-- ============================================================================

alter table public.profiles add column if not exists deactivated_until timestamptz;

create or replace function public.deactivate_account()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := auth.uid();
  v_until timestamptz := now() + interval '30 days';
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles
  set deactivated_until = v_until, is_online = false
  where id = v_me;
  return v_until;
end;
$$;

revoke all on function public.deactivate_account() from public, anon;
grant execute on function public.deactivate_account() to authenticated;

-- Coming back is the heartbeat: the app calls it on every sign-in and open.
create or replace function public.touch_last_active()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return;
  end if;
  update public.profiles set deactivated_until = null
  where id = v_me and deactivated_until is not null;
  perform public.mark_delivered_for(v_me);
  if not public.shows_online_status(v_me) then
    return;
  end if;
  update public.profiles set last_active_at = now(), is_online = true where id = v_me;
end;
$$;

revoke all on function public.touch_last_active() from public;
grant execute on function public.touch_last_active() to authenticated;

-- 68's visibility rule, with deactivation on top: while it lasts only a match
-- can see them.
create or replace function public.profile_visible_to(p_profile uuid, p_viewer uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_profile = p_viewer
    or case
      when coalesce((select p.deactivated_until > now() from public.profiles p where p.id = p_profile), false)
        then exists (
          select 1 from public.matches m
          where (m.user_a = p_profile and m.user_b = p_viewer) or (m.user_a = p_viewer and m.user_b = p_profile)
        )
      else coalesce((select pp.profile_visible from public.privacy_prefs pp where pp.id = p_profile), true)
        or public.has_connection(p_profile, p_viewer)
    end;
$$;

-- "Who liked you" is its own table; a deactivated liker leaves it too.
drop policy if exists "likes_received_select" on public.likes_received;
create policy "likes_received_select" on public.likes_received
  for select to authenticated
  using (
    profile_id = auth.uid()
    and not exists (
      select 1 from public.profiles p
      where p.id::text = likes_received.liker_id and p.deactivated_until > now()
    )
  );
