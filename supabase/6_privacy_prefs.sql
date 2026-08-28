-- ============================================================================
-- 6. privacy_prefs — owner-only privacy toggles (profile visibility, etc.).
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.privacy_prefs (
  id                    uuid primary key references auth.users (id) on delete cascade,
  profile_visible       boolean not null default true,
  online_status_visible boolean not null default true,
  blur_photos           boolean not null default false
);

alter table public.privacy_prefs enable row level security;

create policy "privacy_prefs_select" on public.privacy_prefs
  for select to authenticated using (auth.uid() = id);
create policy "privacy_prefs_insert" on public.privacy_prefs
  for insert to authenticated with check (auth.uid() = id);
create policy "privacy_prefs_update" on public.privacy_prefs
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "privacy_prefs_delete" on public.privacy_prefs
  for delete to authenticated using (auth.uid() = id);

grant all on public.privacy_prefs to authenticated, service_role;