-- ============================================================================
-- 7. daily_likes — owner-only counter of free likes used per day (resets
-- whenever the app sees a new date).
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.daily_likes (
  id      uuid primary key references auth.users (id) on delete cascade,
  date    text not null,           -- 'YYYY-MM-DD'
  count   integer not null default 0
);

alter table public.daily_likes enable row level security;

create policy "daily_likes_select" on public.daily_likes
  for select to authenticated using (auth.uid() = id);
create policy "daily_likes_insert" on public.daily_likes
  for insert to authenticated with check (auth.uid() = id);
create policy "daily_likes_update" on public.daily_likes
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "daily_likes_delete" on public.daily_likes
  for delete to authenticated using (auth.uid() = id);

grant all on public.daily_likes to authenticated, service_role;