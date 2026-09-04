# Full smoke test — two devices, two real accounts

The core loop has never been walked end to end with nothing mocked. This is the
walk: **match → chat → Move to Rishta → block → report**, on two devices signed
in as two different real accounts, against the live Supabase project.

Every step has a **what you should see** (on the devices) and a **what should be
in the data** (a query you can paste into the SQL editor). Both halves have to
pass. A step that looks right on screen and leaves nothing in the database is
the exact failure mode this whole exercise exists to catch — the Move to Rishta
handshake was a 2.2-second `setTimeout` for months and looked perfect.

---

## Before you start

### 1. The database is up to date

Run, in order, anything not already applied. As of the last check against the
live project, everything through `32` is applied and **`33` is not**:

```sql
-- supabase/33_chat_paging_and_receipts.sql   <- the app does not load a thread without it
```

That one is not optional: the chat reads its messages through two functions this
migration creates, so until it is run a thread shows only its last line and a
toast. It creates an index, three functions and one replacement policy — nothing
is deleted, and it can be run again safely.

`31_drop_legacy_message_columns.sql` is optional (the app works either way —
`26` already made those columns nullable), but run it if every build in the wild
is on the current client.

A quick check of what is live, without a password (uses the anon key from
`.env`; `message_page` is the newest of them):

```bash
curl -s -X POST "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/rpc/message_page" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_match_id":"00000000-0000-0000-0000-000000000000"}'
```

`PGRST202` (not found) means 33 has not been run. `42501` (permission denied)
means it has — the function exists and is not yours to call from out there.

### 2. The data half, before the device half

Run `supabase/tests/verify_core_loop.sql` in the SQL editor. It walks this same
journey between the two lowest-id profiles, through the same RPCs and policies
the app uses, and rolls everything back — the results come back as the raised
exception. **If that script does not pass, do not start the device test:** what
you would be debugging is the schema, and it is much easier to read there.

### 3. The two devices

- Both need a **development build** (`npx eas build --profile development`), not
  Expo Go, if you want the push half of any step. Remote push does not work in
  Expo Go on SDK 53+, and Android additionally needs FCM credentials on the EAS
  project. Everything else in this document works in Expo Go.
- Sign each device into a **different** account. Two sessions of the same
  account will pass steps that a real pair would fail — that is how the
  one-sided schema survived as long as it did.
- Keep the SQL editor open in a third window. Half of these steps are only
  really verified there.

Throughout: **A** is device one, **B** is device two.

---

## 1 · Signup, on both devices

**Do:** create both accounts through the real signup flow — account details,
intent, 2+ photos, selfie, CNIC. Do not reuse an existing session.

**See:** both land on Home with a deck, not on an error or an empty splash.

**Data:**

```sql
select id, full_name, city, active_mode, created_at
from public.profiles order by created_at desc limit 2;
```

Two rows, minutes old. Note both ids — call them `:a` and `:b`; the rest of this
document uses them.

> Signup writes profile rows through an upsert that needs UPDATE rights on every
> column it names. If signup fails with a permission error, that is what it is
> (`supabase/tests/check_signup_upsert_grants.sql` names the column).

## 2 · Swipe and like each other

**Do:** on A, find B in the deck and like them. Then on B, find A and like them.

**See:** on B (the second liker), the match celebration fires. On A it does not
fire at that moment — A liked into the void and finds out through the match list.

**Data:**

```sql
select liker_id, target_id, mode from public.likes
where (liker_id = :a and target_id = :b) or (liker_id = :b and target_id = :a);
-- expect 2 rows

select id, user_a, user_b, mode, created_at from public.matches
where user_a = least(:a,:b) and user_b = greatest(:a,:b);
-- expect exactly ONE row, uuids in ascending order
```

**One row, not two.** Two rows means the pair-ordering key is not doing its job.
Note the match id as `:m`.

**Both devices:** the other person appears in Matches. If they appear on one
device only, the read policy is wrong, not the UI.

## 3 · Message, both directions

**Do:** A sends "salaam" → B replies → A sends a photo → B sends a voice note.

**See:** each message appears on the other device **without a pull-to-refresh or
a relaunch** (Realtime), on the correct side of the thread, within a second or
so.

**Data:**

```sql
select sender_id, kind, left(text, 20) as text, sent_at
from public.chat_messages where match_id = :m order by sent_at;
-- expect 4 rows, two per sender, and NO row whose sender is not one of the pair
```

If a message never arrives live but the row is there, the fault is the
subscription, not the policies — `verify_two_way_messaging.sql` separates the two.

**Check the three states of your own message.** On A's bubbles: a clock while
sending, two grey ticks once it is on the server, and the same two ticks turning
**blue** once B opens the thread. Put the phone in aeroplane mode and send — the bubble should appear
immediately, then get a **Retry** pill and a toast, not vanish.

```sql
select user_id, last_read_at from public.match_reads where match_id = :m;
-- the double tick on A's side is B's row here, nothing more is stored
```

If B has turned **Settings → Privacy → online status** off, A's ticks stay grey
however many times B reads it. That is deliberate — a read receipt is the same
class of signal as "last seen", so it is behind the same switch.

**A long thread.** Send enough messages that the thread is longer than a screen
(or open one that already is), scroll up, and watch older messages page in 30 at
a time with a spinner at the top. Nothing should jump or repeat.

## 4 · Per-side unread

**Do:** A opens the thread and reads it. B does **not** open theirs.

**See:** A's Matches row loses its unread dot and the tab badge drops. B's row
still shows unread — A reading their own copy must not clear B's.

**Data:**

```sql
select user_id, last_read_at from public.match_reads where match_id = :m;
-- expect ONE row, A's. B has never opened it, so B has no mark.
```

## 5 · The Move to Rishta gate

**Do:** on A, with the rishta half of the profile **empty**, open the thread and
tap "Move to Rishta".

**See:** the bar is muted with a warning icon; tapping explains that religion,
education, family background and readiness are needed, and offers to open the
Rishta profile screen. **No request is sent.**

**Data:**

```sql
select rishta_requested_by from public.matches where id = :m;  -- expect null
```

**Do:** fill in all four fields on A, come back, and tap it again.

**See:** now it confirms, and the bar becomes "Rishta request pending…".

## 6 · The request lands on the other device

**See on B, while they are looking at the app:** a pending banner appears in the
thread with **Accept** / **Not yet** — pushed there by the shared row changing,
not by B refreshing. B's notification feed gains a row. If B has a development
build and the app is backgrounded, a push arrives instead.

**Data:**

```sql
select rishta_requested_by, rishta_requested_at, mode from public.matches where id = :m;
-- expect requested_by = :a, mode still 'dating'

select profile_id, type, title, body, created_at from public.notifications
where profile_id = :b order by created_at desc limit 1;
-- expect a rishta_request row, titled with A's name, in B's language
```

**Also check the rule that the simulation could never express:** A must not be
able to answer their own request. There is no UI for it (A sees "pending", not
Accept), and `respond_rishta` raises `cannot_answer_own_request` if you try it
from the SQL editor as A.

## 7 · Accept, and both sides move

**Do:** tap **Accept** on B.

**See on B:** confirmation, the thread's header gains the Rishta badge, the
colours change to the rishta accent. **On A, without touching anything:** the
same — the pending bar goes, the badge appears, and a notification arrives
saying B accepted.

**Data:**

```sql
select mode, rishta_requested_by, rishta_answered_by from public.matches where id = :m;
-- expect mode = 'rishta', requested_by = null, answered_by = :b (B answered it,
-- and that is what lets B's device — and only B's — push the answer to A)

select profile_id, body, created_at from public.notifications
where profile_id in (:a, :b) and type = 'rishta_request'
order by created_at desc limit 4;
-- expect a row for EACH of them from the acceptance
```

**And the crossing-over is permanent for both:** on both devices, the other
person is now gone from the Friends deck, from Explore's Friends pool and from
the Friends side of Matches.

> **Decline instead, once:** ask again from A, tap "Not yet" on B, and confirm A
> is told rather than watching the pending bar silently revert. Then ask again
> and accept — a decline is meant to leave the door open.

## 8 · Block

**Do:** on B, block A from the chat header.

**See on B:** the thread is gone and A is in Settings → Blocked users. **On A:**
the thread is gone too, and B is not in the deck, not in Explore, not
searchable, not openable from any old link.

**Data:**

```sql
select profile_id, blocked_user_id, name from public.blocked_users
where profile_id = :b and blocked_user_id = :a;               -- expect 1 row

select count(*) from public.matches where id = :m;             -- expect 0
select count(*) from public.likes
where (liker_id = :a and target_id = :b) or (liker_id = :b and target_id = :a);
                                                               -- expect 0
select public.is_blocked_pair(:a, :b), public.is_blocked_pair(:b, :a);
                                                               -- expect true, true
```

Both directions matter. The block is enforced in the database now, so a client
bug cannot leak the pair back to each other — but that is only true if
`is_blocked_pair` says true from **both** seats.

**Then unblock from B**, and confirm they can find each other again, so the rest
of the test has a pair to work with.

## 9 · Report

**Do:** on A, report B from the chat header (any reason).

**See:** "Report submitted". If it fails, it must say so — a false confirmation
on a report is the worst outcome in this app, and it used to do exactly that.

**Data:**

```sql
select reporter_id, target_id, reason, context, status, created_at
from public.reports where reporter_id = :a and target_id = :b;
-- expect 1 row, status 'pending', reason a stable key ('harassment'), not a
-- translated label
```

`reports` has no select policy, so this query only works from the SQL editor —
a reporter cannot read back their own report, by design.

## 10 · Push, on a closed app

**Development build only.** Expo Go cannot mint a push token on SDK 53+, and
Android additionally needs FCM credentials on the EAS project. In Expo Go every
step below silently does nothing, which is not a failure of the wiring.

**First, is there anywhere to send to?**

```sql
select user_id, device_info->>'platform' as platform, created_at
from public.push_tokens;
-- expect one row per signed-in device
```

Empty means no device ever got a token. The app says why in the dev console:
`[push] no token: <reason>` — Expo Go, not a physical device, permission
declined, or no FCM credentials.

**Do:** on B, **close the app completely** (swipe it out of recents — not just
background it). On A, send a message.

**See on B:** a system notification with **A's name** as the title and the
message text as the body. Tap it → the app opens **on that thread**, not on
whichever screen it was left on.

Then the same for the other three events, in whatever order suits:

| Fire it by | B should see |
|---|---|
| A likes B (no match yet) | "A liked your profile." → tap opens Notifications |
| B likes A back | "You matched! Say salaam." → tap opens Matches |
| A sends a Move to Rishta request | "A would like to move to Rishta stage." → tap opens the thread |
| B accepts, A's app closed | A gets "B accepted your Rishta request…" → tap opens the thread |

**Then prove the preference actually stops it:** on B, Settings → Notifications
→ turn **Messages** off. A sends another message.

**See:** no push on B. **But the message still arrives in the thread** — muting
is about the telling, not the feature. Turn it back on, send again, the push
returns.

The database half of that gate is provable without a phone:
`supabase/tests/verify_notification_prefs.sql` mutes a category, confirms
nothing is written, confirms the underlying request still landed, and confirms a
member with no prefs row at all still hears (the table's defaults).

**If nothing arrives**, work down this list before touching the app code:

1. `select count(*) from public.push_tokens;` — no row means the device never
   registered, and nothing after this matters.
2. Is `send-push` deployed, and is it the current version?
   `npx supabase functions deploy send-push --project-ref <ref>`
3. Dashboard → Edge Functions → send-push → Logs. `{"skipped":"no_devices"}`
   means step 1; `{"skipped":"muted_by_prefs"}` means the pref is off;
   `expo_rejected` means Expo refused the token or the payload.
4. Android with no FCM credentials on the EAS project cannot be reached at all,
   however correct everything else is: `npx eas credentials`.

---

## What "done" means

Every box below ticked, on two devices, with **nothing fabricated anywhere** —
no mock deck, no simulated acceptance, no notification the client wrote to
itself about an event that did not happen.

- [ ] Two accounts created through the real signup flow
- [ ] Mutual like produces exactly one match row, visible to both
- [ ] Messages both ways, live, correct sides, per-side unread
- [ ] Move to Rishta is refused without the rishta profile fields
- [ ] The request appears on the other device live, and in their feed
- [ ] Accept flips `mode` for both, and both are notified
- [ ] Decline tells the requester rather than silently reverting
- [ ] Block removes the pair from each other in both directions
- [ ] Report lands as a real row with a stable reason key
- [ ] A message to a **closed** app arrives as a system push, and tapping it
      opens that thread
- [ ] Turning the category off in Settings actually stops the push, without
      stopping the message
- [ ] A message appears the instant it is sent, and a failed one offers Retry
      rather than disappearing
- [ ] Ticks: clock → two grey ticks → two blue ticks when the other side opens
      the thread
- [ ] A long thread pages in older messages instead of loading whole
- [ ] The deck keeps producing cards past the first 30 without a pause

## When something breaks

Fix it, then re-run the whole sequence from step 2 — the steps depend on each
other, and a fix to the match row can easily unfix step 4. Budget time for this:
the point of a smoke test is that it finds things.

Two shortcuts worth knowing:

- `supabase/tests/verify_core_loop.sql` reproduces steps 2-9 in the data alone,
  in seconds, rolled back. Use it to tell "the schema is wrong" from "the app is
  wrong" before opening a single file.
- The other `verify_*.sql` scripts each narrow one step: mutual matching,
  two-way messaging, the rishta handshake, blocks both ways, reports.
