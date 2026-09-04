-- ============================================================================
-- 34. "Active now" that means it, and that obeys the switch that turns it off.
--
-- Two problems with `profiles.last_active_at` as it stood.
--
--   1. It was written once, on sign-in, by a plain client update. So the badge
--      on a card did not say "this member is around" — it said "this member
--      launched the app at some point", which on a phone that keeps the app
--      resident can be days apart. The finest thing it could honestly support
--      was "this week".
--
--   2. Privacy & safety offers **"Show when I'm online"**, and nothing was
--      reading it. A member could turn it off and carry on broadcasting their
--      last-seen time to every card in the deck. A switch that does nothing is
--      worse than no switch: it is a promise.
--
-- The write moves into a function that checks the preference, and turning the
-- preference off clears what is already there — otherwise the last value would
-- sit on the profile forever, which is the one timestamp a member turning the
-- switch off most wants gone.
--
-- Run after 6_privacy_prefs.sql. Re-runnable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The write, behind the preference
-- ---------------------------------------------------------------------------

-- Definer, and it takes no arguments: the member being stamped is `auth.uid()`
-- and never a parameter, so this cannot be used to mark someone else as active.
-- The preference is read through `shows_online_status`
-- (supabase/33_chat_paging_and_receipts.sql), which is the same one the read
-- receipts go through — one rule, read the same way in both places.
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
  update public.profiles set last_active_at = now() where id = v_me;
end;
$$;

revoke all on function public.touch_last_active() from public;
grant execute on function public.touch_last_active() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Turning the switch off clears what it already said
-- ---------------------------------------------------------------------------

create or replace function public.clear_last_active_on_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.online_status_visible is false and coalesce(old.online_status_visible, true) is true then
    update public.profiles set last_active_at = null where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists privacy_prefs_clear_last_active on public.privacy_prefs;
create trigger privacy_prefs_clear_last_active
  after insert or update of online_status_visible on public.privacy_prefs
  for each row execute function public.clear_last_active_on_hide();

-- A member who has the switch off today, from before this ran: clear the stale
-- timestamp they never agreed to keep publishing.
update public.profiles p
set last_active_at = null
from public.privacy_prefs pp
where pp.id = p.id and pp.online_status_visible is false and p.last_active_at is not null;

-- ---------------------------------------------------------------------------
-- 3. Note on what is still writable directly
-- ---------------------------------------------------------------------------

-- `profiles_update` still lets a member write their own `last_active_at`, so
-- this function is how the app does it rather than the only way it can be done.
-- That is a member editing their own visibility signal on their own row, which
-- is theirs to edit; the guard here is against the app publishing it for
-- someone who asked it not to, and that is where the app now writes.
