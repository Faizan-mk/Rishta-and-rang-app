-- ============================================================================
-- Proves the block is enforced in BOTH directions — 3.2's "neither can see or
-- reach the other from any surface".
--
-- No second device needed. Studio normally runs as a superuser, which ignores
-- RLS entirely; this impersonates a real member instead (`role` +
-- `request.jwt.claims`, exactly what PostgREST sets per request), so the same
-- policies that guard the app are the ones being measured here.
--
-- Reads the most recent row in blocked_users and tests that pair. Writes
-- nothing. Results arrive as the error message — the abort is the cleanup.
-- ============================================================================

do $$
declare
  v_blocker    uuid;   -- A, who blocked
  v_blocked    uuid;   -- B, who was blocked
  v_third      uuid;   -- an uninvolved member, as the control
  v_uid_check  uuid;
  v_sees_b     integer;
  v_sees_a     integer;
  v_sees_third integer;
  v_results    text := '';
begin
  select b.profile_id, b.blocked_user_id
    into v_blocker, v_blocked
  from public.blocked_users b
  order by b.blocked_at desc
  limit 1;

  if v_blocker is null then
    raise exception E'NO BLOCKS YET\n\nBlock someone from the app first, then run this.';
  end if;

  select p.id into v_third
  from public.profiles p
  where p.id <> v_blocker and p.id <> v_blocked and p.hidden_at is null
  limit 1;

  -- --- become A ------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_blocker, 'role', 'authenticated')::text,
    true
  );

  -- If auth.uid() does not come back as A, the impersonation did not take and
  -- every number below would be meaningless.
  v_uid_check := auth.uid();
  v_results := v_results || format(
    E'0. impersonating A        auth.uid() = %s   -> %s\n',
    coalesce(v_uid_check::text, 'null'),
    case when v_uid_check = v_blocker then 'PASS' else 'FAIL (session not applied - results below are void)' end
  );

  select count(*) into v_sees_b     from public.profiles p where p.id = v_blocked;
  select count(*) into v_sees_third from public.profiles p where p.id = v_third;

  v_results := v_results || format(
    E'1. A looks for B          %s row(s)   -> %s\n',
    v_sees_b,
    case when v_sees_b = 0 then 'PASS (B is gone for A)' else 'FAIL (A can still see B)' end
  );
  v_results := v_results || format(
    E'2. A looks for a stranger %s row(s)   -> %s\n',
    v_sees_third,
    case when v_sees_third = 1 then 'PASS (control: A still sees everyone else)'
         when v_third is null then 'SKIPPED (no third member to test with)'
         else 'FAIL (A sees nobody - the policy is too wide)' end
  );

  -- --- become B ------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_blocked, 'role', 'authenticated')::text,
    true
  );

  select count(*) into v_sees_a from public.profiles p where p.id = v_blocker;

  v_results := v_results || format(
    E'3. B looks for A          %s row(s)   -> %s\n',
    v_sees_a,
    case when v_sees_a = 0 then 'PASS (enforced both ways - B never asked to be blocked)'
         else 'FAIL (one-directional: B can still see A)' end
  );

  perform set_config('role', 'postgres', true);

  raise exception E'\n\n===== BLOCK, BOTH DIRECTIONS =====\n\nA = %\nB = %\n\n%\nNothing was written; the transaction is rolled back.\n',
    v_blocker, v_blocked, v_results;
end
$$;
