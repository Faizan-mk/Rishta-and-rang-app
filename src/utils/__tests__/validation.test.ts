import { isValidEmail, isStrongPassword } from '../validation';

describe('isValidEmail', () => {
  it.each(['a@example.com', 'first.last@sub.example.co.uk', 'x@y.io'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'not-an-email', 'a@b', '@example.com', 'a@.com', 'a b@example.com'])(
    'rejects %s',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    }
  );

  it('trims surrounding whitespace before validating', () => {
    expect(isValidEmail('  a@example.com  ')).toBe(true);
  });
});

describe('isStrongPassword', () => {
  it('accepts a password with lower, upper, digit and symbol at 8+ chars', () => {
    expect(isStrongPassword('Abcdef1!')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(isStrongPassword('Ab1!')).toBe(false);
  });

  it('rejects a password missing a lowercase letter', () => {
    expect(isStrongPassword('ABCDEF1!')).toBe(false);
  });

  it('rejects a password missing an uppercase letter', () => {
    expect(isStrongPassword('abcdef1!')).toBe(false);
  });

  it('rejects a password missing a digit', () => {
    expect(isStrongPassword('Abcdefg!')).toBe(false);
  });

  it('rejects a password missing a symbol', () => {
    expect(isStrongPassword('Abcdefg1')).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(isStrongPassword('')).toBe(false);
  });
});
