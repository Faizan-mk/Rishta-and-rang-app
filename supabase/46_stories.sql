-- ============================================================================
-- 46. Stories — a photo or a short video a member shares for 24 hours, seen
-- only by the people they are matched with.
--
--   · stories       one row per photo / video. Gone from every read the moment
--                   `expires_at` passes; the owner's app deletes its own expired
--                   rows and files the next time it loads stories.
--   · story_views   who has seen which story, one row per viewer. Drives the
--                   lit / grey ring and the owner's "Seen by" list.
--
-- Who can see a story is decided here, not in the app: the owner, and anyone
-- they share a `matches` row with (24_matching.sql), unless the pair is
-- blocked (22_block_hardening.sql). A stranger cannot read one even by id.
--
-- Media lives in the public-media bucket under {uid}/stories/, which the
-- existing storage policies (17_storage.sql) already limit to the owner.
--
-- Run after 24_matching.sql and 22_block_hardening.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who counts as a connection
-- ---------------------------------------------------------------------------

create or replace function public.are_connected(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.matches m
    where m.user_a = least(a, b)
      and m.user_b = greatest(a, b)
  )
  and not public.is_blocked_pair(a, b);
$$;

grant execute on function public.are_connected(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. stories
-- ---------------------------------------------------------------------------

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_url   text not null,
  media_type  text not null check (media_type in ('image', 'video')),
  -- Seconds of video, so the viewer's progress bar knows its length before the
  -- file has loaded. Null for a photo, which always runs a fixed time.
  duration_sec numeric check (duration_sec is null or (duration_sec > 0 and duration_sec <= 60)),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours'
);

create index if not exists stories_user_created_idx on public.stories (user_id, created_at desc);
create index if not exists stories_expires_idx on public.stories (expires_at);

alter table public.stories enable row level security;

drop policy if exists "stories_select" on public.stories;
create policy "stories_select" on public.stories
  for select to authenticated using (
    expires_at > now()
    and (user_id = auth.uid() or public.are_connected(auth.uid(), user_id))
  );

-- The client may not pick its own lifetime: whatever it sends, a story lasts
-- 24 hours from when it was posted.
drop policy if exists "stories_insert" on public.stories;
create policy "stories_insert" on public.stories
  for insert to authenticated with check (
    user_id = auth.uid()
    and expires_at <= now() + interval '24 hours 1 minute'
  );

drop policy if exists "stories_delete" on public.stories;
create policy "stories_delete" on public.stories
  for delete to authenticated using (user_id = auth.uid());

-- No update policy: a story is posted and deleted, never edited.

grant select, insert, delete on public.stories to authenticated;
grant all on public.stories to service_role;

-- ---------------------------------------------------------------------------
-- 3. story_views
-- ---------------------------------------------------------------------------

create table if not exists public.story_views (
  story_id   uuid not null references public.stories (id) on delete cascade,
  viewer_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists story_views_viewer_idx on public.story_views (viewer_id);

alter table public.story_views enable row level security;

-- A viewer sees their own rows (for the ring); the owner reads the list through
-- `story_viewers` below, which also returns names and photos.
drop policy if exists "story_views_select" on public.story_views;
create policy "story_views_select" on public.story_views
  for select to authenticated using (viewer_id = auth.uid());

-- Only for a story the caller may actually see (the stories policy applies in
-- the subquery), and never for one's own.
drop policy if exists "story_views_insert" on public.story_views;
create policy "story_views_insert" on public.story_views
  for insert to authenticated with check (
    viewer_id = auth.uid()
    and exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id <> auth.uid()
    )
  );

grant select, insert on public.story_views to authenticated;
grant all on public.story_views to service_role;

-- ---------------------------------------------------------------------------
-- 4. Reads
-- ---------------------------------------------------------------------------

-- Every live story the caller may see, with its owner's name and photo and
-- whether the caller has seen it. Oldest first, which is the order a person's
-- stories play in; the app groups them by owner.
create or replace function public.story_feed()
returns table (
  id           uuid,
  user_id      uuid,
  media_url    text,
  media_type   text,
  duration_sec numeric,
  created_at   timestamptz,
  expires_at   timestamptz,
  owner_name   text,
  owner_photo  text,
  seen         boolean,
  view_count   integer
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    s.id,
    s.user_id,
    s.media_url,
    s.media_type,
    s.duration_sec,
    s.created_at,
    s.expires_at,
    p.full_name,
    coalesce(p.photos[1], ''),
    exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()),
    -- Only the owner learns how many have looked.
    case when s.user_id = auth.uid()
      then (select count(*)::integer from public.story_views v where v.story_id = s.id)
      else 0
    end
  from public.stories s
  join public.profiles p on p.id = s.user_id
  where s.expires_at > now()
    and (s.user_id = auth.uid() or public.are_connected(auth.uid(), s.user_id))
  order by s.created_at asc;
$$;

grant execute on function public.story_feed() to authenticated;

-- "Seen by" for one of the caller's own stories, newest first. Empty for a
-- story that is not theirs.
create or replace function public.story_viewers(p_story_id uuid)
returns table (
  viewer_id  uuid,
  name       text,
  photo      text,
  viewed_at  timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select v.viewer_id, p.full_name, coalesce(p.photos[1], ''), v.viewed_at
  from public.story_views v
  join public.stories s on s.id = v.story_id
  join public.profiles p on p.id = v.viewer_id
  where v.story_id = p_story_id
    and s.user_id = auth.uid()
  order by v.viewed_at desc;
$$;

grant execute on function public.story_viewers(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Clean-up
-- ---------------------------------------------------------------------------

-- Deletes the caller's expired stories and hands back their media URLs so the
-- app can remove the files from storage. Expired stories are already invisible
-- to everyone; this only reclaims the space.
create or replace function public.purge_my_expired_stories()
returns setof text
language sql
security definer
set search_path = ''
as $$
  delete from public.stories
  where user_id = auth.uid() and expires_at <= now()
  returning media_url;
$$;

grant execute on function public.purge_my_expired_stories() to authenticated;
