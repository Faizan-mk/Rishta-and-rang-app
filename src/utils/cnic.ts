import type { Gender } from '../types/user';

const CNIC_PATTERN = /^\d{5}-\d{7}-\d{1}$/;

// Auto-inserts '-' as the user types raw digits: 5-7-1 groups, e.g. "12345123456781" -> "12345-1234567-8".
export function digitsToCnicDisplay(digits: string): string {
  const d = digits.slice(0, 13);
  return [d.slice(0, 5), d.slice(5, 12), d.slice(12, 13)].filter(Boolean).join('-');
}

export function isValidCnicFormat(display: string): boolean {
  return CNIC_PATTERN.test(display);
}

// Pakistani CNIC convention: the last digit encodes gender — odd (1,3,5,7,9) is male, even (0,2,4,6,8) is female.
export function cnicGenderFromLastDigit(display: string): 'male' | 'female' | null {
  if (!isValidCnicFormat(display)) return null;
  const lastDigit = Number(display.slice(-1));
  return lastDigit % 2 === 1 ? 'male' : 'female';
}

// 'other' can't be checked against the binary CNIC convention, so it's treated as a pass.
export function cnicMatchesGender(display: string, gender: Gender): boolean {
  if (gender === 'other') return true;
  const cnicGender = cnicGenderFromLastDigit(display);
  return cnicGender === gender;
}

// Masks all but the last group for display: "12345-1234567-1" -> "•••••-•••••••-1".
export function maskCnic(display: string): string {
  const groups = display.split('-');
  if (groups.length !== 3) return display;
  return [groups[0].replace(/./g, '•'), groups[1].replace(/./g, '•'), groups[2]].join('-');
}
