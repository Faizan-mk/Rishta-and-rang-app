# Handover Notes

## Identity verification — currently NOT real

Neither the selfie badge nor the CNIC badge is real identity verification today.

- **Selfie badge** (`selfieVerified`): set to `true` purely because a selfie photo
  was uploaded at account creation (`SelfieVerificationScreen`). No human or
  automated review of the person's identity happens. The badge is labelled
  **"Photo added"** to reflect this.
- **CNIC badge** (`cnicVerified`): set to `true` at account creation when the
  number passes a format regex and a gender-last-digit heuristic, and the photo
  passes an aspect-ratio / green-colour plausibility check (`idCardImageCheck.ts`).
  That is **submission**, not verification. The badge is labelled
  **"ID photo submitted"**.

- **Bureau badge** (`bureauVerified`): the request flow told the member "we'll
  run a background check through our verification bureau" and then set
  `bureauVerified: true` on the spot. No check of any kind ran, and the badge was
  visible to other members — the exact signal someone leans on before agreeing to
  meet a stranger. It is now hidden behind `FEATURE_BUREAU` (default `false`) in
  `src/config/features.ts`: the request row on Profile, the badge on
  `MatchScoreCard`, and the bureau line in `VerificationSection` all disappear
  while the flag is off. Existing `bureauVerified` rows are untouched — the flag
  hides the claim, it does not rewrite anyone's profile.
- **The checkmark visuals are fixed.** A bare tick in the app's accent beside a
  name reads as "verified account" everywhere on the internet, while this flag
  only means a selfie was uploaded at signup. `DiscoverProfileCard`, the Explore
  grid tiles and the `ProfileScreen` avatar now show a small camera glyph on
  neutral ink, with a "Photo added" accessibility label, instead of a tick in
  teal/green.

### Deferred work

- The full review-queue build (human/automated identity review that can grant a
  real "Verified" status) is deferred to **Day 12 of Week 2**.
- Until review ships, do not re-add "Verified" wording to the selfie or CNIC
  badges, and do not present either badge as identity verification.

### For the Day 12 build

- Introduce a real review queue (pending → approved / rejected) backed by a
  Supabase table or RPC.
- Move `selfieVerified` / `cnicVerified` to be set **only on approval**, not at
  upload time.
- Restore "Verified" labels only once the badge is driven by an approved review.
- Flip `FEATURE_BUREAU` to `true` at the same time, and only then — the copy in
  `bureau.confirmBody` promises a background check, so the flag must not come on
  before something actually runs one.
- The checkmark visuals are done (camera glyph, neutral ink). If a real review
  ships, that is when a tick is earned back.

### Still overclaiming

The "Verified only" filter (`filters.verifiedOnly`, in `HomeScreen` and
`ExploreScreen`) matches on `selfieVerified || bureauVerified` — so it promises
verified members while really meaning "uploaded a selfie". Left alone for now
because it is a filter rather than a badge on a person, but it should either be
relabelled or repointed at the review queue when that lands.

## Match celebration

The "It's a match" celebration must only fire when the match RPC / result returns
`matched = true`. Today there is no mutual-match detection server-side, so the
celebration is **not** fired from the swipe handler (`HomeScreen.onLike`) or the
profile-detail like action. When Day 5's match-detection RPC lands, wire
`MatchCelebration` up to that result instead of the raw swipe.

## Trivial fixes log

- `DiscoveryContext`: mock deck top-up is now behind `__DEV__ && ENABLE_MOCK_PROFILES`
  (default `false`; mock data is lazily `require`d so it stays out of production
  bundles). Low-inventory areas show an honest empty state
  (`discover.outOfProfiles`: "Not enough profiles nearby yet…").
- Badge honesty: selfie → "Photo added", CNIC → "ID photo submitted".

## Urdu / RTL sweep

The dictionaries were already at full key coverage; what still rendered in
English was code that never reached `t()`. Fixed:

- **Service-layer errors.** `authService` and `mediaUpload` authored their own
  English messages and threw them as `Error`, and four screens printed
  `e.message` straight to the member. They now throw `AppError`
  (`src/utils/appError.ts`), whose message *is* a dictionary key, and screens
  resolve it with `errorMessage(e, t)`. Raw Supabase server strings are still
  passed through untranslated — we don't author them and they can't be keyed.
- **`timeAgo`** now takes the caller's `t` and returns a whole phrase from the
  dictionary. "5m ago" cannot be built as a number plus a suffix in Urdu.
- **`CalendarModal`** built its month header with `toLocaleDateString('en-US')`
  and hardcoded weekday initials. Both come from `calendar.*` now — Hermes ships
  a trimmed ICU, so a locale-formatted month silently falls back to English.
- **Message previews.** `matches.last_message` persists "📷 Photo" / "🎤 Voice
  message", so the stored value outlives the language it was written under.
  `src/utils/messagePreview.ts` keeps writing those two fixed markers and
  translates them at render, which also re-labels rows already in the database.
- **Fixed option lists** (cities, sects, religions, education, degrees, job
  titles, industries, languages, nationalities, countries) rendered their stored
  English. `src/i18n/vocabulary.ts` translates the *label* while the *value*
  stays canonical English — both sides of a match must agree on what was picked
  regardless of the language each reads in, and existing rows already hold the
  English. Free-text ("Other") answers have no key and fall through unchanged.
- **RTL rows.** Components laying out icon-then-text now mirror in Urdu
  (`NotificationRow`, `StatCard`, `ChatScreen` header and composer, `StepHeader`,
  `SelectField`, `ConfirmDialog`, `MessageBubble`). Most of the codebase uses
  `gap` rather than directional margins, so those rows mirror correctly with
  `row-reverse` alone.

Key parity is enforced by construction: all three dictionaries carry the same
778 paths.

### Still English in Urdu

Raw Supabase auth/storage error strings (`error.message`), on the paths where we
surface the server's own wording rather than our own.

## Legal documents

`legal.placeholderNotice` is gone; the Legal screen renders the real Privacy
Policy (11 clauses) and Terms of Service (12 clauses) from
`legal.privacy.*` / `legal.terms.*`, in all three languages.

- `scripts/build-legal-pages.mjs` (`npm run legal:build`) generates
  `docs/legal/*.html` from `src/i18n/en.json`, and prints each to `.pdf` with a
  headless Chrome/Edge if one is installed — so the hosted copies cannot drift
  from the in-app text.
- `supabase/19_legal_docs.sql` creates the public `legal` bucket. **Upload the
  PDFs, not the HTML.** Supabase serves an `.html` object from a public bucket
  as `text/plain` with `X-Content-Type-Options: nosniff` — their guard against
  phishing pages on a `supabase.co` domain — so an `.html` URL shows raw source
  and the browser will not override it. PDFs come back as `application/pdf` and
  open normally.
- The `.html` is still the authored artefact and the input to the PDF. If this
  ever moves to a real static host (GitHub Pages, Netlify), deploy the HTML and
  repoint the two env vars: it reflows on a phone, and a PDF does not.
- The two URLs live in `.env` as `EXPO_PUBLIC_PRIVACY_POLICY_URL` and
  `EXPO_PUBLIC_TERMS_URL`; until they are set, the "read online" rows say the
  link is unavailable rather than opening a dead URL. They are inlined at build
  time, so changing them needs `npx expo start -c`, not a plain restart.
- **Not done, and needed before submission:** a lawyer has to review both
  documents, and the two URLs have to actually be live. The text is drafted to
  be accurate about what this app does — it is not reviewed legal advice.

Signup now carries an explicit 18+ gate: a checkbox affirming "18 or older, and
I accept the Terms and Privacy Policy", plus a link into the Legal screen. The
date-of-birth check that already rejected under-18s is unchanged — the checkbox
is the affirmation the stores ask for, not a replacement for it.

## Emoji reactions

`supabase/20_message_reactions.sql` adds `message_reactions`
(`message_id`, `user_id`, `emoji`, `created_at`), unique per person per emoji per
message, streamed on the same Realtime channel as the messages themselves.

Long-pressing a bubble opens a six-emoji picker; reactions render as pills under
the bubble and toggle off when tapped again. Writes are optimistic and reconcile
against the row the insert returns.

**Scope limit, same as messages:** this app mirrors each side of a thread into
its own rows (`chat_messages.profile_id` is the owner) and has no cross-user
write path, so "the other person sees it live" means every session of the
*owning* account, not a second member. RLS says "the message you are reacting to
is one you own", which is the strongest form of "match participants only" this
schema can state. When Day 5's match-detection RPC introduces a shared
conversation, these policies move to its participant list without the table
changing shape.

## Reporting

`reports` (`supabase/21_reports.sql`) — reporter, target, reason, details,
context, status. `ReportDialog` used to hand its caller a *translated* label;
it now returns the stable key (`harassment`, `fakeProfile`, …) so a moderator
reads the same word whichever language the reporter had the app in. Both call
sites (Discover card, chat header) write a real row.

- **Insert-only, and no select policy at all.** A reporter cannot read back their
  own report, and nobody can enumerate who reported whom or learn that they have
  been reported. Moderation reads `report_queue`, granted to `service_role` only
  — that is the Studio view.
- Unique on `(reporter_id, target_id)`: reporting someone twice updates the row.
  One person cannot reach the auto-hide threshold by themselves.
- **Auto-hide at 3 distinct reporters.** A trigger stamps `profiles.hidden_at`,
  and `profiles_select` drops hidden rows for everyone except the owner — so a
  reported member still sees their own profile rather than a broken app, but
  disappears from every other surface at once.
- `select public.moderate_profile('<uuid>', false, 'dismissed');` puts them back.

## Block hardening

`blocked_users.blocked_id` held the *match row's* id. A match row is per-user and
per-conversation, so that id meant nothing to the other side and nothing again if
the same two people met through a second match row. `supabase/22_block_hardening.sql`
promotes the person's uuid into `blocked_user_id`, backfilling from
`source_profile_id` and then from the match row.

⚠️ **The migration deletes block rows it cannot resolve to a real person** — demo
and legacy blocks pointing at a profile that no longer exists. Check
`select count(*) from blocked_users;` before and after if that matters.

Enforcement moved into the database, both directions:

| Surface | Enforced by |
|---|---|
| Discover / Explore / profile detail | `profiles_select` calls `is_blocked_pair` |
| Sending a message | `messages_insert` resolves the counterpart via `match_counterpart` |
| Likes / "who liked you" | `likes_received_insert`, plus a trigger clearing existing likes on block |

`is_blocked_pair` is `security definer` because `blocked_users` is owner-only —
answering "did *they* block *me*?" needs a row you do not own. It returns yes/no
about one pair and never anyone's block list.

`BlockedProfile.sourceProfileId` is gone; `BlockedProfile.id` is the person now.
`blocked_id` is left in place but nullable, so an older client mid-rollout does
not fail its inserts. Drop it once every build is updated.

**Known gap:** a match row with no `sourceProfileId` (legacy) has no person to
block. The thread is still removed, but no `blocked_users` row is written —
recording a block against a match id is what this change was undoing.

## Push notifications — scaffolding only

Installed `expo-notifications` + `expo-device`; plugin added to app.json.

- `push_tokens` (`supabase/23_push_tokens.sql`) — one row per *device*, not per
  member, so a phone and a tablet both get reached. Written through
  `register_push_token`, a definer RPC: the token is unique table-wide, so a
  device that changes hands has to move to the new account, which a plain client
  upsert could not do without failing the previous owner's RLS check.
- `usePushRegistration` (mounted in the root layout) stores a token on sign-in
  and drops it on sign-out. Silent on failure by design — a declined permission,
  a simulator, and a build without FCM credentials all end in "no token", and
  none is worth interrupting someone for.
- `supabase/functions/send-push` checks the recipient's `notification_prefs`,
  looks up their devices, calls Expo, and prunes `DeviceNotRegistered` tokens.

**What is NOT done, and cannot be from here:**

- Nothing calls `send-push` automatically. Event wiring (new match / message /
  like) waits on Day 5-6 making those real server-side events.
- **Not verified end to end.** A real push needs a physical device, FCM
  credentials on the EAS project, and the function deployed — none of which
  exist in this environment. Remote push also does not work in Expo Go on
  SDK 53+; it needs a development build.

To verify manually once deployed:

```
supabase functions deploy send-push
curl -X POST 'https://<project>.supabase.co/functions/v1/send-push' \
  -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"<uuid>","event":"message","title":"Test","body":"Hello"}'
```

### Verified (2 September 2026)

`supabase/tests/` holds two scripts that prove this rather than assert it. Both
write inside a transaction they deliberately abort, so they are safe against a
live project — the results come back as the raised exception.

- `verify_reports_and_blocks.sql` — one reporter does not hide anyone, the same
  reporter twice still does not, three distinct reporters do; `is_blocked_pair`
  answers true from both sides of a single row and false for an unrelated pair;
  blocking clears a standing like; `match_counterpart` resolves a thread.
- `verify_block_both_ways.sql` — impersonates real members (`role` +
  `request.jwt.claims`, what PostgREST sets per request) so the actual policies
  are measured, not bypassed by Studio's superuser. Confirms A cannot see B,
  **B cannot see A**, and a third member is still visible as a control.

Both passed, and reporting and blocking were each confirmed from the app: a
report lands as a real row, and `blocked_users.blocked_user_id` resolves to the
blocked person's name.

**Bug found doing it:** `reportsService` used `.upsert()`, which is
`INSERT … ON CONFLICT DO UPDATE` underneath and needs UPDATE rights that
`reports` deliberately does not grant. Every report was silently refused, and
the screen said "Report submitted" anyway because the handler swallowed the
error. Now a plain `.insert()` (duplicate = success, via `23505`), and a failed
report says so instead of lying — a report is what someone reaches for when they
feel unsafe, so a false confirmation is the worst possible outcome.

### Push — what is and is not proven (2 September 2026)

The `send-push` logic was run line-for-line against the live project without
deploying it, using a fake device row that the function's own pruning deleted
again. All six steps passed:

| Step | Result |
|---|---|
| prefs gate, with no `notification_prefs` row | falls back to the table default (`messages` = on) |
| device lookup | found the seeded row |
| Expo push API call | HTTP 200, request shape accepted |
| ticket parsing | `DeviceNotRegistered` read from `data[].details.error` |
| dead-token pruning | row deleted, table back to 0 |

So the pipeline — prefs → tokens → Expo → prune — is correct.

**Still unproven, and it needs credentials this environment does not have:**

1. **Deployment.** `supabase functions deploy send-push` needs a personal access
   token (`supabase login`), which is not the service_role key. Never run.
2. **A real device token.** `push_tokens` is empty. Expo Go cannot produce one on
   SDK 53+; it needs a development build, and Android additionally needs FCM
   credentials on the EAS project.
3. **A push actually arriving.** Follows from 1 and 2.

3.3's own criterion — "a test account has a stored token; manually invoking the
Edge Function sends a real push" — is therefore **not met**. The code is written
and its logic is verified; delivery is not.

### Push — deployed and exercised (2 September 2026)

`send-push` is deployed to the project and was invoked against it:

| Call | Response |
|---|---|
| valid request, no devices registered | `{"skipped":"no_devices"}` |
| `{"userId":"x"}` | `{"error":"missing_fields","required":[...]}` |
| valid request, one (fake) device seeded | `{"sent":1,"pruned":1,"tickets":[…DeviceNotRegistered…]}` |

The third call is the whole pipeline running inside the deployed function: prefs
gate → device lookup → Expo push API → ticket parsing → dead-token pruning. It
deleted the fake row itself, and `push_tokens` came back empty.

**The one thing still unproven: a real device receiving a notification.** Expo
rejected the fake token, correctly — nothing here has ever held a real one.
`push_tokens` is empty because Expo Go cannot mint a token on SDK 53+; that
needs a development build, and Android also needs FCM credentials on the EAS
project.

So of 3.3's criterion — "a test account has a stored token; manually invoking
the Edge Function sends a real push" — the second half is proven as far as Expo's
API, and the first half is not met at all. To close it:

```
npx eas build --profile development --platform android
# install, sign in, then:
#   select * from push_tokens;          -> expect one row
# then invoke send-push with that account's userId and watch the phone
```

## Move to Rishta — the handshake, and being told about it

`supabase/28_rishta_request.sql` made the handshake real: the request is two
columns on the shared match row (`rishta_requested_by`, `rishta_requested_at`),
`request_rishta` / `respond_rishta` are the only ways either moves, and 24's
blanket `matches_update` policy is gone — so `mode` becomes `rishta` by
acceptance and by nothing else. The 2.2-second `setTimeout` that used to fake
the other person's answer is gone with it.

`supabase/32_rishta_notifications.sql` is the half that tells people:

- The three moments each leave a `notifications` row — **asked** → the other
  member, **accepted** → *both* of them off the one write that moved them,
  **declined** → the requester, so a pending bar never just disappears.
- It has to be server-side. `notifications_insert` is `profile_id = auth.uid()`,
  so the client can only ever write a notification to itself; the rows are
  written inside the definer functions that already own the transition, through
  `notify_member`, which is deliberately **not** granted to `authenticated`.
- Wording is in the recipient's language (`rishta_copy`), word for word the same
  as the push copy in `send-push` — the same event should not arrive twice in
  two wordings.
- `notifications` joins the Realtime publication, and `NotificationContext`
  subscribes. Without that the feed was fetched once per sign-in, so a row
  written while the app was open showed up on the next launch — which, for the
  requester, is long after the moment.
- Push rides along: `rishta_accepted` / `rishta_declined` are new `send-push`
  events, sent by the member who answered. "They accepted your request" is the
  one line the *other* half of a pair would want to be able to send, so the row
  now records `rishta_answered_by` / `rishta_answered_at` and the function
  carries an answer only for the member the row says gave it, only while that is
  still the answer it holds, and only within five minutes of it.

**The gate is in both places on purpose.** `rishta_profile_complete` (religion,
education, family background, readiness ≠ browsing) is what refuses the request;
`src/utils/rishtaProfile.ts` is the same rule in the client, so the bar can grey
itself and offer the Rishta profile screen instead of turning a tap into an
error. Both `btrim` now, so a field holding only spaces fails on both sides
rather than one.

**Found while checking what was deployed:** `rishta_profile_complete` (28) and
`is_blocked_pair` (22) were both granted to `authenticated` without being
revoked from `public` — and a definer function is executable by `public` unless
told otherwise, so **anyone holding the anon key could call them**. Confirmed
against the live project: both answered HTTP 200 to an unauthenticated caller.
32 revokes `rishta_profile_complete`. **`is_blocked_pair` is left alone and is
still open**: it is called from inside RLS policies, which run as the querying
role, so revoking it needs a check of which roles those policies serve before it
is safe. Worth doing — it answers "do these two people block each other?" about
any pair of ids to anyone with the public key.

### Status against 7.1's "done when"

> The signature feature works between two real accounts and is visible in the data.

Everything on the request side is written and its logic is provable —
`supabase/tests/verify_rishta_request.sql` proves the handshake and
`verify_core_loop.sql` the whole journey around it, both rolled back. **What has
not happened is 7.2: nobody has run it on two devices.** 32 is not applied to
the live project yet either (checked: `rishta_copy` answers `PGRST202`), so the
notifications half is code, not behaviour, until it is run.

Note on the ticket's wording: it asked for `rishta_request_status`
(null/pending/accepted/declined). The status is derived rather than stored —
`mode = 'rishta'` is accepted, a non-null `rishta_requested_by` is pending, and
declined returns to null so the requester may ask again. A stored status column
would be a second name for facts the row already carries, and could disagree
with `mode`. If a decline needs to *persist* (to show the requester "not yet"
until they ask again, say), that is the change to make, and it is a column plus
a clause in `respond_rishta`.

## Full smoke test — the walk-through, not the walk

`docs/smoke-test.md` is the two-device script: match → chat → Move to Rishta →
block → report, with, for every step, what the devices should show **and** the
query that proves it landed. It exists because a step that looks right on screen
and leaves nothing in the database is exactly the failure this project has
already shipped once.

`supabase/tests/verify_core_loop.sql` is its data half — the same journey
through the same RPCs and policies, with both members impersonated
(`role` + both jwt claim GUCs), rolled back by a closing exception. Run it
before touching the devices: if it fails, what you would be debugging is the
schema, and it is far easier to read there.

**Not run, and it cannot be from here:** the two-device walk itself needs two
physical devices, two real accounts and a development build. Nothing in this
change verifies it; it makes it verifiable, and says exactly what to look at.

## Push — wired to real events (10.1)

The scaffolding from Day 3 is now fired by something. Every send goes through
`pushService.notify*` → the `send-push` Edge Function, and the function decides
the recipient and the wording itself from a relationship the caller
demonstrably has — a member can neither address a stranger nor sign a
notification with someone else's name.

| Moment | Fired from | Recipient |
|---|---|---|
| New match | `likeProfile`, on the call that created the pair | the person who liked first |
| One-sided like | `likeProfile` | the person liked |
| New message (text, voice, photo) | `sendMessage` / `sendVoiceMessage` / `sendImageMessage` | the other participant |
| Move to Rishta asked | `sendRishtaRequest` | the other participant |
| …accepted / declined | `respondRishtaRequest` | the requester |

Each fires only after the write it is about has succeeded — a push about a
message that failed to send would be worse than no push — and `notify` never
throws, so a dead notification cannot take the message down with it.

**Tap routing was the missing half.** `send-push` had been putting `matchId` in
every notification's `data` and nothing read it, so a push about a message
opened the app whereever it was last left — the one thing a notification is
supposed to save you from. `usePushNavigation` (mounted in the root layout)
handles both paths: a listener for taps while the app is alive, and
`getLastNotificationResponseAsync` for the tap that launched a killed app, which
no listener is around to hear. A match opens the Matches list and a like opens
the feed, because neither payload carries a thread to open.

**The prefs gate is written twice, and both are the same rule:** `PREF_COLUMN`
in the Edge Function and the `case` in `notify_member`, each falling back to the
table's own defaults when the member has no `notification_prefs` row (everything
on except product updates). `supabase/tests/verify_notification_prefs.sql`
proves the in-app half: a muted category writes nothing, an unmuted one writes
once, a member with no prefs row still hears — and, the assertion worth having,
**muting the notification does not break the thing being notified about**. The
request still lands on the row; only the telling is suppressed.

### Still not proven, and it needs a device

10.1's own criterion — "a message to a closed app arrives as a push, and turning
the pref off actually stops it" — is **not met**. `push_tokens` has never held a
real token: Expo Go cannot mint one on SDK 53+, and Android needs FCM
credentials on the EAS project. Everything up to Expo's API is verified (see the
2 September entries above); a phone receiving a notification is not.

To close it: `npx eas build --profile development --platform android`, install,
sign in, confirm `select count(*) from push_tokens;` is 1, then walk step 10 of
docs/smoke-test.md.
