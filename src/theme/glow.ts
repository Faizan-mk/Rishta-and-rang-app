import type { Palette } from './palettes';
import type { ProfileMode } from '../types/user';

// Gradient + glow tokens for the browse surfaces. They live in the theme rather
// than in each component so Friends and Rishta stay two recognisable colour
// worlds — sunlit gold on the Friends deck, the maroon-to-rose
// signature gradient on Rishta — instead of every card inventing its own pair.

// expo-linear-gradient needs to see at least two stops at the type level.
export type Gradient = readonly [string, string, ...string[]];

export interface ModeAccent {
  // The mode's signature hue, used on its own for text and icons.
  primary: string;
  // The hue the primary melts into across a gradient.
  secondary: string;
  // Three-stop ramp for large fills: cards, toggle thumbs, halos.
  ramp: Gradient;
  // Two-stop ramp for small controls, where a third stop would just muddy it.
  duo: Gradient;
  // Faint wash laid behind content that still has to stay readable.
  wash: Gradient;
}

// '#RRGGBB' -> 'rgba(r, g, b, a)'. Only the six-digit form is used in the
// palettes, so anything else is handed back untouched rather than mangled.
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// The app is flat: every surface that used to blend two or three shades now
// wears one colour. LinearGradient needs at least two stops, so a flat fill
// repeats the one colour.
export function flat(color: string): Gradient {
  return [color, color] as const;
}

// One colour per mode. `secondary`, `ramp` and `duo` are kept so callers need
// no changes, but they all carry the same hue now.
export function modeAccent(colors: Palette, mode: ProfileMode): ModeAccent {
  const primary = mode === 'dating' ? colors.dating : colors.rishta;

  return {
    primary,
    secondary: primary,
    ramp: flat(primary),
    duo: flat(primary),
    wash: [withAlpha(primary, 0.16), withAlpha(primary, 0.08), 'transparent'] as const,
  };
}

// Members no longer switch between Friends and Rishta, so the whole app wears
// one colour: the Rishta accent, which each theme sets.
export const APP_MODE: ProfileMode = 'rishta';

// Kept structural rather than typed as ViewStyle: TextStyle narrows some of
// ViewStyle's fields, so a ViewStyle return would be rejected on a TextInput.
export interface GlowStyle {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

// A coloured shadow, so an accent control reads as lit from within instead of
// merely sitting on a grey drop shadow. Android only honours the colour from
// API 28 up; below that the elevation alone still lifts the control.
export function glow(color: string, intensity = 0.45, blur = 16, elevation = 8): GlowStyle {
  return {
    shadowColor: color,
    shadowOpacity: intensity,
    shadowRadius: blur,
    shadowOffset: { width: 0, height: 4 },
    elevation,
  };
}
