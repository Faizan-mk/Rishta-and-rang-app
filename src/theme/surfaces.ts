import { radius, spacing } from './spacing';
import type { Palette } from './palettes';

// Level-1 card from the design system: white on ivory, a henna hairline and a
// barely-there warm shadow. Shared by every form so they sit on one surface.
export function cardSurface(colors: Palette) {
  return {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    shadowColor: '#2A1720',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  } as const;
}
