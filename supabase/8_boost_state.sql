-- ============================================================================
-- 8. boost_state — owner-only "boost my discovery ranking" state.
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.boost_state (
  id           uuid primary key references auth.users (id) on delete cascade,
  boosts_left  integer not null default 0,
  active_until timestamptz
);

alter table public.boost_state enable row level security;

create policy "boost_select" on public.boost_state
  for select to authenticated using (auth.uid() = id);
create policy "boost_insert" on public.boost_state
  for insert to authenticated with check (auth.uid() = id);
create policy "boost_update" on public.boost_state
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "boost_delete" on public.boost_state
  for delete to authenticated using (auth.uid() = id);

grant all on public.boost_state to authenticated, service_role;