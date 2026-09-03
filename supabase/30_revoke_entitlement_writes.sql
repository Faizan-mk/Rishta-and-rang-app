-- ============================================================================
-- 30. Take the UPDATE privilege away, not just the effect.
--
-- 29 pinned the entitlement columns with a before-update trigger, which stops
-- the write from meaning anything. This stops it from being permitted at all:
-- Postgres grants are per column, so `authenticated` simply loses UPDATE on the
-- ones a member must never move. A hand-crafted call naming one of them is now
-- refused by the privilege system before any policy or trigger is consulted.
--
-- Why keep the trigger as well: `2_profiles.sql` ends with
-- `grant all on public.profiles to authenticated`, so anyone re-running that
-- file silently hands the columns back. The trigger is what makes that a
-- no-op rather than a reopened hole. Two mechanisms, and the outer one is the
-- one that can be undone by accident.
--
-- The client stopped sending these columns in the same change — naming a column
-- you cannot update fails the whole statement, even when you are writing the
-- value it already holds, so `authService.updateUser` had to drop them from its
-- patch first or every profile save would have started failing.
--
-- Run after 29_entitlements.sql.
-- ============================================================================

-- The paid tier and its subscription state. `grant_explore_plus` /
-- `revoke_explore_plus` (29) are the only writers, and they run as the owner.
revoke update (is_explore_plus, subscription_plan, subscription_renews_at, has_used_trial)
  on public.profiles from authenticated;

-- Badges. Granted at signup, which is an insert and therefore untouched by
-- this; what it stops is a member editing one onto themselves afterwards.
revoke update (selfie_verified, bureau_verified)
  on public.profiles from authenticated;

-- Set by the reports auto-hide trigger (21_reports.sql), a definer function
-- running as the owner. Without this a reported profile could un-hide itself.
revoke update (hidden_at)
  on public.profiles from authenticated;

-- `anon` should never have had any of this either. Stated rather than assumed —
-- a no-op where the grant was never made.
revoke update (
  is_explore_plus, subscription_plan, subscription_renews_at, has_used_trial,
  selfie_verified, bureau_verified, hidden_at
) on public.profiles from anon;
