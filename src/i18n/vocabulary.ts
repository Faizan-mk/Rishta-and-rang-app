import type { Translate } from './index';

/**
 * Labels for the fixed option lists — cities, sects, education, job titles,
 * industries, languages, countries.
 *
 * These values are *stored* as their canonical English string, not as a key:
 * both sides of a match have to agree on what was picked regardless of the
 * language each of them reads in, and rows written before this existed already
 * hold the English. So only the label is translated, keyed by a slug derived
 * from the stored value, and anything without a key (a free-text "Other"
 * answer, a value from a newer build) falls through unchanged.
 */
function slugFor(value: string): string {
  const parts = value.match(/[A-Za-z0-9]+/g);
  if (!parts || parts.length === 0) return value;
  return parts
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join('');
}

export function vocabularyLabel(value: string, t: Translate): string {
  if (!value) return value;
  const key = `vocab.${slugFor(value)}`;
  const label = t(key);
  // `translate` hands the path back when a key is missing — that is the signal
  // this value is free text and should be shown exactly as the member typed it.
  return label === key ? value : label;
}

/** The same, for a list. Empty entries are dropped rather than rendered blank. */
export function vocabularyLabels(values: string[] | undefined, t: Translate): string[] {
  return (values ?? []).filter(Boolean).map((value) => vocabularyLabel(value, t));
}
