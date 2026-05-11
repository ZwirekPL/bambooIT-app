/**
 * Tests for gramScaling.service.ts — tier classification, per-day scaling, edge cases.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyScalingTier,
  scaleDayIngredients,
  smartScaleContent,
  type NutrientsPer100g,
  type ScalingConfig,
} from '../../services/gramScaling.service';
import type { PlanContent, PlanDay, PlanItem, PlanMeal } from '../../services/planValidation.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNutrients(kcal: number, protein: number, fat: number, carbs: number): NutrientsPer100g {
  return { kcalPer100g: kcal, proteinPer100g: protein, fatPer100g: fat, carbsPer100g: carbs };
}

function makeNutrientMap(entries: Array<[string, NutrientsPer100g]>): Map<string, NutrientsPer100g> {
  return new Map(entries.map(([name, n]) => [name.toLowerCase(), n]));
}

function makeItem(name: string, ingredients: Array<{ name: string; grams: number }>): PlanItem {
  return {
    name,
    grams: ingredients.reduce((sum, i) => sum + i.grams, 0),
    kcal: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    ingredients,
  };
}

function makeMeal(name: string, items: PlanItem[]): PlanMeal {
  return { name, items };
}

function makeDay(dayName: string, meals: PlanMeal[]): PlanDay {
  return { day: dayName, meals };
}

// Common nutrients for tests
const CHICKEN = makeNutrients(150, 25, 5, 0);        // Protein
const RICE = makeNutrients(340, 10, 2, 70);           // Carb
const BROCCOLI = makeNutrients(25, 1.5, 0.3, 4.5);   // Vegetable
const OLIVE_OIL = makeNutrients(800, 0, 90, 0);       // Fat
const SALT = makeNutrients(0, 0, 0, 0);               // Fixed (spice)
const BREAD = makeNutrients(250, 8, 2, 50);           // Carb
const EGG = makeNutrients(155, 13, 11, 1);            // Protein

// ─── Tier Classification ────────────────────────────────────────────────────

describe('classifyScalingTier', () => {
  it('classifies small amounts (<= 10g) as FIXED', () => {
    expect(classifyScalingTier('Sól', 5, SALT)).toBe('FIXED');
    expect(classifyScalingTier('Pieprz', 3, null)).toBe('FIXED');
    expect(classifyScalingTier('Ryż', 8, RICE)).toBe('FIXED');
  });

  it('classifies water and seasonings as FIXED regardless of grams', () => {
    expect(classifyScalingTier('woda', 200, null)).toBe('FIXED');
    expect(classifyScalingTier('Sól morska', 15, null)).toBe('FIXED');
    expect(classifyScalingTier('Pieprz czarny', 15, null)).toBe('FIXED');
    expect(classifyScalingTier('Cynamon', 15, null)).toBe('FIXED');
    expect(classifyScalingTier('Kurkuma', 20, null)).toBe('FIXED');
  });

  it('classifies fats by keyword', () => {
    expect(classifyScalingTier('Oliwa z oliwek', 15, OLIVE_OIL)).toBe('FAT');
    expect(classifyScalingTier('Masło', 20, null)).toBe('FAT');
    expect(classifyScalingTier('Olej rzepakowy', 15, null)).toBe('FAT');
  });

  it('classifies proteins by keyword', () => {
    expect(classifyScalingTier('Pierś z kurczaka', 150, CHICKEN)).toBe('PROTEIN');
    expect(classifyScalingTier('Łosoś', 120, null)).toBe('PROTEIN');
    expect(classifyScalingTier('Tofu', 100, null)).toBe('PROTEIN');
    expect(classifyScalingTier('Twaróg chudy', 100, null)).toBe('PROTEIN');
    expect(classifyScalingTier('Jajko', 60, EGG)).toBe('PROTEIN');
  });

  it('classifies carbs by keyword', () => {
    expect(classifyScalingTier('Ryż brązowy', 100, RICE)).toBe('CARB');
    expect(classifyScalingTier('Makaron pełnoziarnisty', 80, null)).toBe('CARB');
    expect(classifyScalingTier('Chleb razowy', 60, BREAD)).toBe('CARB');
    expect(classifyScalingTier('Kasza gryczana', 80, null)).toBe('CARB');
    expect(classifyScalingTier('Ziemniaki', 200, null)).toBe('CARB');
  });

  it('classifies vegetables by keyword', () => {
    expect(classifyScalingTier('Brokuły', 100, BROCCOLI)).toBe('VEGETABLE');
    expect(classifyScalingTier('Szpinak', 80, null)).toBe('VEGETABLE');
    expect(classifyScalingTier('Pomidory', 100, null)).toBe('VEGETABLE');
    expect(classifyScalingTier('Jabłko', 150, null)).toBe('VEGETABLE');
  });

  it('uses nutrient-based fallback when no keyword matches', () => {
    // High fat → FAT
    expect(classifyScalingTier('Tahini', 30, makeNutrients(600, 18, 55, 15))).toBe('FAT');
    // High protein → PROTEIN
    expect(classifyScalingTier('Serek wiejski', 100, makeNutrients(100, 18, 4, 3))).toBe('PROTEIN');
    // High carb → CARB
    expect(classifyScalingTier('Amarantus', 80, makeNutrients(370, 14, 7, 65))).toBe('CARB');
    // Low kcal → VEGETABLE
    expect(classifyScalingTier('Rabarbar', 100, makeNutrients(21, 0.9, 0.2, 4))).toBe('VEGETABLE');
  });

  it('falls back to classifyUnmatched category mapping', () => {
    // 'orzech' → nut → FAT
    expect(classifyScalingTier('Orzechy włoskie', 30, null)).toBe('FAT');
    // 'soczewic' → legume → CARB
    expect(classifyScalingTier('Soczewica', 80, null)).toBe('CARB');
  });
});

// ─── Day Scaling ────────────────────────────────────────────────────────────

describe('scaleDayIngredients', () => {
  const nutrientMap = makeNutrientMap([
    ['pierś z kurczaka', CHICKEN],
    ['ryż brązowy', RICE],
    ['brokuły', BROCCOLI],
    ['oliwa z oliwek', OLIVE_OIL],
    ['sól', SALT],
  ]);

  function makeSampleDay(chickenG: number, riceG: number, broccoliG: number, oilG: number): PlanDay {
    return makeDay('Poniedziałek', [
      makeMeal('Obiad', [
        makeItem('Kurczak z ryżem', [
          { name: 'Pierś z kurczaka', grams: chickenG },
          { name: 'Ryż brązowy', grams: riceG },
          { name: 'Brokuły', grams: broccoliG },
          { name: 'Oliwa z oliwek', grams: oilG },
          { name: 'Sól', grams: 3 },
        ]),
      ]),
    ]);
  }

  it('does not scale when already within tolerance', () => {
    // ~150*1.5 + 340*1 + 25*1.5 + 800*0.15 = 225+340+37.5+120 = 722.5 kcal
    const day = makeSampleDay(150, 100, 150, 15);
    const config: ScalingConfig = { targetKcal: 720 };
    const { scaledDay, detail } = scaleDayIngredients(day, nutrientMap, config);

    expect(detail.originalKcal).toBeCloseTo(722, -1);
    expect(detail.iterations).toBe(0);
    // Grams should remain unchanged
    const ings = scaledDay.meals[0].items[0].ingredients!;
    expect(ings[0].grams).toBe(150); // chicken
    expect(ings[1].grams).toBe(100); // rice
  });

  it('scales UP carbs and protein when deficit exists', () => {
    const day = makeSampleDay(100, 60, 100, 10);
    // Original: 150+204+25+80 = 459 kcal
    const config: ScalingConfig = { targetKcal: 600, tolerance: 0.05 };
    const { scaledDay, detail } = scaleDayIngredients(day, nutrientMap, config);

    expect(detail.finalKcal).toBeGreaterThan(detail.originalKcal);
    expect(detail.finalKcal).toBeGreaterThanOrEqual(570); // 600 - 5%
    expect(detail.finalKcal).toBeLessThanOrEqual(630);    // 600 + 5%
    expect(detail.iterations).toBeGreaterThanOrEqual(1);

    const ings = scaledDay.meals[0].items[0].ingredients!;
    // Rice (CARB) should increase most
    expect(ings[1].grams).toBeGreaterThan(60);
    // Oil (FAT) should barely change (max 1.1x = 11)
    expect(ings[3].grams).toBeLessThanOrEqual(11);
    // Salt (FIXED) should not change
    expect(ings[4].grams).toBe(3);
  });

  it('scales DOWN when surplus exists', () => {
    const day = makeSampleDay(200, 150, 200, 20);
    // Original: 300+510+50+160 = 1020 kcal
    const config: ScalingConfig = { targetKcal: 700, tolerance: 0.05 };
    const { scaledDay, detail } = scaleDayIngredients(day, nutrientMap, config);

    expect(detail.finalKcal).toBeLessThan(detail.originalKcal);
    // Tier min factors (0.7-0.85) limit how much we can reduce in 3 iterations
    // so we verify it moved significantly toward target, not that it hit it exactly
    expect(detail.finalKcal).toBeLessThanOrEqual(850); // Moved substantially from 1020
    expect(detail.finalKcal).toBeGreaterThanOrEqual(600); // Didn't overshoot below
  });

  it('respects tier max factors and does not over-scale', () => {
    const day = makeSampleDay(80, 40, 60, 5);
    // Very low: 120+136+15+40 = 311 kcal
    const config: ScalingConfig = { targetKcal: 700, tolerance: 0.05 };
    const { scaledDay } = scaleDayIngredients(day, nutrientMap, config);

    const ings = scaledDay.meals[0].items[0].ingredients!;
    // Chicken (PROTEIN max 1.25x): 80 * 1.25 = 100
    expect(ings[0].grams).toBeLessThanOrEqual(100);
    // Rice (CARB max 1.3x): 40 * 1.3 = 52
    expect(ings[1].grams).toBeLessThanOrEqual(52);
    // Broccoli (VEGETABLE max 1.5x): 60 * 1.5 = 90
    expect(ings[2].grams).toBeLessThanOrEqual(90);
    // Oil (FAT max 1.1x): 5 * 1.1 = 5.5 → 6
    expect(ings[3].grams).toBeLessThanOrEqual(6);
  });

  it('recomputes item-level macros after scaling', () => {
    // Create item with pre-set kcal (as if enriched by nutritionCalculator)
    const day = makeDay('Poniedziałek', [
      makeMeal('Obiad', [{
        name: 'Kurczak z ryżem',
        grams: 273,
        kcal: 459, // 150+204+25+80
        protein: 25,
        fat: 10,
        carbs: 55,
        ingredients: [
          { name: 'Pierś z kurczaka', grams: 100 },
          { name: 'Ryż brązowy', grams: 60 },
          { name: 'Brokuły', grams: 100 },
          { name: 'Oliwa z oliwek', grams: 10 },
          { name: 'Sól', grams: 3 },
        ],
      }]),
    ]);
    const config: ScalingConfig = { targetKcal: 600 };
    const { scaledDay } = scaleDayIngredients(day, nutrientMap, config);

    const item = scaledDay.meals[0].items[0];
    // Item macros should be recalculated proportionally, not zero
    expect(item.kcal).toBeGreaterThan(0);
    expect(item.protein).toBeGreaterThan(0);
    expect(item.grams).toBeGreaterThan(0);
    // Should be higher than original since we're scaling up to 600
    expect(item.kcal).toBeGreaterThan(459);
  });

  it('handles empty ingredient list gracefully', () => {
    const day = makeDay('Poniedziałek', [
      makeMeal('Śniadanie', [{
        name: 'Owsianka',
        grams: 300,
        kcal: 350,
        protein: 12,
        fat: 8,
        carbs: 55,
        // No ingredients array
      }]),
    ]);
    const config: ScalingConfig = { targetKcal: 400 };
    const { scaledDay, detail } = scaleDayIngredients(day, nutrientMap, config);

    // Should pass through without error
    expect(scaledDay.meals[0].items[0].grams).toBe(300);
    expect(detail.scaledIngredients).toBe(0);
  });
});

// ─── Portioned Items Snapping ───────────────────────────────────────────────

describe('scaleDayIngredients — portion snapping', () => {
  const nutrientMap = makeNutrientMap([
    ['jajko', EGG],
    ['chleb razowy', BREAD],
    ['masło', makeNutrients(740, 0.5, 82, 0.6)],
  ]);

  it('snaps eggs to 60g multiples', () => {
    const day = makeDay('Wtorek', [
      makeMeal('Śniadanie', [
        makeItem('Jajecznica', [
          { name: 'Jajko', grams: 120 },    // 2 eggs
          { name: 'Masło', grams: 10 },
        ]),
      ]),
    ]);

    const config: ScalingConfig = { targetKcal: 250, tolerance: 0.10 };
    const { scaledDay } = scaleDayIngredients(day, nutrientMap, config);
    const eggGrams = scaledDay.meals[0].items[0].ingredients![0].grams;
    expect(eggGrams % 60).toBe(0); // Must be multiple of 60
  });

  it('snaps bread to 30g multiples', () => {
    const day = makeDay('Środa', [
      makeMeal('Śniadanie', [
        makeItem('Kanapka', [
          { name: 'Chleb razowy', grams: 60 },  // 2 slices
          { name: 'Masło', grams: 10 },
        ]),
      ]),
    ]);

    const config: ScalingConfig = { targetKcal: 300, tolerance: 0.10 };
    const { scaledDay } = scaleDayIngredients(day, nutrientMap, config);
    const breadGrams = scaledDay.meals[0].items[0].ingredients![0].grams;
    expect(breadGrams % 30).toBe(0); // Must be multiple of 30
  });
});

// ─── smartScaleContent (full plan) ──────────────────────────────────────────

describe('smartScaleContent', () => {
  const nutrientMap = makeNutrientMap([
    ['pierś z kurczaka', CHICKEN],
    ['ryż brązowy', RICE],
    ['brokuły', BROCCOLI],
    ['oliwa z oliwek', OLIVE_OIL],
    ['łosoś', makeNutrients(200, 20, 13, 0)],
    ['kasza gryczana', makeNutrients(340, 12, 3, 70)],
    ['szpinak', makeNutrients(23, 2.9, 0.4, 3.6)],
  ]);

  function make7DayPlan(): PlanContent {
    const days: PlanDay[] = [];
    const dayNames = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
    for (const dayName of dayNames) {
      days.push(makeDay(dayName, [
        makeMeal('Obiad', [
          makeItem('Danie główne', [
            { name: 'Pierś z kurczaka', grams: 120 },
            { name: 'Ryż brązowy', grams: 80 },
            { name: 'Brokuły', grams: 100 },
            { name: 'Oliwa z oliwek', grams: 10 },
          ]),
        ]),
      ]));
    }
    return { days };
  }

  it('scales all 7 days independently', () => {
    const plan = make7DayPlan();
    const config: ScalingConfig = { targetKcal: 600 };
    const { scaledContent, report } = smartScaleContent(plan, nutrientMap, config);

    expect(scaledContent.days).toHaveLength(7);
    expect(report.details).toHaveLength(7);
    expect(report.daysScaled + report.daysSkipped).toBe(7);
  });

  it('returns unchanged content when targetKcal is 0', () => {
    const plan = make7DayPlan();
    const config: ScalingConfig = { targetKcal: 0 };
    const { scaledContent, report } = smartScaleContent(plan, nutrientMap, config);

    expect(report.daysScaled).toBe(0);
    expect(scaledContent).toBe(plan); // Same reference — not modified
  });

  it('returns unchanged content for empty plan', () => {
    const plan: PlanContent = { days: [] };
    const config: ScalingConfig = { targetKcal: 2000 };
    const { scaledContent, report } = smartScaleContent(plan, nutrientMap, config);

    expect(report.daysScaled).toBe(0);
    expect(scaledContent).toBe(plan);
  });

  it('brings each day closer to target kcal', () => {
    const plan = make7DayPlan();
    // Original day: 150*1.2 + 340*0.8 + 25*1 + 800*0.1 = 180+272+25+80 = 557 kcal
    const config: ScalingConfig = { targetKcal: 700, tolerance: 0.05 };
    const { report } = smartScaleContent(plan, nutrientMap, config);

    for (const detail of report.details) {
      // Each day should move toward target
      const originalDiff = Math.abs(detail.originalKcal - 700);
      const finalDiff = Math.abs(detail.finalKcal - 700);
      expect(finalDiff).toBeLessThanOrEqual(originalDiff);
    }
  });
});
