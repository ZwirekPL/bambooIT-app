import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  recipe: { findUnique: vi.fn() },
  recipeNutritionSnapshot: { upsert: vi.fn() },
  recipeAllergen: { deleteMany: vi.fn(), createMany: vi.fn() },
  recipeDietFlag: { deleteMany: vi.fn(), createMany: vi.fn() },
}));

vi.mock('@db', () => ({
  prisma: {
    recipe: m.recipe,
    recipeNutritionSnapshot: m.recipeNutritionSnapshot,
    recipeAllergen: m.recipeAllergen,
    recipeDietFlag: m.recipeDietFlag,
  },
  Prisma: {},
}));

import {
  computeNutritionSnapshot,
  computeRecipeAllergens,
  computeRecipeDietFlags,
  computeFullRecipeData,
} from '../../import/nutrition-snapshot';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCleanNutrients(overrides = {}) {
  return {
    kcalPer100g: 165,
    proteinPer100g: 31,
    fatPer100g: 3.6,
    saturatedFatPer100g: 1,
    carbsPer100g: 0,
    sugarsPer100g: 0,
    fiberPer100g: 0,
    saltPer100g: 0.1,
    sodiumMg: 40,
    potassiumMg: 256,
    calciumMg: 11,
    magnesiumMg: 29,
    ironMg: 0.7,
    zincMg: 0.9,
    vitaminAUg: 6,
    vitaminCMg: 0,
    vitaminDUg: 0.1,
    vitaminEMg: 0.3,
    vitaminB12Ug: 0.3,
    folateMg: 4,
    cholesterolMg: 85,
    ...overrides,
  };
}

function makeIngredient(overrides: Record<string, unknown> = {}) {
  return {
    grams: 200,
    retentionFactor: null,
    isOptional: false,
    foodProduct: null,
    cleanProduct: {
      nutrients: makeCleanNutrients(),
      allergens: [],
      dietFlags: [],
    },
    ...overrides,
  };
}

function makeRecipeWithIngredients(ingredients: ReturnType<typeof makeIngredient>[], servings = 1) {
  return {
    id: 'rec-1',
    servings,
    ingredients,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('nutrition-snapshot', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── computeNutritionSnapshot ──────────────────────────────────────────────
  describe('computeNutritionSnapshot()', () => {
    it('does nothing when recipe not found', async () => {
      m.recipe.findUnique.mockResolvedValue(null);
      await computeNutritionSnapshot('bad-id');
      expect(m.recipeNutritionSnapshot.upsert).not.toHaveBeenCalled();
    });

    it('computes per-serving macros from CleanProduct ingredients', async () => {
      const recipe = makeRecipeWithIngredients([
        makeIngredient({
          grams: 200,
          cleanProduct: {
            nutrients: makeCleanNutrients({ kcalPer100g: 165, proteinPer100g: 31, fatPer100g: 3.6, carbsPer100g: 0 }),
            allergens: [],
            dietFlags: [],
          },
        }),
        makeIngredient({
          grams: 150,
          cleanProduct: {
            nutrients: makeCleanNutrients({ kcalPer100g: 130, proteinPer100g: 2.7, fatPer100g: 0.3, carbsPer100g: 28 }),
            allergens: [],
            dietFlags: [],
          },
        }),
      ], 2);

      m.recipe.findUnique.mockResolvedValue(recipe);
      m.recipeNutritionSnapshot.upsert.mockResolvedValue({});

      await computeNutritionSnapshot('rec-1');

      expect(m.recipeNutritionSnapshot.upsert).toHaveBeenCalledOnce();
      const upsertCall = m.recipeNutritionSnapshot.upsert.mock.calls[0][0];

      // Total: chicken 200g → 330kcal, rice 150g → 195kcal = 525 total
      // Per serving (÷2): 262.5
      expect(upsertCall.create.totalKcal).toBe(525);
      expect(upsertCall.create.kcal).toBe(262.5); // per serving
    });

    it('applies retention factor to grams', async () => {
      const recipe = makeRecipeWithIngredients([
        makeIngredient({
          grams: 100,
          retentionFactor: 0.8, // 80g effective
          cleanProduct: {
            nutrients: makeCleanNutrients({ kcalPer100g: 100 }),
            allergens: [],
            dietFlags: [],
          },
        }),
      ], 1);

      m.recipe.findUnique.mockResolvedValue(recipe);
      m.recipeNutritionSnapshot.upsert.mockResolvedValue({});

      await computeNutritionSnapshot('rec-1');

      const upsertCall = m.recipeNutritionSnapshot.upsert.mock.calls[0][0];
      // 100g * 0.8 retention = 80g effective → 80 kcal
      expect(upsertCall.create.totalKcal).toBe(80);
    });

    it('falls back to FoodProduct nutrients when CleanProduct not present', async () => {
      const recipe = makeRecipeWithIngredients([
        makeIngredient({
          grams: 100,
          cleanProduct: null,
          foodProduct: {
            nutrients: {
              kcal: 200,
              protein_g: 25,
              fat_g: 8,
              carbs_g: 5,
            },
            allergens: [],
            dietFlags: [],
          },
        }),
      ], 1);

      m.recipe.findUnique.mockResolvedValue(recipe);
      m.recipeNutritionSnapshot.upsert.mockResolvedValue({});

      await computeNutritionSnapshot('rec-1');

      const upsertCall = m.recipeNutritionSnapshot.upsert.mock.calls[0][0];
      expect(upsertCall.create.totalKcal).toBe(200);
      expect(upsertCall.create.totalProtein_g).toBe(25);
    });
  });

  // ── computeRecipeAllergens ────────────────────────────────────────────────
  describe('computeRecipeAllergens()', () => {
    it('does nothing when recipe not found', async () => {
      m.recipe.findUnique.mockResolvedValue(null);
      await computeRecipeAllergens('bad-id');
      expect(m.recipeAllergen.deleteMany).not.toHaveBeenCalled();
    });

    it('aggregates CONTAINS allergens from required ingredients', async () => {
      const recipe = makeRecipeWithIngredients([
        makeIngredient({
          isOptional: false,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [
              { allergenCode: 'gluten', presence: 'CONTAINS' },
              { allergenCode: 'milk', presence: 'MAY_CONTAIN' },
            ],
            dietFlags: [],
          },
        }),
        makeIngredient({
          isOptional: false,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [
              { allergenCode: 'eggs', presence: 'CONTAINS' },
            ],
            dietFlags: [],
          },
        }),
      ]);

      m.recipe.findUnique.mockResolvedValue(recipe);
      m.recipeAllergen.deleteMany.mockResolvedValue({});
      m.recipeAllergen.createMany.mockResolvedValue({});

      await computeRecipeAllergens('rec-1');

      const createData = m.recipeAllergen.createMany.mock.calls[0][0].data;
      expect(createData).toHaveLength(3);

      const glutenEntry = createData.find((d: { allergenCode: string }) => d.allergenCode === 'gluten');
      expect(glutenEntry.presence).toBe('CONTAINS');

      const milkEntry = createData.find((d: { allergenCode: string }) => d.allergenCode === 'milk');
      expect(milkEntry.presence).toBe('MAY_CONTAIN');

      const eggsEntry = createData.find((d: { allergenCode: string }) => d.allergenCode === 'eggs');
      expect(eggsEntry.presence).toBe('CONTAINS');
    });

    it('optional ingredient CONTAINS → MAY_CONTAIN in recipe', async () => {
      const recipe = makeRecipeWithIngredients([
        makeIngredient({
          isOptional: true,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [
              { allergenCode: 'nuts', presence: 'CONTAINS' },
            ],
            dietFlags: [],
          },
        }),
      ]);

      m.recipe.findUnique.mockResolvedValue(recipe);
      m.recipeAllergen.deleteMany.mockResolvedValue({});
      m.recipeAllergen.createMany.mockResolvedValue({});

      await computeRecipeAllergens('rec-1');

      const createData = m.recipeAllergen.createMany.mock.calls[0][0].data;
      const nutsEntry = createData.find((d: { allergenCode: string }) => d.allergenCode === 'nuts');
      expect(nutsEntry.presence).toBe('MAY_CONTAIN');
    });

    it('CONTAINS from required wins over MAY_CONTAIN from optional', async () => {
      const recipe = makeRecipeWithIngredients([
        makeIngredient({
          isOptional: false,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [{ allergenCode: 'milk', presence: 'CONTAINS' }],
            dietFlags: [],
          },
        }),
        makeIngredient({
          isOptional: true,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [{ allergenCode: 'milk', presence: 'CONTAINS' }],
            dietFlags: [],
          },
        }),
      ]);

      m.recipe.findUnique.mockResolvedValue(recipe);
      m.recipeAllergen.deleteMany.mockResolvedValue({});
      m.recipeAllergen.createMany.mockResolvedValue({});

      await computeRecipeAllergens('rec-1');

      const createData = m.recipeAllergen.createMany.mock.calls[0][0].data;
      const milkEntry = createData.find((d: { allergenCode: string }) => d.allergenCode === 'milk');
      expect(milkEntry.presence).toBe('CONTAINS');
    });
  });

  // ── computeRecipeDietFlags ────────────────────────────────────────────────
  describe('computeRecipeDietFlags()', () => {
    it('does nothing when recipe not found', async () => {
      m.recipe.findUnique.mockResolvedValue(null);
      await computeRecipeDietFlags('bad-id');
      expect(m.recipeDietFlag.deleteMany).not.toHaveBeenCalled();
    });

    it('flag is true only when ALL required ingredients have it true', async () => {
      const recipe = makeRecipeWithIngredients([
        makeIngredient({
          isOptional: false,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [],
            dietFlags: [
              { flagCode: 'vegetarian', value: true, confidence: 90 },
              { flagCode: 'vegan', value: true, confidence: 85 },
            ],
          },
        }),
        makeIngredient({
          isOptional: false,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [],
            dietFlags: [
              { flagCode: 'vegetarian', value: true, confidence: 95 },
              { flagCode: 'vegan', value: false, confidence: 95 },
            ],
          },
        }),
      ]);

      m.recipe.findUnique.mockResolvedValue(recipe);
      m.recipeDietFlag.deleteMany.mockResolvedValue({});
      m.recipeDietFlag.createMany.mockResolvedValue({});

      await computeRecipeDietFlags('rec-1');

      const createData = m.recipeDietFlag.createMany.mock.calls[0][0].data;

      const vegEntry = createData.find((d: { flagCode: string }) => d.flagCode === 'vegetarian');
      expect(vegEntry.value).toBe(true);

      const veganEntry = createData.find((d: { flagCode: string }) => d.flagCode === 'vegan');
      expect(veganEntry.value).toBe(false);
    });

    it('averages confidence when flag is true for all ingredients', async () => {
      const recipe = makeRecipeWithIngredients([
        makeIngredient({
          isOptional: false,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [],
            dietFlags: [{ flagCode: 'glutenFree', value: true, confidence: 80 }],
          },
        }),
        makeIngredient({
          isOptional: false,
          cleanProduct: {
            nutrients: makeCleanNutrients(),
            allergens: [],
            dietFlags: [{ flagCode: 'glutenFree', value: true, confidence: 100 }],
          },
        }),
      ]);

      m.recipe.findUnique.mockResolvedValue(recipe);
      m.recipeDietFlag.deleteMany.mockResolvedValue({});
      m.recipeDietFlag.createMany.mockResolvedValue({});

      await computeRecipeDietFlags('rec-1');

      const createData = m.recipeDietFlag.createMany.mock.calls[0][0].data;
      const gfEntry = createData.find((d: { flagCode: string }) => d.flagCode === 'glutenFree');
      expect(gfEntry.confidence).toBe(90); // avg(80, 100)
    });

    it('does nothing when recipe has no ingredients', async () => {
      m.recipe.findUnique.mockResolvedValue({
        id: 'rec-1',
        ingredients: [],
      });

      await computeRecipeDietFlags('rec-1');
      expect(m.recipeDietFlag.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ── computeFullRecipeData ─────────────────────────────────────────────────
  describe('computeFullRecipeData()', () => {
    it('calls all three computation functions', async () => {
      // Each sub-call finds the recipe separately
      m.recipe.findUnique.mockResolvedValue(
        makeRecipeWithIngredients([makeIngredient()], 1),
      );
      m.recipeNutritionSnapshot.upsert.mockResolvedValue({});
      m.recipeAllergen.deleteMany.mockResolvedValue({});
      m.recipeDietFlag.deleteMany.mockResolvedValue({});

      await computeFullRecipeData('rec-1');

      // All three were called
      expect(m.recipeNutritionSnapshot.upsert).toHaveBeenCalledOnce();
      expect(m.recipeAllergen.deleteMany).toHaveBeenCalledOnce();
      expect(m.recipeDietFlag.deleteMany).toHaveBeenCalledOnce();
    });
  });
});
