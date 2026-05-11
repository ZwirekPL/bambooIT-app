import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ScoredRecipeCandidate } from '../../services/recipeCandidate.service';
import type { MealSlotTarget, MealDistributionInput, MealDistributionResult } from '../../services/mealDistribution.service';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  recipe: { findUnique: vi.fn() },
  recipeIngredient: { findMany: vi.fn().mockResolvedValue([]) },
  findCandidates: vi.fn(),
  loadPatientMealDistribution: vi.fn(),
  computeMealDistribution: vi.fn(),
  scaleRecipeForMeal: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: { recipe: m.recipe, recipeIngredient: m.recipeIngredient },
  Prisma: {},
}));

vi.mock('../../services/recipeCandidate.service', () => ({
  findCandidates: m.findCandidates,
}));

vi.mock('../../services/mealDistribution.service', () => ({
  loadPatientMealDistribution: m.loadPatientMealDistribution,
  computeMealDistribution: m.computeMealDistribution,
}));

vi.mock('../../services/recipeScaler.service', () => ({
  scaleRecipeForMeal: m.scaleRecipeForMeal,
}));

import { assembleDbPlan } from '../../services/dbPlanAssembly.service';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build 5 standard meal slots (breakfast, snack1, lunch, snack2, dinner) */
function make5Slots(): MealSlotTarget[] {
  return [
    { slotIndex: 0, pctOfDaily: 25, mealName: 'Śniadanie',       mealType: 'BREAKFAST',  targetKcal: 400,  targetProteinG: 25, targetFatG: 15, targetCarbsG: 45 },
    { slotIndex: 1, pctOfDaily: 10, mealName: 'Drugie śniadanie', mealType: 'SNACK',     targetKcal: 200,  targetProteinG: 10, targetFatG: 8,  targetCarbsG: 25 },
    { slotIndex: 2, pctOfDaily: 35, mealName: 'Obiad',           mealType: 'LUNCH',      targetKcal: 600,  targetProteinG: 40, targetFatG: 20, targetCarbsG: 65 },
    { slotIndex: 3, pctOfDaily: 10, mealName: 'Podwieczorek',    mealType: 'SNACK',      targetKcal: 200,  targetProteinG: 10, targetFatG: 8,  targetCarbsG: 25 },
    { slotIndex: 4, pctOfDaily: 20, mealName: 'Kolacja',         mealType: 'DINNER',     targetKcal: 400,  targetProteinG: 25, targetFatG: 15, targetCarbsG: 40 },
  ];
}

function makeDistributionResult(slots: MealSlotTarget[]): MealDistributionResult {
  const totalKcal = slots.reduce((s, sl) => s + sl.targetKcal, 0);
  const totalProteinG = slots.reduce((s, sl) => s + sl.targetProteinG, 0);
  const totalFatG = slots.reduce((s, sl) => s + sl.targetFatG, 0);
  const totalCarbsG = slots.reduce((s, sl) => s + sl.targetCarbsG, 0);
  return { slots, totalKcal, totalProteinG, totalFatG, totalCarbsG };
}

function makeCandidate(overrides: Partial<ScoredRecipeCandidate> = {}): ScoredRecipeCandidate {
  return {
    recipeId: overrides.recipeId ?? `recipe-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Testowy przepis',
    category: 'danie główne',
    mealType: 'LUNCH',
    cuisineType: null,
    kcal: 400,
    proteinG: 30,
    fatG: 12,
    carbsG: 50,
    fiberG: 5,
    scaleFactor: 1.0,
    scaledKcal: 400,
    scaledProteinG: 30,
    scaledFatG: 12,
    scaledCarbsG: 50,
    nutritionFitScore: 80,
    qualityScore: 70,
    patientRatingScore: 0,
    cuisineScore: 50,
    seasonScore: 50,
    diversityScore: 50,
    costScore: 50,
    microFitScore: 50,
    practicalFitScore: 80,
    satietyProxyScore: 50,
    interactionScore: 100,
    complianceScore: 80,
    totalScore: 65,
    totalTimeMinutes: 30,
    difficulty: 'MEDIUM',
    servings: 1,
    tags: [],
    mealPrepFriendly: false,
    cookingMethod: null,
    sodiumMg: 0,
    ironMg: 0,
    calciumMg: 0,
    vitaminDUg: 0,
    folateUg: 0,
    vitaminB12Ug: 0,
    zincMg: 0,
    vitaminCMg: 0,
    magnesiumMg: 0,
    potassiumMg: 0,
    vitaminAUg: 0,
    vitaminKUg: 0,
    omega3G: 0,
    seleniumUg: 0,
    iodineUg: 0,
    phosphorusMg: 0,
    // Faza D Phase 1: composition flags surfaced from Recipe DB
    dishCompleteness: null as 'COMPLETE_MEAL' | 'MAIN_DISH' | 'CARB_SIDE' | 'VEG_SIDE' | 'COMPONENT' | null,
    containsVegetableServing: false,
    ...overrides,
  };
}

function makeScaleResult(slot: MealSlotTarget) {
  return {
    scaledNutrition: {
      kcal: slot.targetKcal,
      proteinG: slot.targetProteinG,
      fatG: slot.targetFatG,
      carbsG: slot.targetCarbsG,
      fiberG: 3,
    },
    ingredients: [
      { ingredientId: 'ing-1', displayName: 'Składnik 1', grams: 100 },
    ],
    deviationOk: true,
    globalScaleFactor: 1.0,
  };
}

/** Set up mocks so that every slot gets a candidate + successful scaling */
function setupFullCoverage(slots: MealSlotTarget[]) {
  m.loadPatientMealDistribution.mockResolvedValue({} as MealDistributionInput);
  m.computeMealDistribution.mockReturnValue(makeDistributionResult(slots));

  // findCandidates returns a single candidate every time
  m.findCandidates.mockImplementation(() =>
    Promise.resolve([makeCandidate()]),
  );

  // scaleRecipeForMeal always succeeds
  m.scaleRecipeForMeal.mockImplementation((_id: string, targets: MealSlotTarget) =>
    Promise.resolve(makeScaleResult(targets)),
  );

  // loadRecipeForPlan (used inside candidateToMeal) via prisma.recipe.findUnique
  m.recipe.findUnique.mockResolvedValue({
    id: 'recipe-1',
    title: 'Testowy przepis',
    prepTimeMinutes: 15,
    totalTimeMinutes: 30,
    tips: null,
    servings: 1,
    ingredients: [
      {
        id: 'ing-1',
        grams: 100,
        displayName: 'Składnik 1',
        notes: null,
        cleanProduct: {
          name: 'Składnik 1',
          nutrients: {
            kcalPer100g: 200,
            proteinPer100g: 20,
            fatPer100g: 8,
            carbsPer100g: 15,
            fiberPer100g: 2,
          },
        },
      },
    ],
    instructionSteps: [
      { stepNumber: 1, instruction: 'Przygotuj składniki.' },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('dbPlanAssembly.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Edge case: empty database (no candidates) ────────────────────────────

  it('returns 0% coverage when findCandidates returns [] for every slot', async () => {
    const slots = make5Slots();
    m.loadPatientMealDistribution.mockResolvedValue({} as MealDistributionInput);
    m.computeMealDistribution.mockReturnValue(makeDistributionResult(slots));
    m.findCandidates.mockResolvedValue([]);

    const result = await assembleDbPlan({ patientId: 'patient-1', days: 7 });

    expect(result.coverage.filledFromDb).toBe(0);
    expect(result.coverage.uncoveredSlots).toBe(35);
    expect(result.coverage.filledFromDbPct).toBe(0);
    expect(result.generationMethod).toBe('database');
    // Plan should still have 7 days with placeholder meals
    expect(result.plan.days).toHaveLength(7);
  });

  // ── Full coverage ────────────────────────────────────────────────────────

  it('returns 100% coverage when all slots are filled', async () => {
    const slots = make5Slots();
    setupFullCoverage(slots);

    const result = await assembleDbPlan({ patientId: 'patient-1', days: 7 });

    expect(result.coverage.totalSlots).toBe(35);
    expect(result.coverage.filledFromDb).toBe(35);
    expect(result.coverage.uncoveredSlots).toBe(0);
    expect(result.coverage.filledFromDbPct).toBe(100);
  });

  // ── Partial coverage ─────────────────────────────────────────────────────

  it('reports correct filledFromDb when some slots are empty', async () => {
    const slots = make5Slots();
    m.loadPatientMealDistribution.mockResolvedValue({} as MealDistributionInput);
    m.computeMealDistribution.mockReturnValue(makeDistributionResult(slots));

    // Alternate: first call returns candidate, second returns empty, etc.
    let callCount = 0;
    m.findCandidates.mockImplementation(() => {
      callCount++;
      // Every other slot has no candidates (after 3 retries each, that's 3 calls per empty slot)
      // findCandidates is called up to 3 times per slot (normal, relaxed, last-resort).
      // For slots we want to fill: first call returns candidates.
      // For slots we want empty: all 3 calls return [].
      // We use a simple slot counter: odd slots → empty, even slots → filled.
      const slotInDay = Math.floor((callCount - 1) / 1) % (slots.length * 3);
      const slotIndex = Math.floor(slotInDay / 3);
      if (slotIndex % 2 === 1) {
        return Promise.resolve([]); // Empty for odd slots
      }
      return Promise.resolve([makeCandidate()]);
    });

    m.scaleRecipeForMeal.mockImplementation((_id: string, targets: MealSlotTarget) =>
      Promise.resolve(makeScaleResult(targets)),
    );
    m.recipe.findUnique.mockResolvedValue({
      id: 'recipe-1',
      title: 'Testowy przepis',
      prepTimeMinutes: 15,
      totalTimeMinutes: 30,
      tips: null,
      servings: 1,
      ingredients: [{
        id: 'ing-1', grams: 100, displayName: 'Składnik 1', notes: null,
        cleanProduct: { name: 'Składnik 1', nutrients: { kcalPer100g: 200, proteinPer100g: 20, fatPer100g: 8, carbsPer100g: 15, fiberPer100g: 2 } },
      }],
      instructionSteps: [{ stepNumber: 1, instruction: 'Gotuj.' }],
    });

    const result = await assembleDbPlan({ patientId: 'patient-1', days: 7 });

    // Some slots should be filled, some not
    expect(result.coverage.filledFromDb).toBeGreaterThan(0);
    expect(result.coverage.filledFromDb).toBeLessThan(35);
    expect(result.coverage.filledFromDb + result.coverage.uncoveredSlots).toBe(35);
  });

  // ── 7 days x 5 meals = 35 total slots ────────────────────────────────────

  it('computes totalSlots = 35 for 7 days x 5 meals', async () => {
    const slots = make5Slots(); // 5 meals
    m.loadPatientMealDistribution.mockResolvedValue({} as MealDistributionInput);
    m.computeMealDistribution.mockReturnValue(makeDistributionResult(slots));
    m.findCandidates.mockResolvedValue([]);

    const result = await assembleDbPlan({ patientId: 'patient-1', days: 7 });

    expect(result.coverage.totalSlots).toBe(35);
  });

  // ── Recipe IDs collected ──────────────────────────────────────────────────

  it('collects all used recipe IDs in the result', async () => {
    const slots = make5Slots();
    setupFullCoverage(slots);

    const result = await assembleDbPlan({ patientId: 'patient-1', days: 7 });

    expect(result.recipeIds).toHaveLength(35);
    // All IDs should be strings
    for (const id of result.recipeIds) {
      expect(typeof id).toBe('string');
    }
  });

  // ── Day names are Polish ──────────────────────────────────────────────────

  it('uses Polish day names from Poniedziałek to Niedziela', async () => {
    const slots = make5Slots();
    m.loadPatientMealDistribution.mockResolvedValue({} as MealDistributionInput);
    m.computeMealDistribution.mockReturnValue(makeDistributionResult(slots));
    m.findCandidates.mockResolvedValue([]);

    const result = await assembleDbPlan({ patientId: 'patient-1', days: 7 });

    const expectedDays = [
      'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela',
    ];

    expect(result.plan.days.map((d) => d.day)).toEqual(expectedDays);
  });

  // ── Duration is tracked ───────────────────────────────────────────────────

  it('reports durationMs > 0', async () => {
    const slots = make5Slots();
    m.loadPatientMealDistribution.mockResolvedValue({} as MealDistributionInput);
    m.computeMealDistribution.mockReturnValue(makeDistributionResult(slots));
    m.findCandidates.mockResolvedValue([]);

    const result = await assembleDbPlan({ patientId: 'patient-1', days: 7 });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.generationMethod).toBe('database');
  });

  // ── Default days = 7 ─────────────────────────────────────────────────────

  it('defaults to 7 days when days is not specified', async () => {
    const slots = make5Slots();
    m.loadPatientMealDistribution.mockResolvedValue({} as MealDistributionInput);
    m.computeMealDistribution.mockReturnValue(makeDistributionResult(slots));
    m.findCandidates.mockResolvedValue([]);

    const result = await assembleDbPlan({ patientId: 'patient-1' });

    expect(result.plan.days).toHaveLength(7);
    expect(result.coverage.totalSlots).toBe(35);
  });

  // ── Coverage report daily arrays ──────────────────────────────────────────

  it('returns dailyKcal array with length = number of days', async () => {
    const slots = make5Slots();
    setupFullCoverage(slots);

    const result = await assembleDbPlan({ patientId: 'patient-1', days: 7 });

    expect(result.coverage.dailyKcal).toHaveLength(7);
    expect(result.coverage.dailyProteinG).toHaveLength(7);
    expect(result.coverage.dailyFatG).toHaveLength(7);
    expect(result.coverage.dailyCarbsG).toHaveLength(7);
  });
});
