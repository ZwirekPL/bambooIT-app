import { describe, it, expect, afterEach } from 'vitest';
import { encryptJson, decryptJson, encryptString, decryptString } from '../../utils/encryption';

// ENCRYPTION_KEY is set in setup.ts

describe('encryptJson', () => {
  it('returns object with v=1, iv, tag, data fields', () => {
    const result = encryptJson({ foo: 'bar' });
    expect(result.v).toBe(1);
    expect(result.iv).toMatch(/^[0-9a-f]+$/);
    expect(result.tag).toMatch(/^[0-9a-f]+$/);
    expect(result.data).toMatch(/^[0-9a-f]+$/);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const a = encryptJson({ foo: 'bar' });
    const b = encryptJson({ foo: 'bar' });
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptJson({ foo: 'bar' })).toThrow('ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = saved;
  });

  it('throws when ENCRYPTION_KEY has wrong length', () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encryptJson({ foo: 'bar' })).toThrow();
    process.env.ENCRYPTION_KEY = saved;
  });
});

describe('decryptJson', () => {
  it('round-trips: decrypt(encrypt(data)) === data', () => {
    const data = { q1: 'answer', nested: { a: 1, arr: [true, null] } };
    expect(decryptJson(encryptJson(data))).toEqual(data);
  });

  it('returns plain object as-is (legacy plaintext support)', () => {
    const legacy = { foo: 'bar', num: 42 };
    expect(decryptJson(legacy)).toEqual(legacy);
  });

  it('returns string as-is', () => {
    expect(decryptJson('hello')).toBe('hello');
  });

  it('returns null as-is', () => {
    expect(decryptJson(null)).toBeNull();
  });

  it('returns number as-is', () => {
    expect(decryptJson(123)).toBe(123);
  });

  it('returns array as-is (not an EncryptedJson shape)', () => {
    const arr = [1, 2, 3];
    expect(decryptJson(arr)).toEqual(arr);
  });
});

describe('encryptString / decryptString (RODO Phase 1.5 — DietitianNote.content)', () => {
  it('produces string with v1: prefix and 4 colon-separated parts', () => {
    const out = encryptString('hello');
    const parts = out.split(':');
    expect(parts[0]).toBe('v1');
    expect(parts).toHaveLength(4);
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    expect(parts[3]).toMatch(/^[0-9a-f]+$/);
  });

  it('round-trips: decryptString(encryptString(x)) === x', () => {
    const text = 'Pacjent Jan Kowalski zgłasza bóle głowy i problemy ze snem.';
    expect(decryptString(encryptString(text))).toBe(text);
  });

  it('handles UTF-8 (polish characters)', () => {
    const text = 'ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ — wszystko OK';
    expect(decryptString(encryptString(text))).toBe(text);
  });

  it('handles multiline content', () => {
    const text = 'Line 1\nLine 2\n\nLine 4 with\ttab';
    expect(decryptString(encryptString(text))).toBe(text);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const a = encryptString('same text');
    const b = encryptString('same text');
    expect(a).not.toBe(b);
  });

  it('returns legacy plaintext as-is (no v1: prefix)', () => {
    expect(decryptString('Legacy unencrypted note')).toBe('Legacy unencrypted note');
  });

  it('returns malformed v1 string as-is (defensive)', () => {
    expect(decryptString('v1:only:three')).toBe('v1:only:three');
  });

  it('handles empty string gracefully', () => {
    expect(decryptString(encryptString(''))).toBe('');
  });
});
