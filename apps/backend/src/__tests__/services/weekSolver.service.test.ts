/**
 * Unit tests for weekSolver.service.ts
 *
 * Tests cover:
 *   - callSolver (indirectly via solveWeekPlan — callSolver is private)
 *   - getProteinSource / getCategoryTag (indirectly via solver payload)
 *   - assembleSolverPlan
 *   - Fallback / error status propagation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@db', () => ({
  prisma: {
    dietitianProfile: { findUnique: vi.fn().mockResolvedValue(null) },
    recipeIngredient: { findMany: vi.fn().mockResolvedValue([]) },
    recipeRating: { findMany: vi.fn().mockResolvedValue([]) },
    recipeAllergen: { findMany: vi.fn().mockResolvedValue([]) },
    recipe: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../../services/recipeCandidate.service', () => ({
  findCandidates: vi.fn(),
}));

vi.mock('../../services/mealDistribution.service', () => ({
  loadPatientMealDistribution: vi.fn(),
  computeMealDistribution: vi.fn(),
}));

vi.mock('../../services/recipeScaler.service', () => ({
  scaleRecipeForMeal: vi.fn(),
  // Faza D Phase 1 W2-Mon-B: mocked since assembleSolverPlan dispatches to
  // it for multi-element selections. Tests below set single-element arrays
  // so this mock isn't actually invoked unless explicitly seeded.
  scaleMealComposition: vi.fn(),
}));

// Mock global fetch (callSolver uses native fetch, not axios)
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { solveWeekPlan, assembleSolverPlan } from '../../services/weekSolver.service';
import { findCandidates } from '../../services/recipeCandidate.service';
import {
  loadPatientMealDistribution,
  computeMealDistribution,
} from '../../services/mealDistribution.service';
import { scaleRecipeForMeal } from '../../services/recipeScaler.service';
import { prisma } from '@db';

// ─── Constants ──────────────────────────────────────────────────────────────

const NUM_SLOTS = 5;
const NUM_DAYS = 7;
const TOTAL_SELECTIONS = NUM_SLOTS * NUM_DAYS; // 35

const SLOT_DEFS = [
  { slotIndex: 0, mealName: 'Śniadanie',        mealType: 'BREAKFAST',        pctOfDaily: 20, targetKcal: 400, targetProteinG: 20, targetFatG: 15, targetCarbsG: 50 },
  { slotIndex: 1, mealName: 'II Śniadanie',     mealType: 'SECOND_BREAKFAST', pctOfDaily: 10, targetKcal: 200, targetProteinG: 10, targetFatG: 8,  targetCarbsG: 25 },
  { slotIndex: 2, mealName: 'Obiad',             mealType: 'LUNCH',            pctOfDaily: 30, targetKcal: 600, targetProteinG: 35, targetFatG: 20, targetCarbsG: 65 },
  { slotIndex: 3, mealName: 'Podwieczorek',      mealType: 'SNACK',            pctOfDaily: 10, targetKcal: 200, targetProteinG: 10, targetFatG: 8,  targetCarbsG: 25 },
  { slotIndex: 4, mealName: 'Kolacja',           mealType: 'DINNER',           pctOfDaily: 25, targetKcal: 500, targetProteinG: 25, targetFatG: 18, targetCarbsG: 55 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    recipeId: 'r_default_1',
    title: 'Default Recipe',
    category: 'LUNCH',
    mealType: 'LUNCH',
    cuisineType: null,
    kcal: 500,
    proteinG: 30,
    fatG: 15,
    carbsG: 50,
    fiberG: 6,
    scaleFactor: 1.0,
    scaledKcal: 500,
    scaledProteinG: 30,
    scaledFatG: 15,
    scaledCarbsG: 50,
    nutritionFitScore: 80,
    qualityScore: 70,
    patientRatingScore: 50,
    cuisineScore: 60,
    seasonScore: 65,
    diversityScore: 70,
    costScore: 50,
    microFitScore: 60,
    practicalFitScore: 70,
    satietyProxyScore: 55,
    interactionScore: 50,
    complianceScore: 60,
    totalScore: 70,
    totalTimeMinutes: 30,
    difficulty: 'EASY',
    servings: 2,
    tags: [] as string[],
    mealPrepFriendly: false,
    sodiumMg: 300,
    ironMg: 2,
    calciumMg: 100,
    vitaminDUg: 2,
    folateUg: 60,
    vitaminB12Ug: 0.5,
    zincMg: 1.5,
    vitaminCMg: 15,
    cookingMethod: null,
    magnesiumMg: 30,
    potassiumMg: 200,
    vitaminAUg: 50,
    vitaminKUg: 10,
    omega3G: 0.3,
    seleniumUg: 5,
    iodineUg: 10,
    phosphorusMg: 100,
    // Faza D Phase 1: composition flags surfaced from Recipe DB
    dishCompleteness: null as 'COMPLETE_MEAL' | 'MAIN_DISH' | 'CARB_SIDE' | 'VEG_SIDE' | 'COMPONENT' | null,
    containsVegetableServing: false,
    ...overrides,
  };
}

function makeAssemblyInput(overrides: Record<string, unknown> = {}) {
  return {
    patientId: 'patient_test_1',
    days: NUM_DAYS,
    ...overrides,
  };
}

function makeSolverResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 'OPTIMAL',
    selections: [{ day_index: 0, slot_index: 0, recipe_id: 'r1', candidate_id: 'd0_s0_r_defaul' }],
    objective_value: 1000,
    total_variables: 875,
    total_constraints: 400,
    duration_ms: 500,
    seed_used: 42,
    infeasibility_reasons: [],
    ...overrides,
  };
}

/** Generate 35 selections covering all day/slot combos */
function makeFullSelections() {
  const selections = [];
  for (let d = 0; d < NUM_DAYS; d++) {
    for (let s = 0; s < NUM_SLOTS; s++) {
      const shortId = `r_s${s}`.slice(-8);
      selections.push({
        day_index: d,
        slot_index: s,
        recipe_id: `r_s${s}`,
        candidate_id: `d${d}_s${s}_r${shortId}`,
      });
    }
  }
  return selections;
}

/** Set up mocks that allow solveWeekPlan to reach the fetch call */
function setupStandardMocks(candidateOverrides: Record<string, unknown> = {}) {
  vi.mocked(loadPatientMealDistribution).mockResolvedValue({
    dailyTargets: { targetKcal: 2000, targetProteinG: 100, targetFatG: 70, targetCarbsG: 220 },
    mealsPerDay: NUM_SLOTS,
  });
  vi.mocked(computeMealDistribution).mockReturnValue({
    slots: SLOT_DEFS,
    totalKcal: 2000,
    totalProteinG: 100,
    totalFatG: 70,
    totalCarbsG: 220,
  });

  // findCandidates returns enough candidates for each slot
  const candidates = Array.from({ length: 10 }, (_, k) =>
    makeCandidate({ recipeId: `r_k${k}`, title: `Recipe ${k}`, ...candidateOverrides }),
  );
  vi.mocked(findCandidates).mockResolvedValue(candidates);
}

/** Mock fetch to return a solver response */
function mockFetchSolverResponse(responseOverrides: Record<string, unknown> = {}) {
  const body = makeSolverResponse(responseOverrides);
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

/** Extract the solver payload body that was sent to fetch */
function extractSolverPayload(): Record<string, unknown> | null {
  if (mockFetch.mock.calls.length === 0) return null;
  const [, init] = mockFetch.mock.calls[0];
  return JSON.parse(init.body as string);
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── callSolver (via solveWeekPlan) ─────────────────────────────────────────

describe('callSolver', () => {
  it('calls fetch with correct URL and method', async () => {
    setupStandardMocks();
    mockFetchSolverResponse({ selections: makeFullSelections() });

    await solveWeekPlan(makeAssemblyInput());

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/solve');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('sends candidates and targets in payload', async () => {
    setupStandardMocks();
    mockFetchSolverResponse({ selections: makeFullSelections() });

    await solveWeekPlan(makeAssemblyInput());

    const payload = extractSolverPayload()!;
    expect(payload).not.toBeNull();
    expect((payload.candidates as unknown[]).length).toBeGreaterThan(0);
    expect(payload.daily_target_kcal).toBeGreaterThan(0);
    expect((payload.slots as unknown[]).length).toBe(NUM_SLOTS);
    expect(payload.num_days).toBe(NUM_DAYS);
  });

  it('returns ERROR status on fetch abort (timeout)', async () => {
    setupStandardMocks();
    mockFetch.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    const result = await solveWeekPlan(makeAssemblyInput());

    expect(result.status).toBe('ERROR');
    expect(result.selections.size).toBe(0);
  });

  it('returns ERROR status on HTTP error', async () => {
    setupStandardMocks();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    });

    const result = await solveWeekPlan(makeAssemblyInput());

    expect(result.status).toBe('ERROR');
    expect(result.selections.size).toBe(0);
  });

  it('propagates INFEASIBLE status from solver', async () => {
    setupStandardMocks();
    mockFetchSolverResponse({
      status: 'INFEASIBLE',
      selections: [],
      infeasibility_reasons: [
        { constraint: 'SLOT_EMPTY', description: 'test', suggestion: 'test', severity: 'HARD' },
      ],
    });

    const result = await solveWeekPlan(makeAssemblyInput());

    expect(result.status).toBe('INFEASIBLE');
    expect(result.selections.size).toBe(0);
  });

  it('returns OPTIMAL with correct selections map', async () => {
    setupStandardMocks();

    // Need unique candidates per slot so recipeMap resolves all 35
    const perSlotCandidates: Record<number, ReturnType<typeof makeCandidate>[]> = {};
    for (let s = 0; s < NUM_SLOTS; s++) {
      perSlotCandidates[s] = Array.from({ length: 10 }, (_, k) =>
        makeCandidate({ recipeId: `r_s${s}_k${k}`, title: `Recipe s${s} k${k}` }),
      );
    }
    let callIndex = 0;
    vi.mocked(findCandidates).mockImplementation(async () => {
      const slotIdx = callIndex % NUM_SLOTS;
      callIndex++;
      return perSlotCandidates[slotIdx];
    });

    // Build selections that match the candidate_id format from weekSolver
    const selections = [];
    for (let d = 0; d < NUM_DAYS; d++) {
      for (let s = 0; s < NUM_SLOTS; s++) {
        const recipeId = `r_s${s}_k0`;
        const shortId = recipeId.slice(-8);
        selections.push({
          day_index: d,
          slot_index: s,
          recipe_id: recipeId,
          candidate_id: `d${d}_s${s}_main_r${shortId}`,
        });
      }
    }
    mockFetchSolverResponse({ status: 'OPTIMAL', selections });

    const result = await solveWeekPlan(makeAssemblyInput());

    expect(result.status).toBe('OPTIMAL');
    expect(result.selections.size).toBe(TOTAL_SELECTIONS);
  });
});

// ─── getProteinSource (indirect via solver payload) ─────────────────────────
// NEEDS_EXPORT: getProteinSource — tested indirectly via payload sent to fetch

describe('getProteinSource (via payload)', () => {
  it('detects Polish protein sources from title', async () => {
    const testCases = [
      { title: 'Kurczak z warzywami',       expected: 'poultry' },
      { title: 'Łosoś pieczony',            expected: 'fish' },
      // P-3: egg/legume (singular) to match scraper/utils/proteinSource.ts taxonomy
      { title: 'Jajecznica na maśle',        expected: 'egg' },
      { title: 'Tofu stir-fry',              expected: 'tofu' },
      { title: 'Soczewica curry',            expected: 'legume' },
      { title: 'Jogurt grecki z owocami',    expected: 'dairy' },
    ];

    // One candidate per test case, all assigned to slot 0
    const candidates = testCases.map((tc, k) =>
      makeCandidate({ recipeId: `r_prot_${k}`, title: tc.title }),
    );

    setupStandardMocks();
    vi.mocked(findCandidates).mockResolvedValue(candidates);
    mockFetchSolverResponse({ selections: [] });

    await solveWeekPlan(makeAssemblyInput());

    const payload = extractSolverPayload()!;
    const sent = payload.candidates as Array<{ title: string; protein_source: string | null }>;

    for (const tc of testCases) {
      const match = sent.find((c) => c.title === tc.title);
      expect(match, `Candidate "${tc.title}" not found in payload`).toBeDefined();
      expect(match!.protein_source).toBe(tc.expected);
    }
  });

  it('returns null for title with no protein match', async () => {
    setupStandardMocks({ title: 'Sałatka owocowa', tags: [] });
    mockFetchSolverResponse({ selections: [] });

    await solveWeekPlan(makeAssemblyInput());

    const payload = extractSolverPayload()!;
    const sent = payload.candidates as Array<{ protein_source: string | null }>;
    // All candidates have title "Sałatka owocowa" — none should match a protein source
    for (const c of sent) {
      expect(c.protein_source).toBeNull();
    }
  });

  it('detects protein source from tags, not only title', async () => {
    const candidate = makeCandidate({
      recipeId: 'r_tags_test',
      title: 'Miseczka mocy',
      tags: ['kurczak', 'ryż'],
    });

    setupStandardMocks();
    vi.mocked(findCandidates).mockResolvedValue([candidate]);
    mockFetchSolverResponse({ selections: [] });

    await solveWeekPlan(makeAssemblyInput());

    const payload = extractSolverPayload()!;
    const sent = payload.candidates as Array<{ title: string; protein_source: string | null }>;
    const match = sent.find((c) => c.title === 'Miseczka mocy');
    expect(match).toBeDefined();
    expect(match!.protein_source).toBe('poultry');
  });
});

// ─── getCategoryTag (indirect via solver payload) ───────────────────────────
// NEEDS_EXPORT: getCategoryTag — tested indirectly via payload sent to fetch

describe('getCategoryTag (via payload)', () => {
  it('detects oatmeal category', async () => {
    const candidate = makeCandidate({
      recipeId: 'r_oatmeal',
      title: 'Owsianka z bananem',
    });

    setupStandardMocks();
    vi.mocked(findCandidates).mockResolvedValue([candidate]);
    mockFetchSolverResponse({ selections: [] });

    await solveWeekPlan(makeAssemblyInput());

    const payload = extractSolverPayload()!;
    const sent = payload.candidates as Array<{ category_tag: string | null }>;
    const match = sent.find((c: Record<string, unknown>) => c.title === 'Owsianka z bananem');
    expect(match).toBeDefined();
    expect(match!.category_tag).toBe('oatmeal');
  });

  it('detects salad category', async () => {
    const candidate = makeCandidate({
      recipeId: 'r_salad',
      title: 'Sałatka grecka',
    });

    setupStandardMocks();
    vi.mocked(findCandidates).mockResolvedValue([candidate]);
    mockFetchSolverResponse({ selections: [] });

    await solveWeekPlan(makeAssemblyInput());

    const payload = extractSolverPayload()!;
    const sent = payload.candidates as Array<{ category_tag: string | null }>;
    const match = sent.find((c: Record<string, unknown>) => c.title === 'Sałatka grecka');
    expect(match).toBeDefined();
    expect(match!.category_tag).toBe('salad');
  });

  it('returns null for unknown category', async () => {
    const candidate = makeCandidate({
      recipeId: 'r_stew',
      title: 'Gulasz wołowy',
      category: 'STEW',
    });

    setupStandardMocks();
    vi.mocked(findCandidates).mockResolvedValue([candidate]);
    mockFetchSolverResponse({ selections: [] });

    await solveWeekPlan(makeAssemblyInput());

    const payload = extractSolverPayload()!;
    const sent = payload.candidates as Array<{ category_tag: string | null }>;
    const match = sent.find((c: Record<string, unknown>) => c.title === 'Gulasz wołowy');
    expect(match).toBeDefined();
    expect(match!.category_tag).toBeNull();
  });
});

// ─── assembleSolverPlan ─────────────────────────────────────────────────────

describe('assembleSolverPlan', () => {
  function setupAssemblyMocks() {
    vi.mocked(loadPatientMealDistribution).mockResolvedValue({
      dailyTargets: { targetKcal: 2000, targetProteinG: 100, targetFatG: 70, targetCarbsG: 220 },
      mealsPerDay: NUM_SLOTS,
    });
    vi.mocked(computeMealDistribution).mockReturnValue({
      slots: SLOT_DEFS,
      totalKcal: 2000,
      totalProteinG: 100,
      totalFatG: 70,
      totalCarbsG: 220,
    });
    vi.mocked(scaleRecipeForMeal).mockResolvedValue({
      scaledNutrition: { kcal: 500, proteinG: 30, fatG: 15, carbsG: 50, fiberG: 6 },
      ingredients: [
        { ingredientId: 'ing1', displayName: 'Chicken breast', grams: 150 },
        { ingredientId: 'ing2', displayName: 'Rice', grams: 100 },
      ],
      deviationOk: true,
      globalScaleFactor: 1.2,
    });
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      title: 'Test Recipe',
      prepTimeMinutes: 20,
      tips: 'Serve warm',
      instructionSteps: [
        { instruction: 'Step 1: Prepare ingredients' },
        { instruction: 'Step 2: Cook' },
      ],
    } as never);
    // Faza D Phase 1 W2-Mon-B: assembleSolverPlan now batch-loads via findMany.
    // Return one row per requested id so the per-item title/steps lookup works
    // for every recipeId in selections.
    vi.mocked(prisma.recipe.findMany as unknown as (args: { where?: { id?: { in?: string[] } } }) => Promise<unknown[]>)
      .mockImplementation(async (args) => {
        const ids = args?.where?.id?.in ?? [];
        return ids.map((id) => ({
          id,
          title: `Test Recipe ${id}`,
          servings: 2,
          prepTimeMinutes: 20,
          tips: 'Serve warm',
          instructionSteps: [
            { instruction: 'Step 1: Prepare ingredients' },
            { instruction: 'Step 2: Cook' },
          ],
          ingredients: [],
        }));
      });
  }

  function makeSolverResult(): import('../../services/weekSolver.service').SolverResult {
    const selections = new Map<string, ReturnType<typeof makeCandidate>[]>();
    for (let d = 0; d < NUM_DAYS; d++) {
      for (let s = 0; s < NUM_SLOTS; s++) {
        const key = `${d}:${s}`;
        // Faza D Phase 1 W2-Mon-B: SolverResult.selections is now Map<key, ScoredRecipeCandidate[]>.
        // Single-element arrays exercise the legacy scaleRecipeForMeal path.
        selections.set(key, [makeCandidate({
          recipeId: `r_d${d}_s${s}`,
          title: `Recipe d${d} s${s}`,
        })]);
      }
    }
    return {
      status: 'OPTIMAL',
      selections,
      objectiveValue: 1000,
      totalVariables: 875,
      totalConstraints: 400,
      durationMs: 500,
      seedUsed: 42,
    };
  }

  it('assembles correct number of days', async () => {
    setupAssemblyMocks();
    const result = await assembleSolverPlan(makeSolverResult(), makeAssemblyInput());

    expect(result.plan.days).toHaveLength(NUM_DAYS);
  });

  it('each day has correct number of meals', async () => {
    setupAssemblyMocks();
    const result = await assembleSolverPlan(makeSolverResult(), makeAssemblyInput());

    for (const day of result.plan.days) {
      expect(day.meals).toHaveLength(NUM_SLOTS);
    }
  });

  it('fetches recipe from DB for each selection', async () => {
    setupAssemblyMocks();
    await assembleSolverPlan(makeSolverResult(), makeAssemblyInput());

    // Faza D Phase 1 W2-Mon-B: assembleSolverPlan batch-loads recipe rows
    // once per slot (covering all selected items). 35 slots × 1 findMany.
    expect(prisma.recipe.findMany).toHaveBeenCalledTimes(TOTAL_SELECTIONS);
  });

  it('calls scaleRecipeForMeal for each meal', async () => {
    setupAssemblyMocks();
    await assembleSolverPlan(makeSolverResult(), makeAssemblyInput());

    expect(scaleRecipeForMeal).toHaveBeenCalledTimes(TOTAL_SELECTIONS);
  });

  it('coverage report contains diversityScore between 0 and 1', async () => {
    setupAssemblyMocks();
    const result = await assembleSolverPlan(makeSolverResult(), makeAssemblyInput());

    expect(result.coverage.diversityScore).toBeGreaterThanOrEqual(0);
    expect(result.coverage.diversityScore).toBeLessThanOrEqual(1);
  });

  it('generationMethod is database', async () => {
    setupAssemblyMocks();
    const result = await assembleSolverPlan(makeSolverResult(), makeAssemblyInput());

    expect(result.generationMethod).toBe('database');
  });

  it('populates slotDecisions for every slot', async () => {
    setupAssemblyMocks();
    const result = await assembleSolverPlan(makeSolverResult(), makeAssemblyInput());

    expect(result.slotDecisions).toHaveLength(TOTAL_SELECTIONS);
    // Each decision includes the SOLVER_SELECTED rule
    for (const decision of result.slotDecisions) {
      expect(decision.rulesApplied).toContain('SOLVER_SELECTED');
    }
  });

  it('handles missing recipe in selections gracefully', async () => {
    setupAssemblyMocks();

    // Partial selections — only day 0. SolverResult.selections is Map<key, ScoredRecipeCandidate[]>.
    const selections = new Map<string, ReturnType<typeof makeCandidate>[]>();
    for (let s = 0; s < NUM_SLOTS; s++) {
      selections.set(`0:${s}`, [makeCandidate({ recipeId: `r_s${s}` })]);
    }
    const partialResult = {
      status: 'OPTIMAL' as const,
      selections,
      objectiveValue: 500,
      totalVariables: 875,
      totalConstraints: 400,
      durationMs: 300,
    };

    const result = await assembleSolverPlan(partialResult, makeAssemblyInput());

    // Should still produce 7 days, unfilled slots get placeholder meals
    expect(result.plan.days).toHaveLength(NUM_DAYS);
    // Day 0 should have real meals
    expect(result.plan.days[0].meals[0].name).not.toContain('Brak przepisu');
    // Day 1+ unfilled slots should have placeholder names
    expect(result.plan.days[1].meals[0].name).toContain('Brak przepisu');
  });

  it('includes dailyKcal in coverage report', async () => {
    setupAssemblyMocks();
    const result = await assembleSolverPlan(makeSolverResult(), makeAssemblyInput());

    expect(result.coverage.dailyKcal).toHaveLength(NUM_DAYS);
    for (const kcal of result.coverage.dailyKcal) {
      expect(kcal).toBeGreaterThan(0);
    }
  });
});

// ─── Fallback behavior ──────────────────────────────────────────────────────

describe('fallback behavior', () => {
  it.each(['ERROR', 'INFEASIBLE', 'TIMEOUT'] as const)(
    'status %s does not throw — returns result object',
    async (status) => {
      setupStandardMocks();

      if (status === 'ERROR') {
        mockFetch.mockRejectedValue(new Error('Network failure'));
      } else {
        mockFetchSolverResponse({ status, selections: [] });
      }

      const result = await solveWeekPlan(makeAssemblyInput());

      expect(result).toBeDefined();
      expect(result.status).toBe(status);
      expect(result.selections.size).toBe(0);
    },
  );

  it('FEASIBLE status is accepted as valid with selections', async () => {
    setupStandardMocks();

    // Need candidates that match the candidate_id format
    let callIndex = 0;
    const perSlotCandidates: Record<number, ReturnType<typeof makeCandidate>[]> = {};
    for (let s = 0; s < NUM_SLOTS; s++) {
      perSlotCandidates[s] = Array.from({ length: 10 }, (_, k) =>
        makeCandidate({ recipeId: `r_s${s}_k${k}`, title: `Recipe s${s} k${k}` }),
      );
    }
    vi.mocked(findCandidates).mockImplementation(async () => {
      const slotIdx = callIndex % NUM_SLOTS;
      callIndex++;
      return perSlotCandidates[slotIdx];
    });

    const selections = [];
    for (let d = 0; d < NUM_DAYS; d++) {
      for (let s = 0; s < NUM_SLOTS; s++) {
        const recipeId = `r_s${s}_k0`;
        const shortId = recipeId.slice(-8);
        selections.push({
          day_index: d,
          slot_index: s,
          recipe_id: recipeId,
          candidate_id: `d${d}_s${s}_main_r${shortId}`,
        });
      }
    }
    mockFetchSolverResponse({ status: 'FEASIBLE', selections });

    const result = await solveWeekPlan(makeAssemblyInput());

    expect(result.status).toBe('FEASIBLE');
    expect(result.selections.size).toBe(TOTAL_SELECTIONS);
  });

  it('returns INFEASIBLE when no candidates found for a slot', async () => {
    vi.mocked(loadPatientMealDistribution).mockResolvedValue({
      dailyTargets: { targetKcal: 2000, targetProteinG: 100, targetFatG: 70, targetCarbsG: 220 },
      mealsPerDay: NUM_SLOTS,
    });
    vi.mocked(computeMealDistribution).mockReturnValue({
      slots: SLOT_DEFS,
      totalKcal: 2000,
      totalProteinG: 100,
      totalFatG: 70,
      totalCarbsG: 220,
    });
    // First slot returns empty, all others return candidates
    let callCount = 0;
    vi.mocked(findCandidates).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return []; // empty for first slot
      return [makeCandidate()];
    });

    const result = await solveWeekPlan(makeAssemblyInput());

    expect(result.status).toBe('INFEASIBLE');
    // fetch should NOT have been called (early return before solver call)
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
