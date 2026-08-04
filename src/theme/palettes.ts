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

  overlay: string;
  shadow: string;
  skeleton: string;
}

// Warm, editorial palette matching the roadmap doc's own branding (deep teal + gold + sage/plum
// section accents), extended with a dark variant that keeps the same hue relationships.
export const lightPalette: Palette = {
  background: '#FBFAF8',
  backgroundAlt: '#F3EFE8',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E7E2DA',
  borderSoft: '#F0ECE4',

  textPrimary: '#1F2A2E',
  textSecondary: '#5B6B6E',
  textTertiary: '#8B9A9C',
  textInverse: '#FFFFFF',

  teal: '#1D4E52',
  tealDark: '#123234',
  tealSoft: '#E4EEEE',
  gold: '#C98A3D',
  goldSoft: '#F7EBDA',
  sage: '#3C7A5C',
  sageLight: '#E7F2EC',
  plum: '#7A3B6D',
  plumLight: '#F3E7F0',

  dating: '#C9583D',
  datingSoft: '#FBEBE6',
  rishta: '#7A3B6D',
  rishtaSoft: '#F3E7F0',

  success: '#3C7A5C',
  successSoft: '#E7F2EC',
  danger: '#B3413B',
  dangerSoft: '#FAEAE8',
  warning: '#C98A3D',
  warningSoft: '#F7EBDA',

  overlay: 'rgba(18, 50, 52, 0.55)',
  shadow: 'rgba(18, 42, 46, 0.12)',
  skeleton: '#EDE9E1',
};

// Matte-black dark theme: true near-black surfaces (not the old dark-teal tint) with a
// brighter, more saturated accent set so teal/gold/rose/orchid actually pop off the black
// instead of blending into it. Text sitting on accent buttons flips to near-black for
// punch, since these accents are now bright enough to carry dark text comfortably.
export const darkPalette: Palette = {
  background: '#0A0A0C',
  backgroundAlt: '#000000',
  surface: '#151517',
  surfaceElevated: '#1C1C1F',
  border: '#2A2A2E',
  borderSoft: '#1E1E21',

  textPrimary: '#F5F5F7',
  textSecondary: '#A8A8AE',
  textTertiary: '#6E6E76',
  textInverse: '#0A0A0C',

  teal: '#2DD4BF',
  tealDark: '#0F766E',
  tealSoft: '#12302C',
  gold: '#F2B84B',
  goldSoft: '#332710',
  sage: '#4ADE80',
  sageLight: '#123322',
  plum: '#E879F9',
  plumLight: '#301A34',

  dating: '#FB7185',
  datingSoft: '#331A1F',
  rishta: '#E879F9',
  rishtaSoft: '#301A34',

  success: '#4ADE80',
  successSoft: '#123322',
  danger: '#F87171',
  dangerSoft: '#331716',
  warning: '#F2B84B',
  warningSoft: '#332710',

  overlay: 'rgba(0, 0, 0, 0.75)',
  shadow: 'rgba(0, 0, 0, 0.7)',
  skeleton: '#1C1C1F',
};
