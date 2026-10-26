-- ============================================================================
-- 58. Delivered is not the same as "on the server".
--
-- Until now a message had two states once it left the phone: two grey ticks
-- the moment the row landed (33_chat_paging_and_receipts.sql), two blue ones
-- once the other member's read mark passed it. Two grey ticks therefore showed
-- even while the other member was offline and had not received anything —
-- which is not what two ticks mean to anyone who has used WhatsApp.
--
-- This adds the missing middle state. `match_deliveries` holds, per member per
-- conversation, the newest message from the other side that this member's app
-- has actually fetched. The app calls `mark_delivered()` when it comes to the
-- foreground and when a message reaches it live; a message of mine at or
-- before the other member's mark is delivered (two grey ticks), one after it
-- is only on the server (one grey tick).
--
-- The mark is the newest delivered message's own `sent_at`, not `now()`: what
-- it tells the sender is "your messages up to here arrived", never "they were
-- on their phone at 11:42". That is why it is not behind the online-status
-- switch the way a read mark is — the same line WhatsApp draws, where
-- delivered ticks show even for someone who hides their last seen.
--
-- Run after 57_cnic_photo_lock.sql. Re-runnable.
-- ============================================================================

create table if not exists public.match_deliveries (
  match_id         uuid not null references public.matches (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  delivered_until  timestamptz not null,
  primary key (match_id, user_id)
);

alter table public.match_deliveries enable row level security;

-- Both participants read both marks: mine so every device of mine agrees, the
-- other member's because it is the receipt on my own messages.
drop policy if exists "match_deliveries_select" on public.match_deliveries;
create policy "match_deliveries_select" on public.match_deliveries
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where m.id = match_deliveries.match_id and auth.uid() in (m.user_a, m.user_b)
    )
  );

-- No insert/update policy and no write grant: `mark_delivered` is the only
-- writer, so a client cannot claim a delivery the server did not see — or
-- write one for someone else.
revoke all on public.match_deliveries from authenticated, anon;
grant select on public.match_deliveries to authenticated;
grant all on public.match_deliveries to service_role;

-- ---------------------------------------------------------------------------
-- The one writer
-- ---------------------------------------------------------------------------

-- For every conversation the caller is in, moves their mark up to the newest
-- message the other member has sent there. Only forwards: an older answer
-- (a slow call landing after a newer one) never pulls a mark back.
--
-- It looks at the other member's messages regardless of any block the caller
-- has on them. A shadow-blocked sender (36_shadow_block_messages.sql) must not
-- be able to tell from a tick that stopped turning double that they were
-- blocked — that would undo the whole point of the block being silent.
--
-- The lateral `limit 1` walks `chat_messages_thread_idx` (33) newest-first and
-- stops at the first message not from the caller, so this stays cheap however
-- long the threads get.
create or replace function public.mark_delivered()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return;
  end if;

  insert into public.match_deliveries (match_id, user_id, delivered_until)
  select m.id, v_me, latest.sent_at
  from public.matches m
  cross join lateral (
    select c.sent_at
    from public.chat_messages c
    where c.match_id = m.id and c.sender_id <> v_me
    order by c.sent_at desc, c.id desc
    limit 1
  ) latest
  where v_me in (m.user_a, m.user_b)
  on conflict (match_id, user_id) do update
    set delivered_until = excluded.delivered_until
    where public.match_deliveries.delivered_until < excluded.delivered_until;
end;
$$;

revoke all on function public.mark_delivered() from public;
grant execute on function public.mark_delivered() to authenticated;

-- ---------------------------------------------------------------------------
-- Everything sent before today counts as delivered
-- ---------------------------------------------------------------------------

-- Without this every message already in every thread would drop from two grey
-- ticks to one the day this ships, until the other member next opened the app.
-- Those messages have long since reached them; say so.
insert into public.match_deliveries (match_id, user_id, delivered_until)
select m.id, side.user_id, latest.sent_at
from public.matches m
cross join lateral (values (m.user_a), (m.user_b)) as side (user_id)
cross join lateral (
  select c.sent_at
  from public.chat_messages c
  where c.match_id = m.id and c.sender_id <> side.user_id
  order by c.sent_at desc, c.id desc
  limit 1
) latest
on conflict (match_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Live
-- ---------------------------------------------------------------------------

-- The other member coming online is what turns one tick into two while the
-- sender is watching, so the mark has to stream like `match_reads` does (26).
alter table public.match_deliveries replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'match_deliveries'
     )
  then
    alter publication supabase_realtime add table public.match_deliveries;
  end if;
end
$$;
