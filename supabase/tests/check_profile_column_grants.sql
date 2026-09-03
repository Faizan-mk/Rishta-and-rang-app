-- ============================================================================
-- What can `authenticated` actually update on `profiles`?
--
-- A diagnostic, not a test: it writes nothing and asserts nothing.
--
-- Run it after 30_revoke_entitlement_writes.sql to see the split, and whenever
-- a write fails with "permission denied for table profiles" — that message
-- names the table but never the column, which is what makes the failure hard to
-- place. Any column the failing statement mentions that shows as PROTECTED here
-- is the one refusing it.
--
-- Worth remembering while reading this: an upsert is INSERT ... ON CONFLICT DO
-- UPDATE, so it needs UPDATE on every column in its payload — the primary key
-- included, and even on a first insert that conflicts with nothing.
-- ============================================================================

select
  c.column_name,
  case
    when has_column_privilege('authenticated', 'public.profiles', c.column_name, 'UPDATE')
      then 'writable'
    else 'PROTECTED'
  end as member_update
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'profiles'
order by
  has_column_privilege('authenticated', 'public.profiles', c.column_name, 'UPDATE'),
  c.ordinal_position;
