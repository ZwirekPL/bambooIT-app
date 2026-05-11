import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  recipe: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('@db', () => ({
  prisma: {
    recipe: m.recipe,
    appSettings: { findUnique: vi.fn().mockResolvedValue(null) },
  },
  Prisma: {
    Decimal: class {
      private v: number;
      constructor(v: number) { this.v = v; }
      toString() { return String(this.v); }
    },
  },
}));

import {
  findCandidates,
  computeScaledNutrition,
  type RecipeCandidateQuery,
} from '../../services/recipeCandidate.service';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a raw recipe candidate as returned by Prisma (before scoring). */
function makeRawCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    title: 'Test Recipe',
    category: 'MAIN',
    mealType: 'LUNCH',
    cuisineType: 'POLISH',
    qualityScore: 80,
    averageRating: null,
    ratingCount: 0,
    totalTimeMinutes: 30,
    difficulty: 'EASY',
    servings: 2,
    tags: [],
    mealPrepFriendly: false,
    seasons: [],
    estimatedCost: 'STANDARD',
    nutritionSnapshot: {
      kcal: 500,
      protein_g: 30,
      fat_g: 20,
      carbs_g: 50,
      fiber_g: 5,
    },
    ...overrides,
  };
}

function makeBaseQuery(overrides: Partial<RecipeCandidateQuery> = {}): RecipeCandidateQuery {
  return {
    mealType: 'LUNCH',
    targetKcal: 500,
    targetProteinG: 30,
    targetFatG: 20,
    targetCarbsG: 50,
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('recipeCandidate.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── findCandidates ──────────────────────────────────────────────────────────

  describe('findCandidates', () => {
    it('returns candidates sorted by totalScore descending', async () => {
      // Arrange: 3 recipes with different quality scores → different total scores
      const recipes = [
        makeRawCandidate({ id: 'rec-low', qualityScore: 20 }),
        makeRawCandidate({ id: 'rec-high', qualityScore: 95 }),
        makeRawCandidate({ id: 'rec-mid', qualityScore: 60 }),
      ];
      m.recipe.findMany.mockResolvedValue(recipes);

      // Act
      const result = await findCandidates(makeBaseQuery());

      // Assert: sorted by totalScore desc
      expect(result).toHaveLength(3);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].totalScore).toBeGreaterThanOrEqual(result[i].totalScore);
      }
      // The highest quality recipe should be first
      expect(result[0].recipeId).toBe('rec-high');
    });

    it('passes excludeRecipeIds filter to Prisma query', async () => {
      m.recipe.findMany.mockResolvedValue([]);

      const excludeIds = ['rec-exclude-1', 'rec-exclude-2'];
      await findCandidates(makeBaseQuery({ excludeRecipeIds: excludeIds }));

      // Verify findMany was called with AND conditions containing notIn
      const call = m.recipe.findMany.mock.calls[0][0];
      const andConditions = call.where.AND as Array<Record<string, unknown>>;
      const excludeCondition = andConditions.find(
        (c: Record<string, unknown>) => c.id && typeof c.id === 'object' && 'notIn' in (c.id as Record<string, unknown>),
      );
      expect(excludeCondition).toBeDefined();
      expect((excludeCondition!.id as { notIn: string[] }).notIn).toEqual(excludeIds);
    });

    it('requires nutrition snapshot with kcal > 0 (no kcal range filter)', async () => {
      m.recipe.findMany.mockResolvedValue([]);

      await findCandidates(makeBaseQuery({ targetKcal: 600 }));

      const call = m.recipe.findMany.mock.calls[0][0];
      const andConditions = call.where.AND as Array<Record<string, unknown>>;

      // Find the nutritionSnapshot condition — should require kcal > 0, no range filter
      const snapCondition = andConditions.find(
        (c: Record<string, unknown>) =>
          c.nutritionSnapshot &&
          typeof c.nutritionSnapshot === 'object' &&
          'is' in (c.nutritionSnapshot as Record<string, unknown>),
      );
      expect(snapCondition).toBeDefined();
    });

    it('returns empty array when no recipes match', async () => {
      m.recipe.findMany.mockResolvedValue([]);

      const result = await findCandidates(makeBaseQuery());

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('throws AppError when targetKcal <= 0', async () => {
      await expect(
        findCandidates(makeBaseQuery({ targetKcal: 0 })),
      ).rejects.toThrow('targetKcal must be > 0');

      await expect(
        findCandidates(makeBaseQuery({ targetKcal: -100 })),
      ).rejects.toThrow('targetKcal must be > 0');
    });

    it('computes scaleFactor as targetKcal / recipeKcal', async () => {
      const recipeKcal = 400;
      const targetKcal = 600;
      const recipe = makeRawCandidate({
        id: 'rec-scale',
        nutritionSnapshot: {
          kcal: recipeKcal,
          protein_g: 25,
          fat_g: 15,
          carbs_g: 45,
          fiber_g: 3,
        },
      });
      m.recipe.findMany.mockResolvedValue([recipe]);

      const result = await findCandidates(makeBaseQuery({ targetKcal }));

      expect(result).toHaveLength(1);
      const expectedScale = targetKcal / recipeKcal; // 1.5
      expect(result[0].scaleFactor).toBeCloseTo(expectedScale, 2);
    });

    it('clamps scaleFactor to [0.5, 3.0]', async () => {
      // Recipe with very high kcal → raw scale < 0.5 → should clamp to 0.5
      const highKcalRecipe = makeRawCandidate({
        id: 'rec-high-kcal',
        nutritionSnapshot: {
          kcal: 2000, // target 500 → raw scale 0.25 → clamped to 0.5
          protein_g: 80,
          fat_g: 60,
          carbs_g: 200,
          fiber_g: 10,
        },
      });
      // Recipe with very low kcal → raw scale > 3.0 → should clamp to 3.0
      const lowKcalRecipe = makeRawCandidate({
        id: 'rec-low-kcal',
        nutritionSnapshot: {
          kcal: 100, // target 500 → raw scale 5.0 → clamped to 3.0
          protein_g: 5,
          fat_g: 3,
          carbs_g: 15,
          fiber_g: 1,
        },
      });
      m.recipe.findMany.mockResolvedValue([highKcalRecipe, lowKcalRecipe]);

      const result = await findCandidates(makeBaseQuery({ targetKcal: 500 }));

      const high = result.find((r) => r.recipeId === 'rec-high-kcal');
      const low = result.find((r) => r.recipeId === 'rec-low-kcal');

      expect(high).toBeDefined();
      expect(high!.scaleFactor).toBe(0.5);

      expect(low).toBeDefined();
      expect(low!.scaleFactor).toBe(3.0);
    });
  });

  // ── computeScaledNutrition ──────────────────────────────────────────────────

  describe('computeScaledNutrition', () => {
    it('scales ingredients and computes nutrition totals', async () => {
      m.recipe.findUnique.mockResolvedValue({
        id: 'rec-1',
        ingredients: [
          {
            id: 'ing-1',
            grams: 200,
            displayName: 'Chicken breast',
            retentionFactor: 1.0,
            cleanProduct: {
              nutrients: {
                kcalPer100g: 165,
                proteinPer100g: 31,
                fatPer100g: 3.6,
                carbsPer100g: 0,
                fiberPer100g: 0,
              },
            },
          },
          {
            id: 'ing-2',
            grams: 150,
            displayName: 'Brown rice',
            retentionFactor: 1.0,
            cleanProduct: {
              nutrients: {
                kcalPer100g: 112,
                proteinPer100g: 2.3,
                fatPer100g: 0.8,
                carbsPer100g: 24,
                fiberPer100g: 1.8,
              },
            },
          },
        ],
      });

      const result = await computeScaledNutrition('rec-1', 1.5);

      // Scale factor should be clamped to [0.5, 2.0] → 1.5 is within range
      expect(result.scaleFactor).toBe(1.5);
      expect(result.ingredients).toHaveLength(2);

      // Ingredient grams should be scaled
      expect(result.ingredients[0].originalGrams).toBe(200);
      expect(result.ingredients[0].scaledGrams).toBe(300); // 200 * 1.5
      expect(result.ingredients[1].originalGrams).toBe(150);
      expect(result.ingredients[1].scaledGrams).toBe(225); // 150 * 1.5

      // Nutrition totals: sum of (scaledGrams/100 * per100g) for each ingredient
      // Chicken: 300/100 * 165 = 495 kcal, Rice: 225/100 * 112 = 252 kcal
      expect(result.kcal).toBeCloseTo(747, 0);
      expect(result.proteinG).toBeCloseTo(3 * 31 + 2.25 * 2.3, 0);
    });

    it('clamps extreme scale factors', async () => {
      m.recipe.findUnique.mockResolvedValue({
        id: 'rec-1',
        ingredients: [
          {
            id: 'ing-1',
            grams: 100,
            displayName: 'Test',
            retentionFactor: 1.0,
            cleanProduct: {
              nutrients: {
                kcalPer100g: 100,
                proteinPer100g: 10,
                fatPer100g: 5,
                carbsPer100g: 15,
                fiberPer100g: 2,
              },
            },
          },
        ],
      });

      // Scale factor 5.0 → clamped to 3.0 (MAX_SCALE_FACTOR)
      const result = await computeScaledNutrition('rec-1', 5.0);
      expect(result.scaleFactor).toBe(3.0);
      expect(result.ingredients[0].scaledGrams).toBe(300); // 100 * 3.0

      // Scale factor 0.1 → clamped to 0.5
      const result2 = await computeScaledNutrition('rec-1', 0.1);
      expect(result2.scaleFactor).toBe(0.5);
      expect(result2.ingredients[0].scaledGrams).toBe(50); // 100 * 0.5
    });

    it('throws when recipe not found', async () => {
      m.recipe.findUnique.mockResolvedValue(null);

      await expect(
        computeScaledNutrition('non-existent', 1.0),
      ).rejects.toThrow('not found');
    });

    it('handles ingredient without cleanProduct nutrients', async () => {
      m.recipe.findUnique.mockResolvedValue({
        id: 'rec-1',
        ingredients: [
          {
            id: 'ing-1',
            grams: 100,
            displayName: 'Salt',
            retentionFactor: 1.0,
            cleanProduct: null, // no linked clean product
          },
        ],
      });

      const result = await computeScaledNutrition('rec-1', 1.0);

      expect(result.kcal).toBe(0);
      expect(result.proteinG).toBe(0);
      expect(result.ingredients).toHaveLength(1);
      expect(result.ingredients[0].scaledGrams).toBe(100);
    });
  });
});
