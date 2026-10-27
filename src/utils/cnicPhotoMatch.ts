import TextRecognition from '@react-native-ml-kit/text-recognition';

// Reads the CNIC number printed on the card photo (on-device, ML Kit) and
// compares it with the number the member typed. Like idCardImageCheck, this is
// a check against honest mistakes and casual misuse, not identity
// verification: it runs in the app, so it can't stop someone who rebuilds it.

// 'nameMismatch' / 'dobMismatch': the number checks out but the typed name or
// date of birth isn't on the card.
export type CnicPhotoMatch = 'match' | 'mismatch' | 'nameMismatch' | 'dobMismatch' | 'unreadable';

// 12345-1234567-1, with the dashes and spacing OCR tends to vary or drop.
const PRINTED_CNIC = /(\d{5})\s*[-–—.]?\s*(\d{7})\s*[-–—.]?\s*(\d)(?!\d)/g;

/** Letters OCR commonly reads in place of digits on the card's number line. */
function asDigits(text: string): string {
  return text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
}

/** Every CNIC-shaped number in the recognised text, as 13 digits. */
function cnicNumbersIn(lines: string[]): string[] {
  const found = new Set<string>();
  for (const line of lines) {
    const text = asDigits(line);
    for (const m of text.matchAll(PRINTED_CNIC)) found.add(m[1] + m[2] + m[3]);
    // A number OCR split oddly ("12345 12 34567 1") still counts when the line
    // holds exactly 13 digits and nothing else that looks like a number.
    const digits = text.replace(/[^\d]/g, '');
    if (digits.length === 13 && /^[\d\s\-–—.]+$/.test(text.trim())) found.add(digits);
  }
  return [...found];
}

// The card prints dates as 01.03.1998; OCR swaps the dots for other marks or spaces.
const PRINTED_DATE = /(?<!\d)(\d{1,2})\s*[.\-/,\s]\s*(\d{1,2})\s*[.\-/,\s]\s*(\d{4})(?!\d)/g;

/** Every DD.MM.YYYY date on the card (birth, issue, expiry) as YYYY-MM-DD. */
function datesIn(lines: string[]): string[] {
  const found = new Set<string>();
  for (const line of lines) {
    for (const m of asDigits(line).matchAll(PRINTED_DATE)) {
      found.add(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
    }
  }
  return [...found];
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

function nameWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/**
 * Whether every word of the typed name is printed on the card. The card's
 * English name line is what's compared, so the member has to type it as
 * printed; OCR's usual one-letter slips (rn/m, l/i) are let through on longer
 * words. The father's name is on the card too and isn't told apart: this is a
 * guard against a made-up name, not proof of whose name it is.
 */
function nameOnCard(typedName: string, lines: string[]): boolean {
  const typed = nameWords(typedName);
  if (!typed.length) return false;
  const printed = new Set(lines.flatMap(nameWords));
  return typed.every((word) => {
    if (printed.has(word)) return true;
    const slack = word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;
    if (!slack) return false;
    for (const candidate of printed) {
      if (Math.abs(candidate.length - word.length) <= slack && editDistance(word, candidate) <= slack) return true;
    }
    return false;
  });
}

export async function matchCnicPhoto(
  uri: string,
  typedCnic: string,
  typedName: string,
  typedDob: string
): Promise<CnicPhotoMatch> {
  let lines: string[];
  try {
    const result = await TextRecognition.recognize(uri);
    lines = [result.text, ...result.blocks.flatMap((block) => block.lines.map((line) => line.text))];
  } catch {
    // Includes a build without the native module: treated as unreadable, so
    // the check can't be skipped by it failing.
    return 'unreadable';
  }

  const printed = cnicNumbersIn(lines);
  if (!printed.length) return 'unreadable';
  if (!printed.includes(typedCnic.replace(/\D/g, ''))) return 'mismatch';
  // The number was readable, so the card was too: a missing name is a real
  // mismatch, not a blurry photo.
  if (!nameOnCard(typedName, lines)) return 'nameMismatch';
  // Birth, issue and expiry dates all match the pattern; the typed date of
  // birth only has to be one of them. None read at all is a glare problem,
  // not a wrong date.
  const dates = datesIn(lines);
  if (!dates.length) return 'unreadable';
  return dates.includes(typedDob) ? 'match' : 'dobMismatch';
}
