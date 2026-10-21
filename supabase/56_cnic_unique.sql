-- ============================================================================
-- 56. One account per CNIC.
--
-- Until now `profile_verification.cnic_number` was a free text column with no
-- uniqueness: the same CNIC could sit behind any number of accounts, as long as
-- each used a different email.
--
-- The rule is held by `cnic_registry`, one row per account, keyed by an
-- HMAC-SHA256 of the CNIC's 13 digits. The key (CNIC_SECRET) lives only in the
-- edge functions, so the table can't be turned back into CNIC numbers by
-- anyone who reads it, and two spellings of one CNIC (with or without dashes)
-- land on the same hash. The primary key is the uniqueness; the edge functions
-- (supabase/functions/cnic, and auth-otp's signup) are the only writers.
--
--   · cnic_hash primary key   — one account per CNIC
--   · user_id unique          — one CNIC per account; changing it moves the row
--   · on delete cascade       — a deleted account frees its CNIC
--
-- `cnic_number` itself is pinned for member sessions, the same way 29 pins
-- the entitlement columns: otherwise a member could sign up with one CNIC and
-- then write another one straight into their row. It moves only through
-- cnic_claim, which checks the registry first.
--
-- Existing rows are not hashed here — the database never sees the secret. After
-- deploying, run the `backfill` action of the cnic function once (see its
-- header); it fills the registry and lists any CNIC already shared by two
-- accounts.
--
-- Run after 4_profile_verification.sql. Safe to run more than once.
-- ============================================================================

create table if not exists public.cnic_registry (
  cnic_hash  text primary key,
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cnic_registry enable row level security;
-- No policies on purpose: only the service role (which bypasses RLS) reads or
-- writes it.
revoke all on table public.cnic_registry from public, anon, authenticated;
grant all on table public.cnic_registry to service_role;

-- ---------------------------------------------------------------------------
-- 1. Pin cnic_number for member sessions
-- ---------------------------------------------------------------------------

-- security INVOKER on purpose — see guard_profile_entitlements in 29: only an
-- invoker trigger sees `authenticated` for a member's request and the owner for
-- cnic_claim below.
create or replace function public.guard_profile_verification_cnic()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' then
      new.cnic_number := old.cnic_number;
    else
      new.cnic_number := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_verification_guard_cnic on public.profile_verification;
create trigger profile_verification_guard_cnic
  before insert or update on public.profile_verification
  for each row execute function public.guard_profile_verification_cnic();

-- ---------------------------------------------------------------------------
-- 2. Claim a CNIC for an account
-- ---------------------------------------------------------------------------
-- 'ok' when the CNIC is now this account's (including when it already was),
-- 'taken' when another account holds it. A member changing their CNIC moves
-- their one row to the new hash, freeing the old CNIC. Two accounts claiming
-- the same new CNIC at once can't both win: the loser hits the primary key.
create or replace function public.cnic_claim(p_user_id uuid, p_cnic_hash text, p_cnic_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holder uuid;
begin
  select user_id into v_holder from public.cnic_registry where cnic_hash = p_cnic_hash;
  if v_holder is not null and v_holder <> p_user_id then
    return 'taken';
  end if;

  begin
    insert into public.cnic_registry (cnic_hash, user_id)
    values (p_cnic_hash, p_user_id)
    on conflict (user_id) do update set cnic_hash = excluded.cnic_hash, created_at = now();
  exception when unique_violation then
    return 'taken';
  end;

  insert into public.profile_verification (id, cnic_number)
  values (p_user_id, p_cnic_number)
  on conflict (id) do update set cnic_number = excluded.cnic_number;

  return 'ok';
end;
$$;

revoke all on function public.cnic_claim(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cnic_claim(uuid, text, text) to service_role;

-- The backfill's work list: stored CNICs not yet in the registry, oldest
-- account first.
create or replace function public.cnic_backfill_rows()
returns table (id uuid, cnic_number text)
language sql
security definer
set search_path = ''
stable
as $$
  select v.id, v.cnic_number
  from public.profile_verification v
  join auth.users u on u.id = v.id
  where coalesce(v.cnic_number, '') <> ''
    and not exists (select 1 from public.cnic_registry r where r.user_id = v.id)
  order by u.created_at;
$$;

revoke all on function public.cnic_backfill_rows() from public, anon, authenticated;
grant execute on function public.cnic_backfill_rows() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Rate limits for the cnic function
-- ---------------------------------------------------------------------------
-- "Is this CNIC registered?" is answered to signed-out visitors on signup's
-- first step, so it is capped per IP like the OTP endpoints (53_rate_limits).
insert into public.rate_limit_config (name, max_hits, window_seconds) values
  ('cnic_check_ip', 20, 3600),   -- CNIC availability checks from one IP an hour
  ('cnic_claim',    10, 3600)    -- CNIC changes one member may attempt an hour
on conflict (name) do nothing;
