import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../lib/auth';

describe('lib/auth.ts', () => {
  it('enforces password strength requirements', () => {
    expect(validatePasswordStrength('short').valid).toBe(false);
    expect(validatePasswordStrength('onlylettershere').valid).toBe(false);
    expect(validatePasswordStrength('1234567890').valid).toBe(false);
    expect(validatePasswordStrength('ValidPassword123!').valid).toBe(true);
  });

  it('hashes and verifies passwords correctly using scrypt', () => {
    const password = 'StationerySecret2026!';
    const hash = hashPassword(password);

    expect(hash.startsWith('scrypt:16384:8:1:')).toBe(true);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword('WrongPassword123!', hash)).toBe(false);
  });
});
