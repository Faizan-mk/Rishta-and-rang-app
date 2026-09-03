-- ============================================================================
-- 31. Drop the one-sided message columns.
--
-- 26 re-keyed `chat_messages` to (match_id, sender_id) but left `profile_id`
-- and `from_me` behind, nullable, so a client still running the previous build
-- would not fail its inserts mid-rollout. That was the right call then and is
-- dead weight now: nothing in the app or in any other migration reads either
-- column, and `from_me` in particular is a lie waiting to be believed — whose
-- message it is depends on who is reading, which is why it is derived at render
-- time instead.
--
-- Deliberately a separate file rather than an edit to 26: a database that has
-- already run 26 needs this step, and running it is a decision about rollout
-- ("is every client on the new build?"), not a correction.
--
-- Before running: any build still writing `profile_id` / `from_me` will start
-- failing its inserts. Every current build stopped writing them in the same
-- change as 26.
--
-- Run after 26_two_way_messaging.sql. Re-runnable.
-- ============================================================================

alter table public.chat_messages drop column if exists from_me;
alter table public.chat_messages drop column if exists profile_id;
