-- ============================================================================
-- 39. reply_to_id — swipe-to-reply, quoting one message from another.
--
-- One nullable self-reference is the whole feature: the quoted preview itself
-- is never stored — it is resolved client-side from the thread already held
-- in memory, the same way a reply's own text or audio already is. `set null`
-- on delete rather than `cascade`: a reply is a message in its own right, and
-- "delete for everyone" (26_two_way_messaging.sql) on the message it quoted
-- should orphan that reference, not take the reply down with it.
--
-- Run after 38_clear_chat_for_me.sql. Re-runnable.
-- ============================================================================

alter table public.chat_messages
  add column if not exists reply_to_id uuid references public.chat_messages (id) on delete set null;

-- `thread_previews`/`message_page` (33, 37) already `select c.*` — a new
-- column on chat_messages reaches the client through them with no function
-- changes needed.
