-- ============================================================================
-- 14. likes_received — "who liked me". profile_id is the owner/target; the
-- liker (liker_id) may create / update / delete only their own row, and the
-- owner reads the whole list. Upsert on (profile_id, liker_id) means re-liking
-- overwrites the entry.
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.likes_received (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references auth.users (id) on delete cascade,
  liker_id     text not null,
  kind         text not null,
  name         text not null,
  age          integer not null,
  city         text not null default '',
  photo        text not null default '',
  created_at   timestamptz not null default now(),
  unique (profile_id, liker_id)
);

alter table public.likes_received enable row level security;

create policy "likes_received_select" on public.likes_received
  for select to authenticated using (profile_id = auth.uid());
create policy "likes_received_insert" on public.likes_received
  for insert to authenticated with check (cast(liker_id as uuid) = auth.uid());
create policy "likes_received_update" on public.likes_received
  for update to authenticated using (cast(liker_id as uuid) = auth.uid())
  with check (cast(liker_id as uuid) = auth.uid());
create policy "likes_received_delete" on public.likes_received
  for delete to authenticated using (cast(liker_id as uuid) = auth.uid());

grant all on public.likes_received to authenticated, service_role;