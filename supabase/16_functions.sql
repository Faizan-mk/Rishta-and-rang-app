-- ============================================================================
-- 16. Helper functions (run as owner, bypass RLS).
--
-- Run after the table files (1 → 15).
-- ============================================================================

-- "Is this address taken?" check for the signup step — reliable because it
-- reads auth.users directly.
create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from auth.users u where lower(u.email) = lower(p_email)
  );
$$;

-- Deletes the signed-in auth user; every table above has `on delete cascade`,
-- so the whole account goes in one call.
create or replace function public.delete_account()
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
  delete from auth.users where id = current_user_id;
end;
$$;

grant execute on function public.email_exists(text) to authenticated, anon;
grant execute on function public.delete_account() to authenticated;