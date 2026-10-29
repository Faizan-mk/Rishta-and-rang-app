-- ============================================================================
-- 62. Taking back a Move to Rishta request.
--
-- Once sent, a request could only be answered by the other member; the sender
-- was stuck with "pending" until they did, even when it went by mistake.
-- cancel_rishta_request lets the sender withdraw it while it is still
-- unanswered, and tidies up what the request left behind:
--
--   · the match row goes back to "no request", which realtime carries to the
--     other member's open chat (their Accept/Decline banner goes away)
--   · the "wants to move to rishta" notification sent to them is removed
--   · the "💫 Rishta request sent…" chat line the sender's app posted is
--     deleted for both (chat_messages realtime DELETE)
--
-- Only the member who asked can cancel, and only while it is pending: once
-- answered it is the other member's decision, not something to undo.
--
-- Run after 32_rishta_notifications.sql. Safe to run more than once.
-- ============================================================================

create or replace function public.cancel_rishta_request(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := auth.uid();
  v_other uuid;
  v_match public.matches%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id for update;
  if not found or v_me not in (v_match.user_a, v_match.user_b) then
    raise exception 'not_a_participant';
  end if;
  if v_match.rishta_requested_by is distinct from v_me or v_match.mode = 'rishta' then
    raise exception 'no_pending_request';
  end if;

  update public.matches
  set rishta_requested_by = null,
      rishta_requested_at = null
  where id = p_match_id;

  v_other := case when v_me = v_match.user_a then v_match.user_b else v_match.user_a end;

  -- The request notification (notify_rishta writes it titled with the asker's
  -- name, no match id), from the moment of this request on.
  delete from public.notifications n
  where n.profile_id = v_other
    and n.type = 'rishta_request'
    and n.title = coalesce((select p.full_name from public.profiles p where p.id = v_me), '')
    and n.created_at >= v_match.rishta_requested_at - interval '1 minute';

  -- The app's own "request sent" line (chat.moveToRishtaSent starts with 💫 in
  -- every language), sent right after the request.
  delete from public.chat_messages c
  where c.match_id = p_match_id
    and c.sender_id = v_me
    and c.kind = 'text'
    and c.text like '💫%'
    and c.sent_at >= v_match.rishta_requested_at - interval '1 minute';
end;
$$;

revoke all on function public.cancel_rishta_request(uuid) from public;
grant execute on function public.cancel_rishta_request(uuid) to authenticated;
