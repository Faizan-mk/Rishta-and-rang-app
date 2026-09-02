-- ============================================================================
-- 21. reports — what happens when someone taps Report.
--
-- Until now the reason was shown back to the reporter in a toast and thrown
-- away. This gives it somewhere to land, and gives the community a floor: a
-- profile three different people have reported stops being shown to anyone
-- while it waits for review.
--
-- Run after 2_profiles.sql.
-- ============================================================================

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users (id) on delete cascade,
  target_id    uuid not null references auth.users (id) on delete cascade,
  -- A stable key from ReportDialog ('harassment', 'fakeProfile', …), never the
  -- translated label: the moderator reading this queue must see the same word
  -- whichever language the reporter was using.
  reason       text not null,
  -- The reporter's own words, when they picked "other". Free text.
  details      text not null default '',
  -- Where they reported from: 'chat' | 'discover' | 'profile'.
  context      text not null default 'profile',
  status       text not null default 'pending'
                 check (status in ('pending', 'reviewing', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now(),
  -- One standing report per person per target. Reporting again updates the
  -- reason rather than inflating the count that drives the auto-hide.
  unique (reporter_id, target_id),
  constraint reports_no_self check (reporter_id <> target_id)
);

create index reports_target_idx on public.reports (target_id);
create index reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- Insert-only for members. Deliberately no select policy: a reporter cannot
-- read back their own report, and nobody can enumerate who reported whom or
-- discover that they have been reported. Moderation reads through
-- `report_queue` below, as service_role.
create policy "reports_insert" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

grant insert on public.reports to authenticated;
grant all on public.reports to service_role;

-- ---------------------------------------------------------------------------
-- Auto-hide
-- ---------------------------------------------------------------------------

-- Set when enough distinct people have reported this profile. Discovery, Explore
-- and the likes list all stop returning the row while it is non-null; the owner
-- still sees their own profile, so they are not left staring at a broken app.
alter table public.profiles
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_reason text;

create index if not exists profiles_hidden_idx on public.profiles (hidden_at);

-- Three different reporters. The unique constraint above already means one row
-- per reporter, so this is a plain count — one person cannot hide someone by
-- reporting them repeatedly.
create or replace function public.apply_report_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_count integer;
begin
  select count(*) into report_count
  from public.reports
  where target_id = new.target_id;

  if report_count >= 3 then
    update public.profiles
    set hidden_at = coalesce(hidden_at, now()),
        hidden_reason = 'auto:reports'
    where id = new.target_id;
  end if;

  return new;
end;
$$;

create trigger reports_apply_threshold
  after insert or update on public.reports
  for each row execute function public.apply_report_threshold();

-- Hidden profiles drop out of everyone's deck. `id = auth.uid()` keeps the
-- owner's own row readable so their profile screen still works.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (
    id = auth.uid() or hidden_at is null
  );

-- ---------------------------------------------------------------------------
-- Moderation queue
-- ---------------------------------------------------------------------------

-- The minimal read-only view for Supabase Studio. Shows who was reported, what
-- for, how many distinct people said it, and whether the auto-hide has fired.
-- service_role only — Studio's SQL editor runs as service_role, the app never
-- reaches this.
create or replace view public.report_queue as
select
  r.id,
  r.created_at,
  r.status,
  r.reason,
  r.details,
  r.context,
  r.target_id,
  target.full_name  as target_name,
  target.city       as target_city,
  target.hidden_at  as target_hidden_at,
  (select count(*) from public.reports r2 where r2.target_id = r.target_id) as reports_against_target,
  r.reporter_id,
  reporter.full_name as reporter_name
from public.reports r
left join public.profiles target   on target.id = r.target_id
left join public.profiles reporter on reporter.id = r.reporter_id
order by r.created_at desc;

revoke all on public.report_queue from authenticated, anon;
grant select on public.report_queue to service_role;

-- ---------------------------------------------------------------------------
-- Un-hiding
-- ---------------------------------------------------------------------------

-- For the moderator: clearing hidden_at puts the profile back in circulation.
-- Run from Studio, e.g.
--   select public.moderate_profile('<uuid>', false, 'dismissed');
create or replace function public.moderate_profile(
  p_target_id uuid,
  p_hidden boolean,
  p_status text default 'reviewing'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end,
      hidden_reason = case when p_hidden then 'manual:review' else null end
  where id = p_target_id;

  update public.reports
  set status = p_status
  where target_id = p_target_id and status in ('pending', 'reviewing');
end;
$$;

revoke all on function public.moderate_profile(uuid, boolean, text) from authenticated, anon;
grant execute on function public.moderate_profile(uuid, boolean, text) to service_role;
