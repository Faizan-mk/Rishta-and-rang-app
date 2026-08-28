-- ============================================================================
-- 10. chat_messages — the actual lines of a conversation. Owner (profile_id)
-- only. Live chat streaming is wired up in 18_realtime.sql (run that AFTER
-- this file).
--
-- Run after 1_extension.sql (and ideally after 9_matches.sql).
-- ============================================================================

create table public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references auth.users (id) on delete cascade,
  match_id      uuid not null,
  from_me       boolean not null,
  text          text not null default '',
  kind          text not null default 'text',
  audio_path    text,               -- public storage URL
  duration_sec  numeric,
  image_path    text,               -- public storage URL
  sent_at       timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "messages_select" on public.chat_messages
  for select to authenticated using (profile_id = auth.uid());
create policy "messages_insert" on public.chat_messages
  for insert to authenticated with check (profile_id = auth.uid());
create policy "messages_update" on public.chat_messages
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "messages_delete" on public.chat_messages
  for delete to authenticated using (profile_id = auth.uid());

grant all on public.chat_messages to authenticated, service_role;