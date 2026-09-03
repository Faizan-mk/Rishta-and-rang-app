-- ============================================================================
-- Proves item 10's "done when": a hand-crafted API call cannot grant itself
-- Explore+ or extra likes.
--
-- Everything here is what a member could send by hand — a plain update on their
-- own row, a plain write to their own counter. Both are permitted by RLS and
-- both must come to nothing: the trigger pins the columns, and the counter has
-- no write policy at all.
--
-- The cap is measured by starting the counter one short of the limit rather
-- than sending fifteen likes, so it needs three profiles instead of seventeen.
-- It also checks the part that is easy to get wrong: re-liking someone already
-- liked must not cost a second like.
--
-- Everything rolls back with the closing exception — the profile edit, the
-- counter and the likes included.
--
-- Run after 29_entitlements.sql.
-- ============================================================================

do $$
declare
  v_me       uuid;
  v_uid      uuid;
  v_pro      boolean;
  v_count    integer;
  v_left     integer;
  v_targets  uuid[];
  v_hit      boolean := false;
  v_results  text := '';
begin
  select p.id into v_me from public.profiles p where p.hidden_at is null order by p.id limit 1;
  select array_agg(p.id) into v_targets from (
    select p.id from public.profiles p
    where p.hidden_at is null and p.id <> v_me and not public.is_blocked_pair(v_me, p.id)
    order by p.id limit 2
  ) p;

  if coalesce(array_length(v_targets, 1), 0) < 2 then
    raise exception E'NEED AT LEAST THREE PROFILES\n\nFound % other profile(s). Create another test account and run this again.',
      coalesce(array_length(v_targets, 1), 0);
  end if;

  -- A known starting point, as the owner. The counter starts one short of the
  -- limit so the cap can be reached with a single like.
  update public.profiles
  set is_explore_plus = false, subscription_plan = null, subscription_renews_at = null
  where id = v_me;
  delete from public.likes where liker_id = v_me and target_id = any(v_targets);
  insert into public.daily_likes (id, date, count)
  values (v_me, to_char(current_date, 'YYYY-MM-DD'), 14)
  on conflict (id) do update set date = excluded.date, count = 14;

  -- --- become a member -----------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_me, 'role', 'authenticated')::text, true);

  v_uid := auth.uid();
  if v_uid is distinct from v_me then
    raise exception E'IMPERSONATION DID NOT TAKE\n\nauth.uid() = %, expected %.',
      coalesce(v_uid::text, 'null'), v_me;
  end if;
  v_results := v_results || format(E'0. impersonating a member  auth.uid() = %s -> PASS\n', v_uid);

  -- --- 1. grant yourself the paid tier -------------------------------------
  update public.profiles
  set is_explore_plus = true, subscription_plan = 'yearly',
      subscription_renews_at = now() + interval '1 year'
  where id = v_me;

  select p.is_explore_plus into v_pro from public.profiles p where p.id = v_me;
  v_results := v_results || format(
    E'1. member writes is_explore_plus   is_explore_plus = %s -> %s\n',
    v_pro, case when v_pro is false then 'PASS (pinned)' else 'FAIL (the paid tier is free)' end
  );

  -- --- 2. an ordinary edit still works -------------------------------------
  update public.profiles set city = 'test-city-entitlements' where id = v_me;
  select count(*) into v_count from public.profiles p
  where p.id = v_me and p.city = 'test-city-entitlements';
  v_results := v_results || format(
    E'2. member edits their own city     %s row(s) -> %s\n',
    v_count, case when v_count = 1 then 'PASS (the guard is not blanket)' else 'FAIL (profile edits broke)' end
  );

  -- --- 3. reset your own like counter --------------------------------------
  begin
    insert into public.daily_likes (id, date, count)
    values (v_me, to_char(current_date, 'YYYY-MM-DD'), 0)
    on conflict (id) do update set count = 0;
  exception when insufficient_privilege then
    null; -- refused outright is the same answer as changing nothing
  end;
  select d.count into v_count from public.daily_likes d where d.id = v_me;
  v_results := v_results || format(
    E'3. member zeroes daily_likes       count = %s -> %s\n',
    coalesce(v_count, -1),
    case when v_count = 14 then 'PASS (unchanged)' else 'FAIL (the cap is erasable)' end
  );

  -- --- 4. the 15th like lands ----------------------------------------------
  select l.likes_left into v_left from public.like_profile(v_targets[1], 'dating') l;
  select d.count into v_count from public.daily_likes d where d.id = v_me;
  v_results := v_results || format(
    E'4. the 15th like                   likes_left = %s, count = %s -> %s\n',
    v_left, v_count,
    case when v_left = 0 and v_count = 15 then 'PASS' else 'FAIL' end
  );

  -- --- 5. the 16th does not ------------------------------------------------
  begin
    perform public.like_profile(v_targets[2], 'dating');
    v_hit := false;
  exception when others then
    v_hit := sqlerrm like '%daily_like_limit_reached%';
  end;
  v_results := v_results || format(
    E'5. the 16th like                   -> %s\n',
    case when v_hit then 'PASS (refused at 15)' else 'FAIL (the cap does not bite)' end
  );

  -- --- 6. re-liking the same person is free --------------------------------
  begin
    select l.likes_left into v_left from public.like_profile(v_targets[1], 'rishta') l;
    select d.count into v_count from public.daily_likes d where d.id = v_me;
    v_results := v_results || format(
      E'6. re-liking the same person       likes_left = %s, count = %s -> %s\n',
      v_left, v_count,
      case when v_left = 0 and v_count = 15 then 'PASS (free)' else 'FAIL (charged twice for one person)' end
    );
  exception when others then
    v_results := v_results || format(
      E'6. re-liking the same person       -> FAIL (refused: %s)\n', sqlerrm
    );
  end;

  raise exception E'\n\n===== RESULTS =====\n\n%\n(rolled back - nothing above was kept)\n', v_results;
end
$$;
