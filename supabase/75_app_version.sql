-- ============================================================================
-- 75. "A new version is out" — the numbers the app checks on open.
--
-- One row. The app compares its own Android versionCode with it
-- (src/hooks/useUpdatePrompt.ts):
--
--   · latest_version_code  newer than the app → "Update available" popup,
--                          with Later; shown again on the next open until
--                          the member updates
--   · min_version_code     newer than the app → the same popup without Later:
--                          that version can't be used any more
--
-- After publishing a new build to Play, raise latest_version_code to its
-- versionCode:
--   update public.app_version set latest_version_code = 23 where id = 1;
-- And to force everyone off an old build (e.g. before 71):
--   update public.app_version set min_version_code = 23 where id = 1;
--
-- Readable by anyone (the check runs before sign-in too); written only from
-- here. Safe to run more than once.
-- ============================================================================

create table if not exists public.app_version (
  id                  integer primary key default 1 check (id = 1),
  latest_version_code integer not null,
  min_version_code    integer not null default 0,
  updated_at          timestamptz not null default now()
);

alter table public.app_version enable row level security;

drop policy if exists "app_version_select" on public.app_version;
create policy "app_version_select" on public.app_version
  for select to anon, authenticated using (true);

grant select on public.app_version to anon, authenticated;

-- 22 is 1.0.18, the build in closed testing when this was written.
insert into public.app_version (id, latest_version_code, min_version_code)
values (1, 22, 0)
on conflict (id) do nothing;
