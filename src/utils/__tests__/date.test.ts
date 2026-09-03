import { ageFromDob, displayToIso, digitsToDisplay, isValidDobFormat, isoToDisplay } from '../date';

// The 18+ gate at signup is `ageFromDob(dob) < 18` on a string the member typed
// into a DD/MM/YYYY field, so these three functions are the gate. A date that
// parses loosely, or an age that rounds the wrong way on a birthday, lets a
// minor through.

describe('isValidDobFormat', () => {
  it('accepts a real ISO date', () => {
    expect(isValidDobFormat('2000-02-29')).toBe(true); // 2000 was a leap year
  });

  it('rejects a day that does not exist in that month', () => {
    expect(isValidDobFormat('2001-02-29')).toBe(false); // 2001 was not
    expect(isValidDobFormat('2001-04-31')).toBe(false);
  });

  it('rejects anything not shaped like YYYY-MM-DD', () => {
    expect(isValidDobFormat('01/08/2000')).toBe(false);
    expect(isValidDobFormat('2000-1-1')).toBe(false);
    expect(isValidDobFormat('')).toBe(false);
  });
});

describe('ageFromDob', () => {
  // Fixed "today" so a birthday case does not change meaning as time passes.
  const TODAY = new Date('2026-06-15T12:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(TODAY);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it('counts a birthday that has already passed this year', () => {
    expect(ageFromDob('2000-06-14')).toBe(26);
  });

  it('counts the birthday itself', () => {
    expect(ageFromDob('2000-06-15')).toBe(26);
  });

  it('does not count a birthday still to come this year', () => {
    expect(ageFromDob('2000-06-16')).toBe(25);
  });

  it('holds the gate the day before someone turns 18', () => {
    expect(ageFromDob('2008-06-16')).toBe(17);
  });

  it('opens it on the day they do', () => {
    expect(ageFromDob('2008-06-15')).toBe(18);
  });

  it('returns null for something it cannot read', () => {
    expect(ageFromDob('not-a-date')).toBeNull();
  });
});

describe('the display/ISO round trip', () => {
  it('converts a typed date to what storage keeps', () => {
    expect(displayToIso('15/06/2000')).toBe('2000-06-15');
  });

  it('refuses a typed date that is not real', () => {
    expect(displayToIso('31/04/2000')).toBeNull();
    expect(displayToIso('15/6/2000')).toBeNull();
  });

  it('comes back the way it went in', () => {
    expect(isoToDisplay('2000-06-15')).toBe('15/06/2000');
    expect(displayToIso(isoToDisplay('2000-06-15'))).toBe('2000-06-15');
  });

  it('punctuates digits as they are typed', () => {
    expect(digitsToDisplay('15')).toBe('15');
    expect(digitsToDisplay('1506')).toBe('15/06');
    expect(digitsToDisplay('15062000')).toBe('15/06/2000');
    expect(digitsToDisplay('150620001234')).toBe('15/06/2000');
  });
});
