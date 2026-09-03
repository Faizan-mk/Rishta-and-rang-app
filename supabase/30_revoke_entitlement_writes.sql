-- ============================================================================
-- 30. Take the UPDATE privilege away, not just the effect.
--
-- 29 pinned the entitlement columns with a before-update trigger, which stops
-- the write from meaning anything. This stops it from being permitted at all,
-- so a hand-crafted call naming one of them is refused by the privilege system
-- before any policy or trigger is consulted.
--
-- The part that is easy to get wrong, and that a first pass at this file got
-- wrong: a column-level REVOKE does NOT cut into a table-level grant. Postgres
-- treats `GRANT UPDATE ON t` and `GRANT UPDATE (col) ON t` as separate
-- privileges, and `2_profiles.sql` ends with `grant all on public.profiles to
-- authenticated` — a table-level grant covering every column. Revoking single
-- columns against that changes nothing at all. The table-level UPDATE has to
-- come off first, and the allowed columns be granted back one by one.
--
-- The list is built from the catalogue rather than typed out, so a column added
-- to `profiles` later is writable by default and only the named ones stay shut.
-- That is the right way round: forgetting to add a new column here should break
-- nothing, and the protected list is short and deliberate.
--
-- Why the trigger stays: re-running 2_profiles.sql hands the table-level grant
-- straight back. The trigger is what makes that a no-op instead of a reopened
-- hole — the outer wall is the one that can fall over by accident.
--
-- The client stopped sending these columns in the same change — naming a column
-- you cannot update fails the whole statement, even when writing the value it
-- already holds, so `authService.updateUser` had to drop them from its patch
-- first or every profile save would have started failing.
--
-- Run after 29_entitlements.sql. Re-runnable.
-- ============================================================================

do $$
declare
  v_protected text[] := array[
    -- The paid tier and its subscription state. `grant_explore_plus` /
    -- `revoke_explore_plus` (29) are the only writers, and run as the owner.
    'is_explore_plus', 'subscription_plan', 'subscription_renews_at', 'has_used_trial',
    -- Badges. Granted at signup, which is an insert and so untouched by this;
    -- what it stops is a member editing one onto themselves afterwards.
    'selfie_verified', 'bureau_verified',
    -- Set by the reports auto-hide trigger (21_reports.sql), a definer function
    -- running as the owner. Without this a reported profile could un-hide itself.
    'hidden_at',
    -- Not an entitlement, but nothing should ever rewrite a row's identity.
    'id'
  ];
  v_columns text;
begin
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position)
  into v_columns
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and not (c.column_name = any (v_protected));

  if v_columns is null then
    raise exception 'public.profiles has no updatable columns left — refusing to lock the table';
  end if;

  -- Order matters: the blanket privilege goes, then the specific ones come back.
  execute 'revoke update on public.profiles from authenticated';
  execute format('grant update (%s) on public.profiles to authenticated', v_columns);
end
$$;

-- service_role keeps everything: it is what a verified-purchase function and
-- any server-side maintenance run as.
grant update on public.profiles to service_role;
