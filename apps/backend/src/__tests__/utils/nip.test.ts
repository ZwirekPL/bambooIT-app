import { describe, it, expect } from 'vitest';
import { isValidNIP, normalizeNIP } from '../../utils/nip';

describe('isValidNIP', () => {
  // Verified checksums (computed against WEIGHTS = [6,5,7,2,3,4,5,6,7])
  const VALID = [
    '5260250274',     // checksum 4 ✓
    '526-025-02-74',  // same NIP with separators
    '9999999999',     // checksum 9 ✓
    '0000000017',     // checksum 7 ✓ (leading zeros allowed)
    '1111111111',     // checksum 1 ✓ (45 mod 11 = 1)
  ];

  const INVALID = [
    '1234567890',     // checksum mod 11 = 10 → no valid NIP can end this way
    '5260250275',     // wrong last digit
    '123',            // too short
    'abcdefghij',     // non-digit
    '',               // empty
    '12345678901',    // too long
  ];

  for (const nip of VALID) {
    it(`accepts ${nip}`, () => {
      expect(isValidNIP(nip)).toBe(true);
    });
  }

  for (const nip of INVALID) {
    it(`rejects ${nip}`, () => {
      expect(isValidNIP(nip)).toBe(false);
    });
  }

  it('rejects NIP where checksum mod 11 = 10 (no such valid digit)', () => {
    // Digits 123456789 → checksum mod 11 = 10. The tax office never
    // assigns NIPs in this case, so any last digit must fail.
    for (let d = 0; d <= 9; d++) {
      expect(isValidNIP(`123456789${d}`)).toBe(false);
    }
  });
});

describe('normalizeNIP', () => {
  it('strips spaces and hyphens', () => {
    expect(normalizeNIP('123-456-78-90')).toBe('1234567890');
    expect(normalizeNIP('123 456 78 90')).toBe('1234567890');
    expect(normalizeNIP('1234567890')).toBe('1234567890');
  });
});
