-- ============================================================================
-- 59. A member can change their name, at most once every 30 days.
--
-- full_name has always been member-writable (30_revoke_entitlement_writes.sql
-- grants every non-protected column), but the app never offered it. Edit
-- Profile now does, and the limit lives here rather than in the app so a
-- direct API call can't rename an account every few minutes: on a rishta app
-- with CNIC-verified profiles, a name that keeps moving is how someone hides
-- after being reported.
--
--   · name_changed_at   when the member last renamed themselves; null until the
--                       first change, so fixing a typo right after signup is
--                       never blocked. `authenticated` gets no UPDATE on it
--                       (it's added after 30's column grants), and the trigger
--                       pins it for member sessions anyway.
--   · guard trigger     a member's rename inside the window raises
--                       'name_change_too_soon'; the app shows its own line for
--                       that (authService.updateUser).
--   · likes_received    carries a copy of the liker's name (14_likes_received);
--                       a rename refreshes it so the "who liked you" cards
--                       don't keep the old one. Members can't update that
--                       table, hence the definer function.
--
-- Service role / SQL editor renames are not limited and don't move the clock —
-- that's the team correcting a record, not the member.
--
-- Safe to run more than once.
-- ============================================================================

alter table public.profiles add column if not exists name_changed_at timestamptz;

create or replace function public.guard_profile_name_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.name_changed_at := old.name_changed_at;
    if new.full_name is distinct from old.full_name then
      new.full_name := btrim(new.full_name);
    end if;
    if new.full_name is distinct from old.full_name then
      if old.name_changed_at is not null and old.name_changed_at > now() - interval '30 days' then
        raise exception 'name_change_too_soon';
      end if;
      new.name_changed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_name_change on public.profiles;
create trigger guard_profile_name_change
  before update of full_name on public.profiles
  for each row execute function public.guard_profile_name_change();

create or replace function public.sync_liker_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.likes_received
  set name = new.full_name
  where liker_id = new.id::text;
  return null;
end;
$$;

revoke all on function public.sync_liker_name() from public, anon, authenticated;

drop trigger if exists sync_liker_name on public.profiles;
create trigger sync_liker_name
  after update of full_name on public.profiles
  for each row
  when (old.full_name is distinct from new.full_name)
  execute function public.sync_liker_name();
