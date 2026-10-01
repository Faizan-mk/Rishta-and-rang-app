import { scaleFont } from './responsive';
import { fonts } from './fonts';

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

// Headings are Playfair Display (the invitation-card serif), everything else is
// Plus Jakarta Sans. fontWeight stays on each token so a screen that overrides
// the family still gets a sensible system-font weight.
export const typography = {
  h1: { ...scaled(BASE.h1), fontFamily: fonts.display, fontWeight: '600' as const },
  h2: { ...scaled(BASE.h2), fontFamily: fonts.display, fontWeight: '600' as const },
  h3: { ...scaled(BASE.h3), fontFamily: fonts.displayMedium, fontWeight: '500' as const },
  body: { ...scaled(BASE.body), fontFamily: fonts.body, fontWeight: '400' as const },
  bodyBold: { ...scaled(BASE.body), fontFamily: fonts.bodySemiBold, fontWeight: '600' as const },
  caption: { ...scaled(BASE.caption), fontFamily: fonts.body, fontWeight: '400' as const },
  label: { ...scaled(BASE.caption), fontFamily: fonts.bodySemiBold, fontWeight: '600' as const },
} as const;
