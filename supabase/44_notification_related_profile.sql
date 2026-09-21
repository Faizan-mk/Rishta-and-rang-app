-- ============================================================================
-- 44. Notifications know who they are about.
--
-- A "liked your profile" row told a member someone liked them and nothing
-- else — the Notifications tab had no way to open that person's profile, so
-- tapping it did nothing but mark it read. `likes_received` (27_like_profile,
-- carried by 29) already has exactly this pairing (liker_id + kind) for the
-- Explore+ "who liked you" grid; this gives the notification the same two
-- columns directly, the way 42 gave it `match_id`, so the client does not
-- have to go correlate a notification row with a likes_received row by name.
--
-- Run after 42_notification_match_id.sql.
-- ============================================================================

alter table public.notifications
  add column if not exists related_id uuid references auth.users (id) on delete set null;

-- The mode `related_id`'s profile should open in — /profile-detail needs to
-- know which pool (dating or rishta) to look the id up in, same as
-- likes_received.kind already tells the Explore+ grid.
alter table public.notifications
  add column if not exists related_kind text check (related_kind in ('dating', 'rishta'));

create index if not exists notifications_profile_related_idx
  on public.notifications (profile_id, related_id)
  where related_id is not null;

-- `notify_member` gains two more optional, trailing parameters — same
-- drop-then-create 42 used for `match_id`, so every existing 4- and 5-arg
-- call (notify_rishta, notify_activity, notify_new_message) keeps working
-- unchanged.
drop function if exists public.notify_member(uuid, text, text, text, uuid);

create function public.notify_member(
  p_user         uuid,
  p_type         text,
  p_title        text,
  p_body         text,
  p_match_id     uuid default null,
  p_related_id   uuid default null,
  p_related_kind text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_column  text := case p_type
                      when 'match'          then 'new_matches'
                      when 'like'           then 'likes'
                      when 'message'        then 'messages'
                      when 'rishta_request' then 'rishta_requests'
                      when 'system'         then 'product_updates'
                    end;
  v_enabled boolean;
begin
  if p_user is null then
    return;
  end if;

  if v_column is not null then
    execute format(
      'select coalesce(np.%I, true) from public.notification_prefs np where np.id = $1',
      v_column
    )
    into v_enabled
    using p_user;

    if v_enabled is null then
      v_enabled := v_column <> 'product_updates';
    end if;
    if not v_enabled then
      return;
    end if;
  end if;

  insert into public.notifications (profile_id, type, title, body, match_id, related_id, related_kind)
  values (p_user, p_type, p_title, p_body, p_match_id, p_related_id, p_related_kind);
end;
$$;

revoke all on function public.notify_member(uuid, text, text, text, uuid, uuid, text) from public;
revoke all on function public.notify_member(uuid, text, text, text, uuid, uuid, text) from authenticated;

-- `notify_activity` gains the mode the like/match itself was made in, so it
-- can hand it straight to `notify_member` as `related_kind`. A new trailing
-- parameter changes the function's arity, so this is a drop-then-create too.
drop function if exists public.notify_activity(uuid, uuid, text);

create function public.notify_activity(
  p_recipient uuid,
  p_about     uuid,
  p_event     text,
  p_kind      text default 'dating'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_lang text;
begin
  select p.full_name into v_name from public.profiles p where p.id = p_about;
  select p.language  into v_lang from public.profiles p where p.id = p_recipient;
  perform public.notify_member(
    p_recipient,
    p_event,
    coalesce(v_name, ''),
    public.activity_copy(p_event, v_lang),
    null,
    p_about,
    p_kind
  );
exception
  -- Same rule as before: a notification that fails to write must never take
  -- the like or the match it is reporting down with it.
  when others then
    return;
end;
$$;

revoke all on function public.notify_activity(uuid, uuid, text, text) from public;
revoke all on function public.notify_activity(uuid, uuid, text, text) from authenticated;

-- `like_profile` (40, carried by 29's daily-cap body) now has a mode to pass:
-- its own `p_mode` argument is exactly what `related_kind` should be for the
-- 'like' notification. The match notifications right below it are left on
-- the default 'dating' — a brand-new match always opens in Dating regardless
-- of which mode either side liked in, same reasoning 40's own comment gives
-- for the match row itself.
create or replace function public.like_profile(p_target uuid, p_mode text)
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
    perform public.notify_activity(p_target, v_me, 'like', p_mode);
    return query select false, null::uuid, false, v_left;
    return;
  end if;

  v_low  := least(v_me, p_target);
  v_high := greatest(v_me, p_target);

  insert into public.matches (user_a, user_b, mode)
  values (v_low, v_high, 'dating')
  on conflict (user_a, user_b) do nothing
  returning id into v_match_id;

  v_created := v_match_id is not null;

  if v_match_id is null then
    select m.id into v_match_id
    from public.matches m
    where m.user_a = v_low and m.user_b = v_high;
  end if;

  if v_created then
    perform public.notify_activity(v_me, p_target, 'match');
    perform public.notify_activity(p_target, v_me, 'match');
  end if;

  return query select true, v_match_id, v_created, v_left;
end;
$$;

revoke all on function public.like_profile(uuid, text) from public;
grant execute on function public.like_profile(uuid, text) to authenticated;
