/**
 * Faza D Phase 1 W2-Thu: tests for the multi-item aggregation pipeline that
 * drives meal-card totals + diet-plan-template day-summary kcal/macros.
 *
 * The PDF renderer itself writes to a PDFKit doc — we don't unit-test the
 * pixel-level output. Instead we lock down the helper functions that
 * compute the numbers feeding `renderMealCard` (Porcja / kcal / B/T/W) and
 * `renderDayPage` totals.
 */

import { describe, it, expect } from 'vitest';
import type { Meal, MealItem } from '../../pdf/types';
import { getMealItems, aggregateItems } from '../../pdf/meal-card';

function mk(name: string, kcal: number, protein: number, fat: number, carbs: number, grams = 100): MealItem {
  return { name, kcal, protein, fat, carbs, grams };
}

// ─── 1. getMealItems — string entries filtered ──────────────────────────────

describe('Faza D W2-Thu — getMealItems', () => {
  it('returns empty array for missing / empty items', () => {
    expect(getMealItems({ name: 'X', items: [] } as unknown as Meal)).toEqual([]);
    expect(getMealItems({ name: 'X' } as unknown as Meal)).toEqual([]);
  });

  it('returns single-element array for legacy 1-item meals', () => {
    const meal: Meal = { name: 'Owsianka', items: [mk('Owsianka', 400, 12, 8, 60)] } as Meal;
    const items = getMealItems(meal);
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe('Owsianka');
  });

  it('filters out string entries (legacy free-text items)', () => {
    const meal: Meal = {
      name: 'X',
      items: ['plain text instruction', mk('Recipe', 300, 20, 10, 30), 'another note'],
    } as Meal;
    const items = getMealItems(meal);
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe('Recipe');
  });

  it('returns 1-3 items for compose-mode slots in MAIN→CARB→VEG order', () => {
    const meal: Meal = {
      name: 'Kotlet schabowy',
      items: [
        mk('Kotlet schabowy', 320, 28, 18, 10, 130),   // MAIN
        mk('Ryż biały',       200,  4,  1, 45, 150),   // CARB
        mk('Sałatka mizeria', 100,  3,  6,  8, 200),   // VEG
      ],
    } as Meal;
    const items = getMealItems(meal);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.name)).toEqual(['Kotlet schabowy', 'Ryż biały', 'Sałatka mizeria']);
  });
});

// ─── 2. aggregateItems — multi-item totals ──────────────────────────────────

describe('Faza D W2-Thu — aggregateItems', () => {
  it('sums kcal/protein/fat/carbs/grams across 3 elements', () => {
    const items = [
      mk('Kotlet schabowy', 320, 28, 18, 10, 130),
      mk('Ryż biały',       200,  4,  1, 45, 150),
      mk('Sałatka mizeria', 100,  3,  6,  8, 200),
    ];
    const totals = aggregateItems(items);
    expect(totals.kcal).toBe(620);
    expect(totals.protein).toBe(35);
    expect(totals.fat).toBe(25);
    expect(totals.carbs).toBe(63);
    expect(totals.grams).toBe(480);
  });

  it('returns zeros for empty items', () => {
    expect(aggregateItems([])).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0, grams: 0 });
  });

  it('treats undefined fields as 0', () => {
    const items = [
      { name: 'Partial', kcal: 200, grams: 100 } as MealItem,
      mk('Full', 100, 5, 2, 15, 50),
    ];
    const totals = aggregateItems(items);
    expect(totals.kcal).toBe(300);
    expect(totals.protein).toBe(5);     // 0 (partial) + 5 (full)
    expect(totals.fat).toBe(2);
    expect(totals.carbs).toBe(15);
    expect(totals.grams).toBe(150);
  });

  it('preserves single-element pass-through (legacy bit-equality)', () => {
    const single = [mk('Owsianka', 400, 12, 8, 60, 250)];
    const totals = aggregateItems(single);
    expect(totals.kcal).toBe(400);
    expect(totals.protein).toBe(12);
    expect(totals.fat).toBe(8);
    expect(totals.carbs).toBe(60);
    expect(totals.grams).toBe(250);
  });
});

// ─── 3. Day-summary totals — multi-item iteration ───────────────────────────
//
// `diet-plan-template.ts:renderDayPage` sums macros per day across every
// item of every meal. Pre-Faza-D plans have items.length === 1 per meal so
// the inner loop is a no-op. Compose mode emits 1-3 per slot and the
// inner loop is what makes daily totals add up.

describe('Faza D W2-Thu — day-totals iteration semantics', () => {
  it('legacy plan (1 item per meal) — totals match items[0]', () => {
    const meals: Meal[] = [
      { name: 'Śniadanie', items: [mk('Owsianka', 400, 12, 8, 60)] } as Meal,
      { name: 'Obiad',     items: [mk('Kurczak z ryżem', 600, 35, 18, 65)] } as Meal,
      { name: 'Kolacja',   items: [mk('Kanapki', 350, 18, 12, 40)] } as Meal,
    ];
    const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    for (const meal of meals) {
      for (const item of getMealItems(meal)) {
        totals.kcal += item.kcal ?? 0;
        totals.protein += item.protein ?? 0;
        totals.fat += item.fat ?? 0;
        totals.carbs += item.carbs ?? 0;
      }
    }
    expect(totals.kcal).toBe(1350);
    expect(totals.protein).toBe(65);
    expect(totals.fat).toBe(38);
    expect(totals.carbs).toBe(165);
  });

  it('compose-mode plan (3-tuple lunch + 3-tuple dinner) sums all items', () => {
    const meals: Meal[] = [
      // BREAKFAST stays 1-item (compose rule excludes it)
      { name: 'Śniadanie', items: [mk('Owsianka', 400, 12, 8, 60)] } as Meal,
      // LUNCH 3-tuple
      { name: 'Kotlet schabowy', items: [
        mk('Kotlet schabowy', 320, 28, 18, 10),
        mk('Ryż biały',       200,  4,  1, 45),
        mk('Sałatka mizeria', 100,  3,  6,  8),
      ] } as Meal,
      // DINNER 3-tuple
      { name: 'Łosoś pieczony', items: [
        mk('Łosoś pieczony',   280, 32, 16,  0),
        mk('Kasza gryczana',   180,  6,  2, 35),
        mk('Surówka colesław', 90,   2,  5,  9),
      ] } as Meal,
    ];
    const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    for (const meal of meals) {
      for (const item of getMealItems(meal)) {
        totals.kcal += item.kcal ?? 0;
        totals.protein += item.protein ?? 0;
        totals.fat += item.fat ?? 0;
        totals.carbs += item.carbs ?? 0;
      }
    }
    // Breakfast 400 + lunch 620 + dinner 550 = 1570
    expect(totals.kcal).toBe(1570);
    // Protein: 12 + (28+4+3) + (32+6+2) = 87
    expect(totals.protein).toBe(87);
    // Fat: 8 + (18+1+6) + (16+2+5) = 56
    expect(totals.fat).toBe(56);
    // Carbs: 60 + (10+45+8) + (0+35+9) = 167
    expect(totals.carbs).toBe(167);
  });

  it('handles missing meals array gracefully', () => {
    const meals: Meal[] = [];
    const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    for (const meal of meals) {
      for (const item of getMealItems(meal)) {
        totals.kcal += item.kcal ?? 0;
      }
    }
    expect(totals.kcal).toBe(0);
  });
});
