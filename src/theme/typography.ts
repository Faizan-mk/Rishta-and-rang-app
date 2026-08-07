import { scaleFont } from './responsive';

// Base sizes are tuned for a 375pt-wide phone; scaleFont() adapts them to the
// current device (small phone, large phone, or tablet) — see responsive.ts.
const BASE = {
  h1: { fontSize: 28, lineHeight: 34 },
  h2: { fontSize: 22, lineHeight: 28 },
  h3: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
} as const;

function scaled(base: { fontSize: number; lineHeight: number }) {
  return { fontSize: scaleFont(base.fontSize), lineHeight: scaleFont(base.lineHeight) };
}

export const typography = {
  h1: { ...scaled(BASE.h1), fontWeight: '700' as const },
  h2: { ...scaled(BASE.h2), fontWeight: '700' as const },
  h3: { ...scaled(BASE.h3), fontWeight: '600' as const },
  body: { ...scaled(BASE.body), fontWeight: '400' as const },
  bodyBold: { ...scaled(BASE.body), fontWeight: '600' as const },
  caption: { ...scaled(BASE.caption), fontWeight: '400' as const },
  label: { ...scaled(BASE.caption), fontWeight: '600' as const },
} as const;
