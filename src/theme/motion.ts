import { Easing } from 'react-native-reanimated';

// Press feedback and small state changes ease in and settle without
// overshooting. They used to be springs with low damping (10–14 at stiffness
// ~220, against ~30 for no bounce), which overshot and wobbled back on every
// tap and read as the UI shaking. The deliberate "pop" on a like keeps its
// spring; this is for everything that should just move and stop.

/** Shrinking under a finger: quick, so the press feels immediate. */
export const PRESS_IN = { duration: 90, easing: Easing.out(Easing.quad) } as const;

/** Coming back on release: a touch slower, ending softly at rest. */
export const PRESS_OUT = { duration: 160, easing: Easing.out(Easing.quad) } as const;

/** Small state changes, such as a tab icon lifting. */
export const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) } as const;
