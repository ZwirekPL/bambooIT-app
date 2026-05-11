import { describe, it, expect } from 'vitest';
import { validateIngredientName } from '../../services/planValidation.service';

describe('BUG-3 prevention: validateIngredientName', () => {
  // ─── Happy path ──────────────────────────────────────────────────────────
  it('zwyczajne produkty przechodzą walidację', () => {
    for (const name of [
      'pierś kurczaka',
      'mąka pszenna',
      'oliwa z oliwek',
      'pomidor',
      'Twaróg śmietankowy ze Strzałkowa',  // 30 chars
      '1 łyżka oliwy',
      'parmezan',
    ]) {
      const result = validateIngredientName(name);
      expect(result.valid, `"${name}" should be valid`).toBe(true);
      expect(result.reasons).toEqual([]);
    }
  });

  it('null/undefined/pusty string są traktowane jako valid', () => {
    expect(validateIngredientName(null).valid).toBe(true);
    expect(validateIngredientName(undefined).valid).toBe(true);
    expect(validateIngredientName('').valid).toBe(true);
    expect(validateIngredientName('   ').valid).toBe(true);
  });

  // ─── Too long ────────────────────────────────────────────────────────────
  it('nazwa >60 znaków → too-long', () => {
    const name = 'proszek do pieczenia i soda oczyszczona po 1 płaskiej łyżeczce';  // ~62 char
    const r = validateIngredientName(name);
    expect(r.valid).toBe(false);
    expect(r.reasons.some(x => x.startsWith('too-long'))).toBe(true);
  });

  // ─── Colon/semicolon ─────────────────────────────────────────────────────
  it('zawiera ":" → contains-colon-or-semicolon', () => {
    const r = validateIngredientName('przyprawy: sól, pieprz');
    expect(r.reasons).toContain('contains-colon-or-semicolon');
  });

  it('zawiera ";" → contains-colon-or-semicolon', () => {
    const r = validateIngredientName('sól; pieprz; kurkuma');
    expect(r.reasons).toContain('contains-colon-or-semicolon');
  });

  // ─── Junk prefix ─────────────────────────────────────────────────────────
  it('prefix "przyprawy:" → junk-prefix-category', () => {
    const r = validateIngredientName('przyprawy: sól, pieprz');
    expect(r.reasons).toContain('junk-prefix-category');
  });

  it('prefix "orzechy:" → junk-prefix', () => {
    const r = validateIngredientName('orzechy: pekan, nerkowce, włoskie');
    expect(r.reasons).toContain('junk-prefix-category');
  });

  it('prefix "sery:" → junk-prefix', () => {
    expect(validateIngredientName('sery: cheddar, pleśniowe').reasons)
      .toContain('junk-prefix-category');
  });

  it('prefix "dekoracja:" → junk-prefix', () => {
    expect(validateIngredientName('dekoracja: rzeżucha, koperek').reasons)
      .toContain('junk-prefix-category');
  });

  // ─── ALL-CAPS ────────────────────────────────────────────────────────────
  it('"BIAŁA" (ALL-CAPS short) → all-caps-short-name', () => {
    const r = validateIngredientName('BIAŁA');
    expect(r.valid).toBe(false);
    expect(r.reasons).toContain('all-caps-short-name');
  });

  it('"BIO" (3 liter ALL-CAPS) → flagowane', () => {
    expect(validateIngredientName('BIO').reasons).toContain('all-caps-short-name');
  });

  it('"KIELBASA" (8 liter ALL-CAPS) → flagowane', () => {
    expect(validateIngredientName('KIELBASA').reasons).toContain('all-caps-short-name');
  });

  it('"PRZYPRAWA DO MIESA" (ALL-CAPS z spacją) → nie flagowane (więcej niż 1 słowo)', () => {
    // Multi-word ALL-CAPS to osobny przypadek — MAX_CAPS check jest tylko single-word
    const r = validateIngredientName('PRZYPRAWA DO MIESA');
    expect(r.reasons).not.toContain('all-caps-short-name');
  });

  // ─── Standalone dangling ─────────────────────────────────────────────────
  it('"Mrożone" (sam participle) → standalone-dangling-adjective', () => {
    const r = validateIngredientName('Mrożone');
    expect(r.valid).toBe(false);
    expect(r.reasons).toContain('standalone-dangling-adjective');
  });

  it('"Świeże" (sam przymiotnik) → flagowane', () => {
    expect(validateIngredientName('Świeże').reasons).toContain('standalone-dangling-adjective');
  });

  it('"Groszek mrożony" (dwuwyrazowe z participle) → NIE flagowane', () => {
    const r = validateIngredientName('Groszek mrożony');
    expect(r.reasons).not.toContain('standalone-dangling-adjective');
  });

  // ─── Kombinacje wielu naruszeń ───────────────────────────────────────────
  it('kombinacja naruszeń → wiele reasons', () => {
    const name = 'przyprawy: sól, pieprz, po 1/2 łyżeczki kurkumy, kminu rzymskiego, kolendry';
    const r = validateIngredientName(name);
    expect(r.valid).toBe(false);
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);  // too-long, colon, junk-prefix
    expect(r.reasons).toContain('contains-colon-or-semicolon');
    expect(r.reasons).toContain('junk-prefix-category');
    expect(r.reasons.some(x => x.startsWith('too-long'))).toBe(true);
  });
});
