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

// "Noor & Nisa" design system: Rosewood (Rishta), Warm Coral (Friends/Rang) and
// Champagne Gold (verification, premium) on warm ivory. Token names predate the
// redesign and are kept so every screen picks the new colours up unchanged:
// `teal` is the brand primary (Rosewood), `sage` is the verified/success
// Emerald, `plum` is a rose mid-tone used between the two mode colours.
export const lightPalette: Palette = {
  background: '#FFFAF6',
  backgroundAlt: '#FFF0F4',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#F0E4E0',
  borderSoft: '#F7EEEA',

  textPrimary: '#2A1720',
  textSecondary: '#7A6670',
  textTertiary: '#A8959D',
  textInverse: '#FFFFFF',

  teal: '#8E1B45',
  tealDark: '#5E0F2E',
  tealSoft: '#F7E1E7',
  gold: '#D4A857',
  goldSoft: '#FBF1DC',
  sage: '#1F8A5B',
  sageLight: '#E3F3EA',
  plum: '#A83158',
  plumLight: '#FFE8F0',

  dating: '#F2715E',
  datingSoft: '#FDE8E4',
  rishta: '#8E1B45',
  rishtaSoft: '#F7E1E7',

  success: '#1F8A5B',
  successSoft: '#E3F3EA',
  danger: '#D0393E',
  dangerSoft: '#FCE6E6',
  warning: '#D4A857',
  warningSoft: '#FBF1DC',

  readReceipt: '#2B7FB8',

  overlay: 'rgba(20, 11, 16, 0.65)',
  shadow: 'rgba(42, 23, 32, 0.10)',
  skeleton: '#F7E9EC',
};

// Dark variant: aubergine-tinted black with night-plum surfaces, the rose and
// gold brightened so they still read on the dark canvas.
export const darkPalette: Palette = {
  background: '#140B10',
  backgroundAlt: '#0C0609',
  surface: '#1F141A',
  surfaceElevated: '#2A1C23',
  border: '#3A2830',
  borderSoft: '#26191F',

  textPrimary: '#F8EEF1',
  textSecondary: '#B8A4AD',
  textTertiary: '#85727B',
  textInverse: '#FFFFFF',

  teal: '#E0577F',
  tealDark: '#8E1B45',
  tealSoft: '#3A1624',
  gold: '#E9C27A',
  goldSoft: '#33270F',
  sage: '#4CC38A',
  sageLight: '#12301F',
  plum: '#F08BA6',
  plumLight: '#3A1A26',

  dating: '#FF8A78',
  datingSoft: '#3A1A16',
  rishta: '#E0577F',
  rishtaSoft: '#3A1624',

  success: '#4CC38A',
  successSoft: '#12301F',
  danger: '#F1767A',
  dangerSoft: '#3A1718',
  warning: '#E9C27A',
  warningSoft: '#33270F',

  // Brighter against near-black, the same way the other dark accents are.
  readReceipt: '#5AB6E8',

  overlay: 'rgba(0, 0, 0, 0.75)',
  shadow: 'rgba(0, 0, 0, 0.7)',
  skeleton: '#2A1C23',
};
