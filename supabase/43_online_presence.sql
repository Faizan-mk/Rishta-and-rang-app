-- ============================================================================
-- 43. "Online" means right now, not "within the last ten minutes".
--
-- `last_active_at` (34_last_active.sql) only ever grows more stale — nothing
-- clears it when a member actually leaves, so the badge inferred "online"
-- from "seen recently enough" (a 10-minute window, src/utils/time.ts). That
-- reads correctly for someone still in the app, but it also keeps a member
-- who left thirty seconds ago showing "Online" in someone else's chat header
-- for most of the next ten minutes.
--
-- This adds real presence: `is_online` is set true by the same heartbeat that
-- already stamps `last_active_at`, and set false the moment the app leaves
-- the foreground — a member is "online" for exactly as long as the app is
-- actually in front of them. `last_active_at` keeps doing what it always did
-- (the "today"/"yesterday"/"week" tiers), untouched by this.
--
-- Run after 34_last_active.sql.
-- ============================================================================

alter table public.profiles
  add column if not exists is_online boolean not null default false;

-- ---------------------------------------------------------------------------
-- 1. Coming to the foreground sets both
-- ---------------------------------------------------------------------------

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
  if not public.shows_online_status(v_me) then
    return;
  end if;
  update public.profiles set last_active_at = now(), is_online = true where id = v_me;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Leaving clears only the "right now" half
-- ---------------------------------------------------------------------------

-- No `shows_online_status` gate here on purpose: turning presence *off* is
-- always allowed, even for a member who has "Show when I'm online" disabled
-- (their `is_online` should already be sitting at false, but there is no harm
-- in a redundant write, and every future caller does not have to remember
-- the asymmetry).
create or replace function public.touch_offline()
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
  update public.profiles set is_online = false where id = v_me;
end;
$$;

revoke all on function public.touch_offline() from public;
grant execute on function public.touch_offline() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The privacy switch clears both, same as it always cleared one
-- ---------------------------------------------------------------------------

create or replace function public.clear_last_active_on_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.online_status_visible is false and coalesce(old.online_status_visible, true) is true then
    update public.profiles set last_active_at = null, is_online = false where id = new.id;
  end if;
  return new;
end;
$$;

-- A member with the switch off today should not be sitting on a stale
-- `is_online = true` from before this column existed.
update public.profiles p
set is_online = false
from public.privacy_prefs pp
where pp.id = p.id and pp.online_status_visible is false and p.is_online is true;

-- ---------------------------------------------------------------------------
-- 4. Live, not on the next poll
-- ---------------------------------------------------------------------------

-- `profiles` was never on the realtime publication, so a chat header's
-- "Online" badge could only ever catch up to the truth on its own next poll
-- (up to a minute) or the next time the screen itself was reopened — never
-- the instant the other side's presence actually changed. `replica identity
-- full` is what makes an UPDATE payload carry the whole row rather than just
-- the primary key, same reason 32/26 set it on `notifications`/`match_reads`.
alter table public.profiles replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'profiles'
     )
  then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;
