-- ============================================================================
-- 28. Move to Rishta, for real.
--
-- The handshake used to be a 2.2-second `setTimeout` in the client that wrote
-- the acceptance as if the other person had sent it. 26 made that impossible
-- (a message is signed by its sender now), which left the request as a message
-- and nothing more. This gives it somewhere to live: two columns on the shared
-- match row, so both people see the same pending state, and the crossing-over
-- happens once, for both of them.
--
-- Why RPCs rather than an update policy: RLS can check the row going in, but it
-- cannot compare it against the row that was there, so "you may set the request
-- but not answer your own" and "accepting is the only way mode becomes rishta"
-- are not expressible as a policy. They are expressible as two functions, and
-- 24's blanket `matches_update` — which let either participant write any column
-- at any time — is dropped in favour of them.
--
-- Run after 26_two_way_messaging.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The state
-- ---------------------------------------------------------------------------

alter table public.matches
  add column if not exists rishta_requested_by uuid references auth.users (id) on delete set null,
  add column if not exists rishta_requested_at timestamptz;

-- A request is from one of the two people in the row, and only ever one at a
-- time — the pending state is the pair's, not each member's.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matches_requester_is_participant') then
    alter table public.matches
      add constraint matches_requester_is_participant
      check (rishta_requested_by is null or rishta_requested_by in (user_a, user_b));
  end if;
end
$$;

-- Direct updates go away: `mode` is now moved by respond_rishta and nothing
-- else, and the request columns by request_rishta. Both are definer functions
-- that check who is asking, which a policy cannot do on its own.
drop policy if exists "matches_update" on public.matches;

-- ---------------------------------------------------------------------------
-- 2. Asking
-- ---------------------------------------------------------------------------

-- The rishta half of a profile is what the other member is being asked to
-- consider. Sending the request without it is asking them to decide on nothing,
-- so the gate is here rather than in the client, where it could be skipped.
create or replace function public.rishta_profile_complete(p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and coalesce(p.rishta_religion, '') <> ''
      and coalesce(p.rishta_education, '') <> ''
      and coalesce(p.rishta_family_background, '') <> ''
      and coalesce(p.rishta_readiness, '') not in ('', 'browsing')
  );
$$;

grant execute on function public.rishta_profile_complete(uuid) to authenticated;

create or replace function public.request_rishta(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := auth.uid();
  v_match public.matches%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_me not in (v_match.user_a, v_match.user_b) then
    raise exception 'not_a_participant';
  end if;
  if v_match.mode = 'rishta' then
    raise exception 'already_rishta';
  end if;
  if v_match.rishta_requested_by is not null then
    raise exception 'request_already_pending';
  end if;
  if not public.rishta_profile_complete(v_me) then
    raise exception 'rishta_profile_incomplete';
  end if;

  update public.matches
  set rishta_requested_by = v_me, rishta_requested_at = now()
  where id = p_match_id;
end;
$$;

revoke all on function public.request_rishta(uuid) from public;
grant execute on function public.request_rishta(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Answering
-- ---------------------------------------------------------------------------

-- Only the other member may answer, which is the rule the old simulation could
-- not express at all: it answered on their behalf.
create or replace function public.respond_rishta(p_match_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := auth.uid();
  v_match public.matches%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_me not in (v_match.user_a, v_match.user_b) then
    raise exception 'not_a_participant';
  end if;
  if v_match.rishta_requested_by is null then
    raise exception 'no_pending_request';
  end if;
  if v_match.rishta_requested_by = v_me then
    raise exception 'cannot_answer_own_request';
  end if;

  if p_accept then
    -- One row, so one write moves the conversation for both of them.
    update public.matches
    set mode = 'rishta', rishta_requested_by = null, rishta_requested_at = null
    where id = p_match_id;
    return 'accepted';
  end if;

  -- Declining clears the request and leaves the conversation where it was; the
  -- requester may ask again later.
  update public.matches
  set rishta_requested_by = null, rishta_requested_at = null
  where id = p_match_id;
  return 'declined';
end;
$$;

revoke all on function public.respond_rishta(uuid, boolean) from public;
grant execute on function public.respond_rishta(uuid, boolean) to authenticated;

-- `matches` is already `replica identity full` and in the publication (24), so
-- the update reaches the other member's session without anything further here —
-- which is what puts the banner on their screen while they are looking at it.
