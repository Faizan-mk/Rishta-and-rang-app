// Central feature flags for the V1 build.
//
// Events is out of V1 roadmap scope, so its tab is hidden unless explicitly
// enabled here. Keep this false for any shipped build — the events screen and
// its data are relax-received, not real events.

export const FEATURE_EVENTS = false;

// Bureau verification is hidden until a real review exists behind it.
//
// The flow promised "we'll run a background check through our verification
// bureau" and then set `bureauVerified: true` on the spot — no check of any
// kind. That badge is visible to other members and is exactly the signal
// someone leans on before agreeing to meet a stranger, so shipping it while it
// means nothing is worse than not shipping it at all.
//
// Turn this on only once the badge is driven by an approved review (the Day 12
// review-queue build). Existing `bureauVerified` rows are left alone — the flag
// hides the badge and the request row, it does not rewrite anyone's profile.
export const FEATURE_BUREAU = false;

// Explore+ perks given to everyone for now, to show members what they do
// before they're sold. Each one's lock is still in place behind its flag: set
// it to false to put the feature back behind Explore+ (the Explore+ screen
// lists it again automatically).
export const FREE_MATCH_SCORE = false;
export const FREE_REWIND = false;
