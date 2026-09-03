-- ============================================================================
-- Proves the Move to Rishta handshake: the request is one state on the shared
-- row that both people see, only the other member may answer it, and accepting
-- moves the conversation for both of them.
--
-- The thing the old simulation could not do is step 3 — answering your own
-- request must be refused, because the whole point is that the other person
-- decides. Step 6 is the crossing-over being one row, not two.
--
-- Seeds a match and fills A's rishta profile (so the gate is measured
-- deliberately in step 1, not tripped over by accident). Everything rolls back
-- with the closing exception, the profile edit included.
--
-- Run after 28_rishta_request.sql.
-- ============================================================================

do $$
declare
  v_a        uuid;
  v_b        uuid;
  v_match    uuid;
  v_uid      uuid;
  v_by       uuid;
  v_mode     text;
  v_outcome  text;
  v_refused  boolean;
  v_results  text := '';
begin
  select p.id into v_a from public.profiles p where p.hidden_at is null order by p.id limit 1;
  select p.id into v_b from public.profiles p
    where p.hidden_at is null and p.id <> v_a and not public.is_blocked_pair(v_a, p.id)
    order by p.id limit 1;

  if v_b is null then
    raise exception E'NEED AT LEAST TWO UNBLOCKED PROFILES\n\nCreate a second test account, then run this again.';
  end if;

  insert into public.likes (liker_id, target_id, mode) values (v_a, v_b, 'dating')
    on conflict (liker_id, target_id) do nothing;
  insert into public.likes (liker_id, target_id, mode) values (v_b, v_a, 'dating')
    on conflict (liker_id, target_id) do nothing;
  insert into public.matches (user_a, user_b, mode)
  values (least(v_a, v_b), greatest(v_a, v_b), 'dating')
  on conflict (user_a, user_b) do update set mode = 'dating';
  select m.id into v_match from public.matches m
  where m.user_a = least(v_a, v_b) and m.user_b = greatest(v_a, v_b);

  update public.matches
  set rishta_requested_by = null, rishta_requested_at = null
  where id = v_match;

  -- --- A asks, with an empty rishta profile --------------------------------
  update public.profiles
  set rishta_religion = '', rishta_education = '', rishta_family_background = '', rishta_readiness = 'browsing'
  where id = v_a;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  v_uid := auth.uid();
  if v_uid is distinct from v_a then
    raise exception E'IMPERSONATION DID NOT TAKE\n\nauth.uid() = %, expected %.',
      coalesce(v_uid::text, 'null'), v_a;
  end if;
  v_results := v_results || format(E'0. impersonating A        auth.uid() = %s -> PASS\n', v_uid);

  begin
    perform public.request_rishta(v_match);
    v_refused := false;
  exception when others then
    v_refused := sqlerrm like '%rishta_profile_incomplete%';
  end;
  v_results := v_results || format(
    E'1. A asks with an empty rishta profile -> %s\n',
    case when v_refused then 'PASS (refused)' else 'FAIL (the gate is not enforced)' end
  );

  -- --- fill it in and ask properly -----------------------------------------
  -- Still as A: a member owns their own card, so this needs no role change —
  -- and it is the same write the app makes when they edit their profile.
  update public.profiles
  set rishta_religion = 'test', rishta_education = 'test',
      rishta_family_background = 'test', rishta_readiness = 'ready'
  where id = v_a;

  perform public.request_rishta(v_match);
  select m.rishta_requested_by into v_by from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'2. A asks with it filled in           requested_by = %s -> %s\n',
    coalesce(v_by::text, 'null'), case when v_by = v_a then 'PASS' else 'FAIL' end
  );

  -- --- A may not answer their own ------------------------------------------
  begin
    perform public.respond_rishta(v_match, true);
    v_refused := false;
  exception when others then
    v_refused := sqlerrm like '%cannot_answer_own_request%';
  end;
  v_results := v_results || format(
    E'3. A accepts their own request        -> %s\n',
    case when v_refused then 'PASS (refused)' else 'FAIL (a member can move themselves)' end
  );

  -- --- B sees it, and declines ---------------------------------------------
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select m.rishta_requested_by into v_by from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'4. B sees the pending request         requested_by = %s -> %s\n',
    coalesce(v_by::text, 'null'),
    case when v_by = v_a then 'PASS (same row, so they both see it)' else 'FAIL' end
  );

  select public.respond_rishta(v_match, false) into v_outcome;
  select m.mode, m.rishta_requested_by into v_mode, v_by from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'5. B declines                         mode = %s, pending = %s -> %s\n',
    v_mode, coalesce(v_by::text, 'null'),
    case when v_outcome = 'declined' and v_mode = 'dating' and v_by is null then 'PASS'
         else 'FAIL' end
  );

  -- --- ask again, and accept this time -------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform public.request_rishta(v_match);

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  select public.respond_rishta(v_match, true) into v_outcome;

  select m.mode, m.rishta_requested_by into v_mode, v_by from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'6. B accepts                          mode = %s, pending = %s -> %s\n',
    v_mode, coalesce(v_by::text, 'null'),
    case when v_outcome = 'accepted' and v_mode = 'rishta' and v_by is null then 'PASS'
         else 'FAIL' end
  );

  -- --- and A is in rishta too, off the same row ----------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  select m.mode into v_mode from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'7. A is in rishta as well             mode = %s -> %s\n',
    v_mode, case when v_mode = 'rishta' then 'PASS (one row, both sides moved)' else 'FAIL' end
  );

  -- --- and neither may write `mode` by hand --------------------------------
  begin
    update public.matches set mode = 'dating' where id = v_match;
    v_refused := false;
  exception when insufficient_privilege then
    v_refused := true;
  end;
  select m.mode into v_mode from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'8. A rewrites mode directly           mode = %s -> %s\n',
    v_mode,
    case when v_mode = 'rishta' then 'PASS (no update policy, so it changed nothing)'
         else 'FAIL (mode is writable outside the handshake)' end
  );

  raise exception E'\n\n===== RESULTS =====\n\n%\n(rolled back - nothing above was kept)\n', v_results;
end
$$;
