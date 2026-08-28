-- ============================================================================
-- 15. notifications — per-user in-app notifications (owner = profile_id).
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references auth.users (id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text not null default '',
  created_at   timestamptz not null default now(),
  read         boolean not null default false
);

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications
  for select to authenticated using (profile_id = auth.uid());
create policy "notifications_insert" on public.notifications
  for insert to authenticated with check (profile_id = auth.uid());
create policy "notifications_update" on public.notifications
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "notifications_delete" on public.notifications
  for delete to authenticated using (profile_id = auth.uid());

grant all on public.notifications to authenticated, service_role;