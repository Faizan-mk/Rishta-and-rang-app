import type { Palette } from './palettes';
import type { ProfileMode } from '../types/user';

// Gradient + glow tokens for the browse surfaces. They live in the theme rather
// than in each component so Friends and Rishta stay two recognisable colour
// worlds — warm coral/gold on the Friends deck, cool orchid/teal on Rishta —
// instead of every card inventing its own pair.

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

export function modeAccent(colors: Palette, mode: ProfileMode): ModeAccent {
  const primary = mode === 'dating' ? colors.dating : colors.rishta;
  const secondary = mode === 'dating' ? colors.gold : colors.teal;
  const middle = mode === 'dating' ? colors.plum : colors.dating;

  return {
    primary,
    secondary,
    ramp: [primary, middle, secondary] as const,
    duo: [primary, secondary] as const,
    wash: [withAlpha(primary, 0.16), withAlpha(secondary, 0.08), 'transparent'] as const,
  };
}

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
