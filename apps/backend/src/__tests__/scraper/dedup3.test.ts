import { describe, it, expect } from 'vitest';
import {
  titleSignature,
  ingredientSignature,
  macroSignature,
  compareRecipes,
  classifyDedup,
  findDuplicatesInCorpus,
  type DedupInput,
} from '../../scraper/utils/dedup3';

// ─── Signatures ────────────────────────────────────────────────────────────────

describe('titleSignature', () => {
  it('collapses common inflected variants of longer words', () => {
    // "orkiszową" / "orkiszowej" both stem to "orkiszow" (6-char stem survives
    // the 4-char minimum). Shorter words like "mąki"/"mąką" don't normalize
    // the same way — dedup relies on per-word Dice when exact stems diverge.
    expect(titleSignature('Zupa orkiszową')).toBe(titleSignature('Zupa orkiszowej'));
  });
  it('strips diacritics', () => {
    expect(titleSignature('Łosoś')).toBe(titleSignature('Losos'));
  });
  it('empty for empty input', () => {
    expect(titleSignature('')).toBe('');
  });
});

describe('ingredientSignature', () => {
  it('sorts alphabetically — order-independent', () => {
    expect(ingredientSignature(['cebula', 'czosnek', 'olej'])).toBe(ingredientSignature(['olej', 'czosnek', 'cebula']));
  });
  it('strips short tokens (<3 chars)', () => {
    expect(ingredientSignature(['ryż', 'z', 'ser'])).toBe(ingredientSignature(['ser', 'ryż']));
  });
  it('handles empty', () => {
    expect(ingredientSignature([])).toBe('');
  });
});

describe('macroSignature', () => {
  it('buckets kcal to 50, macros to 5', () => {
    expect(macroSignature({ calories: 420, protein: 12, fat: 18, carbs: 45 })).toBe('400|10|20|45');
    expect(macroSignature({ calories: 430, protein: 14, fat: 17, carbs: 43 })).toBe('450|15|15|45');
  });
  it('returns "-|-|-|-" for null nutrition', () => {
    expect(macroSignature(null)).toBe('-|-|-|-');
  });
  it('marks missing fields with dashes', () => {
    expect(macroSignature({ calories: 400 })).toBe('400|-|-|-');
  });
});

// ─── classifyDedup ─────────────────────────────────────────────────────────────

describe('classifyDedup', () => {
  it('3/3 → AUTO_MERGE', () => {
    expect(classifyDedup({ title: true, ingredients: true, macros: true })).toEqual({ count: 3, decision: 'AUTO_MERGE' });
  });
  it('2/3 → REVIEW', () => {
    expect(classifyDedup({ title: true, ingredients: true, macros: false }).decision).toBe('REVIEW');
    expect(classifyDedup({ title: true, ingredients: false, macros: true }).decision).toBe('REVIEW');
    expect(classifyDedup({ title: false, ingredients: true, macros: true }).decision).toBe('REVIEW');
  });
  it('1/3 → UNIQUE', () => {
    expect(classifyDedup({ title: true, ingredients: false, macros: false }).decision).toBe('UNIQUE');
  });
  it('0/3 → UNIQUE', () => {
    expect(classifyDedup({ title: false, ingredients: false, macros: false }).decision).toBe('UNIQUE');
  });
});

// ─── compareRecipes ────────────────────────────────────────────────────────────

function mkInput(overrides: Partial<DedupInput> = {}): DedupInput {
  return {
    id: 'r1',
    title: 'Naleśniki z owocami',
    ingredients: ['mąka', 'jajka', 'mleko', 'sól'],
    nutrition: { calories: 300, protein: 10, fat: 8, carbs: 45 },
    ...overrides,
  };
}

describe('compareRecipes', () => {
  it('identical recipes → AUTO_MERGE', () => {
    const a = mkInput();
    const b = mkInput({ id: 'r2' });
    const m = compareRecipes(a, b);
    expect(m.matchCount).toBe(3);
    expect(m.decision).toBe('AUTO_MERGE');
  });

  it('different titles + same ingredients + same macros → REVIEW (2/3)', () => {
    const a = mkInput();
    const b = mkInput({ id: 'r2', title: 'Zupełnie coś innego kulinarnie' });
    const m = compareRecipes(a, b);
    expect(m.matchCount).toBe(2);
    expect(m.decision).toBe('REVIEW');
    expect(m.levels.title).toBe(false);
    expect(m.levels.ingredients).toBe(true);
    expect(m.levels.macros).toBe(true);
  });

  it('same title + different macros + different ingredients → UNIQUE (1/3)', () => {
    const a = mkInput();
    const b = mkInput({
      id: 'r2',
      ingredients: ['ciecierzyca', 'tahini', 'czosnek', 'cytryna'],
      nutrition: { calories: 500, protein: 25, fat: 20, carbs: 60 },
    });
    const m = compareRecipes(a, b);
    expect(m.matchCount).toBe(1);
    expect(m.decision).toBe('UNIQUE');
    expect(m.levels.title).toBe(true);
  });

  it('missing macros → macros level false', () => {
    const a = mkInput();
    const b = mkInput({ id: 'r2', nutrition: null });
    const m = compareRecipes(a, b);
    expect(m.levels.macros).toBe(false);
    // still title + ingredients = 2/3
    expect(m.matchCount).toBe(2);
  });

  it('completely different → UNIQUE (0/3)', () => {
    const a = mkInput();
    const b = mkInput({
      id: 'r2',
      title: 'Kurczak po indyjsku curry',
      ingredients: ['kurczak', 'curry', 'pomidory', 'śmietana'],
      nutrition: { calories: 600, protein: 35, fat: 25, carbs: 20 },
    });
    const m = compareRecipes(a, b);
    expect(m.matchCount).toBe(0);
  });

  it('inflected title variants still match', () => {
    const a = mkInput({ title: 'Naleśniki z owocami' });
    const b = mkInput({ id: 'r2', title: 'Naleśniki z owoców' });
    const m = compareRecipes(a, b);
    expect(m.levels.title).toBe(true);
  });

  it('exposes titleSimilarity 0-1', () => {
    const a = mkInput({ title: 'Pizza margherita' });
    const b = mkInput({ id: 'r2', title: 'Pizza margherita klasyczna' });
    const m = compareRecipes(a, b);
    expect(m.titleSimilarity).toBeGreaterThan(0.5);
    expect(m.titleSimilarity).toBeLessThanOrEqual(1);
  });
});

// ─── findDuplicatesInCorpus ────────────────────────────────────────────────────

describe('findDuplicatesInCorpus', () => {
  it('empty corpus → empty report', () => {
    const r = findDuplicatesInCorpus([]);
    expect(r.autoMerge).toEqual([]);
    expect(r.review).toEqual([]);
    expect(r.unique).toEqual([]);
  });

  it('three identical recipes → single AUTO_MERGE cluster', () => {
    const corpus: DedupInput[] = [
      mkInput({ id: 'a' }),
      mkInput({ id: 'b' }),
      mkInput({ id: 'c' }),
    ];
    const r = findDuplicatesInCorpus(corpus);
    expect(r.autoMerge).toHaveLength(1);
    expect(r.autoMerge[0].recipes).toHaveLength(3);
    expect(r.unique).toHaveLength(0);
    expect(r.review).toHaveLength(0);
  });

  it('two variants of same recipe with different macros → REVIEW', () => {
    const corpus: DedupInput[] = [
      mkInput({ id: 'a' }),
      mkInput({ id: 'b', nutrition: { calories: 500, protein: 20, fat: 20, carbs: 50 } }),
    ];
    const r = findDuplicatesInCorpus(corpus);
    expect(r.review).toHaveLength(1);
    expect(r.autoMerge).toHaveLength(0);
    // Both get placed into review; none in unique.
    expect(r.unique).toHaveLength(0);
  });

  it('unrelated recipes → all unique', () => {
    const corpus: DedupInput[] = [
      mkInput({ id: 'a' }),
      mkInput({
        id: 'b',
        title: 'Kurczak curry',
        ingredients: ['kurczak', 'curry', 'ryż'],
        nutrition: { calories: 650, protein: 40, fat: 25, carbs: 60 },
      }),
      mkInput({
        id: 'c',
        title: 'Sałatka grecka',
        ingredients: ['pomidor', 'ogórek', 'feta', 'oliwki'],
        nutrition: { calories: 200, protein: 8, fat: 15, carbs: 10 },
      }),
    ];
    const r = findDuplicatesInCorpus(corpus);
    expect(r.unique).toHaveLength(3);
    expect(r.autoMerge).toHaveLength(0);
    expect(r.review).toHaveLength(0);
  });

  it('recipes without macros fall back from AUTO_MERGE to REVIEW', () => {
    const corpus: DedupInput[] = [
      mkInput({ id: 'a', nutrition: null }),
      mkInput({ id: 'b', nutrition: null }),
    ];
    const r = findDuplicatesInCorpus(corpus);
    // Same title + same ingredients = 2/3 (macros both '-|-|-|-' so macroMatch=false)
    expect(r.autoMerge).toHaveLength(0);
    expect(r.review).toHaveLength(1);
  });
});
