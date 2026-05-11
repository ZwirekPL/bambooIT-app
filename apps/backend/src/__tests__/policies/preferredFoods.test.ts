import { describe, it, expect } from 'vitest';
import { mapPreferredFoodsToKeywords } from '../../policies/policy-engine';

describe('mapPreferredFoodsToKeywords', () => {
  it('returns empty result for null / empty / undefined input', () => {
    expect(mapPreferredFoodsToKeywords(null)).toEqual({ keywords: [], canonicalBuckets: [], filteredCodes: [] });
    expect(mapPreferredFoodsToKeywords(undefined)).toEqual({ keywords: [], canonicalBuckets: [], filteredCodes: [] });
    expect(mapPreferredFoodsToKeywords([])).toEqual({ keywords: [], canonicalBuckets: [], filteredCodes: [] });
  });

  it('expands single code to its keyword set', () => {
    const r = mapPreferredFoodsToKeywords(['legumes']);
    expect(r.keywords).toContain('ciecierzyca');
    expect(r.keywords).toContain('soczewica');
    expect(r.keywords).toContain('hummus');
    expect(r.canonicalBuckets).toEqual(['legumes']);
    expect(r.filteredCodes).toEqual([]);
  });

  it('maps `fish` code to BOTH fatty and white canonical buckets', () => {
    const r = mapPreferredFoodsToKeywords(['fish']);
    expect(r.canonicalBuckets).toContain('fish_fatty');
    expect(r.canonicalBuckets).toContain('fish_white');
    expect(r.keywords).toContain('łosoś');
    expect(r.keywords).toContain('dorsz');
  });

  it('maps `beef_pork` to red_meat bucket', () => {
    const r = mapPreferredFoodsToKeywords(['beef_pork']);
    expect(r.canonicalBuckets).toEqual(['red_meat']);
    expect(r.keywords).toContain('wołowina');
    expect(r.keywords).toContain('schab');
  });

  it('keeps lexical keywords for non-bucket codes (carb / veg / dairy)', () => {
    const r = mapPreferredFoodsToKeywords(['oatmeal', 'fruits', 'dairy']);
    expect(r.canonicalBuckets).toEqual([]); // none feed SC30
    expect(r.keywords).toContain('owsianka');
    expect(r.keywords).toContain('owoce');
    expect(r.keywords).toContain('twaróg');
  });

  it('passes unknown codes through as raw keywords (custom entries)', () => {
    const r = mapPreferredFoodsToKeywords(['martian-feast']);
    expect(r.keywords).toEqual(['martian-feast']);
    expect(r.canonicalBuckets).toEqual([]);
    expect(r.filteredCodes).toEqual([]);
  });

  it('dedupes canonical buckets when a code maps to multiple', () => {
    const r = mapPreferredFoodsToKeywords(['fish', 'fish']);
    expect(r.canonicalBuckets.length).toBe(new Set(r.canonicalBuckets).size);
  });
});

describe('vegan / vegetarian guard (P1.8)', () => {
  it('vegan: filters fish, seafood, poultry, beef_pork, eggs, dairy', () => {
    const r = mapPreferredFoodsToKeywords(
      ['fish', 'seafood', 'poultry', 'beef_pork', 'eggs', 'dairy', 'legumes', 'tofu_tempeh', 'fruits'],
      'vegan',
    );
    expect(r.filteredCodes.sort()).toEqual(['beef_pork', 'dairy', 'eggs', 'fish', 'poultry', 'seafood']);
    // legumes/tofu/fruits remain
    expect(r.canonicalBuckets.sort()).toEqual(['legumes', 'tofu']);
    expect(r.keywords).toContain('ciecierzyca'); // legumes kept
    expect(r.keywords).toContain('tofu');         // tofu kept
    expect(r.keywords).not.toContain('łosoś');    // fish dropped
    expect(r.keywords).not.toContain('twaróg');   // dairy dropped
  });

  it('vegetarian: keeps eggs + dairy, drops meat/fish/seafood', () => {
    const r = mapPreferredFoodsToKeywords(
      ['fish', 'seafood', 'poultry', 'eggs', 'dairy', 'legumes'],
      'vegetarian',
    );
    expect(r.filteredCodes.sort()).toEqual(['fish', 'poultry', 'seafood']);
    expect(r.canonicalBuckets.sort()).toEqual(['eggs', 'legumes']);
    expect(r.keywords).toContain('twaróg');
    expect(r.keywords).toContain('jajko');
  });

  it('pescatarian: keeps fish + seafood, drops meat/poultry', () => {
    const r = mapPreferredFoodsToKeywords(
      ['fish', 'seafood', 'poultry', 'beef_pork', 'eggs'],
      'pescatarian',
    );
    expect(r.filteredCodes.sort()).toEqual(['beef_pork', 'poultry']);
    expect(r.canonicalBuckets).toContain('fish_fatty');
    expect(r.canonicalBuckets).toContain('seafood');
  });

  it('omnivore (no dietType): no codes filtered', () => {
    const r = mapPreferredFoodsToKeywords(
      ['fish', 'poultry', 'beef_pork', 'eggs', 'legumes'],
      undefined,
    );
    expect(r.filteredCodes).toEqual([]);
    expect(r.canonicalBuckets.sort()).toEqual(['eggs', 'fish_fatty', 'fish_white', 'legumes', 'poultry', 'red_meat']);
  });

  it('unknown dietType behaves as omnivore', () => {
    const r = mapPreferredFoodsToKeywords(['fish', 'poultry'], 'extraterrestrial');
    expect(r.filteredCodes).toEqual([]);
    expect(r.canonicalBuckets).toContain('poultry');
  });

  it('dietType matching is case + whitespace tolerant', () => {
    const r1 = mapPreferredFoodsToKeywords(['fish', 'legumes'], '  VEGAN  ');
    const r2 = mapPreferredFoodsToKeywords(['fish', 'legumes'], 'Vegan');
    expect(r1.filteredCodes).toEqual(['fish']);
    expect(r2.filteredCodes).toEqual(['fish']);
  });
});

describe('output shape', () => {
  it('canonicalBuckets is sorted (deterministic regardless of input order)', () => {
    const r1 = mapPreferredFoodsToKeywords(['legumes', 'fish', 'eggs']);
    const r2 = mapPreferredFoodsToKeywords(['fish', 'eggs', 'legumes']);
    expect(r1.canonicalBuckets).toEqual(r2.canonicalBuckets);
    expect(r1.canonicalBuckets).toEqual([...r1.canonicalBuckets].sort());
  });
});
