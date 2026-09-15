-- ============================================================================
-- 36. A blocked sender's new messages look sent, but never arrive.
--
-- `messages_insert` (supabase/22_block_hardening.sql) currently refuses the
-- insert outright across a block, in either direction. From the blocked
-- person's own screen that reads as a normal failed send — the bubble goes to
-- "failed, tap to retry" — which is itself a tell: nothing else in the app
-- fails a send that consistently, forever, for one specific thread. It is
-- also one-sided information the blocker never asked to hand over.
--
-- This keeps the insert clean (so the sender's own bubble settles to a plain
-- single "sent" tick, same as any other message) and moves the actual
-- enforcement to the read side: a message a blocked sender writes exists, but
-- is invisible to the member who blocked them, for as long as the block
-- stands. `thread_previews` and `message_page` (supabase/33_chat_paging_and_
-- receipts.sql) are plain, non-definer functions that query chat_messages
-- directly, so this one policy change covers the matches list preview and
-- the thread itself without touching either function.
--
-- Only messages sent *after* the block is what disappears — the history a
-- match already had when it was blocked is exactly what
-- supabase/35_block_keeps_thread.sql set out to keep, and this must not
-- quietly undo that. `blocked_users.blocked_at` is the line: sent_at on or
-- after it is hidden from the blocker; anything earlier still shows.
--
-- send-push (supabase/functions/send-push) still needs its own change — it
-- runs on the service role and does not go through RLS at all, so without a
-- matching check there a blocked sender's "invisible" message would still
-- reach the blocker as a push notification, previewing the very text this
-- migration hides from the chat. See that function's own comment for the fix;
-- it has to be deployed separately (`supabase functions deploy send-push`).
--
-- Run after 22_block_hardening.sql and 26_two_way_messaging.sql. Re-runnable.
-- ============================================================================

drop policy if exists "messages_insert" on public.chat_messages;
create policy "messages_insert" on public.chat_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = chat_messages.match_id)
  );

drop policy if exists "messages_select" on public.chat_messages;
create policy "messages_select" on public.chat_messages
  for select to authenticated using (
    exists (select 1 from public.matches m where m.id = chat_messages.match_id)
    and (
      sender_id = auth.uid()
      or not exists (
        select 1 from public.blocked_users bu
        where bu.profile_id = auth.uid()
          and bu.blocked_user_id = chat_messages.sender_id
          and chat_messages.sent_at >= bu.blocked_at
      )
    )
  );
