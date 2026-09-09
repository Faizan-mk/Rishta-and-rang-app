import {
  digitsToCnicDisplay,
  isValidCnicFormat,
  cnicGenderFromLastDigit,
  cnicMatchesGender,
  maskCnic,
} from '../cnic';

describe('digitsToCnicDisplay', () => {
  it('groups raw digits as 5-7-1', () => {
    expect(digitsToCnicDisplay('12345123456781')).toBe('12345-1234567-8');
  });

  it('builds up the display incrementally as digits are typed', () => {
    expect(digitsToCnicDisplay('123')).toBe('123');
    expect(digitsToCnicDisplay('12345')).toBe('12345');
    expect(digitsToCnicDisplay('123451234567')).toBe('12345-1234567');
  });

  it('truncates beyond 13 digits', () => {
    expect(digitsToCnicDisplay('123451234567899999')).toBe('12345-1234567-8');
  });

  it('returns an empty string for no digits', () => {
    expect(digitsToCnicDisplay('')).toBe('');
  });
});

describe('isValidCnicFormat', () => {
  it('accepts a properly formatted CNIC', () => {
    expect(isValidCnicFormat('12345-1234567-8')).toBe(true);
  });

  it.each(['12345-1234567', '1234-1234567-8', '12345-1234567-88', 'abcde-1234567-8', ''])(
    'rejects %s',
    (value) => {
      expect(isValidCnicFormat(value)).toBe(false);
    }
  );
});

describe('cnicGenderFromLastDigit', () => {
  it('treats an odd last digit as male', () => {
    expect(cnicGenderFromLastDigit('12345-1234567-1')).toBe('male');
    expect(cnicGenderFromLastDigit('12345-1234567-9')).toBe('male');
  });

  it('treats an even last digit as female', () => {
    expect(cnicGenderFromLastDigit('12345-1234567-2')).toBe('female');
    expect(cnicGenderFromLastDigit('12345-1234567-0')).toBe('female');
  });

  it('returns null for a malformed CNIC', () => {
    expect(cnicGenderFromLastDigit('not-a-cnic')).toBeNull();
  });
});

describe('cnicMatchesGender', () => {
  it('passes when the encoded gender matches', () => {
    expect(cnicMatchesGender('12345-1234567-1', 'male')).toBe(true);
    expect(cnicMatchesGender('12345-1234567-2', 'female')).toBe(true);
  });

  it('fails when the encoded gender does not match', () => {
    expect(cnicMatchesGender('12345-1234567-1', 'female')).toBe(false);
    expect(cnicMatchesGender('12345-1234567-2', 'male')).toBe(false);
  });

  it('always passes for "other" regardless of the CNIC', () => {
    expect(cnicMatchesGender('12345-1234567-1', 'other')).toBe(true);
    expect(cnicMatchesGender('not-a-cnic', 'other')).toBe(true);
  });

  it('fails a malformed CNIC against a binary gender', () => {
    expect(cnicMatchesGender('not-a-cnic', 'male')).toBe(false);
  });
});

describe('maskCnic', () => {
  it('masks the first two groups and keeps the last digit', () => {
    expect(maskCnic('12345-1234567-8')).toBe('•••••-•••••••-8');
  });

  it('returns the input unchanged when it is not three groups', () => {
    expect(maskCnic('12345-1234567')).toBe('12345-1234567');
    expect(maskCnic('')).toBe('');
  });
});
