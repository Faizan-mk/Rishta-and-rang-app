import { scaleSpace } from './responsive';

// Base values tuned for a 375pt-wide phone; scaleSpace() adapts them to the
// current device — see responsive.ts.
export const spacing = {
  xs: scaleSpace(4),
  sm: scaleSpace(8),
  md: scaleSpace(16),
  lg: scaleSpace(24),
  xl: scaleSpace(32),
  xxl: scaleSpace(48),
} as const;

export const radius = {
  sm: scaleSpace(8),
  md: scaleSpace(14),
  lg: scaleSpace(20),
  pill: 999,
} as const;
