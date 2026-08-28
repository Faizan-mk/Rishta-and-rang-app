-- ============================================================================
-- 5. notification_prefs — owner-only push-notification toggles.
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.notification_prefs (
  id               uuid primary key references auth.users (id) on delete cascade,
  new_matches      boolean not null default true,
  messages         boolean not null default true,
  likes            boolean not null default true,
  rishta_requests  boolean not null default true,
  product_updates  boolean not null default false
);

alter table public.notification_prefs enable row level security;

create policy "notif_prefs_select" on public.notification_prefs
  for select to authenticated using (auth.uid() = id);
create policy "notif_prefs_insert" on public.notification_prefs
  for insert to authenticated with check (auth.uid() = id);
create policy "notif_prefs_update" on public.notification_prefs
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "notif_prefs_delete" on public.notification_prefs
  for delete to authenticated using (auth.uid() = id);

grant all on public.notification_prefs to authenticated, service_role;