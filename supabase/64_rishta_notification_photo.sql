-- ============================================================================
-- 64. A photo on rishta notifications.
--
-- notify_rishta (32) wrote "wants to move to Rishta" / "accepted" / "is not
-- ready yet" with only the other member's name: no match, no profile. The app
-- finds a notification's photo through one of those, so these rows were the
-- only ones left showing a bare icon, and a tap on them went nowhere.
--
-- They now carry the conversation they are about (match_id), which gives the
-- row the other member's photo and makes a tap open that chat, and the
-- member's id (related_id). The rows already written are filled in the same
-- way.
--
-- Run after 32_rishta_notifications.sql and 44_notification_related_profile.sql.
-- Safe to run more than once.
-- ============================================================================

create or replace function public.notify_rishta(
  p_recipient uuid,
  p_about     uuid,
  p_event     text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text;
  v_lang  text;
  v_match uuid;
begin
  select p.full_name into v_name from public.profiles p where p.id = p_about;
  select p.language  into v_lang from public.profiles p where p.id = p_recipient;
  -- A pair has one match row, so the two members name it.
  select m.id into v_match
  from public.matches m
  where (m.user_a = p_recipient and m.user_b = p_about)
     or (m.user_a = p_about and m.user_b = p_recipient)
  limit 1;
  perform public.notify_member(
    p_recipient,
    -- One stored type for all three moments: they are gated by the same
    -- preference switch, and `notifications.type` is the app's own enum
    -- (types/content.ts NotificationType), which this does not widen.
    'rishta_request',
    coalesce(v_name, ''),
    public.rishta_copy(p_event, v_lang),
    v_match,
    p_about,
    'rishta'
  );
end;
$$;
revoke all on function public.notify_rishta(uuid, uuid, text) from public;
revoke all on function public.notify_rishta(uuid, uuid, text) from authenticated;

-- The rows already there: the other member is the one in a match with the
-- recipient whose name the row is titled with.
update public.notifications n
set match_id     = m.id,
    related_id   = other.id,
    related_kind = 'rishta'
from public.matches m
join public.profiles other
  on other.id in (m.user_a, m.user_b)
where n.type = 'rishta_request'
  and n.match_id is null
  and n.profile_id in (m.user_a, m.user_b)
  and other.id <> n.profile_id
  and other.full_name = n.title;
