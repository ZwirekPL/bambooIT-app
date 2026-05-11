/**
 * Faza D Phase 1 W2-Wed: tests for D4 (skip breakfast) and D7 (night shift)
 * distribution variants in mealDistribution.service.ts.
 *
 * Variants are gated behind `composeMeals=true`. Legacy / gold-standard runs
 * (composeMeals=false / undefined) MUST keep using DEFAULT_DISTRIBUTIONS so
 * pre-Faza-D snapshots stay bit-equal — this is enforced as the first
 * regression check in the suite.
 */

import { vi, describe, it, expect } from 'vitest';

// Mock @db / encryption — service imports them at top level even though
// computeMealDistribution itself is pure.
vi.mock('@db', () => ({ prisma: {}, Prisma: {} }));
vi.mock('../../utils/encryption', () => ({ decryptJson: vi.fn() }));

import {
  computeMealDistribution,
  getNightShiftDistribution,
  applySkipBreakfast,
  type MealDistributionInput,
} from '../../services/mealDistribution.service';

function makeInput(overrides: Partial<MealDistributionInput> = {}): MealDistributionInput {
  return {
    dailyTargets: {
      targetKcal: 2000,
      targetProteinG: 150,
      targetFatG: 67,
      targetCarbsG: 250,
    },
    mealsPerDay: 5,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Gating regression — composeMeals=false must use DEFAULT_DISTRIBUTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Faza D W2-Wed — gating regression (composeMeals=false)', () => {
  it('ignores skipBreakfast when composeMeals is false', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: false,
      skipBreakfast: true,
      mealsPerDay: 5,
    }));
    // Expect 5 slots including "Śniadanie" (default 5-meal layout)
    expect(result.slots).toHaveLength(5);
    expect(result.slots[0]!.mealName).toBe('Śniadanie');
  });

  it('ignores nightShift when composeMeals is false', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: false,
      nightShift: true,
      mealsPerDay: 5,
    }));
    // Default 5-meal Śniadanie pct = 25% — confirms NIGHT_SHIFT not used
    const breakfastSlot = result.slots.find((s) => s.mealName === 'Śniadanie');
    expect(breakfastSlot?.pctOfDaily).toBe(25);
  });

  it('ignores both flags when composeMeals is undefined (default)', () => {
    const result = computeMealDistribution(makeInput({
      skipBreakfast: true,
      nightShift: true,
      mealsPerDay: 4,
    }));
    expect(result.slots).toHaveLength(4);
    expect(result.slots[0]!.mealName).toBe('Śniadanie');   // breakfast still present
    expect(result.slots[0]!.pctOfDaily).toBe(25);          // default 4-meal pct
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D4 — skipBreakfast renormalization
// ═══════════════════════════════════════════════════════════════════════════════

describe('Faza D W2-Wed — D4 skipBreakfast', () => {
  it('drops Śniadanie slot and renormalizes pcts to sum 100', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      skipBreakfast: true,
      mealsPerDay: 5,
    }));
    expect(result.slots).toHaveLength(4);
    expect(result.slots.map((s) => s.mealName)).not.toContain('Śniadanie');
    // pcts must sum to 100 (within ±1 tolerance for rounding)
    const pctSum = result.slots.reduce((sum, s) => sum + s.pctOfDaily, 0);
    expect(pctSum).toBe(100);
  });

  it('renormalizes 5-meal default minus breakfast (25%) → 4 slots scaled from 75% base', () => {
    // Default 5-meal: 25/10/35/10/20. Drop 25 → 10/35/10/20 (sum 75).
    // Scale by 100/75: 13.33/46.67/13.33/26.67 → 13/47/13/27 (after rounding).
    // Sum = 100. (Last largest absorbs remainder.)
    const slots = applySkipBreakfast([
      { mealName: 'Śniadanie',         pct: 25 },
      { mealName: 'Drugie śniadanie',  pct: 10 },
      { mealName: 'Obiad',             pct: 35 },
      { mealName: 'Podwieczorek',      pct: 10 },
      { mealName: 'Kolacja',           pct: 20 },
    ]);
    expect(slots).toHaveLength(4);
    const sum = slots.reduce((s, x) => s + x.pct, 0);
    expect(sum).toBe(100);
    // Obiad keeps its dominance after rescaling
    const obiad = slots.find((s) => s.mealName === 'Obiad');
    expect(obiad?.pct).toBeGreaterThan(40);
  });

  it('preserves slot ordering after dropping breakfast', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      skipBreakfast: true,
      mealsPerDay: 5,
    }));
    const order = result.slots.map((s) => s.mealName);
    expect(order).toEqual([
      'Drugie śniadanie',
      'Obiad',
      'Podwieczorek',
      'Kolacja',
    ]);
  });

  it('passthrough when distribution has no Śniadanie (defensive)', () => {
    const slots = applySkipBreakfast([
      { mealName: 'Obiad',   pct: 60 },
      { mealName: 'Kolacja', pct: 40 },
    ]);
    expect(slots).toEqual([
      { mealName: 'Obiad',   pct: 60 },
      { mealName: 'Kolacja', pct: 40 },
    ]);
  });

  it('respects MIN_SLOT_PCT after renormalization (no zero-kcal slots)', () => {
    // 6-meal default: 20/10/30/10/20/10. Drop 20 → 10/30/10/20/10 (sum 80).
    // Scale by 100/80 = 1.25 → all stay above the 5% min.
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      skipBreakfast: true,
      mealsPerDay: 6,
    }));
    expect(result.slots).toHaveLength(5);
    for (const slot of result.slots) {
      expect(slot.pctOfDaily).toBeGreaterThanOrEqual(5);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D7 — nightShift distribution
// ═══════════════════════════════════════════════════════════════════════════════

describe('Faza D W2-Wed — D7 nightShift', () => {
  it('uses NIGHT_SHIFT_DISTRIBUTIONS when composeMeals=true and nightShift=true', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      nightShift: true,
      mealsPerDay: 5,
    }));
    // Night-shift 5-meal Śniadanie pct = 30 (vs default 25)
    const breakfastSlot = result.slots.find((s) => s.mealName === 'Śniadanie');
    expect(breakfastSlot?.pctOfDaily).toBe(30);
    // Night-shift Kolacja pct = 15 (vs default 20)
    const dinnerSlot = result.slots.find((s) => s.mealName === 'Kolacja');
    expect(dinnerSlot?.pctOfDaily).toBe(15);
  });

  it('mealsPerDay 3 night-shift: 35/45/20 (vs default 30/45/25)', () => {
    const slots = getNightShiftDistribution(3);
    expect(slots).toHaveLength(3);
    expect(slots[0]!.pct).toBe(35);
    expect(slots[1]!.pct).toBe(45);
    expect(slots[2]!.pct).toBe(20);
  });

  it('clamps mealsPerDay to 2-6 range', () => {
    expect(getNightShiftDistribution(1)).toHaveLength(2);
    expect(getNightShiftDistribution(7)).toHaveLength(6);
  });

  it('preserves mealType labels (BREAKFAST/LUNCH/DINNER) for solver constraints', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      nightShift: true,
      mealsPerDay: 5,
    }));
    const types = result.slots.map((s) => s.mealType);
    expect(types).toContain('BREAKFAST');
    expect(types).toContain('LUNCH');
    expect(types).toContain('DINNER');
  });

  it('protocol override beats nightShift baseline (dietitian wins)', () => {
    const customProtocol = [
      { mealName: 'Śniadanie',         pct: 40 },
      { mealName: 'Drugie śniadanie',  pct: 5 },
      { mealName: 'Obiad',             pct: 30 },
      { mealName: 'Podwieczorek',      pct: 5 },
      { mealName: 'Kolacja',           pct: 20 },
    ];
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      nightShift: true,
      mealsPerDay: 5,
      protocolMealDistribution: customProtocol,
    }));
    const breakfastSlot = result.slots.find((s) => s.mealName === 'Śniadanie');
    expect(breakfastSlot?.pctOfDaily).toBe(40);   // protocol override, not 30 from night-shift
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D4 + D7 combined — skipBreakfast applied AFTER night-shift baseline
// ═══════════════════════════════════════════════════════════════════════════════

describe('Faza D W2-Wed — D4+D7 combined', () => {
  it('night-shift baseline minus breakfast → 4 slots, sum 100', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      skipBreakfast: true,
      nightShift: true,
      mealsPerDay: 5,
    }));
    expect(result.slots).toHaveLength(4);
    expect(result.slots.map((s) => s.mealName)).not.toContain('Śniadanie');
    const pctSum = result.slots.reduce((sum, s) => sum + s.pctOfDaily, 0);
    expect(pctSum).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// kcal totals stay correct after distribution changes
// ═══════════════════════════════════════════════════════════════════════════════

describe('Faza D W2-Wed — kcal totals preserved across variants', () => {
  it('skipBreakfast keeps total kcal exactly equal to dailyTargets', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      skipBreakfast: true,
      mealsPerDay: 5,
    }));
    expect(result.totalKcal).toBe(2000);
  });

  it('nightShift keeps total kcal exactly equal to dailyTargets', () => {
    const result = computeMealDistribution(makeInput({
      composeMeals: true,
      nightShift: true,
      mealsPerDay: 5,
    }));
    expect(result.totalKcal).toBe(2000);
  });
});
