import { describe, it, expect } from 'vitest';
import {
  compareNutrition,
  checkPlausibility,
  THRESHOLD_OK,
  THRESHOLD_REVIEW,
  type NutritionSnapshot,
} from '../../scraper/utils/nutritionCompare';

// ─── compareNutrition ──────────────────────────────────────────────────────────

describe('compareNutrition — overall decisions', () => {
  it('returns UNKNOWN when both sides null', () => {
    expect(compareNutrition(null, null).overall).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when no overlapping fields', () => {
    expect(compareNutrition({ calories: 300 }, { protein: 15 }).overall).toBe('UNKNOWN');
  });

  it('returns OK for identical values', () => {
    const n: NutritionSnapshot = { calories: 300, protein: 15, fat: 10, carbs: 40 };
    const r = compareNutrition(n, n);
    expect(r.overall).toBe('OK');
    expect(r.reasons).toEqual([]);
  });

  it('returns OK when within 15% on all fields', () => {
    const r = compareNutrition(
      { calories: 300, protein: 15, fat: 10, carbs: 40 },
      { calories: 330, protein: 16, fat: 11, carbs: 43 }, // +10%, +6%, +10%, +7%
    );
    expect(r.overall).toBe('OK');
  });

  it('returns REVIEW at 15-30% diff on a main macro', () => {
    const r = compareNutrition(
      { calories: 300, protein: 15, fat: 10, carbs: 40 },
      { calories: 360, protein: 15, fat: 10, carbs: 40 }, // calories +20%
    );
    expect(r.overall).toBe('REVIEW');
    expect(r.reasons[0]).toMatch(/calories/);
  });

  it('returns REJECT at >30% diff on a main macro', () => {
    const r = compareNutrition(
      { calories: 300, protein: 15, fat: 10, carbs: 40 },
      { calories: 500, protein: 15, fat: 10, carbs: 40 }, // calories +67%
    );
    expect(r.overall).toBe('REJECT');
    expect(r.primaryDriverField).toBe('calories');
  });

  it('extended-only REJECT bumps to REVIEW (not REJECT)', () => {
    const r = compareNutrition(
      { calories: 300, protein: 15, fat: 10, carbs: 40, fiber: 5, sodium: 200 },
      { calories: 300, protein: 15, fat: 10, carbs: 40, fiber: 5, sodium: 900 },
    );
    // fiber OK, sodium should REJECT but only extended → capped at REVIEW overall.
    expect(r.overall).toBe('REVIEW');
  });

  it('worst-of-main wins over OK extended', () => {
    const r = compareNutrition(
      { calories: 300, protein: 15, fat: 10, carbs: 40, fiber: 5 },
      { calories: 400, protein: 15, fat: 10, carbs: 40, fiber: 5 }, // diff 100/400 = 25%
    );
    expect(r.overall).toBe('REVIEW');
  });
});

describe('compareNutrition — small-value guard', () => {
  it('treats 0 fiber vs 0.8g fiber as OK (below epsilon)', () => {
    const r = compareNutrition({ fiber: 0 }, { fiber: 0.8 });
    const fiberField = r.fields.find((f) => f.field === 'fiber')!;
    expect(fiberField.decision).toBe('OK');
  });

  it('treats 30kcal vs 40kcal as OK (below epsilon 20, but denom=40)', () => {
    // calories diff 10, denom 40, pct 25%. ABS_EPSILON for calories=20,
    // max(30,40)=40 > 20 → percentage kicks in. 25% → REVIEW.
    const r = compareNutrition({ calories: 30 }, { calories: 40 });
    const cal = r.fields.find((f) => f.field === 'calories')!;
    expect(cal.decision).toBe('REVIEW');
  });

  it('treats 5kcal vs 10kcal as OK (both below epsilon)', () => {
    const r = compareNutrition({ calories: 5 }, { calories: 10 });
    const cal = r.fields.find((f) => f.field === 'calories')!;
    expect(cal.decision).toBe('OK');
  });
});

describe('compareNutrition — field-level details', () => {
  it('reports absDiff and pctDiff for each field', () => {
    const r = compareNutrition(
      { calories: 400 },
      { calories: 500 },
    );
    const cal = r.fields.find((f) => f.field === 'calories')!;
    expect(cal.absDiff).toBe(100);
    expect(cal.pctDiff).toBe(20); // 100/500 = 20%
  });

  it('preserves scraped=null vs computed=300 as UNKNOWN', () => {
    const r = compareNutrition({ calories: null }, { calories: 300 });
    const cal = r.fields.find((f) => f.field === 'calories')!;
    expect(cal.decision).toBe('UNKNOWN');
  });

  it('picks the biggest % diff as primaryDriverField', () => {
    const r = compareNutrition(
      { calories: 300, protein: 10, fat: 20, carbs: 30 },
      { calories: 500, protein: 15, fat: 25, carbs: 45 },
    );
    // calories diff 40%, protein 33%, fat 20%, carbs 33% → calories drives
    expect(r.primaryDriverField).toBe('calories');
  });
});

// ─── checkPlausibility ────────────────────────────────────────────────────────

describe('checkPlausibility', () => {
  it('accepts normal breakfast', () => {
    expect(checkPlausibility({ calories: 400 }, 'BREAKFAST').ok).toBe(true);
  });

  it('rejects 3000-kcal breakfast (above max 900)', () => {
    const r = checkPlausibility({ calories: 3000 }, 'BREAKFAST');
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/exceeds/);
  });

  it('rejects 30-kcal breakfast (below min 100)', () => {
    const r = checkPlausibility({ calories: 30 }, 'BREAKFAST');
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/below/);
  });

  it('accepts 800-kcal lunch (within 200-1400)', () => {
    expect(checkPlausibility({ calories: 800 }, 'LUNCH').ok).toBe(true);
  });

  it('rejects 2000-kcal dinner', () => {
    expect(checkPlausibility({ calories: 2000 }, 'DINNER').ok).toBe(false);
  });

  it('accepts 300-kcal snack', () => {
    expect(checkPlausibility({ calories: 300 }, 'SNACK').ok).toBe(true);
  });

  it('rejects 1200-kcal snack (above 500)', () => {
    expect(checkPlausibility({ calories: 1200 }, 'SNACK').ok).toBe(false);
  });

  it('flags missing calories as not-ok', () => {
    const r = checkPlausibility({ calories: null }, 'BREAKFAST');
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/not provided/);
  });

  it('DRINK allows zero calories', () => {
    expect(checkPlausibility({ calories: 0 }, 'DRINK').ok).toBe(true);
  });
});

// ─── Thresholds sanity ─────────────────────────────────────────────────────────

describe('exported thresholds', () => {
  it('THRESHOLD_OK < THRESHOLD_REVIEW', () => {
    expect(THRESHOLD_OK).toBeLessThan(THRESHOLD_REVIEW);
  });
});
