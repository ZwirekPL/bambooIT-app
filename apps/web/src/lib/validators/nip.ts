/**
 * Polish NIP validator — frontend twin of apps/backend/src/utils/nip.ts.
 * Kept duplicated rather than packaged because the logic is ~20 LOC and
 * a shared package would add monorepo build complexity.
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

export function normalizeNIP(nip: string): string {
  return nip.replace(/[\s-]/g, '');
}
