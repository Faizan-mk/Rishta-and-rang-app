const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

// The one password rule in the app. Signup and the password reset both check
// against this, so a password that was acceptable when the account was made
// stays acceptable when it is changed — and PasswordRequirements renders the
// same five checks the user has to satisfy.
export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}
