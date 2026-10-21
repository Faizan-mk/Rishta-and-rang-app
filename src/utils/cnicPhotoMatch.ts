import TextRecognition from '@react-native-ml-kit/text-recognition';

// Reads the CNIC number printed on the card photo (on-device, ML Kit) and
// compares it with the number the member typed. Like idCardImageCheck, this is
// a check against honest mistakes and casual misuse, not identity
// verification: it runs in the app, so it can't stop someone who rebuilds it.

export type CnicPhotoMatch = 'match' | 'mismatch' | 'unreadable';

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

export async function matchCnicPhoto(uri: string, typedCnic: string): Promise<CnicPhotoMatch> {
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
  return printed.includes(typedCnic.replace(/\D/g, '')) ? 'match' : 'mismatch';
}
