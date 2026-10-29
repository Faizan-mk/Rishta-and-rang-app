-- ============================================================================
-- 68. Make "Show my profile" and "Blur my photos" actually do something.
--
-- Both switches on Privacy & Safety saved to privacy_prefs (6) and nothing
-- ever read them: a hidden profile stayed in everyone's deck, and "blurred"
-- photos reached every phone in full. Now the server holds both lines.
--
--   · Show my profile = off: the profile row is readable only by its owner and
--     by people they already have something with (a like either way, or a
--     match). It drops out of Home and Explore for everyone else; chats,
--     "who liked you" and matches keep working.
--
--   · Blur my photos = on: until there's a match, or they have liked the
--     viewer, the viewer gets no photo links and no video intro — not a
--     blurred copy, nothing — plus a photos_blurred flag so the app shows the
--     "photos hidden" cover. The app reads photos through visible_photos()
--     and visible_video_intro() instead of the raw columns.
--
-- Run after 6_privacy_prefs.sql. Safe to run more than once.
-- ============================================================================

-- Something between the two: a like either way, or a match.
create or replace function public.has_connection(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.likes l
    where (l.liker_id = p_a and l.target_id = p_b) or (l.liker_id = p_b and l.target_id = p_a)
  ) or exists (
    select 1 from public.matches m
    where (m.user_a = p_a and m.user_b = p_b) or (m.user_a = p_b and m.user_b = p_a)
  );
$$;

create or replace function public.profile_visible_to(p_profile uuid, p_viewer uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_profile = p_viewer
    or coalesce((select pp.profile_visible from public.privacy_prefs pp where pp.id = p_profile), true)
    or public.has_connection(p_profile, p_viewer);
$$;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (
      hidden_at is null
      and not public.is_blocked_pair(auth.uid(), id)
      and public.profile_visible_to(id, auth.uid())
    )
  );

-- Blurred for this viewer: the owner asked for it, and there's no match and
-- no like from the owner to the viewer yet.
create or replace function public.photos_blurred(p public.profiles)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce((select pp.blur_photos from public.privacy_prefs pp where pp.id = p.id), false)
    and not exists (select 1 from public.likes l where l.liker_id = p.id and l.target_id = auth.uid())
    and not exists (
      select 1 from public.matches m
      where (m.user_a = p.id and m.user_b = auth.uid()) or (m.user_a = auth.uid() and m.user_b = p.id)
    );
$$;

create or replace function public.visible_photos(p public.profiles)
returns text[]
language sql
security definer
stable
set search_path = ''
as $$
  select case when public.photos_blurred(p) then array[]::text[] else coalesce(p.photos, array[]::text[]) end;
$$;

create or replace function public.visible_video_intro(p public.profiles)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case when public.photos_blurred(p) then null else p.video_intro_url end;
$$;

revoke all on function public.has_connection(uuid, uuid) from public, anon;
revoke all on function public.profile_visible_to(uuid, uuid) from public, anon;
grant execute on function public.has_connection(uuid, uuid) to authenticated;
grant execute on function public.profile_visible_to(uuid, uuid) to authenticated;
grant execute on function public.photos_blurred(public.profiles) to authenticated;
grant execute on function public.visible_photos(public.profiles) to authenticated;
grant execute on function public.visible_video_intro(public.profiles) to authenticated;
