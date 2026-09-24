-- ============================================================================
-- 45. Email OTP for signup and password reset.
--
-- Both flows used to lean on Supabase's own emails, which carry a *link*: the
-- member left the app, landed in a browser, and depended on the redirect URL
-- being on the project's allow-list to get back. They now get a 6-digit code
-- (sent through Resend by supabase/functions/auth-otp) and type it into the app.
--
-- Everything here is reachable only by the service role — the edge function is
-- the one caller. RLS is on with no policies, and every function has execute
-- revoked from public/anon/authenticated. The app never reads a code, a hash or
-- a ticket; it only ever sees what the function chooses to return.
--
-- What the rows enforce, atomically (row lock per email + purpose, so two
-- parallel requests can't both slip under a limit):
--   · a code expires            (p_ttl_seconds, set by the function)
--   · resend cooldown           (p_cooldown_seconds between sends)
--   · hourly send cap           (p_max_sends per rolling hour window)
--   · max wrong attempts        (max_attempts, then the code is dead)
--   · single use                (a correct code is consumed; it mints a ticket)
--   · single-use ticket         (the ticket is what authorises account creation
--                                or the password write, and is burned by it)
--
-- Codes and tickets are stored only as HMAC-SHA256 hashes keyed with a secret
-- the database never sees, so a leaked row cannot be brute-forced offline.
--
-- Run after 16_functions.sql.
-- ====================================================J========================

create table if not exists public.email_otps (
  email text not null,
  purpose text not null check (purpose in ('signup', 'reset')),
  code_hash text,
  expires_at timestamptz,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  last_sent_at timestamptz,
  window_started_at timestamptz,
  send_count int not null default 0,
  ticket_hash text,
  ticket_expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (email, purpose)
);

alter table public.email_otps enable row level security;
-- No policies on purpose: nobody but the service role (which bypasses RLS)
-- touches this table.
revoke all on table public.email_otps from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Issue a code — or say how long until one may be issued
-- ---------------------------------------------------------------------------
-- Returns { status: 'ok' } or { status: 'cooldown' | 'rate_limited',
-- retry_after: seconds }. A fresh code replaces the old one outright: the
-- attempt counter resets, any unspent ticket is dropped.
create or replace function public.otp_issue(
  p_email text,
  p_purpose text,
  p_code_hash text,
  p_ttl_seconds int,
  p_cooldown_seconds int,
  p_max_sends int,
  p_max_attempts int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.email_otps;
  v_now timestamptz := now();
  v_window interval := interval '1 hour';
begin
  insert into public.email_otps (email, purpose)
  values (p_email, p_purpose)
  on conflict (email, purpose) do nothing;

  select * into v_row
  from public.email_otps
  where email = p_email and purpose = p_purpose
  for update;

  if v_row.last_sent_at is not null
     and v_row.last_sent_at + make_interval(secs => p_cooldown_seconds) > v_now then
    return jsonb_build_object(
      'status', 'cooldown',
      'retry_after', ceil(extract(epoch from (v_row.last_sent_at + make_interval(secs => p_cooldown_seconds) - v_now)))::int
    );
  end if;

  if v_row.window_started_at is null or v_row.window_started_at + v_window <= v_now then
    v_row.window_started_at := v_now;
    v_row.send_count := 0;
  end if;

  if v_row.send_count >= p_max_sends then
    return jsonb_build_object(
      'status', 'rate_limited',
      'retry_after', ceil(extract(epoch from (v_row.window_started_at + v_window - v_now)))::int
    );
  end if;

  update public.email_otps
  set code_hash = p_code_hash,
      expires_at = v_now + make_interval(secs => p_ttl_seconds),
      attempts = 0,
      max_attempts = p_max_attempts,
      consumed_at = null,
      last_sent_at = v_now,
      window_started_at = v_row.window_started_at,
      send_count = v_row.send_count + 1,
      ticket_hash = null,
      ticket_expires_at = null
  where email = p_email and purpose = p_purpose;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- The email provider refused the send: give the cooldown back so the member
-- can retry at once. The hourly count stands — that is the abuse brake.
create or replace function public.otp_release_cooldown(p_email text, p_purpose text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_otps
  set last_sent_at = null, code_hash = null, expires_at = null
  where email = p_email and purpose = p_purpose;
$$;

-- ---------------------------------------------------------------------------
-- 2. Check a code
-- ---------------------------------------------------------------------------
-- Returns { status: 'ok' } (code consumed, ticket stored) or
-- { status: 'invalid', remaining } / 'expired' / 'locked' / 'missing'.
-- The comparison happens under the row lock, so parallel guesses each cost an
-- attempt instead of racing past the counter.
create or replace function public.otp_verify(
  p_email text,
  p_purpose text,
  p_code_hash text,
  p_ticket_hash text,
  p_ticket_ttl_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.email_otps;
  v_now timestamptz := now();
begin
  select * into v_row
  from public.email_otps
  where email = p_email and purpose = p_purpose
  for update;

  if not found or v_row.code_hash is null then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_row.consumed_at is not null or v_row.expires_at <= v_now then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_row.attempts >= v_row.max_attempts then
    return jsonb_build_object('status', 'locked');
  end if;

  if v_row.code_hash <> p_code_hash then
    update public.email_otps
    set attempts = attempts + 1
    where email = p_email and purpose = p_purpose;

    if v_row.attempts + 1 >= v_row.max_attempts then
      return jsonb_build_object('status', 'locked');
    end if;
    return jsonb_build_object('status', 'invalid', 'remaining', v_row.max_attempts - v_row.attempts - 1);
  end if;

  update public.email_otps
  set consumed_at = v_now,
      code_hash = null,
      ticket_hash = p_ticket_hash,
      ticket_expires_at = v_now + make_interval(secs => p_ticket_ttl_seconds)
  where email = p_email and purpose = p_purpose;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Spend a ticket
-- ---------------------------------------------------------------------------
-- True exactly once per ticket, and only before it expires. The ticket is what
-- proves "this caller typed the right code for this address a moment ago".
create or replace function public.otp_consume_ticket(p_email text, p_purpose text, p_ticket_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hit int;
begin
  update public.email_otps
  set ticket_hash = null, ticket_expires_at = null
  where email = p_email
    and purpose = p_purpose
    and ticket_hash = p_ticket_hash
    and ticket_expires_at > now();
  get diagnostics v_hit = row_count;
  return v_hit = 1;
end;
$$;

-- Same test without spending it — signup checks first and burns the ticket
-- only once the account exists, so a transient failure creating it doesn't
-- send the member back to request a new code.
create or replace function public.otp_ticket_valid(p_email text, p_purpose text, p_ticket_hash text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.email_otps
    where email = p_email
      and purpose = p_purpose
      and ticket_hash = p_ticket_hash
      and ticket_expires_at > now()
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Lookups the function needs from auth
-- ---------------------------------------------------------------------------

create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select u.id from auth.users u where lower(u.email) = lower(p_email) limit 1;
$$;

-- After a password reset every existing session ends: whoever else was signed
-- in with the old password (the reason for a reset, often) is signed out the
-- next time their access token needs refreshing.
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = p_user_id;
$$;

revoke all on function public.otp_issue(text, text, text, int, int, int, int) from public, anon, authenticated;
revoke all on function public.otp_release_cooldown(text, text) from public, anon, authenticated;
revoke all on function public.otp_verify(text, text, text, text, int) from public, anon, authenticated;
revoke all on function public.otp_consume_ticket(text, text, text) from public, anon, authenticated;
revoke all on function public.otp_ticket_valid(text, text, text) from public, anon, authenticated;
revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;

grant execute on function public.otp_issue(text, text, text, int, int, int, int) to service_role;
grant execute on function public.otp_release_cooldown(text, text) to service_role;
grant execute on function public.otp_verify(text, text, text, text, int) to service_role;
grant execute on function public.otp_consume_ticket(text, text, text) to service_role;
grant execute on function public.otp_ticket_valid(text, text, text) to service_role;
grant execute on function public.auth_user_id_by_email(text) to service_role;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
