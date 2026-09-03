-- ============================================================================
-- 27. like_profile — one call that likes, checks for the reciprocal like, and
-- creates the match if there is one.
--
-- The client used to do this in three round trips: insert the like, ask
-- `is_mutual_like`, then insert the match. Between any two of those the app can
-- lose the network or be killed, and the half-finished state is a like that
-- landed with no match behind it — the pair both liked each other and neither
-- has a conversation. This does the whole thing in one statement's worth of
-- transaction, and returns what the caller actually needs to know: whether they
-- just matched, which conversation it is, and whether this call is the one that
-- created it (so a celebration fires once, not on every re-like).
--
-- security definer because it writes `likes_received` on the *target's* behalf
-- and reads the reciprocal like, neither of which the caller may do directly.
-- It therefore does its own checking: the liker is always auth.uid(), never a
-- parameter, and a blocked pair is refused the same way the policies refuse it.
--
-- Run after 24_matching.sql (25 and 26 optional, no dependency).
-- ============================================================================

create or replace function public.like_profile(p_target uuid, p_mode text)
returns table (matched boolean, match_id uuid, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me         uuid := auth.uid();
  v_low        uuid;
  v_high       uuid;
  v_reciprocal boolean;
  v_match_id   uuid;
  v_created    boolean := false;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_target = v_me then
    raise exception 'cannot_like_self';
  end if;
  -- The same refusal `likes_insert` would give, stated here because a definer
  -- function does not go through it.
  if public.is_blocked_pair(v_me, p_target) then
    raise exception 'blocked';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target) then
    raise exception 'no_such_profile';
  end if;

  -- 1. The like itself. Re-liking updates the mode rather than stacking.
  insert into public.likes (liker_id, target_id, mode)
  values (v_me, p_target, p_mode)
  on conflict (liker_id, target_id) do update set mode = excluded.mode;

  -- 2. The display row behind Explore+'s "who liked you". The card is copied
  -- from the liker's own profile rather than passed in, so it cannot disagree
  -- with what the target would see on the profile itself.
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

  -- 3. Did they like us first?
  select exists (
    select 1 from public.likes l where l.liker_id = p_target and l.target_id = v_me
  ) into v_reciprocal;

  if not v_reciprocal then
    return query select false, null::uuid, false;
    return;
  end if;

  -- 4. They did, so the pair has a conversation. Ordered uuids, and
  -- `on conflict do nothing` because the other side's call may have got here
  -- first — that is a race we read our way out of, not an error.
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

  return query select true, v_match_id, v_created;
end;
$$;

-- Definer functions are executable by `public` unless told otherwise, and this
-- one writes. Members only.
revoke all on function public.like_profile(uuid, text) from public;
grant execute on function public.like_profile(uuid, text) to authenticated;
