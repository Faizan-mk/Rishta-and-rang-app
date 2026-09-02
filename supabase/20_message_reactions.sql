-- ============================================================================
-- 20. message_reactions — the emoji people tap onto a message.
--
-- Scope note: like `chat_messages`, a row here belongs to one member's copy of
-- a thread (`chat_messages.profile_id` is the owner). "Match participants only"
-- is therefore expressed as "the message this reaction hangs off is one you
-- own" — the strongest rule this schema can state, and the same rule the
-- messages themselves are under. When the shared-conversation model lands
-- (Day 5's match-detection RPC), these policies move to the conversation's
-- participant list without the table changing shape.
--
-- Run after 10_chat_messages.sql.
-- ============================================================================

create table public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.chat_messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  -- One of each emoji per person per message; tapping the same one again
  -- removes it rather than stacking a duplicate.
  unique (message_id, user_id, emoji)
);

-- Every read is "the reactions on these messages", so the message is the index.
create index message_reactions_message_id_idx on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

-- `exists` against chat_messages is itself filtered by that table's own RLS
-- (owner-only), so this resolves to true only for a message the caller owns.
create policy "reactions_select" on public.message_reactions
  for select to authenticated using (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_reactions.message_id and m.profile_id = auth.uid()
    )
  );

create policy "reactions_insert" on public.message_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_messages m
      where m.id = message_reactions.message_id and m.profile_id = auth.uid()
    )
  );

create policy "reactions_delete" on public.message_reactions
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_messages m
      where m.id = message_reactions.message_id and m.profile_id = auth.uid()
    )
  );

grant all on public.message_reactions to authenticated, service_role;

-- Live reactions ride the same Realtime stream as the messages themselves.
-- `replica identity full` is what makes the DELETE payload carry message_id —
-- without it a removed reaction never disappears from the other session.
alter table public.message_reactions replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'message_reactions'
     )
  then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end
$$;
