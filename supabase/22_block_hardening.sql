-- ============================================================================
-- 22. Block hardening — make a block mean something on both sides, and make the
-- database the thing that enforces it.
--
-- Two problems this fixes:
--
--   1. `blocked_users.blocked_id` held the *match row's* id, not the person's.
--      A match row is per-user and per-conversation, so the id A stored when
--      blocking B was meaningless to B, and meaningless again if A ever met B
--      through a different match row. The person's uuid was in
--      `source_profile_id` all along; this promotes it.
--
--   2. Blocking was one-directional and enforced only in the client: B still
--      saw A in their deck, could still open the thread, could still send. Now
--      `profiles`, `chat_messages` and `likes_received` all refuse across a
--      block in either direction, so a client bug cannot leak a blocked pair
--      back to each other.
--
-- Run after 11_blocked_users.sql and 21_reports.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Migrate blocked_id → the blocked person's uuid
-- ---------------------------------------------------------------------------

-- New column first, so a half-finished run never leaves the old one destroyed.
alter table public.blocked_users
  add column if not exists blocked_user_id uuid references auth.users (id) on delete cascade;

-- Backfill, in order of confidence:
--   a) source_profile_id, which is already the person's id where it was set;
--   b) failing that, the match row the old blocked_id pointed at.
update public.blocked_users b
set blocked_user_id = nullif(b.source_profile_id, '')::uuid
where b.blocked_user_id is null
  and b.source_profile_id is not null
  and b.source_profile_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

update public.blocked_users b
set blocked_user_id = nullif(m.source_profile_id, '')::uuid
from public.matches m
where b.blocked_user_id is null
  and b.blocked_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and m.id = b.blocked_id::uuid
  and m.source_profile_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Rows we could not resolve to a person are demo/legacy blocks of a profile
-- that no longer exists. Keeping them would mean a NOT NULL we cannot satisfy
-- and a block pointing at nobody, so they go.
delete from public.blocked_users where blocked_user_id is null;

alter table public.blocked_users
  alter column blocked_user_id set not null;

-- The old unique was on (profile_id, blocked_id); the meaningful one is per
-- person. Dropped by name-independent lookup so this runs on any project.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'blocked_users' and con.contype = 'u';

  if constraint_name is not null then
    execute format('alter table public.blocked_users drop constraint %I', constraint_name);
  end if;
end
$$;

alter table public.blocked_users
  add constraint blocked_users_unique_pair unique (profile_id, blocked_user_id);

create index if not exists blocked_users_blocked_idx on public.blocked_users (blocked_user_id);

-- `blocked_id` stays for now, nullable, so an older build still running against
-- this database does not fail its inserts mid-rollout. Drop it once every
-- client is on the new column:
--   alter table public.blocked_users drop column blocked_id;
alter table public.blocked_users alter column blocked_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. The both-ways predicate
-- ---------------------------------------------------------------------------

-- security definer on purpose: blocked_users is owner-only by RLS, so a member
-- can only see the blocks they created. Checking "did the other person block
-- me?" needs to read a row they do not own. This function answers only yes/no
-- about a specific pair — it never returns anyone's block list.
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.blocked_users bu
    where (bu.profile_id = a and bu.blocked_user_id = b)
       or (bu.profile_id = b and bu.blocked_user_id = a)
  );
$$;

grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;

-- The other person in a conversation, from the match row that owns it.
create or replace function public.match_counterpart(p_match_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select nullif(m.source_profile_id, '')::uuid
  from public.matches m
  where m.id = p_match_id
    and m.source_profile_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  limit 1;
$$;

grant execute on function public.match_counterpart(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Enforce it
-- ---------------------------------------------------------------------------

-- Discovery, Explore, profile detail — all read `profiles`. One policy covers
-- every surface at once, which is the point of doing this in the database.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or (hidden_at is null and not public.is_blocked_pair(auth.uid(), id))
  );

-- Messages. A match row carries the counterpart, so the check reaches the other
-- person even though chat_messages itself only stores the owner. A match with
-- no resolvable counterpart (demo/legacy rows) is left alone rather than
-- bricked — `match_counterpart` returns null and the guard passes.
drop policy if exists "messages_insert" on public.chat_messages;
create policy "messages_insert" on public.chat_messages
  for insert to authenticated with check (
    profile_id = auth.uid()
    and not public.is_blocked_pair(
      auth.uid(),
      coalesce(public.match_counterpart(match_id), auth.uid())
    )
  );

-- Likes. Without this, a blocked person still surfaces in "who liked you".
drop policy if exists "likes_received_insert" on public.likes_received;
create policy "likes_received_insert" on public.likes_received
  for insert to authenticated with check (
    cast(liker_id as uuid) = auth.uid()
    and not public.is_blocked_pair(auth.uid(), profile_id)
  );

-- Blocking someone should also clear the like they already left on you, and the
-- one you left on them — otherwise the block is undone by a stale row in the
-- Explore+ list.
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
  return new;
end;
$$;

drop trigger if exists blocked_users_clear_likes on public.blocked_users;
create trigger blocked_users_clear_likes
  after insert on public.blocked_users
  for each row execute function public.clear_likes_on_block();
