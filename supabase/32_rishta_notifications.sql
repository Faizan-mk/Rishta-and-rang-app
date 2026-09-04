-- ============================================================================
-- 32. The Move to Rishta handshake, said out loud.
--
-- 28 made the handshake real: a request is a state on the shared match row, and
-- only the other member may answer it. What it did not do is tell anyone. The
-- requester learned of an acceptance by their `mode` quietly flipping under
-- them, of a decline by the pending bar vanishing, and neither event ever
-- reached the notifications feed at all.
--
-- It could not have, from the client: `notifications_insert` (15) is
-- `profile_id = auth.uid()`, so a member can only ever write a notification to
-- themselves — which is the right rule, and the reason this belongs in the
-- definer functions that already own the transition. The three moments of the
-- handshake now each leave a row:
--
--   asked      -> the other member
--   accepted   -> BOTH of them, off the one write that moved them
--   declined   -> the requester, so a pending bar never just disappears
--
-- Push is the client's half (`pushService.notifyRishta*` -> the `send-push`
-- Edge Function); this is the in-app half, and it is the one that survives the
-- phone being off.
--
-- Run after 28_rishta_request.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Writing a notification to someone who is not you
-- ---------------------------------------------------------------------------

-- Deliberately NOT granted to `authenticated`. It writes a row addressed to
-- another member, which is exactly the thing RLS refuses the app, so the only
-- callers are the definer functions below — they have already established that
-- the two people are in a match together before they call it.
create or replace function public.notify_member(
  p_user  uuid,
  p_type  text,
  p_title text,
  p_body  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Which preference switch gates this kind of event. Kept in step with
  -- NotificationContext's PREF_KEY_BY_TYPE and send-push's PREF_COLUMN.
  v_column  text := case p_type
                      when 'match'          then 'new_matches'
                      when 'like'           then 'likes'
                      when 'message'        then 'messages'
                      when 'rishta_request' then 'rishta_requests'
                      when 'system'         then 'product_updates'
                    end;
  v_enabled boolean;
begin
  if p_user is null then
    return;
  end if;

  if v_column is not null then
    execute format(
      'select coalesce(np.%I, true) from public.notification_prefs np where np.id = $1',
      v_column
    )
    into v_enabled
    using p_user;

    -- Null means no prefs row — the member never opened Settings. The table's
    -- own defaults answer then: everything on except product updates. The same
    -- fallback the Edge Function uses, so a muted event is muted on both paths.
    if v_enabled is null then
      v_enabled := v_column <> 'product_updates';
    end if;
    if not v_enabled then
      return;
    end if;
  end if;

  insert into public.notifications (profile_id, type, title, body)
  values (p_user, p_type, p_title, p_body);
end;
$$;

revoke all on function public.notify_member(uuid, text, text, text) from public;
revoke all on function public.notify_member(uuid, text, text, text) from authenticated;

-- ---------------------------------------------------------------------------
-- 2. The wording
-- ---------------------------------------------------------------------------

-- A notification is often the only thing a member sees of an event, so it
-- should not arrive in English because that is what the server happens to
-- speak. Same three languages, and the same shape — title is the other
-- person's name, body continues from it — as
-- supabase/functions/send-push/index.ts. Keep the two in step.
create or replace function public.rishta_copy(p_event text, p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(p_language, 'en')
    when 'ur' then case p_event
      when 'rishta_request'  then 'آپ کے ساتھ رشتہ مرحلے میں جانا چاہتے ہیں۔'
      when 'rishta_accepted' then 'نے آپ کی رشتہ درخواست قبول کر لی — اب آپ دونوں رشتہ مرحلے میں ہیں۔'
      when 'rishta_moved'    then 'کے ساتھ اب آپ رشتہ مرحلے میں ہیں۔'
      when 'rishta_declined' then 'ابھی رشتہ مرحلے کے لیے تیار نہیں ہیں۔'
    end
    when 'roman' then case p_event
      when 'rishta_request'  then 'aap ke sath Rishta marhale mein jana chahte hain.'
      when 'rishta_accepted' then 'ne aap ki Rishta darkhwast qubool kar li — ab aap dono Rishta marhale mein hain.'
      when 'rishta_moved'    then 'ke sath ab aap Rishta marhale mein hain.'
      when 'rishta_declined' then 'abhi Rishta marhale ke liye tayyar nahi hain.'
    end
    else case p_event
      when 'rishta_request'  then 'would like to move to Rishta stage.'
      when 'rishta_accepted' then 'accepted your Rishta request — you are both in Rishta stage now.'
      when 'rishta_moved'    then 'and you are in Rishta stage now.'
      when 'rishta_declined' then 'is not ready for Rishta stage yet.'
    end
  end;
$$;

-- Members only, for the same reason as everything else here: a function is
-- executable by `public` unless told otherwise. This one only returns fixed
-- copy and leaks nothing, but leaving it open would mean the rule holds
-- everywhere except in one place, which is how the two below were missed.
revoke all on function public.rishta_copy(text, text) from public;
grant execute on function public.rishta_copy(text, text) to authenticated, service_role;

-- One member's name, in the language the *recipient* reads the app in.
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
  v_name text;
  v_lang text;
begin
  select p.full_name into v_name from public.profiles p where p.id = p_about;
  select p.language  into v_lang from public.profiles p where p.id = p_recipient;
  perform public.notify_member(
    p_recipient,
    -- One stored type for all three moments: they are gated by the same
    -- preference switch, and `notifications.type` is the app's own enum
    -- (types/content.ts NotificationType), which this does not widen.
    'rishta_request',
    coalesce(v_name, ''),
    public.rishta_copy(p_event, v_lang)
  );
end;
$$;

revoke all on function public.notify_rishta(uuid, uuid, text) from public;
revoke all on function public.notify_rishta(uuid, uuid, text) from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Who answered, and when
-- ---------------------------------------------------------------------------

-- The in-app rows above are written by the database, so they cannot be forged.
-- The push half is sent by the client, and the answer is the one event the
-- *other* side of the pair would like to be able to fake: "they accepted your
-- request" is a sentence either participant could otherwise send to the other.
-- 28 cleared `rishta_requested_by` on the way through and kept nothing, so
-- afterwards the row could not say who had answered it. Now it can, and
-- `send-push` checks these two before it will carry an answer.
alter table public.matches
  add column if not exists rishta_answered_by uuid references auth.users (id) on delete set null,
  add column if not exists rishta_answered_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matches_answerer_is_participant') then
    alter table public.matches
      add constraint matches_answerer_is_participant
      check (rishta_answered_by is null or rishta_answered_by in (user_a, user_b));
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. The gate, trimmed
-- ---------------------------------------------------------------------------

-- Unchanged in substance from 28; `btrim` is so a field holding nothing but
-- spaces counts as empty here too, which is what the client's own copy of this
-- rule (src/utils/rishtaProfile.ts) says. Without it the two could disagree:
-- the button greyed out while the database would have allowed the request.
create or replace function public.rishta_profile_complete(p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and btrim(coalesce(p.rishta_religion, '')) <> ''
      and btrim(coalesce(p.rishta_education, '')) <> ''
      and btrim(coalesce(p.rishta_family_background, '')) <> ''
      and btrim(coalesce(p.rishta_readiness, '')) not in ('', 'browsing')
  );
$$;

-- 28 granted this to `authenticated` but never revoked it from `public`, and a
-- definer function is executable by `public` unless told otherwise — so anyone
-- holding the anon key could ask whether a given account has filled in its
-- rishta profile. Confirmed against the live project: the RPC answered 200 to
-- an unauthenticated caller. Nothing needs it from a policy (only
-- `request_rishta` calls it, and a definer function runs as its owner), so it
-- becomes members-only here.
revoke all on function public.rishta_profile_complete(uuid) from public;
grant execute on function public.rishta_profile_complete(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The three moments
-- ---------------------------------------------------------------------------

-- Same rules as 28 — participant, not already rishta, nothing pending, rishta
-- profile filled in — plus the notification to the person being asked.
create or replace function public.request_rishta(p_match_id uuid)
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

  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_me not in (v_match.user_a, v_match.user_b) then
    raise exception 'not_a_participant';
  end if;
  if v_match.mode = 'rishta' then
    raise exception 'already_rishta';
  end if;
  if v_match.rishta_requested_by is not null then
    raise exception 'request_already_pending';
  end if;
  if not public.rishta_profile_complete(v_me) then
    raise exception 'rishta_profile_incomplete';
  end if;

  -- A fresh ask, so last time's answer stops being the current state of the row.
  update public.matches
  set rishta_requested_by = v_me,
      rishta_requested_at = now(),
      rishta_answered_by  = null,
      rishta_answered_at  = null
  where id = p_match_id;

  v_other := case when v_me = v_match.user_a then v_match.user_b else v_match.user_a end;
  perform public.notify_rishta(v_other, v_me, 'rishta_request');
end;
$$;

revoke all on function public.request_rishta(uuid) from public;
grant execute on function public.request_rishta(uuid) to authenticated;

-- Accepting moves both sides with one write, so both sides hear about it from
-- that same write. Declining tells the requester, so the pending bar they are
-- looking at never simply disappears with nothing said.
create or replace function public.respond_rishta(p_match_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me        uuid := auth.uid();
  v_requester uuid;
  v_match     public.matches%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_me not in (v_match.user_a, v_match.user_b) then
    raise exception 'not_a_participant';
  end if;
  if v_match.rishta_requested_by is null then
    raise exception 'no_pending_request';
  end if;
  if v_match.rishta_requested_by = v_me then
    raise exception 'cannot_answer_own_request';
  end if;

  v_requester := v_match.rishta_requested_by;

  if p_accept then
    -- One row, so one write moves the conversation for both of them.
    update public.matches
    set mode = 'rishta',
        rishta_requested_by = null,
        rishta_requested_at = null,
        rishta_answered_by  = v_me,
        rishta_answered_at  = now()
    where id = p_match_id;

    -- The one who asked is told it was accepted; the one who accepted is told
    -- where the two of them now are. Both rows, off the one transition.
    perform public.notify_rishta(v_requester, v_me, 'rishta_accepted');
    perform public.notify_rishta(v_me, v_requester, 'rishta_moved');
    return 'accepted';
  end if;

  -- Declining clears the request and leaves the conversation where it was; the
  -- requester may ask again later.
  update public.matches
  set rishta_requested_by = null,
      rishta_requested_at = null,
      rishta_answered_by  = v_me,
      rishta_answered_at  = now()
  where id = p_match_id;

  perform public.notify_rishta(v_requester, v_me, 'rishta_declined');
  return 'declined';
end;
$$;

revoke all on function public.respond_rishta(uuid, boolean) from public;
grant execute on function public.respond_rishta(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Live, not on next launch
-- ---------------------------------------------------------------------------

-- The feed was fetched once per sign-in, so a notification written while the
-- app was open sat unseen until the next launch — which, for the requester, is
-- the whole event. On the publication it arrives the moment it is written, and
-- `notifications_select` (profile_id = auth.uid()) is what keeps each member's
-- stream to their own rows.
alter table public.notifications replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     )
  then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
