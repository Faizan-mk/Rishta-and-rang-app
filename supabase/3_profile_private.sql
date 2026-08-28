-- ============================================================================
-- 3. profile_private — owner-only private record (email, wali contact).
-- Mirrors the old users/{uid}/private documents.
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.profile_private (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  wali_contact  text
);

alter table public.profile_private enable row level security;

create policy "profile_private_select" on public.profile_private
  for select to authenticated using (auth.uid() = id);
create policy "profile_private_insert" on public.profile_private
  for insert to authenticated with check (auth.uid() = id);
create policy "profile_private_update" on public.profile_private
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profile_private_delete" on public.profile_private
  for delete to authenticated using (auth.uid() = id);

grant all on public.profile_private to authenticated, service_role;