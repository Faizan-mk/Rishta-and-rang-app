-- ============================================================================
-- 74. Keep the login account's name in step with the profile's.
--
-- Signup writes the member's name into the auth user's metadata (fullName,
-- supabase/functions/auth-otp). Changing the name later (59) only touched
-- profiles.full_name, so Authentication — the Supabase dashboard, auth emails —
-- kept the old one. Now a name change on the profile is copied there too, and
-- the accounts already out of step are fixed.
--
-- Safe to run more than once.
-- ============================================================================

create or replace function public.sync_auth_full_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.full_name is distinct from old.full_name then
    update auth.users u
    set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('fullName', new.full_name, 'full_name', new.full_name)
    where u.id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_auth_full_name on public.profiles;
create trigger profiles_sync_auth_full_name
  after update of full_name on public.profiles
  for each row execute function public.sync_auth_full_name();

-- Everyone already out of step.
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('fullName', p.full_name, 'full_name', p.full_name)
from public.profiles p
where p.id = u.id
  and (u.raw_user_meta_data->>'fullName') is distinct from p.full_name;
