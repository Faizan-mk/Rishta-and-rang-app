-- ============================================================================
-- 33. Chat that does not load whole, and messages that say whether they landed.
--
-- Two problems, both of them "it works until a thread gets long".
--
--   1. The app fetched EVERY message in EVERY conversation on sign-in — one
--      unfiltered select, the whole history, before the matches list could
--      render. At a hundred messages that is invisible; at five hundred across
--      a few threads it is the slowest thing in the app, and it grows with use.
--
--      Two functions replace it: `thread_previews` returns just the newest
--      message per conversation (all the matches list actually needs), and
--      `message_page` returns one page of one thread, oldest-bound by a keyset
--      cursor so paging cannot skip or repeat a message.
--
--   2. There was no per-message state at all — only a per-thread unread flag.
--      Nothing new is stored for it: `match_reads` (26) already records when
--      each member last opened each conversation, and "they have read this
--      message" is that mark against the message's own timestamp. What was
--      missing is that a member could only read their OWN mark, so the one
--      side that needs it — the sender — could not see it.
--
-- Both functions are `security invoker` (the default): they run as the caller,
-- so the same RLS that narrows a plain select narrows these. They are a shape
-- for the query, not a way around the rules.
--
-- Run after 32_rishta_notifications.sql. Re-runnable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The index both functions are built on
-- ---------------------------------------------------------------------------

-- Newest-first within one conversation, which is what a chat screen reads and
-- what the keyset below pages through. Without it, every page is a sort of the
-- whole thread.
create index if not exists chat_messages_thread_idx
  on public.chat_messages (match_id, sent_at desc, id desc);

-- ---------------------------------------------------------------------------
-- 2. The matches list: one message per conversation
-- ---------------------------------------------------------------------------

-- `distinct on` is the whole point: Postgres walks the index above once per
-- conversation and stops at the first row, instead of the client downloading
-- every message to find the last one of each.
create or replace function public.thread_previews()
returns setof public.chat_messages
language sql
stable
set search_path = ''
as $$
  select distinct on (c.match_id) c.*
  from public.chat_messages c
  order by c.match_id, c.sent_at desc, c.id desc;
$$;

grant execute on function public.thread_previews() to authenticated;
revoke all on function public.thread_previews() from public;

-- ---------------------------------------------------------------------------
-- 3. One page of one thread
-- ---------------------------------------------------------------------------

-- Keyset, not offset. `(sent_at, id) < (p_before_at, p_before_id)` is a single
-- row comparison the index can seek straight to, and it stays correct while
-- messages arrive underneath — an offset would silently repeat a message every
-- time one was inserted between two pages. Timestamps are client-stamped and
-- can collide, which is why `id` is in the cursor at all.
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
  order by c.sent_at desc, c.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

grant execute on function public.message_page(uuid, timestamptz, uuid, integer) to authenticated;
revoke all on function public.message_page(uuid, timestamptz, uuid, integer) from public;

-- ---------------------------------------------------------------------------
-- 4. Read receipts, out of the mark that already exists
-- ---------------------------------------------------------------------------

-- Whether this member lets others see when they were last around.
--
-- Definer, because `privacy_prefs` is owner-only: asked as the counterpart, a
-- plain subquery would be filtered to nothing by that table's own RLS and
-- `coalesce(..., true)` would then answer "yes, show it" for everyone — a gate
-- that silently never closes. It answers one boolean about one person and
-- returns nothing else. Not granted to `public`: a definer function is
-- executable by `public` unless told otherwise.
create or replace function public.shows_online_status(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select pp.online_status_visible from public.privacy_prefs pp where pp.id = p_user),
    true
  );
$$;

revoke all on function public.shows_online_status(uuid) from public;
grant execute on function public.shows_online_status(uuid) to authenticated;

-- A read mark becomes readable by the other participant — which is what a read
-- receipt is, and the reason it is behind the same switch as "last seen". A
-- member who has turned off their online status does not start broadcasting the
-- minute they opened a conversation; their side simply shows no receipt.
--
-- Your own mark stays readable unconditionally, whatever you have turned off,
-- and whether or not the match still exists.
drop policy if exists "match_reads_select" on public.match_reads;
create policy "match_reads_select" on public.match_reads
  for select to authenticated using (
    user_id = auth.uid()
    or (
      exists (
        select 1 from public.matches m
        where m.id = match_reads.match_id and auth.uid() in (m.user_a, m.user_b)
      )
      and public.shows_online_status(match_reads.user_id)
    )
  );

-- `match_reads` is already `replica identity full` and in the publication (26),
-- so the other side's mark moving reaches the sender's session on its own —
-- which is what turns a delivered tick into a read one while they are looking
-- at it.
