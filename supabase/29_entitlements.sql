-- ============================================================================
-- 29. Entitlements the member cannot grant themselves.
--
-- Two holes, both of them "the client is the only thing stopping you":
--
--   1. `profiles_update` (2_profiles.sql) is `auth.uid() = id` and nothing more,
--      so a member may write ANY column on their own row — `is_explore_plus`
--      included. The paid tier was free to anyone who sent one API call, and
--      `hidden_at` could be cleared by a profile the reports trigger had just
--      auto-hidden.
--
--   2. `daily_likes` is fully client-writable, so the 15-a-day cap came off by
--      writing `count = 0`.
--
-- RLS cannot express either fix: a policy sees the row going in, not the row it
-- replaces, so "you may update your bio but not your subscription" is not a
-- policy. It is a trigger, and the counter moves into `like_profile`, which is
-- already the one place a like is recorded.
--
-- Deliberately silent rather than raising: the app sends the whole profile row
-- on every save, so raising would break editing a bio. The protected columns
-- are simply pinned to what they were, and a definer function (a verified
-- purchase, the reports trigger) remains the only thing that can move them.
--
-- Run after 27_like_profile.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pin the columns a member must not write
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_entitlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `authenticated` is the role PostgREST runs a member's request as. A definer
  -- function runs as the owner instead, so the purchase path and the reports
  -- trigger pass straight through this.
  if current_user = 'authenticated' then
    new.is_explore_plus       := old.is_explore_plus;
    new.subscription_plan     := old.subscription_plan;
    new.subscription_renews_at := old.subscription_renews_at;
    new.has_used_trial        := old.has_used_trial;
    -- Not billing, but the same shape of problem: an auto-hidden profile could
    -- otherwise un-hide itself, and a badge could grant itself.
    new.hidden_at             := old.hidden_at;
    new.selfie_verified       := old.selfie_verified;
    new.bureau_verified       := old.bureau_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_entitlements on public.profiles;
create trigger profiles_guard_entitlements
  before update on public.profiles
  for each row execute function public.guard_profile_entitlements();

-- The one door in. Nothing calls it yet — real billing (an Edge Function
-- validating the receipt) is the caller it is waiting for — but it is what the
-- purchase flow grants through, so the columns have exactly one writer.
create or replace function public.grant_explore_plus(
  p_user uuid,
  p_plan text,
  p_renews_at timestamptz,
  p_used_trial boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set is_explore_plus = true,
      subscription_plan = p_plan,
      subscription_renews_at = p_renews_at,
      has_used_trial = has_used_trial or p_used_trial
  where id = p_user;
end;
$$;

create or replace function public.revoke_explore_plus(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set is_explore_plus = false,
      subscription_plan = null,
      subscription_renews_at = null
  where id = p_user;
end;
$$;

-- Members do not call these; a receipt-validating function does, as
-- service_role. Stated rather than assumed.
revoke all on function public.grant_explore_plus(uuid, text, timestamptz, boolean) from public;
revoke all on function public.revoke_explore_plus(uuid) from public;
grant execute on function public.grant_explore_plus(uuid, text, timestamptz, boolean) to service_role;
grant execute on function public.revoke_explore_plus(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. The counter stops being client-writable
-- ---------------------------------------------------------------------------

-- Reading it is fine and the app needs it — that is the "3 likes left" line.
-- Writing it is what `like_profile` does now, as the owner.
drop policy if exists "daily_likes_insert" on public.daily_likes;
drop policy if exists "daily_likes_update" on public.daily_likes;
drop policy if exists "daily_likes_delete" on public.daily_likes;

-- ---------------------------------------------------------------------------
-- 3. The cap moves into the RPC
-- ---------------------------------------------------------------------------

-- The return type gains a column, which `create or replace` cannot do.
drop function if exists public.like_profile(uuid, text);

create function public.like_profile(p_target uuid, p_mode text)
returns table (matched boolean, match_id uuid, is_new boolean, likes_left integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_daily_free constant integer := 15;
  v_me         uuid := auth.uid();
  v_low        uuid;
  v_high       uuid;
  v_reciprocal boolean;
  v_match_id   uuid;
  v_created    boolean := false;
  v_unlimited  boolean;
  v_first_time boolean;
  v_today      text := to_char(current_date, 'YYYY-MM-DD');
  v_used       integer := 0;
  v_left       integer;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_target = v_me then
    raise exception 'cannot_like_self';
  end if;
  if public.is_blocked_pair(v_me, p_target) then
    raise exception 'blocked';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target) then
    raise exception 'no_such_profile';
  end if;

  select coalesce(p.is_explore_plus, false) into v_unlimited
  from public.profiles p where p.id = v_me;

  -- Re-liking someone already liked costs nothing: the row is the same row, and
  -- charging for it would let the count be run up on one person.
  v_first_time := not exists (
    select 1 from public.likes l where l.liker_id = v_me and l.target_id = p_target
  );

  if not v_unlimited then
    -- Read the count whether or not this like is chargeable: `likes_left` has
    -- to be right on a re-like too, and a re-like reports without spending.
    select case when d.date = v_today then d.count else 0 end into v_used
    from public.daily_likes d where d.id = v_me;
    v_used := coalesce(v_used, 0);

    if v_first_time then
      if v_used >= c_daily_free then
        raise exception 'daily_like_limit_reached';
      end if;

      insert into public.daily_likes (id, date, count)
      values (v_me, v_today, v_used + 1)
      on conflict (id) do update set date = v_today, count = v_used + 1;
      v_used := v_used + 1;
    end if;
  end if;

  v_left := case when v_unlimited then -1 else greatest(c_daily_free - v_used, 0) end;

  insert into public.likes (liker_id, target_id, mode)
  values (v_me, p_target, p_mode)
  on conflict (liker_id, target_id) do update set mode = excluded.mode;

  insert into public.likes_received (profile_id, liker_id, kind, name, age, city, photo, created_at)
  select
    p_target,
    v_me::text,
    p_mode,
    p.full_name,
    case
      when p.dob ~ '^\d{4}-\d{2}-\d{2}$'
        then greatest(0, extract(year from age(current_date, p.dob::date))::integer)
      else 0
    end,
    p.city,
    coalesce(p.photos[1], ''),
    now()
  from public.profiles p
  where p.id = v_me
  on conflict (profile_id, liker_id) do update set
    kind = excluded.kind,
    name = excluded.name,
    age = excluded.age,
    city = excluded.city,
    photo = excluded.photo,
    created_at = excluded.created_at;

  select exists (
    select 1 from public.likes l where l.liker_id = p_target and l.target_id = v_me
  ) into v_reciprocal;

  if not v_reciprocal then
    return query select false, null::uuid, false, v_left;
    return;
  end if;

  v_low  := least(v_me, p_target);
  v_high := greatest(v_me, p_target);

  insert into public.matches (user_a, user_b, mode)
  values (v_low, v_high, p_mode)
  on conflict (user_a, user_b) do nothing
  returning id into v_match_id;

  v_created := v_match_id is not null;

  if v_match_id is null then
    select m.id into v_match_id
    from public.matches m
    where m.user_a = v_low and m.user_b = v_high;
  end if;

  return query select true, v_match_id, v_created, v_left;
end;
$$;

revoke all on function public.like_profile(uuid, text) from public;
grant execute on function public.like_profile(uuid, text) to authenticated;
