-- ============================================================================
-- 24. Mutual matching — likes, and a match that both people can actually read.
--
-- The problem this fixes:
--
--   `matches` held one row per *user* per conversation (`profile_id` = the
--   owner), and its RLS was `profile_id = auth.uid()`. So A's match row was
--   invisible to B and B's was invisible to A: there was no row in the database
--   that both halves of a pair could see. Every shared-conversation feature —
--   the other side's read state, a real unmatch, participant-scoped message
--   RLS — was blocked behind that.
--
--   `matches` now holds ONE row per pair, (user_a, user_b) stored with the
--   uuids in ascending order so a pair can only ever produce one row, readable
--   by either participant.
--
--   `likes` is the intent that produces a match. It is deliberately near-blind:
--   you may write your own like and read the ones pointed at you. "Did they
--   like me back?" is answered by `is_mutual_like`, a security-definer yes/no
--   that never returns anyone's like list — the same shape as
--   `is_blocked_pair` in 22_block_hardening.sql.
--
-- Numbering note: the plan called this 19_matching.sql, but 19 is already
-- 19_legal_docs.sql on this project, so it lands at 24.
--
-- DESTRUCTIVE, and not re-runnable: the old one-sided `matches` rows cannot be
-- turned into paired rows (a row records only its owner's side, and the
-- counterpart id is null on the demo rows), so they are discarded rather than
-- migrated — the plan's "discarding is simpler pre-launch". Running this a
-- second time would discard real matches too.
--
-- Run after 22_block_hardening.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Out with the one-sided rows
-- ---------------------------------------------------------------------------

-- Every existing message hangs off a one-sided match row that is about to stop
-- existing. An orphan is unreachable by any surface — the app only opens a
-- thread from a match — and 4.2's participant-scoped RLS has no pair to resolve
-- for one. Comment this block out to keep them; nothing below depends on it.
delete from public.message_reactions;
delete from public.chat_messages;

drop table if exists public.matches cascade;

-- ---------------------------------------------------------------------------
-- 2. likes — one standing like per (liker → target)
-- ---------------------------------------------------------------------------

create table public.likes (
  id          uuid primary key default gen_random_uuid(),
  liker_id    uuid not null references auth.users (id) on delete cascade,
  target_id   uuid not null references auth.users (id) on delete cascade,
  mode        text not null,
  created_at  timestamptz not null default now(),
  constraint likes_not_self check (liker_id <> target_id),
  -- Re-liking the same person overwrites rather than stacking, so the client
  -- upserts on this pair. `mode` records which surface the like came from; it
  -- is not part of the key, because a pair has one relationship rather than one
  -- per mode — the same reason `matches` is unique on the pair alone.
  unique (liker_id, target_id)
);

-- Reciprocity and "who liked me" look up by target; "did I like them" by liker.
create index likes_target_id_idx on public.likes (target_id);
create index likes_liker_id_idx  on public.likes (liker_id);

alter table public.likes enable row level security;

-- Read is one-directional on purpose: you see the likes pointed AT you, which
-- is the Explore+ "who liked you" list and the only read a reciprocity check
-- needs from the client. Your outgoing likes stay unreadable, so nothing can
-- enumerate who you swiped on; ask `is_mutual_like` instead of selecting them.
create policy "likes_select" on public.likes
  for select to authenticated using (target_id = auth.uid());

-- Write your own like, and not across a block in either direction.
create policy "likes_insert" on public.likes
  for insert to authenticated with check (
    liker_id = auth.uid()
    and not public.is_blocked_pair(auth.uid(), target_id)
  );

-- Withdrawing a like is not a surface yet, so there is deliberately no update
-- or delete policy: with RLS on, the absence of a policy is a refusal.

grant all on public.likes to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. The reciprocity predicate
-- ---------------------------------------------------------------------------

-- security definer because `likes` only lets you read the likes aimed at you:
-- answering "do these two like each other" needs the outgoing side too. It
-- returns a bare boolean about one specific pair and never a list, so it leaks
-- nothing that the resulting match would not already reveal.
--
-- Defined before the policies in section 4, which call it.
create or replace function public.is_mutual_like(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.likes l where l.liker_id = a and l.target_id = b)
     and exists (select 1 from public.likes l where l.liker_id = b and l.target_id = a);
$$;

grant execute on function public.is_mutual_like(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. matches — one row per pair, both people read it
-- ---------------------------------------------------------------------------

create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references auth.users (id) on delete cascade,
  user_b      uuid not null references auth.users (id) on delete cascade,
  mode        text not null,
  created_at  timestamptz not null default now(),
  -- Ascending uuids are what make the pair a key: without the ordering check,
  -- (A,B) and (B,A) are two different rows and the unique below buys nothing.
  constraint matches_ordered check (user_a < user_b),
  unique (user_a, user_b)
);

-- Either column can be the caller, so both get an index; the load query is
-- `where user_a = me or user_b = me`.
create index matches_user_a_idx on public.matches (user_a);
create index matches_user_b_idx on public.matches (user_b);

alter table public.matches enable row level security;

-- The point of the whole file: one row, visible to exactly the two people in
-- it, and to nobody else.
create policy "matches_select" on public.matches
  for select to authenticated using (auth.uid() in (user_a, user_b));

-- A participant may write the row, but only once the like is actually mutual
-- and the pair is not blocked — so a client cannot conjure a match with someone
-- who never liked them back. Whichever side writes first wins; the other's
-- insert hits the unique on the pair, which is the client's signal that the
-- match already exists rather than an error to surface.
create policy "matches_insert" on public.matches
  for insert to authenticated with check (
    auth.uid() in (user_a, user_b)
    and public.is_mutual_like(user_a, user_b)
    and not public.is_blocked_pair(user_a, user_b)
  );

-- Either participant may move the conversation between modes; neither may
-- rewrite who is in it.
create policy "matches_update" on public.matches
  for update to authenticated
  using (auth.uid() in (user_a, user_b))
  with check (auth.uid() in (user_a, user_b));

-- Unmatch: one side leaving ends the conversation for both, which is the
-- intended behaviour.
create policy "matches_delete" on public.matches
  for delete to authenticated using (auth.uid() in (user_a, user_b));

grant all on public.matches to authenticated, service_role;

-- Per-user conversation state (unread, last-read-at, muted) is deliberately NOT
-- on this table: the row is shared, so such a column would be one person's
-- state visible to and writable by the other. It belongs in a per-participant
-- table sitting alongside this one.

-- ---------------------------------------------------------------------------
-- 5. Re-point what the old shape fed
-- ---------------------------------------------------------------------------

-- 22_block_hardening.sql's `messages_insert` policy calls this to find the
-- other person in a thread, and it read `matches.source_profile_id` — a column
-- that no longer exists, which would fail every message insert. Same contract
-- (given a match, who is the other person), resolved against the pair instead.
create or replace function public.match_counterpart(p_match_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select case when m.user_a = auth.uid() then m.user_b else m.user_a end
  from public.matches m
  where m.id = p_match_id
    and auth.uid() in (m.user_a, m.user_b)
  limit 1;
$$;

grant execute on function public.match_counterpart(uuid) to authenticated;

-- Blocking already clears the pair's `likes_received` rows (22); it has to
-- clear the new tables too, or a stale like on either side re-forms the match
-- the moment the other person likes back.
create or replace function public.clear_likes_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.likes_received
  where (profile_id = new.profile_id and liker_id = new.blocked_user_id::text)
     or (profile_id = new.blocked_user_id and liker_id = new.profile_id::text);

  delete from public.likes
  where (liker_id = new.profile_id and target_id = new.blocked_user_id)
     or (liker_id = new.blocked_user_id and target_id = new.profile_id);

  delete from public.matches
  where (user_a = new.profile_id and user_b = new.blocked_user_id)
     or (user_a = new.blocked_user_id and user_b = new.profile_id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Realtime
-- ---------------------------------------------------------------------------

-- `replica identity full` so update and delete payloads carry the old row —
-- without it a subscriber sees only the primary key and cannot tell which
-- conversation just changed.
alter table public.matches replica identity full;
alter table public.likes   replica identity full;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach t in array array['matches', 'likes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
