const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDobFormat(dob: string): boolean {
  if (!DOB_PATTERN.test(dob)) return false;
  const [year, month, day] = dob.split('-').map(Number);
  const parsed = new Date(dob);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export function ageFromDob(dob: string): number | null {
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const hasNotHadBirthdayThisYear =
    now.getMonth() < parsed.getMonth() ||
    (now.getMonth() === parsed.getMonth() && now.getDate() < parsed.getDate());
  if (hasNotHadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}

// Display convention across the app is DD/MM/YYYY; storage/validation stays YYYY-MM-DD (ISO).
export function isoToDisplay(iso: string): string {
  if (!isValidDobFormat(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Auto-inserts '/' as the user types raw digits, e.g. "0108" -> "01/08".
export function digitsToDisplay(digits: string): string {
  const d = digits.slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
}

export function displayToIso(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  return isValidDobFormat(iso) ? iso : null;
}

export function eighteenYearsAgoIso(): string {
  const now = new Date();
  const y = now.getFullYear() - 18;
  return `${y}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
