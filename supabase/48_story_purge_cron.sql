-- ============================================================================
-- 48. Hourly clean-up of expired stories.
--
-- Calls the `purge-stories` Edge Function once an hour, which removes each
-- expired story's file from storage and then its row (see
-- supabase/functions/purge-stories/index.ts). Without this, an expired story's
-- row and file only went when its owner next opened the app.
--
-- Before running this file:
--   1. Deploy the function:
--        supabase functions deploy purge-stories --no-verify-jwt
--   2. Store two secrets in Vault (Dashboard → Project Settings → Vault, or the
--      SQL below with your own values):
--        select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--        select vault.create_secret('<service-role-key>', 'service_role_key');
--
-- Run after 46_stories.sql.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running this file replaces the job instead of adding a second one.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-stories';

select cron.schedule(
  'purge-expired-stories',
  '5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge-stories',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
