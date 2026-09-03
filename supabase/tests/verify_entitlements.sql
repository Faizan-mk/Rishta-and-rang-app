-- ============================================================================
-- Proves item 10's "done when": a hand-crafted API call cannot grant itself
-- Explore+ or extra likes.
--
-- Everything here is what a member could send by hand — a plain update on their
-- own row, a plain write to their own counter. Both are permitted by RLS and
-- both must come to nothing: the trigger pins the columns, and the counter has
-- no write policy at all.
--
-- The cap itself is measured by running `like_profile` past 15, which also
-- checks the part that is easy to get wrong: re-liking the same person must not
-- cost a second like.
--
-- Needs at least 17 profiles to exercise the cap fully; with fewer it says so
-- and skips those steps rather than reporting a false pass. Everything rolls
-- back with the closing exception.
--
-- Run after 29_entitlements.sql.
-- ============================================================================

do $$
declare
  v_me       uuid;
  v_target   uuid;
  v_uid      uuid;
  v_pro      boolean;
  v_count    integer;
  v_left     integer;
  v_targets  uuid[];
  v_hit      boolean := false;
  v_results  text := '';
  i          integer;
begin
  select p.id into v_me from public.profiles p where p.hidden_at is null order by p.id limit 1;
  select p.id into v_target from public.profiles p
    where p.hidden_at is null and p.id <> v_me and not public.is_blocked_pair(v_me, p.id)
    order by p.id limit 1;

  if v_target is null then
    raise exception E'NEED AT LEAST TWO PROFILES\n\nCreate a second test account, then run this again.';
  end if;

  -- Known starting point, as the owner (a definer path, so the trigger lets it
  -- through — which is itself the thing being relied on).
  update public.profiles
  set is_explore_plus = false, subscription_plan = null, subscription_renews_at = null
  where id = v_me;
  delete from public.daily_likes where id = v_me;
  delete from public.likes where liker_id = v_me;

  select array_agg(p.id) into v_targets from (
    select p.id from public.profiles p
    where p.hidden_at is null and p.id <> v_me and not public.is_blocked_pair(v_me, p.id)
    order by p.id limit 17
  ) p;

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
    E'1. member writes is_explore_plus     -> is_explore_plus = %s -> %s\n',
    v_pro, case when v_pro is false then 'PASS (pinned)' else 'FAIL (the paid tier is free)' end
  );

  -- --- 2. an ordinary edit still works -------------------------------------
  update public.profiles set city = 'test-city-entitlements' where id = v_me;
  select count(*) into v_count from public.profiles p
  where p.id = v_me and p.city = 'test-city-entitlements';
  v_results := v_results || format(
    E'2. member edits their own city       -> %s row(s) -> %s\n',
    v_count, case when v_count = 1 then 'PASS (the guard is not blanket)' else 'FAIL (profile edits broke)' end
  );

  -- --- 3. reset your own like counter --------------------------------------
  begin
    insert into public.daily_likes (id, date, count)
    values (v_me, to_char(current_date, 'YYYY-MM-DD'), 0)
    on conflict (id) do update set count = 0;
  exception when insufficient_privilege then
    null; -- refused outright is also the right answer
  end;
  select count(*) into v_count from public.daily_likes d where d.id = v_me;
  v_results := v_results || format(
    E'3. member writes daily_likes         -> %s row(s) -> %s\n',
    v_count, case when v_count = 0 then 'PASS (no write policy)' else 'FAIL (the cap is erasable)' end
  );

  -- --- 4. the cap, counted by the RPC --------------------------------------
  if array_length(v_targets, 1) < 16 then
    v_results := v_results || format(
      E'4. the 15-a-day cap                  SKIPPED (needs 16+ other profiles, found %s)\n',
      coalesce(array_length(v_targets, 1), 0)
    );
  else
    for i in 1..16 loop
      begin
        select l.likes_left into v_left from public.like_profile(v_targets[i], 'dating') l;
      exception when others then
        if sqlerrm like '%daily_like_limit_reached%' then
          v_hit := true;
          exit;
        end if;
        raise;
      end;
    end loop;

    v_results := v_results || format(
      E'4. the 16th like in a day            -> %s\n',
      case when v_hit then 'PASS (refused at 15)' else 'FAIL (the cap does not bite)' end
    );

    -- Re-liking someone already liked must not cost a second like.
    select d.count into v_count from public.daily_likes d where d.id = v_me;
    select l.likes_left into v_left from public.like_profile(v_targets[1], 'rishta') l;
    v_results := v_results || format(
      E'5. re-liking the same person         count %s -> %s -> %s\n',
      v_count, coalesce(15 - v_left, -1),
      case when v_left = 15 - v_count then 'PASS (free)' else 'FAIL (charged twice for one person)' end
    );
  end if;

  raise exception E'\n\n===== RESULTS =====\n\n%\n(rolled back - nothing above was kept)\n', v_results;
end
$$;
