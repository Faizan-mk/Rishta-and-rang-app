export interface Palette {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderSoft: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  teal: string;
  tealDark: string;
  tealSoft: string;
  gold: string;
  goldSoft: string;
  sage: string;
  sageLight: string;
  plum: string;
  plumLight: string;

  dating: string;
  datingSoft: string;
  rishta: string;
  rishtaSoft: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;

  // The blue of a read receipt. Its own token rather than one of the accents
  // above: it has to mean "they read it" and nothing else, so it must not move
  // when the Friends or Rishta accents do.
  readReceipt: string;

  overlay: string;
  shadow: string;
  skeleton: string;
}

/**
 * The green that means "here right now" — the deck's live pill and the chat
 * header's dot.
 *
 * Deliberately outside the light/dark palettes: it is a signal borrowed from
 * every other messaging app, and a reader has to recognise it as the same green
 * in both themes and on both surfaces. One definition so the two cannot drift.
 */
export const ONLINE_GREEN = '#22C55E';

// "Rishta & Rang" design system: deep Maroon (Rishta, primary CTA) and Gold
// (premium, verified) on warm ivory, with a maroon-to-rose gradient for
// highlights. Token names predate the redesign and are kept so every screen
// picks the new colours up unchanged: `teal` is the brand primary (Maroon),
// `sage` is the success green, `plum` is the rose end of the primary gradient.
export const lightPalette: Palette = {
  background: '#FCF9F5',
  backgroundAlt: '#F6F0EA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E9E1DB',
  borderSoft: '#F2ECE6',

  textPrimary: '#241F21',
  textSecondary: '#756E70',
  textTertiary: '#A39C9E',
  textInverse: '#FFFFFF',

  teal: '#7A1F35',
  tealDark: '#4B1020',
  tealSoft: '#F5E6EA',
  gold: '#C9A45C',
  goldSoft: '#F7EEDC',
  sage: '#198754',
  sageLight: '#E2F3EA',
  plum: '#9B3A56',
  plumLight: '#F8E9EE',

  dating: '#B08A45',
  datingSoft: '#F7EEDC',
  rishta: '#7A1F35',
  rishtaSoft: '#F5E6EA',

  success: '#198754',
  successSoft: '#E2F3EA',
  danger: '#C43D4B',
  dangerSoft: '#F9E5E7',
  warning: '#C9A45C',
  warningSoft: '#F7EEDC',

  readReceipt: '#2B7FB8',

  overlay: 'rgba(18, 15, 16, 0.65)',
  shadow: 'rgba(36, 31, 33, 0.10)',
  skeleton: '#F2ECE6',
};

// Dark variant: warm charcoal canvas with the maroon and gold brightened so
// they still read on the dark surfaces.
export const darkPalette: Palette = {
  background: '#141112',
  backgroundAlt: '#0D0B0C',
  surface: '#1E1A1C',
  surfaceElevated: '#282325',
  border: '#3A3336',
  borderSoft: '#252022',

  textPrimary: '#F5F0EE',
  textSecondary: '#B5ADAF',
  textTertiary: '#857D80',
  textInverse: '#FFFFFF',

  teal: '#C2516E',
  tealDark: '#7A1F35',
  tealSoft: '#3A1A23',
  gold: '#D9B872',
  goldSoft: '#332914',
  sage: '#3DBE7F',
  sageLight: '#12301F',
  plum: '#D16F8B',
  plumLight: '#3A1D27',

  dating: '#D9B872',
  datingSoft: '#332914',
  rishta: '#C2516E',
  rishtaSoft: '#3A1A23',

  success: '#3DBE7F',
  successSoft: '#12301F',
  danger: '#E0646F',
  dangerSoft: '#3A1718',
  warning: '#D9B872',
  warningSoft: '#332914',

  // Brighter against near-black, the same way the other dark accents are.
  readReceipt: '#5AB6E8',

  overlay: 'rgba(0, 0, 0, 0.75)',
  shadow: 'rgba(0, 0, 0, 0.7)',
  skeleton: '#282325',
};
