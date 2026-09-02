-- ============================================================================
-- 23. push_tokens — where a member's devices can be reached.
--
-- One row per device, not per member: someone signed in on a phone and a tablet
-- should get the notification on both, and a device that reinstalls gets a new
-- token which must not silently replace the old one for a different account.
--
-- The Edge Function that reads this (supabase/functions/send-push) runs as
-- service_role. Members can only write their own rows and never read anyone's.
--
-- Run after 5_notification_prefs.sql.
-- ============================================================================

create table public.push_tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  -- 'ExponentPushToken[xxxxxxxx]' — Expo's address for one install.
  expo_push_token  text not null unique,
  -- Platform, OS version, device model, app version. Enough to debug "why did
  -- only the iPhones miss it", not enough to fingerprint anyone.
  device_info      jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A member manages their own device rows and reads nothing else. There is no
-- policy that lets one account discover another's tokens.
create policy "push_tokens_select" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "push_tokens_insert" on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_tokens_update" on public.push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_tokens_delete" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

grant all on public.push_tokens to authenticated, service_role;

-- The token is unique across the table, so a device that changes hands has to
-- move to the new account rather than being rejected as a duplicate. Upserting
-- on `expo_push_token` from the client would fail its own RLS check against the
-- previous owner's row, which is why this is a definer function.
create or replace function public.register_push_token(
  p_token text,
  p_device_info jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, device_info)
  values (current_user_id, p_token, coalesce(p_device_info, '{}'::jsonb))
  on conflict (expo_push_token) do update
    set user_id      = current_user_id,
        device_info  = coalesce(p_device_info, '{}'::jsonb),
        last_seen_at = now();
end;
$$;

grant execute on function public.register_push_token(text, jsonb) to authenticated;

-- Signing out drops this device's address, so the next person to sign in on the
-- same phone does not receive the previous member's notifications.
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens
  where expo_push_token = p_token and user_id = auth.uid();
$$;

grant execute on function public.unregister_push_token(text) to authenticated;
