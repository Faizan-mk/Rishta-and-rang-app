-- ============================================================================
-- 73. "Who liked you" and Favourites forget people whose account is gone.
--
-- likes_received.liker_id is text, not a foreign key, so deleting an account
-- removed the likes it *received* but left the likes it had *given* on other
-- members' "who liked you" lists: a card for someone who no longer exists
-- (seen as "Isra, Multan" on a test account). favorites.target_id is the
-- same kind of text column, so Favourites kept them too.
--
--   · the orphans already there are removed from both
--   · from now on, a profile's removal (account delete cascades to it) takes
--     it out of everyone else's "who liked you" and Favourites too
--
-- Safe to run more than once.
-- ============================================================================

delete from public.likes_received r
where not exists (select 1 from public.profiles p where p.id::text = r.liker_id);

delete from public.favorites f
where not exists (select 1 from public.profiles p where p.id::text = f.target_id);

create or replace function public.drop_likes_given_by_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.likes_received r where r.liker_id = old.id::text;
  delete from public.favorites f where f.target_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists profiles_drop_likes_given on public.profiles;
create trigger profiles_drop_likes_given
  after delete on public.profiles
  for each row execute function public.drop_likes_given_by_profile();
