-- ============================================================================
-- 26. Two-way messaging — one thread, both people in it.
--
-- `chat_messages` was a per-owner copy of a conversation: `profile_id` was
-- whoever the row belonged to, `from_me` said which side of it they were, and
-- RLS was `profile_id = auth.uid()`. Two members talking had two disjoint sets
-- of rows and could not read each other's. The "other side" of a thread was
-- written by the sender's own client, which is why the app could only ever
-- simulate a counterparty.
--
-- Now a message is one row: `sender_id` says who wrote it, `match_id` says
-- which conversation it belongs to, and both participants read it. `from_me` is
-- not stored at all — it is `sender_id = auth.uid()`, derived when the client
-- maps the row.
--
-- Participation is expressed as `exists (select 1 from matches ...)`. That
-- subquery is itself filtered by 24_matching.sql's `matches_select`, so it is
-- true only for a conversation the caller is actually one half of — the same
-- trick 20_message_reactions.sql already used, now resting on a shared row.
--
-- `match_reads` carries the per-side read state that the shared match row
-- deliberately has no column for.
--
-- Run after 24_matching.sql. Re-runnable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Re-key the messages
-- ---------------------------------------------------------------------------

alter table public.chat_messages
  add column if not exists sender_id uuid references auth.users (id) on delete cascade;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chat_messages' and column_name = 'profile_id'
  ) then
    -- A row the owner wrote is theirs, and `profile_id` is who that was. A row
    -- with from_me = false was the old client writing the counterparty's half
    -- of a one-sided thread — nobody actually sent it, so there is no sender to
    -- attribute it to and it goes.
    execute 'delete from public.chat_messages where from_me is false';
    execute 'update public.chat_messages set sender_id = profile_id where sender_id is null';
  end if;
end
$$;

-- Anything still unattributed predates both shapes and cannot be placed.
delete from public.chat_messages where sender_id is null;

alter table public.chat_messages alter column sender_id set not null;

-- The thread a message belongs to is now a real reference: unmatching takes the
-- conversation with it instead of leaving unreachable rows behind.
delete from public.chat_messages c
where not exists (select 1 from public.matches m where m.id = c.match_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chat_messages_match_id_fkey'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_match_id_fkey
      foreign key (match_id) references public.matches (id) on delete cascade;
  end if;
end
$$;

-- Reading a thread is "every message in this match, oldest first".
create index if not exists chat_messages_match_id_sent_at_idx
  on public.chat_messages (match_id, sent_at);

-- `profile_id` and `from_me` stay for now, nullable, so a client still running
-- the old build does not fail its inserts mid-rollout. Drop them once every
-- client is on `sender_id`:
--   alter table public.chat_messages drop column profile_id, drop column from_me;
alter table public.chat_messages alter column profile_id drop not null;
alter table public.chat_messages alter column from_me drop not null;

-- ---------------------------------------------------------------------------
-- 2. Participant RLS
-- ---------------------------------------------------------------------------

drop policy if exists "messages_select" on public.chat_messages;
create policy "messages_select" on public.chat_messages
  for select to authenticated using (
    exists (select 1 from public.matches m where m.id = chat_messages.match_id)
  );

-- You may write as yourself, into a conversation you are in, and not across a
-- block in either direction (22_block_hardening.sql's rule, kept).
drop policy if exists "messages_insert" on public.chat_messages;
create policy "messages_insert" on public.chat_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = chat_messages.match_id)
    and not public.is_blocked_pair(
      auth.uid(),
      coalesce(public.match_counterpart(match_id), auth.uid())
    )
  );

-- Editing and deleting stay with the author: being able to read the other
-- person's message is not being able to change or remove it.
drop policy if exists "messages_update" on public.chat_messages;
create policy "messages_update" on public.chat_messages
  for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

drop policy if exists "messages_delete" on public.chat_messages;
create policy "messages_delete" on public.chat_messages
  for delete to authenticated using (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Reactions follow the message
-- ---------------------------------------------------------------------------

-- 20_message_reactions.sql said so itself: "when the shared-conversation model
-- lands, these policies move to the conversation's participant list without the
-- table changing shape." The `exists` against chat_messages now resolves
-- through that table's participant RLS, so reacting to the other person's
-- message works and reading their reactions does too.
drop policy if exists "reactions_select" on public.message_reactions;
create policy "reactions_select" on public.message_reactions
  for select to authenticated using (
    exists (select 1 from public.chat_messages m where m.id = message_reactions.message_id)
  );

drop policy if exists "reactions_insert" on public.message_reactions;
create policy "reactions_insert" on public.message_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.chat_messages m where m.id = message_reactions.message_id)
  );

drop policy if exists "reactions_delete" on public.message_reactions;
create policy "reactions_delete" on public.message_reactions
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (select 1 from public.chat_messages m where m.id = message_reactions.message_id)
  );

-- ---------------------------------------------------------------------------
-- 4. Per-side read state
-- ---------------------------------------------------------------------------

-- One row per person per conversation. This is the state that could not live on
-- the match row: unread is mine, and the other person should neither see when I
-- read their message nor be able to mark it read for me. Hence owner-only RLS
-- on a table keyed by the pair.
create table if not exists public.match_reads (
  match_id      uuid not null references public.matches (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.match_reads enable row level security;

drop policy if exists "match_reads_select" on public.match_reads;
create policy "match_reads_select" on public.match_reads
  for select to authenticated using (user_id = auth.uid());

-- Writing a read mark requires being in the conversation, not just claiming to
-- be — otherwise a row could be created against any match id at all.
drop policy if exists "match_reads_insert" on public.match_reads;
create policy "match_reads_insert" on public.match_reads
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_reads.match_id)
  );

drop policy if exists "match_reads_update" on public.match_reads;
create policy "match_reads_update" on public.match_reads
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "match_reads_delete" on public.match_reads;
create policy "match_reads_delete" on public.match_reads
  for delete to authenticated using (user_id = auth.uid());

grant all on public.match_reads to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------------

-- chat_messages and message_reactions joined the publication in 18 and 20. The
-- client can now drop its `profile_id` filter and let RLS decide what reaches
-- it, which is what makes a message land on the other person's device.
alter table public.match_reads replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'match_reads'
     )
  then
    alter publication supabase_realtime add table public.match_reads;
  end if;
end
$$;
