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
