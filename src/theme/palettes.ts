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

  // The theme's fixed "velvet" brand shades, the same in light and dark: the
  // deep hero cards (match celebration, Explore+, the call screen), the
  // welcome gradient and the premium metal trim. `metal` is gold on the
  // Maroon theme and the theme's own trim (silver, rose gold) elsewhere.
  brandInk: string;
  brandDeep: string;
  brandMain: string;
  brandRose: string;
  metal: string;
  metalBright: string;
  metalDeep: string;

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

  brandInk: '#3A0C18',
  brandDeep: '#4B1020',
  brandMain: '#7A1F35',
  brandRose: '#9B3A56',
  metal: '#C9A45C',
  metalBright: '#D9B872',
  metalDeep: '#B8893A',

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

  brandInk: '#3A0C18',
  brandDeep: '#4B1020',
  brandMain: '#7A1F35',
  brandRose: '#9B3A56',
  metal: '#C9A45C',
  metalBright: '#D9B872',
  metalDeep: '#B8893A',

  overlay: 'rgba(0, 0, 0, 0.75)',
  shadow: 'rgba(0, 0, 0, 0.7)',
  skeleton: '#282325',
};

// ---------------------------------------------------------------------------
// App themes. Each one is a light and a dark palette; the light/dark/system
// switch in Settings picks between the two, and the Themes screen picks the
// theme. Maroon & Gold is the original design and stays the default.
//
// Premium identities are built from one deep anchor, one metal and quiet
// neutrals, and the anchors that recur across luxury brands are burgundy,
// emerald, navy and onyx. Each theme is one of those anchors with a gold:
//   Maroon & Gold   the original Rishta & Rang palette
//   Emerald & Gold  Rolex green #006039 with Rolex gold #A37E2C
//   Navy & Gold     deep navy #14213D / #1F3A5F with 24k gold #C69B3C
//   Onyx & Gold     onyx #0A0A0A / #1F1F1F with 24k gold #C69B3C
// Only the anchor and the metal change. The ivory canvas, the charcoal dark
// mode, the text greys and the status colours are shared with Maroon & Gold,
// so every theme still reads as the same app. Light-mode primaries carry white
// button text at 7:1 or better; dark-mode primaries match the Maroon dark
// palette (about 4.5:1).
// ---------------------------------------------------------------------------

export type AppThemeId = 'maroon' | 'emerald' | 'navy' | 'onyx';

export interface AppTheme {
  id: AppThemeId;
  light: Palette;
  dark: Palette;
}

const emeraldBrand = {
  brandInk: '#00261A',
  brandDeep: '#003D25',
  brandMain: '#006039',
  brandRose: '#1F7A55',
  metal: '#A37E2C',
  metalBright: '#C9A452',
  metalDeep: '#86661F',
};

const navyBrand = {
  brandInk: '#0A1222',
  brandDeep: '#14213D',
  brandMain: '#1F3A5F',
  brandRose: '#35507F',
  metal: '#C69B3C',
  metalBright: '#DDB960',
  metalDeep: '#A47E28',
};

const onyxBrand = {
  brandInk: '#050505',
  brandDeep: '#0A0A0A',
  brandMain: '#1F1F1F',
  brandRose: '#3A3A3A',
  metal: '#C69B3C',
  metalBright: '#DDB960',
  metalDeep: '#A47E28',
};

export const APP_THEMES: Record<AppThemeId, AppTheme> = {
  maroon: { id: 'maroon', light: lightPalette, dark: darkPalette },

  emerald: {
    id: 'emerald',
    light: {
      ...lightPalette,
      ...emeraldBrand,
      teal: '#006039',
      tealDark: '#003D25',
      tealSoft: '#E3F0EA',
      gold: '#A37E2C',
      goldSoft: '#F5EDDB',
      plum: '#1F7A55',
      plumLight: '#E8F3EE',
      dating: '#A37E2C',
      datingSoft: '#F5EDDB',
      rishta: '#006039',
      rishtaSoft: '#E3F0EA',
    },
    dark: {
      ...darkPalette,
      ...emeraldBrand,
      teal: '#1F8A5F',
      tealDark: '#006039',
      tealSoft: '#12291F',
      gold: '#C9A452',
      goldSoft: '#302712',
      plum: '#3FA67A',
      plumLight: '#15301F',
      dating: '#C9A452',
      datingSoft: '#302712',
      rishta: '#1F8A5F',
      rishtaSoft: '#12291F',
    },
  },

  navy: {
    id: 'navy',
    light: {
      ...lightPalette,
      ...navyBrand,
      teal: '#1F3A5F',
      tealDark: '#14213D',
      tealSoft: '#E5EAF2',
      gold: '#C69B3C',
      goldSoft: '#F6EEDB',
      plum: '#35507F',
      plumLight: '#EAEEF5',
      dating: '#A47E28',
      datingSoft: '#F6EEDB',
      rishta: '#1F3A5F',
      rishtaSoft: '#E5EAF2',
    },
    dark: {
      ...darkPalette,
      ...navyBrand,
      teal: '#4A6FA5',
      tealDark: '#1F3A5F',
      tealSoft: '#18233A',
      gold: '#DDB960',
      goldSoft: '#312814',
      plum: '#6F8FC2',
      plumLight: '#1C2842',
      dating: '#DDB960',
      datingSoft: '#312814',
      rishta: '#4A6FA5',
      rishtaSoft: '#18233A',
    },
  },

  onyx: {
    id: 'onyx',
    light: {
      ...lightPalette,
      ...onyxBrand,
      teal: '#1F1F1F',
      tealDark: '#0A0A0A',
      tealSoft: '#ECEAE6',
      gold: '#C69B3C',
      goldSoft: '#F6EEDB',
      plum: '#3A3A3A',
      plumLight: '#F1EFEB',
      dating: '#A47E28',
      datingSoft: '#F6EEDB',
      rishta: '#1F1F1F',
      rishtaSoft: '#ECEAE6',
    },
    // On a black canvas the onyx anchor would vanish, so dark mode leads with
    // the gold itself, deepened until white text still reads on it.
    dark: {
      ...darkPalette,
      ...onyxBrand,
      background: '#0E0E0E',
      backgroundAlt: '#080808',
      surface: '#1A1A1A',
      surfaceElevated: '#242424',
      border: '#363636',
      borderSoft: '#202020',
      skeleton: '#242424',
      teal: '#8C6A1F',
      tealDark: '#5E4714',
      tealSoft: '#2C2412',
      gold: '#DDB960',
      goldSoft: '#312814',
      plum: '#A47E28',
      plumLight: '#33291A',
      dating: '#DDB960',
      datingSoft: '#312814',
      rishta: '#8C6A1F',
      rishtaSoft: '#2C2412',
    },
  },
};

export const APP_THEME_IDS: AppThemeId[] = ['maroon', 'emerald', 'navy', 'onyx'];
