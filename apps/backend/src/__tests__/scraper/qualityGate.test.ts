import { describe, it, expect } from 'vitest';
import {
  evaluateRecipeQuality,
  checkScalability,
  AUTO_THRESHOLD,
  REVIEW_THRESHOLD,
  type QualityInput,
} from '../../scraper/utils/qualityGate';

// ─── Fixture helpers ───────────────────────────────────────────────────────────

function validBase(): QualityInput {
  return {
    title: 'Naleśniki z mąki orkiszowej',
    description: 'Pyszne naleśniki z mąki orkiszowej na mleku, idealne na śniadanie.',
    ingredients: [
      { name: 'Mąka orkiszowa', text: '200g' },
      { name: 'Jajka', text: '2 szt' },
      { name: 'Mleko', text: '500ml' },
      { name: 'Sól', text: 'szczypta' },
    ],
    steps: ['Wymieszaj mąkę z jajkami', 'Dodaj mleko', 'Smaż na patelni'],
    servings: 4,
    totalTimeMinutes: 25,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    imageUrl: 'https://example.com/img.jpg',
    rating: 4.7,
    ratingCount: 25,
    category: 'Śniadania',
    cuisineType: 'polska',
    tags: ['naleśniki', 'śniadanie', 'szybkie'],
    nutrition: {
      calories: 320,
      protein: 10,
      fat: 8,
      carbs: 50,
      fiber: 3,
      sugar: 4,
      sodium: 180,
    },
  };
}

// ─── REQUIRED field rejection ──────────────────────────────────────────────────

describe('evaluateRecipeQuality — REQUIRED rejections', () => {
  it('rejects when title missing', () => {
    const input = validBase();
    input.title = '';
    const r = evaluateRecipeQuality(input);
    expect(r.decision).toBe('REJECT');
    expect(r.missingRequired).toContain('title');
  });

  it('rejects when <3 ingredients', () => {
    const input = validBase();
    input.ingredients = [{ name: 'a' }, { name: 'b' }];
    const r = evaluateRecipeQuality(input);
    expect(r.decision).toBe('REJECT');
    expect(r.missingRequired.some(s => s.startsWith('ingredients'))).toBe(true);
  });

  it('rejects when <2 steps', () => {
    const input = validBase();
    input.steps = ['only one'];
    const r = evaluateRecipeQuality(input);
    expect(r.decision).toBe('REJECT');
    expect(r.missingRequired.some(s => s.startsWith('steps'))).toBe(true);
  });

  it('rejects when nutrition missing calories', () => {
    const input = validBase();
    input.nutrition = { protein: 10, fat: 8, carbs: 50 };
    const r = evaluateRecipeQuality(input);
    expect(r.decision).toBe('REJECT');
    expect(r.missingRequired.some(s => s.startsWith('macros'))).toBe(true);
  });

  it('rejects when nutrition missing protein', () => {
    const input = validBase();
    input.nutrition = { calories: 320, fat: 8, carbs: 50 };
    const r = evaluateRecipeQuality(input);
    expect(r.decision).toBe('REJECT');
    expect(r.missingRequired.some(s => s.startsWith('macros'))).toBe(true);
  });

  it('rejects when nutrition entirely missing', () => {
    const input = validBase();
    input.nutrition = null;
    const r = evaluateRecipeQuality(input);
    expect(r.decision).toBe('REJECT');
    expect(r.missingRequired.some(s => s.startsWith('macros'))).toBe(true);
  });

  it('lists all missing required fields at once', () => {
    const input = validBase();
    input.title = '';
    input.steps = [];
    input.nutrition = null;
    const r = evaluateRecipeQuality(input);
    expect(r.missingRequired.length).toBe(3);
    expect(r.score).toBe(0);
  });

  it('accepts ingredients as array of strings', () => {
    const input = validBase();
    input.ingredients = ['a', 'b', 'c', 'd'];
    const r = evaluateRecipeQuality(input);
    expect(r.missingRequired.length).toBe(0);
  });
});

// ─── NON_SCALABLE detection ────────────────────────────────────────────────────

describe('checkScalability', () => {
  it('detects "blacha NxM" pattern', () => {
    const r = checkScalability({ title: 'Sernik na blasze 24x35' });
    expect(r.scalable).toBe(false);
    expect(r.reasons[0]).toMatch(/blacha/);
  });

  it('detects "tort" in title', () => {
    const r = checkScalability({ title: 'Tort czekoladowy z malinami' });
    expect(r.scalable).toBe(false);
    expect(r.reasons[0]).toMatch(/tort/);
  });

  it('detects "tortownica"', () => {
    const r = checkScalability({
      title: 'Sernik krówkowy',
      description: 'Upiecz w tortownicy 26 cm.',
    });
    expect(r.scalable).toBe(false);
  });

  it('detects "foremka"', () => {
    const r = checkScalability({
      title: 'Ciasteczka',
      description: 'Pieczemy w foremce silikonowej.',
    });
    expect(r.scalable).toBe(false);
  });

  it('detects "keksówka"', () => {
    const r = checkScalability({ title: 'Ciasto drożdżowe w keksówce' });
    expect(r.scalable).toBe(false);
  });

  it('detects single-portion + high kcal', () => {
    const r = checkScalability({
      title: 'Bezpieczny przepis',
      servings: 1,
      nutrition: { calories: 1500 },
    });
    expect(r.scalable).toBe(false);
    expect(r.reasons[0]).toMatch(/single serving with high kcal/);
  });

  it('detects low servings + huge per-serving weight', () => {
    const r = checkScalability({
      title: 'Big meal',
      servings: 2,
      servingWeightG: 700,
    });
    expect(r.scalable).toBe(false);
    expect(r.reasons[0]).toMatch(/serving weight/);
  });

  it('allows normal scalable recipe', () => {
    const r = checkScalability({
      title: 'Naleśniki',
      servings: 4,
      servingWeightG: 150,
      nutrition: { calories: 320 },
    });
    expect(r.scalable).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('does not trigger on "tortilla" (no word boundary with tort)', () => {
    const r = checkScalability({ title: 'Tortilla z kurczakiem' });
    expect(r.scalable).toBe(true);
  });
});

// ─── AUTO / REVIEW / REJECT decisions ──────────────────────────────────────────

describe('evaluateRecipeQuality — decisions', () => {
  it('full happy-path recipe → AUTO', () => {
    const r = evaluateRecipeQuality(validBase());
    expect(r.decision).toBe('AUTO');
    expect(r.score).toBeGreaterThanOrEqual(AUTO_THRESHOLD);
    expect(r.scalability).toBe('SCALABLE');
    expect(r.missingRequired).toEqual([]);
  });

  it('minimal valid recipe (required only) → REVIEW or REJECT but not AUTO', () => {
    const r = evaluateRecipeQuality({
      title: 'Bare recipe',
      ingredients: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      steps: ['x', 'y'],
      nutrition: { calories: 200, protein: 5, fat: 3, carbs: 30 },
    });
    expect(r.decision).not.toBe('AUTO');
    expect(r.score).toBeLessThan(AUTO_THRESHOLD);
  });

  it('recipe with mid bonuses → REVIEW', () => {
    const input = validBase();
    // Strip most bonuses; keep only core
    input.imageUrl = null;
    input.rating = null;
    input.ratingCount = null;
    input.category = null;
    input.cuisineType = null;
    input.tags = [];
    input.nutrition = { calories: 320, protein: 10, fat: 8, carbs: 50 };
    const r = evaluateRecipeQuality(input);
    expect(r.score).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
    expect(r.score).toBeLessThan(AUTO_THRESHOLD);
    expect(r.decision).toBe('REVIEW');
  });

  it('recipe missing servings AND time → REJECT from penalties', () => {
    const input: QualityInput = {
      title: 'Minimal',
      ingredients: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      steps: ['x', 'y'],
      nutrition: { calories: 200, protein: 5, fat: 3, carbs: 30 },
      // no servings, no time, no extras
    };
    const r = evaluateRecipeQuality(input);
    // Base 60 - 5 (no servings) - 5 (no time) = 50 → REJECT
    expect(r.score).toBeLessThan(REVIEW_THRESHOLD);
    expect(r.decision).toBe('REJECT');
    expect(r.penaltyReasons.length).toBeGreaterThanOrEqual(2);
  });

  it('non-scalable tort → REJECT with NON_SCALABLE', () => {
    const input = validBase();
    input.title = 'Tort czekoladowy';
    const r = evaluateRecipeQuality(input);
    expect(r.decision).toBe('REJECT');
    expect(r.scalability).toBe('NON_SCALABLE');
    expect(r.nonScalableReasons.length).toBeGreaterThan(0);
  });

  it('score is clamped to 100', () => {
    const input = validBase();
    // Add many tags and extended nutrition to push score
    input.tags = ['a', 'b', 'c', 'd', 'e', 'f'];
    input.nutrition = {
      calories: 320, protein: 10, fat: 8, carbs: 50,
      fiber: 3, sugar: 4, sodium: 180, cholesterol: 50,
    };
    const r = evaluateRecipeQuality(input);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('summary line includes decision and score', () => {
    const r = evaluateRecipeQuality(validBase());
    expect(r.summary).toContain(r.decision);
    expect(r.summary).toContain(r.score.toString());
  });

  it('required missing outranks non-scalable (reported as missing, not scalability)', () => {
    const input = validBase();
    input.title = 'Tort';
    input.steps = [];
    const r = evaluateRecipeQuality(input);
    // Required check runs first; we surface missingRequired.
    expect(r.decision).toBe('REJECT');
    expect(r.missingRequired.length).toBeGreaterThan(0);
    expect(r.nonScalableReasons).toEqual([]);
  });
});

// ─── Bonus behaviour details ───────────────────────────────────────────────────

describe('evaluateRecipeQuality — bonus details', () => {
  it('adds +5 for rating ≥4 with ≥10 reviews', () => {
    const withRating = validBase();
    withRating.rating = 4.5;
    withRating.ratingCount = 50;
    const r1 = evaluateRecipeQuality(withRating);

    const noRating = validBase();
    noRating.rating = null;
    noRating.ratingCount = null;
    const r2 = evaluateRecipeQuality(noRating);

    expect(r1.score - r2.score).toBe(5);
  });

  it('extended nutrition adds +2 per field (fiber/sugar/sodium/cholesterol)', () => {
    const base = validBase();
    base.nutrition = { calories: 320, protein: 10, fat: 8, carbs: 50 };
    const baseResult = evaluateRecipeQuality(base);

    const withExt = validBase();
    withExt.nutrition = {
      calories: 320, protein: 10, fat: 8, carbs: 50,
      fiber: 3, sugar: 4, sodium: 180,
    };
    const extResult = evaluateRecipeQuality(withExt);

    // 3 extended nutrients × 2 = +6, but may be clamped to 100 — use a lower-bonus base.
    expect(extResult.score - baseResult.score).toBe(6);
  });
});
