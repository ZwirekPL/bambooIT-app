/**
 * Polish NIP (Numer Identyfikacji Podatkowej) validator.
 *
 * Format: 10 digits. Checksum is the 10th digit, computed from the
 * first 9 digits using weighted modulo-11. If the modulo gives 10,
 * the NIP is invalid (no such checksum digit exists).
 *
 * Accepts NIPs with spaces or hyphens (e.g. "123-456-78-90" or
 * "1234567890"); strips them before validation.
 */

const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

export function isValidNIP(nip: string): boolean {
  const digits = nip.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(digits)) return false;

  const checksum =
    WEIGHTS.reduce((sum, w, i) => sum + w * Number(digits[i]), 0) % 11;

  if (checksum === 10) return false;
  return checksum === Number(digits[9]);
}

/** Normalize NIP for storage — strips separators, returns 10-digit string. */
export function normalizeNIP(nip: string): string {
  return nip.replace(/[\s-]/g, '');
}
