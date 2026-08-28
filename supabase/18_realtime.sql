-- ============================================================================
-- 18. Realtime — live chat in the Matches screen.
--
-- Run LAST, after 10_chat_messages.sql exists. Also make sure Dashboard →
-- Realtime (or Realtime → "Database changes") has table-change events enabled,
-- otherwise the app's chat subscription won't fire.
-- ============================================================================

alter table public.chat_messages replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'chat_messages'
     )
  then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;