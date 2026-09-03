-- ============================================================================
-- Proves the RPC's "done when": A likes B and gets nothing; B likes A back and
-- both get the same match; and only the call that created it says so.
--
-- Everything runs through `like_profile` as the members themselves, which is
-- the point — the RPC is the only path the app takes now, so this measures what
-- the app does rather than what the tables allow.
--
-- Existing likes between the pair are cleared first (and come back with the
-- rollback), because "A alone gets nothing" is only a real test starting from
-- nothing. The closing exception rolls the whole block back.
--
-- Run after 27_like_profile.sql.
-- ============================================================================

do $$
declare
  v_a         uuid;
  v_b         uuid;
  v_uid       uuid;
  v_matched   boolean;
  v_match_id  uuid;
  v_is_new    boolean;
  v_a_match   uuid;
  v_count     integer;
  v_results   text := '';
begin
  select p.id into v_a from public.profiles p where p.hidden_at is null order by p.id limit 1;
  select p.id into v_b from public.profiles p
    where p.hidden_at is null and p.id <> v_a and not public.is_blocked_pair(v_a, p.id)
    order by p.id limit 1;

  if v_b is null then
    raise exception E'NEED AT LEAST TWO UNBLOCKED PROFILES\n\nCreate a second test account, then run this again.';
  end if;

  -- Start from nothing between them, as the owner.
  delete from public.matches
    where user_a = least(v_a, v_b) and user_b = greatest(v_a, v_b);
  delete from public.likes
    where (liker_id = v_a and target_id = v_b) or (liker_id = v_b and target_id = v_a);
  delete from public.likes_received
    where (profile_id = v_a and liker_id = v_b::text) or (profile_id = v_b and liker_id = v_a::text);

  -- --- A likes B: one-sided, so nothing forms -------------------------------
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

  select l.matched, l.match_id, l.is_new into v_matched, v_match_id, v_is_new
  from public.like_profile(v_b, 'dating') l;
  v_results := v_results || format(
    E'1. A likes B (one-sided)             matched = %s -> %s\n',
    v_matched, case when v_matched is false and v_match_id is null then 'PASS'
                    else 'FAIL (matched without reciprocity)' end
  );

  select count(*) into v_count from public.matches m
  where m.user_a = least(v_a, v_b) and m.user_b = greatest(v_a, v_b);
  v_results := v_results || format(
    E'2. A sees a match yet                %s row(s) -> %s\n',
    v_count, case when v_count = 0 then 'PASS (nothing yet)' else 'FAIL' end
  );

  -- The like still reached B's "who liked you" list, with a card the RPC copied
  -- from A's own profile.
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.likes_received r
  where r.profile_id = v_b and r.liker_id = v_a::text and r.name <> '';
  v_results := v_results || format(
    E'3. B sees A in "who liked you"       %s row(s) -> %s\n',
    v_count, case when v_count = 1 then 'PASS' else 'FAIL (card missing or empty)' end
  );

  -- --- B likes back: the pair forms, once ----------------------------------
  select l.matched, l.match_id, l.is_new into v_matched, v_match_id, v_is_new
  from public.like_profile(v_a, 'dating') l;
  v_results := v_results || format(
    E'4. B likes A back                    matched = %s, is_new = %s -> %s\n',
    v_matched, v_is_new,
    case when v_matched and v_match_id is not null and v_is_new then 'PASS'
         else 'FAIL (no match, or not reported as new)' end
  );

  -- Liking again must not read as a fresh match, or the celebration fires twice.
  select l.is_new into v_is_new from public.like_profile(v_a, 'dating') l;
  v_results := v_results || format(
    E'5. B likes A a second time           is_new = %s -> %s\n',
    v_is_new, case when v_is_new is false then 'PASS' else 'FAIL (would celebrate twice)' end
  );

  -- --- and A has the same conversation -------------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  select m.id into v_a_match from public.matches m
  where m.user_a = least(v_a, v_b) and m.user_b = greatest(v_a, v_b);
  v_results := v_results || format(
    E'6. A sees the SAME match             id = %s -> %s\n',
    coalesce(v_a_match::text, 'none'),
    case when v_a_match is not null and v_a_match = v_match_id then 'PASS'
         else 'FAIL (A and B are on different rows)' end
  );

  raise exception E'\n\n===== RESULTS =====\n\n%\n(rolled back - nothing above was kept)\n', v_results;
end
$$;
