-- ============================================================================
-- 9. matches — one row per conversation (per profile_id, i.e. per user). The
-- owner reads/writes; each row mirrors the old users/{uid}/matches documents.
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.matches (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references auth.users (id) on delete cascade,
  name                  text not null,
  photo                 text not null default '',
  last_message          text not null default '',
  last_message_at       timestamptz not null default now(),
  unread                boolean not null default false,
  mode                  text not null,
  moved_to_rishta       boolean not null default false,
  rishta_request_pending boolean not null default false,
  source_profile_id     text
);

alter table public.matches enable row level security;

create policy "matches_select" on public.matches
  for select to authenticated using (profile_id = auth.uid());
create policy "matches_insert" on public.matches
  for insert to authenticated with check (profile_id = auth.uid());
create policy "matches_update" on public.matches
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "matches_delete" on public.matches
  for delete to authenticated using (profile_id = auth.uid());

grant all on public.matches to authenticated, service_role;