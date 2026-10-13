-- ============================================================================
-- 49. Story likes — the heart on someone else's story, the way Instagram does.
--
--   · story_likes   one row per (story, member) who liked it. Unliking deletes
--                   the row.
--
-- A member may like only a story they can see (the stories policy applies in
-- the subquery) and never their own. Only the owner learns who liked: through
-- `story_viewers`, which now also says whether each viewer liked.
--
-- story_feed and story_viewers change their return columns, so they are
-- dropped and recreated rather than replaced.
--
-- Run after 46_stories.sql and 47_story_privacy.sql.
-- ============================================================================

create table if not exists public.story_likes (
  story_id  uuid not null references public.stories (id) on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  liked_at  timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index if not exists story_likes_user_idx on public.story_likes (user_id);

alter table public.story_likes enable row level security;

drop policy if exists "story_likes_select" on public.story_likes;
create policy "story_likes_select" on public.story_likes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "story_likes_insert" on public.story_likes;
create policy "story_likes_insert" on public.story_likes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id <> auth.uid()
    )
  );

drop policy if exists "story_likes_delete" on public.story_likes;
create policy "story_likes_delete" on public.story_likes
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.story_likes to authenticated;
grant all on public.story_likes to service_role;

-- ---------------------------------------------------------------------------
-- Reads, now with likes
-- ---------------------------------------------------------------------------

drop function if exists public.story_feed();
create function public.story_feed()
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
  view_count   integer,
  liked        boolean,
  like_count   integer
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
    -- Only the owner learns how many have looked, and how many liked.
    case when s.user_id = auth.uid()
      then (select count(*)::integer from public.story_views v where v.story_id = s.id)
      else 0
    end,
    exists (select 1 from public.story_likes l where l.story_id = s.id and l.user_id = auth.uid()),
    case when s.user_id = auth.uid()
      then (select count(*)::integer from public.story_likes l where l.story_id = s.id)
      else 0
    end
  from public.stories s
  join public.profiles p on p.id = s.user_id
  where s.expires_at > now()
    and (s.user_id = auth.uid() or public.are_connected(auth.uid(), s.user_id))
  order by s.created_at asc;
$$;

grant execute on function public.story_feed() to authenticated;

-- "Seen by" for one of the caller's own stories: likers first, then newest.
drop function if exists public.story_viewers(uuid);
create function public.story_viewers(p_story_id uuid)
returns table (
  viewer_id  uuid,
  name       text,
  photo      text,
  viewed_at  timestamptz,
  liked      boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    v.viewer_id,
    p.full_name,
    coalesce(p.photos[1], ''),
    v.viewed_at,
    exists (select 1 from public.story_likes l where l.story_id = v.story_id and l.user_id = v.viewer_id) as liked
  from public.story_views v
  join public.stories s on s.id = v.story_id
  join public.profiles p on p.id = v.viewer_id
  where v.story_id = p_story_id
    and s.user_id = auth.uid()
  order by liked desc, v.viewed_at desc;
$$;

grant execute on function public.story_viewers(uuid) to authenticated;
