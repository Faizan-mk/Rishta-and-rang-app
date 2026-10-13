-- ============================================================================
-- 53. Rate limits.
--
-- The email-code flow already caps itself per address (45_email_otp.sql), but
-- nothing else did: a signed-in member could fire chat messages, likes,
-- reports, stories, notes and push notifications as fast as a script could
-- send them, and the code endpoint could be walked across thousands of
-- different addresses from one machine.
--
-- One counter table and one check function serve every limit. The limits
-- themselves live in `rate_limit_config`, so they are tuned with an UPDATE,
-- not a deploy. Going over a limit does not lock anyone out for good: it
-- blocks for one window, and each repeat offence doubles the block (capped at
-- a day). A clean window clears the record.
--
-- The doubling only sticks for the edge-function callers, which read the
-- returned wait and answer 429. A trigger refuses by raising, which rolls back
-- its own bookkeeping with the insert, so the table limits below are plain
-- fixed windows: every insert past the cap is refused until the window ends.
--
-- Callers:
--   · triggers below           chat_message, like, report, story, profile_note
--   · send-push edge function  push            (per member)
--   · auth-otp edge function   otp_request_ip, otp_verify_ip (per IP)
--
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.rate_limit_config (
  name            text primary key,
  max_hits        int  not null check (max_hits > 0),
  window_seconds  int  not null check (window_seconds > 0)
);

insert into public.rate_limit_config (name, max_hits, window_seconds) values
  ('chat_message',   40,  60),     -- 40 messages a minute
  ('like',          150, 600),     -- 150 likes in 10 minutes (passes write no row)
  ('report',         10, 3600),
  ('story',          20, 3600),
  ('profile_note',   20, 3600),
  ('push',           60,  60),     -- notifications one member may trigger a minute
  ('otp_request_ip', 20, 3600),    -- codes requested from one IP an hour
  ('otp_verify_ip',  60, 3600)     -- code / ticket checks from one IP an hour
on conflict (name) do nothing;

create table if not exists public.rate_limits (
  key            text primary key,          -- '<limit name>:<subject>'
  window_start   timestamptz not null,
  hits           int not null default 0,
  strikes        int not null default 0,    -- consecutive windows that went over
  blocked_until  timestamptz
);

-- Neither table is the client's business. The check function below is
-- security definer, so it can reach them; nothing else can.
alter table public.rate_limit_config enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.rate_limit_config from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limit_config, public.rate_limits to service_role;

-- Counts one hit against `p_name` for `p_subject` (a user id or an IP).
-- Returns 0 when the hit is allowed, otherwise the seconds until it would be.
create or replace function public.rate_limit_check(p_name text, p_subject text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg     public.rate_limit_config;
  v_key     text := p_name || ':' || coalesce(p_subject, '');
  v_now     timestamptz := now();
  v_window  interval;
  v_row     public.rate_limits;
  v_block   interval;
begin
  select * into v_cfg from public.rate_limit_config where name = p_name;
  if not found or p_subject is null then
    return 0;  -- an unconfigured limit, or nobody to count against
  end if;
  v_window := make_interval(secs => v_cfg.window_seconds);

  insert into public.rate_limits (key, window_start, hits)
  values (v_key, v_now, 0)
  on conflict (key) do nothing;

  select * into v_row from public.rate_limits where key = v_key for update;

  -- Still serving a block from an earlier window.
  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return ceil(extract(epoch from (v_row.blocked_until - v_now)))::int;
  end if;

  -- A new window. One that passed without going over wipes the strikes.
  if v_row.window_start + v_window <= v_now then
    if v_row.hits <= v_cfg.max_hits then
      v_row.strikes := 0;
    end if;
    v_row.window_start := v_now;
    v_row.hits := 0;
  end if;

  v_row.hits := v_row.hits + 1;

  if v_row.hits > v_cfg.max_hits then
    v_row.strikes := v_row.strikes + 1;
    -- One window for a first offence, doubling after that, never past a day.
    v_block := least(v_window * power(2, least(v_row.strikes - 1, 16))::int, interval '1 day');
    v_row.blocked_until := v_now + v_block;
    update public.rate_limits
       set window_start = v_row.window_start, hits = v_row.hits,
           strikes = v_row.strikes, blocked_until = v_row.blocked_until
     where key = v_key;
    return ceil(extract(epoch from v_block))::int;
  end if;

  update public.rate_limits
     set window_start = v_row.window_start, hits = v_row.hits,
         strikes = v_row.strikes, blocked_until = null
   where key = v_key;
  return 0;
end;
$$;

revoke all on function public.rate_limit_check(text, text) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Insert triggers. They raise `rate_limited` (SQLSTATE P0001) with the wait in
-- the hint; the app shows its "slow down" line for that word.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text;
  v_wait    int;
begin
  -- Service-role writes (moderation, edge functions) are not throttled.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  -- tg_argv: limit name, then the column holding the acting member. Read
  -- through jsonb because each table names that column differently, and a
  -- direct NEW.<col> on a table without it fails even in an untaken branch.
  v_subject := coalesce(to_jsonb(new) ->> tg_argv[1], auth.uid()::text);

  v_wait := public.rate_limit_check(tg_argv[0], v_subject);
  if v_wait > 0 then
    raise exception 'rate_limited' using hint = 'retry_after=' || v_wait;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_rate_limit() from public, anon, authenticated;

drop trigger if exists chat_messages_rate_limit on public.chat_messages;
create trigger chat_messages_rate_limit before insert on public.chat_messages
  for each row execute function public.enforce_rate_limit('chat_message', 'sender_id');

drop trigger if exists likes_rate_limit on public.likes;
create trigger likes_rate_limit before insert on public.likes
  for each row execute function public.enforce_rate_limit('like', 'liker_id');

drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.enforce_rate_limit('report', 'reporter_id');

drop trigger if exists stories_rate_limit on public.stories;
create trigger stories_rate_limit before insert on public.stories
  for each row execute function public.enforce_rate_limit('story', 'user_id');

drop trigger if exists profile_notes_rate_limit on public.profile_notes;
create trigger profile_notes_rate_limit before insert on public.profile_notes
  for each row execute function public.enforce_rate_limit('profile_note', 'sender_id');

-- Old counters are only ever read to be reset, so a stale one is dead weight.
-- If pg_cron is on (48_story_purge_cron.sql), this keeps the table small:
--   select cron.schedule('rate-limits-cleanup', '17 * * * *',
--     $$delete from public.rate_limits
--       where window_start < now() - interval '1 day'
--         and (blocked_until is null or blocked_until < now())$$);
