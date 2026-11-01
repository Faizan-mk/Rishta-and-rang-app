-- ============================================================================
-- 72. Explore+ for the Google Play reviewer account.
--
-- Play's reviewers can't make purchases or start free trials, but they still
-- have to see every paid feature. The reviewer login given in Play Console
-- (Sign in details) gets Explore+ through the same server-only function a
-- verified purchase uses, until the end of 2027.
--
-- To take it away later:
--   select public.revoke_explore_plus(
--     (select id from auth.users where lower(email) = 'faizannaizi007@gmail.com'));
-- ============================================================================

select public.grant_explore_plus(
  (select id from auth.users where lower(email) = 'faizannaizi007@gmail.com'),
  'yearly',
  '2027-12-31T00:00:00Z'::timestamptz,
  false
);

select full_name, is_explore_plus, subscription_plan, subscription_renews_at
from public.profiles
where id = (select id from auth.users where lower(email) = 'faizannaizi007@gmail.com');
