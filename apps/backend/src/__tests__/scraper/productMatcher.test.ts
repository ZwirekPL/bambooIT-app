import { describe, it, expect } from 'vitest';
import {
  normalizeProductName,
  stem,
  canonicalize,
  diceCoefficient,
  matchProduct,
} from '../../scraper/utils/productMatcher';

describe('normalizeProductName', () => {
  it('strips Polish diacritics', () => {
    expect(normalizeProductName('Mąka pszenna')).toBe('maka pszenna');
    expect(normalizeProductName('Żółty ser')).toBe('zolty ser');
    expect(normalizeProductName('Łosoś')).toBe('losos');
  });

  it('lowercases', () => {
    expect(normalizeProductName('CEBULA')).toBe('cebula');
  });

  it('removes punctuation + collapses whitespace', () => {
    expect(normalizeProductName('Oliwa z oliwek, extra virgin')).toBe('oliwa z oliwek extra virgin');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeProductName('')).toBe('');
  });
});

describe('stem', () => {
  it('strips common plural endings', () => {
    expect(stem('cebule')).toBe('cebul');   // -e → cebul
    expect(stem('pomidory')).toBe('pomidor'); // -y
    expect(stem('ziemniaki')).toBe('ziemniak'); // -i
  });

  it('strips genitive plural endings', () => {
    expect(stem('kurczakow')).toBe('kurczak'); // -ow (after diacritic strip of -ów)
    expect(stem('jajkami')).toBe('jajk');  // -ami
  });

  it('leaves short words alone', () => {
    expect(stem('sol')).toBe('sol');
    expect(stem('olej')).toBe('olej');
  });

  it('does not over-strip short words (<5 chars)', () => {
    expect(stem('raba')).toBe('raba');
    expect(stem('woda')).toBe('woda');
  });
});

describe('canonicalize', () => {
  it('produces identical canonicals for inflected forms', () => {
    const a = canonicalize('Cebula');
    const b = canonicalize('Cebule');
    const c = canonicalize('Cebul');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('produces identical canonicals ignoring diacritics', () => {
    expect(canonicalize('Mąka')).toBe(canonicalize('Maka'));
    expect(canonicalize('Łosoś')).toBe(canonicalize('Losos'));
  });

  it('splits multi-word names and applies stem per word', () => {
    const result = canonicalize('oliwa z oliwek');
    expect(result.split(' ')).toHaveLength(3);
  });
});

describe('diceCoefficient', () => {
  it('returns 1.0 for equal strings', () => {
    expect(diceCoefficient('cebula', 'cebula')).toBe(1);
  });

  it('returns 0 for non-overlapping', () => {
    expect(diceCoefficient('abc', 'xyz')).toBe(0);
  });

  it('returns high similarity for near-identical', () => {
    expect(diceCoefficient('cebula', 'cebule')).toBeGreaterThan(0.7);
  });

  it('handles empty inputs safely', () => {
    expect(diceCoefficient('', 'abc')).toBe(0);
    expect(diceCoefficient('abc', '')).toBe(0);
  });
});

describe('matchProduct', () => {
  const products = [
    { id: 'p1', name: 'Cebula' },
    { id: 'p2', name: 'Cebula czerwona' },
    { id: 'p3', name: 'Mąka pszenna' },
    { id: 'p4', name: 'Oliwa z oliwek' },
    { id: 'p5', name: 'Łosoś wędzony' },
    { id: 'p6', name: 'Pierś z kurczaka' },
    { id: 'p7', name: 'Pomidor' },
    { id: 'p8', name: 'Papryka czerwona' },
  ];

  it('returns exact match with score 1.0', () => {
    const r = matchProduct('Cebula', products);
    expect(r?.product.id).toBe('p1');
    expect(r?.matchType).toBe('exact');
    expect(r?.score).toBe(1);
  });

  it('matches inflected form via canonical stemming', () => {
    const r = matchProduct('cebuli', products);
    expect(r?.product.id).toBe('p1');
    expect(r?.score).toBeGreaterThanOrEqual(0.98);
  });

  it('matches diacritic-stripped form', () => {
    const r = matchProduct('maka pszenna', products);
    expect(r?.product.id).toBe('p3');
    expect(r?.score).toBeGreaterThanOrEqual(0.98);
  });

  it('matches "oliwa" → "Oliwa z oliwek" (leading word)', () => {
    // "Oliwa" is the first word of the candidate — strong match.
    const r = matchProduct('oliwa', products);
    expect(r?.product.id).toBe('p4');
  });

  it('matches "losos" → "Łosoś wędzony" via dominant-first-word rule', () => {
    // "Łosoś" is the leading token of the candidate and matches the query
    // almost perfectly (after NFD strip). We match, but note that callers
    // dealing with nutrition-sensitive flows should raise the threshold to
    // 0.95 or filter modifiers like "wędzony" explicitly.
    const r = matchProduct('losos', products);
    expect(r?.product.id).toBe('p5');
  });

  it('rejects weak matches below threshold', () => {
    const r = matchProduct('kaczka', products);
    expect(r).toBeNull();
  });

  it('picks the best fuzzy match among candidates', () => {
    const r = matchProduct('cebula czerwone', products);
    expect(r?.product.id).toBe('p2');
  });

  it('returns null for empty query', () => {
    expect(matchProduct('', products)).toBeNull();
  });

  it('returns null for empty candidates', () => {
    expect(matchProduct('cebula', [])).toBeNull();
  });

  it('case-insensitive exact match', () => {
    expect(matchProduct('CEBULA', products)?.matchType).toBe('exact');
    expect(matchProduct('cebula', products)?.matchType).toBe('exact');
  });
});
