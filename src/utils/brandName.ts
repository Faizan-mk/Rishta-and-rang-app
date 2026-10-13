// The wordmark's accent gold. Fixed rather than themed: Pink's own "gold" is a
// rose gold, and the wordmark wants the same true gold in every theme.
export const BRAND_GOLD = '#C9A45C';
// For dark surfaces (dark mode, the welcome photo), where #C9A45C goes muddy.
export const BRAND_GOLD_BRIGHT = '#D9B872';

export interface BrandSegment {
  text: string;
  accent: boolean;
}

/**
 * The app name cut into runs for its wordmark, with the coloured letters
 * marked: the "o" of Love (it reads as a small heart) and the "b" that starts
 * birds, so each half of "Lovebirds" carries one. In Urdu (no Latin letters)
 * the first letter takes the accent. A name with none of these letters still
 * renders, uncoloured.
 */
export function splitBrandName(name: string): BrandSegment[] {
  if (!name) return [];
  const latin = /^[A-Za-z]/.test(name);
  const accents = new Set<number>();
  if (latin) {
    const o = name.toLowerCase().indexOf('o');
    if (o !== -1) accents.add(o);
    const b = name.toLowerCase().indexOf('b');
    if (b !== -1) accents.add(b);
  } else {
    accents.add(0);
  }

  const segments: BrandSegment[] = [];
  for (let i = 0; i < name.length; i++) {
    const accent = accents.has(i);
    const last = segments[segments.length - 1];
    if (last && last.accent === accent) last.text += name[i];
    else segments.push({ text: name[i], accent });
  }
  return segments;
}
