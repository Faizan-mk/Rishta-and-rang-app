-- ============================================================================
-- Proves 4.1's "done when": two accounts see the SAME single `matches` row
-- when matched, and a third account sees nothing.
--
-- No second device needed. Studio runs as the table owner, which ignores RLS
-- entirely; this impersonates real members instead (`role` + the jwt claim
-- GUCs, exactly what PostgREST sets per request), so the policies being
-- measured are the ones that guard the app.
--
-- Impersonation note: `auth.uid()` reads `request.jwt.claim.sub` on older
-- projects and the `request.jwt.claims` JSON on newer ones, so BOTH are set
-- each time. If only one is set, `auth.uid()` comes back null on the other kind
-- of project, every policy denies, and the results are meaningless — step 0
-- therefore aborts loudly rather than reporting a wall of false failures.
--
-- The pair's likes and match row are seeded as the owner on purpose: this test
-- is about who can READ the shared row. The write policies get their own
-- negative checks at the end.
--
-- Picks the first three unblocked profiles it can find. Writes nothing that
-- survives: the closing exception rolls the whole block back, and the results
-- arrive as that error's message.
--
-- Run after 24_matching.sql.
-- ============================================================================

do $$
declare
  v_a        uuid;
  v_b        uuid;
  v_c        uuid;   -- the uninvolved control
  v_low      uuid;   -- the pair in the order the table stores it
  v_high     uuid;
  v_uid      uuid;
  v_a_id     uuid;   -- match id as A sees it
  v_b_id     uuid;   -- match id as B sees it
  v_count    integer;
  v_refused  boolean;
  v_results  text := '';
begin
  -- --- pick three members, as the owner ------------------------------------
  select p.id into v_a from public.profiles p where p.hidden_at is null order by p.id limit 1;
  select p.id into v_b from public.profiles p
    where p.hidden_at is null and p.id <> v_a and not public.is_blocked_pair(v_a, p.id)
    order by p.id limit 1;
  select p.id into v_c from public.profiles p
    where p.hidden_at is null and p.id not in (v_a, v_b)
      and not public.is_blocked_pair(v_a, p.id)
      and not public.is_blocked_pair(v_b, p.id)
    order by p.id limit 1;

  if v_b is null then
    raise exception E'NEED AT LEAST TWO UNBLOCKED PROFILES\n\nCreate a second test account, then run this again.';
  end if;

  v_low  := least(v_a, v_b);
  v_high := greatest(v_a, v_b);

  -- --- seed the mutual like and the match ----------------------------------
  insert into public.likes (liker_id, target_id, mode) values (v_a, v_b, 'dating')
    on conflict (liker_id, target_id) do nothing;
  insert into public.likes (liker_id, target_id, mode) values (v_b, v_a, 'dating')
    on conflict (liker_id, target_id) do nothing;
  insert into public.matches (user_a, user_b, mode) values (v_low, v_high, 'dating')
    on conflict (user_a, user_b) do nothing;

  -- The write probes below need pairs that definitely have no row yet,
  -- otherwise a unique violation would masquerade as a policy refusal. These
  -- deletes come back with the rollback like everything else here.
  if v_c is not null then
    delete from public.likes
      where (liker_id = v_c and target_id in (v_a, v_b))
         or (liker_id = v_a and target_id = v_c);
    delete from public.matches
      where user_a = least(v_c, v_a) and user_b = greatest(v_c, v_a);
  end if;

  -- --- become A ------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- Nothing below means anything if the session did not take.
  v_uid := auth.uid();
  if v_uid is distinct from v_a then
    raise exception E'IMPERSONATION DID NOT TAKE\n\nauth.uid() = %, expected %.\nEvery policy would deny, so the run is aborted rather than reporting false failures.',
      coalesce(v_uid::text, 'null'), v_a;
  end if;
  v_results := v_results || format(E'0. impersonating A        auth.uid() = %s -> PASS\n', v_uid);

  select m.id into v_a_id from public.matches m
  where m.user_a = v_low and m.user_b = v_high;
  v_results := v_results || format(
    E'1. A sees the match       id = %s -> %s\n',
    coalesce(v_a_id::text, 'none'), case when v_a_id is not null then 'PASS' else 'FAIL' end
  );

  -- The like aimed at A is readable; A's own outgoing like is not.
  select count(*) into v_count from public.likes l where l.target_id = v_a;
  v_results := v_results || format(
    E'2. A reads likes aimed at A          %s row(s) -> %s\n',
    v_count, case when v_count >= 1 then 'PASS' else 'FAIL (cannot see incoming like)' end
  );

  select count(*) into v_count from public.likes l where l.liker_id = v_a;
  v_results := v_results || format(
    E'3. A reads own outgoing likes        %s row(s) -> %s\n',
    v_count, case when v_count = 0 then 'PASS' else 'FAIL (outgoing likes are enumerable)' end
  );

  -- --- become B: the same row, not a copy ----------------------------------
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select m.id into v_b_id from public.matches m
  where m.user_a = v_low and m.user_b = v_high;
  v_results := v_results || format(
    E'4. B sees the SAME row    id = %s -> %s\n',
    coalesce(v_b_id::text, 'none'),
    case when v_b_id is not null and v_b_id = v_a_id then 'PASS'
         else 'FAIL (each side is back to its own row)' end
  );

  -- --- become C: the control ----------------------------------------------
  if v_c is null then
    v_results := v_results || E'5. C control                         SKIPPED (no third profile)\n';
  else
    perform set_config('request.jwt.claim.sub', v_c::text, true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_c, 'role', 'authenticated')::text, true);

    select count(*) into v_count from public.matches m
    where m.user_a = v_low and m.user_b = v_high;
    v_results := v_results || format(
      E'5. C sees the A-B match              %s row(s) -> %s\n',
      v_count, case when v_count = 0 then 'PASS' else 'FAIL (match leaks to outsiders)' end
    );

    select count(*) into v_count from public.likes l
    where l.liker_id in (v_a, v_b) and l.target_id in (v_a, v_b);
    v_results := v_results || format(
      E'6. C sees the A-B likes              %s row(s) -> %s\n',
      v_count, case when v_count = 0 then 'PASS' else 'FAIL (likes leak to outsiders)' end
    );

    -- C tries to insert itself into someone else's conversation. The nested
    -- block is what keeps a refusal from aborting the run: catching it IS the
    -- pass condition.
    begin
      insert into public.matches (user_a, user_b, mode)
      values (least(v_c, v_a), greatest(v_c, v_a), 'dating');
      v_refused := false;
    exception when insufficient_privilege or check_violation then
      v_refused := true;
    end;
    v_results := v_results || format(
      E'7. C matches A without a like        -> %s\n',
      case when v_refused then 'PASS (refused)' else 'FAIL (match without reciprocity)' end
    );
  end if;

  -- --- write policies on `likes` -------------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  if v_c is null then
    v_results := v_results || E'8. likes write policies             SKIPPED (no third profile)\n';
  else
    -- A writing a like *as C* — the forgery `liker_id = auth.uid()` exists for.
    begin
      insert into public.likes (liker_id, target_id, mode) values (v_c, v_b, 'dating');
      v_refused := false;
    exception when insufficient_privilege then
      v_refused := true;
    end;
    v_results := v_results || format(
      E'8. A writes a like as C              -> %s\n',
      case when v_refused then 'PASS (refused)' else 'FAIL (likes are forgeable)' end
    );

    -- And A writing its own like, which must still work.
    begin
      insert into public.likes (liker_id, target_id, mode) values (v_a, v_c, 'dating');
      v_refused := false;
    exception when insufficient_privilege then
      v_refused := true;
    end;
    v_results := v_results || format(
      E'9. A writes its own like             -> %s\n',
      case when v_refused then 'FAIL (own like refused)' else 'PASS' end
    );
  end if;

  raise exception E'\n\n===== RESULTS =====\n\n%\n(rolled back - nothing above was kept)\n', v_results;
end
$$;
