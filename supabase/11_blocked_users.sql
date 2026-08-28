-- ============================================================================
-- 11. blocked_users — per-user block list (owner = profile_id).
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.blocked_users (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references auth.users (id) on delete cascade,
  blocked_id         text not null,
  source_profile_id  text,
  name               text not null,
  photo              text not null default '',
  blocked_at         timestamptz not null default now(),
  unique (profile_id, blocked_id)
);

alter table public.blocked_users enable row level security;

create policy "blocked_select" on public.blocked_users
  for select to authenticated using (profile_id = auth.uid());
create policy "blocked_insert" on public.blocked_users
  for insert to authenticated with check (profile_id = auth.uid());
create policy "blocked_update" on public.blocked_users
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "blocked_delete" on public.blocked_users
  for delete to authenticated using (profile_id = auth.uid());

grant all on public.blocked_users to authenticated, service_role;