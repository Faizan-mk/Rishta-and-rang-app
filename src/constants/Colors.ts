// Single import point for the app's colour palettes. The palettes themselves
// live in src/theme (next to spacing and typography, which they are tuned
// against); this re-export is what screens and components import.
export { lightPalette, darkPalette } from '../theme/palettes';
export type { Palette } from '../theme/palettes';
