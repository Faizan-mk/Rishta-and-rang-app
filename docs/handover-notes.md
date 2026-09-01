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
- Revisit the checkmark visuals on `DiscoverProfileCard`, `ProfileScreen` avatar,
  and `ExploreScreen` grid tiles, which currently read as "verified" but only
  indicate that a photo/document was provided.

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