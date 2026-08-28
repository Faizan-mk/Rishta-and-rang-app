-- ============================================================================
-- 13. view_history — per-user "recently viewed" list (owner = profile_id).
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.view_history (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references auth.users (id) on delete cascade,
  viewed_id   text not null,
  kind        text not null,
  name        text not null,
  age         integer not null,
  city        text not null default '',
  photo       text not null default '',
  viewed_at   timestamptz not null default now(),
  unique (profile_id, viewed_id)
);

alter table public.view_history enable row level security;

create policy "view_history_select" on public.view_history
  for select to authenticated using (profile_id = auth.uid());
create policy "view_history_insert" on public.view_history
  for insert to authenticated with check (profile_id = auth.uid());
create policy "view_history_update" on public.view_history
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "view_history_delete" on public.view_history
  for delete to authenticated using (profile_id = auth.uid());

grant all on public.view_history to authenticated, service_role;