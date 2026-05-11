import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  recipe: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  cleanProduct: { findUnique: vi.fn() },
  foodProduct: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    recipe: m.recipe,
    cleanProduct: m.cleanProduct,
    foodProduct: m.foodProduct,
    $transaction: m.$transaction,
  },
  Prisma: {},
}));

import {
  createRecipe,
  getRecipeById,
  listRecipes,
  updateRecipe,
  deleteRecipe,
} from '../../services/recipe.service';

// ── helpers ───────────────────────────────────────────────────────────────────

const makeRecipe = (overrides = {}) => ({
  id: 'rec-1',
  title: 'Grillowany kurczak z ryżem',
  slug: 'grillowany-kurczak-z-ryzem',
  source: 'manual',
  sourceId: null,
  description: 'Simple recipe',
  category: 'Obiad',
  cuisineType: null,
  mealType: 'LUNCH',
  difficulty: 'MEDIUM',
  prepTimeMinutes: 15,
  cookTimeMinutes: 30,
  totalTimeMinutes: 45,
  servings: 2,
  servingWeightG: null,
  yieldWeightG: null,
  yieldFactor: null,
  tips: null,
  notesDietitian: null,
  imageUrl: null,
  tags: ['obiad', 'kurczak'],
  isActive: true,
  qualityScore: 0,
  verificationStatus: 'UNVERIFIED',
  createdAt: new Date(),
  updatedAt: new Date(),
  ingredients: [
    {
      id: 'ing-1',
      sortOrder: 0,
      quantity: 1,
      unit: 'g',
      grams: 200,
      displayName: null,
      isOptional: false,
      groupName: null,
      notes: null,
      retentionFactor: null,
      foodProduct: null,
      cleanProduct: {
        id: 'cp-1',
        name: 'Pierś z kurczaka',
        slug: 'piers-z-kurczaka',
        type: 'BASE',
        nutrients: { kcalPer100g: 165, proteinPer100g: 31, fatPer100g: 3.6, carbsPer100g: 0 },
        portions: [{ id: 'por-1', portionName: 'porcja', weightG: 150 }],
      },
    },
    {
      id: 'ing-2',
      sortOrder: 1,
      quantity: 1,
      unit: 'g',
      grams: 150,
      displayName: null,
      isOptional: false,
      groupName: null,
      notes: null,
      retentionFactor: null,
      foodProduct: null,
      cleanProduct: {
        id: 'cp-2',
        name: 'Ryż biały',
        slug: 'ryz-bialy',
        type: 'BASE',
        nutrients: { kcalPer100g: 130, proteinPer100g: 2.7, fatPer100g: 0.3, carbsPer100g: 28 },
        portions: [],
      },
    },
  ],
  instructionSteps: [
    { id: 'step-1', stepNumber: 1, instruction: 'Grilluj kurczaka', durationMinutes: 20 },
    { id: 'step-2', stepNumber: 2, instruction: 'Ugotuj ryż', durationMinutes: 15 },
  ],
  nutritionSnapshot: null,
  allergens: [],
  dietFlags: [],
  ...overrides,
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('recipe.service', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── getRecipeById ─────────────────────────────────────────────────────────
  describe('getRecipeById()', () => {
    it('throws NOT_FOUND when recipe does not exist', async () => {
      m.recipe.findUnique.mockResolvedValue(null);
      await expect(getRecipeById('bad-id'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('returns recipe with ingredients and steps', async () => {
      m.recipe.findUnique.mockResolvedValue(makeRecipe());
      const result = await getRecipeById('rec-1');
      expect(result.id).toBe('rec-1');
      expect(result.ingredients).toHaveLength(2);
      expect(result.instructionSteps).toHaveLength(2);
    });
  });

  // ── createRecipe (I1.4 — recipe with CleanProduct ingredients) ────────────
  describe('createRecipe()', () => {
    it('creates recipe with CleanProduct ingredients', async () => {
      // verifyIngredientProducts checks
      m.cleanProduct.findUnique
        .mockResolvedValueOnce({ id: 'cp-1' })   // chicken exists
        .mockResolvedValueOnce({ id: 'cp-2' });   // rice exists

      // uniqueSlug check
      m.recipe.findUnique
        .mockResolvedValueOnce(null); // slug is free

      const created = makeRecipe();
      m.recipe.create.mockResolvedValue(created);

      const result = await createRecipe({
        title: 'Grillowany kurczak z ryżem',
        category: 'Obiad',
        mealType: 'LUNCH',
        servings: 2,
        prepTimeMinutes: 15,
        cookTimeMinutes: 30,
        ingredients: [
          { cleanProductId: 'cp-1', quantity: 1, grams: 200 },
          { cleanProductId: 'cp-2', quantity: 1, grams: 150 },
        ],
        steps: [
          { stepNumber: 1, instruction: 'Grilluj kurczaka', durationMinutes: 20 },
          { stepNumber: 2, instruction: 'Ugotuj ryż', durationMinutes: 15 },
        ],
      });

      expect(m.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Grillowany kurczak z ryżem',
            servings: 2,
            ingredients: {
              create: expect.arrayContaining([
                expect.objectContaining({ cleanProductId: 'cp-1', grams: 200 }),
                expect.objectContaining({ cleanProductId: 'cp-2', grams: 150 }),
              ]),
            },
            instructionSteps: {
              create: expect.arrayContaining([
                expect.objectContaining({ stepNumber: 1, instruction: 'Grilluj kurczaka' }),
              ]),
            },
          }),
        }),
      );
      expect(result.ingredients).toHaveLength(2);
    });

    it('throws VALIDATION_ERROR when ingredient has no product FK', async () => {
      await expect(createRecipe({
        title: 'Bad Recipe',
        ingredients: [
          { quantity: 1, grams: 100 }, // no cleanProductId or foodProductId
        ],
      })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('throws NOT_FOUND when cleanProductId does not exist', async () => {
      m.cleanProduct.findUnique.mockResolvedValue(null);

      await expect(createRecipe({
        title: 'Bad Recipe',
        ingredients: [
          { cleanProductId: 'nonexistent', quantity: 1, grams: 100 },
        ],
      })).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('calculates totalTimeMinutes from prep + cook', async () => {
      m.cleanProduct.findUnique.mockResolvedValue({ id: 'cp-1' });
      m.recipe.findUnique.mockResolvedValue(null); // slug free
      m.recipe.create.mockResolvedValue(makeRecipe());

      await createRecipe({
        title: 'Quick Recipe',
        prepTimeMinutes: 10,
        cookTimeMinutes: 20,
        ingredients: [{ cleanProductId: 'cp-1', quantity: 1, grams: 100 }],
      });

      expect(m.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalTimeMinutes: 30,
          }),
        }),
      );
    });

    it('sets default values (source=manual, servings=1, difficulty=MEDIUM, mealType=LUNCH)', async () => {
      m.cleanProduct.findUnique.mockResolvedValue({ id: 'cp-1' });
      m.recipe.findUnique.mockResolvedValue(null);
      m.recipe.create.mockResolvedValue(makeRecipe());

      await createRecipe({
        title: 'Minimal Recipe',
        ingredients: [{ cleanProductId: 'cp-1', quantity: 1, grams: 100 }],
      });

      expect(m.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'manual',
            servings: 1,
            difficulty: 'MEDIUM',
            mealType: 'LUNCH',
          }),
        }),
      );
    });
  });

  // ── updateRecipe ──────────────────────────────────────────────────────────
  describe('updateRecipe()', () => {
    it('throws NOT_FOUND when recipe does not exist', async () => {
      m.recipe.findUnique.mockResolvedValue(null);
      await expect(updateRecipe('bad-id', { title: 'New' }))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('replaces ingredients when provided', async () => {
      m.recipe.findUnique.mockResolvedValue(makeRecipe());
      m.cleanProduct.findUnique.mockResolvedValue({ id: 'cp-3' });
      m.recipe.update.mockResolvedValue(makeRecipe());

      await updateRecipe('rec-1', {
        ingredients: [{ cleanProductId: 'cp-3', quantity: 1, grams: 300 }],
      });

      expect(m.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ingredients: {
              deleteMany: {},
              create: expect.arrayContaining([
                expect.objectContaining({ cleanProductId: 'cp-3', grams: 300 }),
              ]),
            },
          }),
        }),
      );
    });
  });

  // ── deleteRecipe ──────────────────────────────────────────────────────────
  describe('deleteRecipe()', () => {
    it('throws NOT_FOUND when recipe does not exist', async () => {
      m.recipe.findUnique.mockResolvedValue(null);
      await expect(deleteRecipe('bad-id'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('deletes recipe and returns id', async () => {
      m.recipe.findUnique.mockResolvedValue(makeRecipe());
      m.recipe.delete.mockResolvedValue(undefined);

      const result = await deleteRecipe('rec-1');
      expect(result).toEqual({ id: 'rec-1' });
    });
  });

  // ── listRecipes ───────────────────────────────────────────────────────────
  describe('listRecipes()', () => {
    it('returns paginated results', async () => {
      m.$transaction.mockResolvedValue([[makeRecipe()], 1]);

      const result = await listRecipes({ page: 1, limit: 10 });

      expect(result).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(result.recipes).toHaveLength(1);
    });
  });
});
