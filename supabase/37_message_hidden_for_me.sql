-- ============================================================================
-- 37. message_hidden — "delete for me" on a shared message row.
--
-- Since 26_two_way_messaging.sql a message is one row both participants read;
-- deleting it outright (`messages_delete`, still sender-only) is "delete for
-- everyone". "Delete for me" cannot touch that row at all — it has to be state
-- that belongs to one side only, the same shape `match_reads` already uses for
-- "when did I last open this thread". One row per (message, member) who has
-- hidden it; the other participant's copy of the thread is untouched.
--
-- `thread_previews` and `message_page` (33) are the only two ways a message
-- ever reaches a client, so both are redefined here to skip a caller's own
-- hidden rows — a hide is invisible on this device and, since the table rides
-- the same Realtime channel, on every other device this member is signed into.
--
-- Run after 33_chat_paging_and_receipts.sql. Re-runnable.
-- ============================================================================

create table if not exists public.message_hidden (
  message_id  uuid not null references public.chat_messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  hidden_at   timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_hidden enable row level security;

drop policy if exists "message_hidden_select" on public.message_hidden;
create policy "message_hidden_select" on public.message_hidden
  for select to authenticated using (user_id = auth.uid());

-- `exists` against chat_messages is itself filtered by `messages_select` (26),
-- so this only succeeds for a message in a conversation the caller is actually
-- part of — the same gate `reactions_insert` (20) uses.
drop policy if exists "message_hidden_insert" on public.message_hidden;
create policy "message_hidden_insert" on public.message_hidden
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.chat_messages m where m.id = message_hidden.message_id)
  );

-- Unhiding is not exposed anywhere in the app today, but there is no reason a
-- member should not be able to take their own hide back off.
drop policy if exists "message_hidden_delete" on public.message_hidden;
create policy "message_hidden_delete" on public.message_hidden
  for delete to authenticated using (user_id = auth.uid());

grant all on public.message_hidden to authenticated, service_role;

alter table public.message_hidden replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'message_hidden'
     )
  then
    alter publication supabase_realtime add table public.message_hidden;
  end if;
end
$$;

create or replace function public.thread_previews()
returns setof public.chat_messages
language sql
stable
set search_path = ''
as $$
  select distinct on (c.match_id) c.*
  from public.chat_messages c
  where not exists (
    select 1 from public.message_hidden h
    where h.message_id = c.id and h.user_id = auth.uid()
  )
  order by c.match_id, c.sent_at desc, c.id desc;
$$;

grant execute on function public.thread_previews() to authenticated;
revoke all on function public.thread_previews() from public;

create or replace function public.message_page(
  p_match_id  uuid,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit     integer default 30
)
returns setof public.chat_messages
language sql
stable
set search_path = ''
as $$
  select c.*
  from public.chat_messages c
  where c.match_id = p_match_id
    and (
      p_before_at is null
      or p_before_id is null
      or (c.sent_at, c.id) < (p_before_at, p_before_id)
    )
    and not exists (
      select 1 from public.message_hidden h
      where h.message_id = c.id and h.user_id = auth.uid()
    )
  order by c.sent_at desc, c.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

grant execute on function public.message_page(uuid, timestamptz, uuid, integer) to authenticated;
revoke all on function public.message_page(uuid, timestamptz, uuid, integer) from public;
