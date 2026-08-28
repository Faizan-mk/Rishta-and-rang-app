-- ============================================================================
-- 12. favorites — per-user saved favorites (owner = profile_id).
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.favorites (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references auth.users (id) on delete cascade,
  target_id    text not null,
  kind         text not null,
  name         text not null,
  age          integer not null,
  city         text not null default '',
  photo        text not null default '',
  created_at   timestamptz not null default now(),
  unique (profile_id, target_id)
);

alter table public.favorites enable row level security;

create policy "favorites_select" on public.favorites
  for select to authenticated using (profile_id = auth.uid());
create policy "favorites_insert" on public.favorites
  for insert to authenticated with check (profile_id = auth.uid());
create policy "favorites_update" on public.favorites
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "favorites_delete" on public.favorites
  for delete to authenticated using (profile_id = auth.uid());

grant all on public.favorites to authenticated, service_role;