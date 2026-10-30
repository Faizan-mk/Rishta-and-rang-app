-- ============================================================================
-- 71. Photos and the video intro move out of `profiles`.
--
-- 68 held back a "blur my photos" member's photos through visible_photos(),
-- but profiles.photos / video_intro_url were still readable by any member who
-- queried the table directly. A column-level revoke can't fix it (it breaks
-- visible_photos(), which takes the whole row, and the signup upsert), so the
-- data moves instead:
--
--   · profile_media holds them. RLS is on with no policies: members can't
--     read it at all. visible_photos() / visible_video_intro() (definer) are
--     the only way out, and they apply the blur rule.
--   · The app still writes `profiles.photos` / `video_intro_url` as before. A
--     trigger moves each write into profile_media and leaves the columns
--     empty, so nothing that saves a profile has to change.
--       - an empty photos array on an update is ignored (an older app build
--         that can't read its own photos any more must not wipe them)
--       - video_intro_url: null leaves the video alone, '' removes it
--   · Server functions that read the first photo (like_profile, story_feed,
--     story_viewers, match_counterpart_card) read it from profile_media.
--
-- Older app builds read the raw columns and so show no photos once this runs:
-- run it together with the release of the build that reads visible_photos.
--
-- Run after 70_privacy_and_paywall_hardening.sql. Safe to run more than once.
-- ============================================================================

create table if not exists public.profile_media (
  profile_id      uuid primary key references public.profiles (id) on delete cascade,
  photos          text[] not null default '{}',
  video_intro_url text
);
alter table public.profile_media enable row level security;
-- No policies: only definer functions read or write it.

-- Move what's there now.
insert into public.profile_media (profile_id, photos, video_intro_url)
select p.id, coalesce(p.photos, '{}'), p.video_intro_url
from public.profiles p
where coalesce(cardinality(p.photos), 0) > 0 or p.video_intro_url is not null
on conflict (profile_id) do update
  set photos = case when cardinality(excluded.photos) > 0 then excluded.photos else public.profile_media.photos end,
      video_intro_url = coalesce(excluded.video_intro_url, public.profile_media.video_intro_url);

create or replace function public.route_profile_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photos text[] := null;   -- null: leave as it is
  v_video  text := null;
  v_clear_video boolean := false;
begin
  if new.photos is not null and (tg_op = 'INSERT' or cardinality(new.photos) > 0) then
    v_photos := new.photos;
  end if;
  if new.video_intro_url = '' then
    v_clear_video := true;
  elsif new.video_intro_url is not null then
    v_video := new.video_intro_url;
  end if;

  if v_photos is not null or v_video is not null or v_clear_video then
    insert into public.profile_media (profile_id, photos, video_intro_url)
    values (new.id, coalesce(v_photos, '{}'), v_video)
    on conflict (profile_id) do update
      set photos = coalesce(v_photos, public.profile_media.photos),
          video_intro_url = case
            when v_clear_video then null
            else coalesce(v_video, public.profile_media.video_intro_url)
          end;
  end if;

  new.photos := '{}';
  new.video_intro_url := null;
  return new;
end;
$$;

-- AFTER would be too late to blank the columns; BEFORE runs before the row
-- exists on insert, so the media row is written with the profile's id, which
-- the foreign key then sees once the insert completes (deferred below).
alter table public.profile_media drop constraint if exists profile_media_profile_id_fkey;
alter table public.profile_media
  add constraint profile_media_profile_id_fkey foreign key (profile_id)
  references public.profiles (id) on delete cascade deferrable initially deferred;

drop trigger if exists profiles_route_media_insert on public.profiles;
create trigger profiles_route_media_insert
  before insert on public.profiles
  for each row execute function public.route_profile_media();

drop trigger if exists profiles_route_media_update on public.profiles;
create trigger profiles_route_media_update
  before update of photos, video_intro_url on public.profiles
  for each row execute function public.route_profile_media();

-- Empty the old columns (the trigger keeps the media where it was moved).
update public.profiles set photos = '{}', video_intro_url = null
where coalesce(cardinality(photos), 0) > 0 or video_intro_url is not null;

-- Readers --------------------------------------------------------------------

create or replace function public.first_photo(p_profile uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select m.photos[1] from public.profile_media m where m.profile_id = p_profile;
$$;
revoke all on function public.first_photo(uuid) from public, anon, authenticated;

create or replace function public.visible_photos(p public.profiles)
returns text[]
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when public.photos_blurred(p) then array[]::text[]
    else coalesce((select m.photos from public.profile_media m where m.profile_id = p.id), array[]::text[])
  end;
$$;

create or replace function public.visible_video_intro(p public.profiles)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when public.photos_blurred(p) then null
    else (select m.video_intro_url from public.profile_media m where m.profile_id = p.id)
  end;
$$;

-- The server functions that read the first photo, re-created as they are with
-- that one read pointed at profile_media.
do $$
declare
  v_fn  text;
  v_def text;
begin
  foreach v_fn in array array['like_profile', 'story_feed', 'story_viewers', 'match_counterpart_card'] loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = v_fn;
    if v_def is not null and position('p.photos[1]' in v_def) > 0 then
      execute replace(v_def, 'p.photos[1]', 'public.first_photo(p.id)');
    end if;
  end loop;
end $$;
