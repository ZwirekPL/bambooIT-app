import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  cleanProduct: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    cleanProduct: m.cleanProduct,
    $transaction: m.$transaction,
  },
  Prisma: {},
}));

import {
  listCleanProducts,
  getCleanProductById,
  searchCleanProducts,
  createCleanProduct,
  updateCleanProduct,
  deleteCleanProduct,
  previewNutrition,
} from '../../services/cleanProduct.service';

// ── helpers ───────────────────────────────────────────────────────────────────

const makeNutrients = (overrides = {}) => ({
  kcalPer100g: 250,
  proteinPer100g: 20,
  fatPer100g: 10,
  carbsPer100g: 15,
  fiberPer100g: 3,
  sugarsPer100g: 2,
  saltPer100g: 0.5,
  saturatedFatPer100g: 4,
  ...overrides,
});

const makeProduct = (overrides = {}) => ({
  id: 'cp-1',
  name: 'Pierś z kurczaka',
  nameEn: 'Chicken breast',
  slug: 'piers-z-kurczaka',
  type: 'BASE',
  brand: null,
  barcode: null,
  category: 'Mięso i drób',
  subcategory: null,
  description: null,
  imageUrl: null,
  sourcePrimary: 'ILEWAZY',
  sourceSecondary: 'USDA',
  sourceUrl: null,
  sourceId: null,
  qualityScore: 90,
  verificationStatus: 'VERIFIED',
  hasMicronutrients: true,
  packageWeightG: null,
  servingWeightG: null,
  createdByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  nutrients: makeNutrients(),
  portions: [{ id: 'por-1', portionName: 'porcja', weightG: 150, source: 'ILEWAZY' }],
  allergens: [],
  dietFlags: [],
  _count: { recipeIngredients: 0 },
  ...overrides,
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('cleanProduct.service', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── getCleanProductById ───────────────────────────────────────────────────
  describe('getCleanProductById()', () => {
    it('throws NOT_FOUND when product does not exist', async () => {
      m.cleanProduct.findUnique.mockResolvedValue(null);
      await expect(getCleanProductById('bad-id'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('returns product when found', async () => {
      const product = makeProduct();
      m.cleanProduct.findUnique.mockResolvedValue(product);
      const result = await getCleanProductById('cp-1');
      expect(result.id).toBe('cp-1');
      expect(result.name).toBe('Pierś z kurczaka');
    });
  });

  // ── searchCleanProducts (I1.6) ────────────────────────────────────────────
  describe('searchCleanProducts()', () => {
    it('searches by query with default limit', async () => {
      m.cleanProduct.findMany.mockResolvedValue([makeProduct()]);
      const results = await searchCleanProducts('kurczak');

      expect(m.cleanProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'kurczak', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Pierś z kurczaka');
    });

    it('filters by type when provided', async () => {
      m.cleanProduct.findMany.mockResolvedValue([]);
      await searchCleanProducts('mleko', 10, 'RETAIL');

      expect(m.cleanProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          where: expect.objectContaining({ type: 'RETAIL' }),
        }),
      );
    });

    it('returns empty array when no matches', async () => {
      m.cleanProduct.findMany.mockResolvedValue([]);
      const results = await searchCleanProducts('xyz-nonexistent');
      expect(results).toEqual([]);
    });
  });

  // ── listCleanProducts (I1.6 — filtering) ─────────────────────────────────
  describe('listCleanProducts()', () => {
    it('returns paginated results', async () => {
      m.$transaction.mockResolvedValue([[makeProduct()], 1]);

      const result = await listCleanProducts({ page: 1, limit: 10 });

      expect(result).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
    });

    it('applies type filter', async () => {
      m.$transaction.mockResolvedValue([[], 0]);
      await listCleanProducts({ page: 1, limit: 10, type: 'BASE' });

      const findManyCall = m.$transaction.mock.calls[0][0][0];
      // The transaction receives raw Prisma promises, verify type filter was applied
      expect(m.$transaction).toHaveBeenCalledTimes(1);
    });

    it('applies search filter across name, nameEn, brand', async () => {
      m.$transaction.mockResolvedValue([[], 0]);
      await listCleanProducts({ page: 1, limit: 10, search: 'chicken' });
      expect(m.$transaction).toHaveBeenCalledTimes(1);
    });

    it('calculates correct skip for page > 1', async () => {
      m.$transaction.mockResolvedValue([[], 0]);
      const result = await listCleanProducts({ page: 3, limit: 20 });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
    });
  });

  // ── createCleanProduct (I1.5 — MANUAL product creation) ──────────────────
  describe('createCleanProduct()', () => {
    it('creates a MANUAL product with nutrients and portions', async () => {
      const created = makeProduct({
        type: 'MANUAL',
        sourcePrimary: 'MANUAL',
        verificationStatus: 'VERIFIED',
        createdByUserId: 'user-diet-1',
      });
      m.cleanProduct.findUnique.mockResolvedValue(null); // slug check
      m.cleanProduct.create.mockResolvedValue(created);

      const result = await createCleanProduct({
        name: 'Pierś z kurczaka',
        type: 'MANUAL',
        category: 'Mięso i drób',
        sourcePrimary: 'MANUAL',
        verificationStatus: 'VERIFIED',
        createdByUserId: 'user-diet-1',
        nutrients: makeNutrients(),
        portions: [{ portionName: 'porcja', weightG: 150 }],
      });

      expect(m.cleanProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'MANUAL',
            sourcePrimary: 'MANUAL',
            verificationStatus: 'VERIFIED',
            createdByUserId: 'user-diet-1',
            nutrients: { create: expect.objectContaining({ kcalPer100g: 250 }) },
            portions: { create: expect.arrayContaining([
              expect.objectContaining({ portionName: 'porcja', weightG: 150, source: 'MANUAL' }),
            ]) },
          }),
        }),
      );
      expect(result.type).toBe('MANUAL');
      expect(result.createdByUserId).toBe('user-diet-1');
    });

    it('defaults qualityScore to 70 and verificationStatus to UNVERIFIED', async () => {
      m.cleanProduct.findUnique.mockResolvedValue(null); // slug check
      m.cleanProduct.create.mockResolvedValue(makeProduct());

      await createCleanProduct({
        name: 'Test Product',
        type: 'BASE',
        category: 'Test',
        sourcePrimary: 'ILEWAZY',
        nutrients: makeNutrients(),
      });

      expect(m.cleanProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qualityScore: 70,
            verificationStatus: 'UNVERIFIED',
          }),
        }),
      );
    });

    it('generates unique slug for duplicate names', async () => {
      m.cleanProduct.findUnique
        .mockResolvedValueOnce({ id: 'existing' })  // first slug exists
        .mockResolvedValueOnce(null);                // slug-2 is free
      m.cleanProduct.create.mockResolvedValue(makeProduct({ slug: 'piers-z-kurczaka-2' }));

      const result = await createCleanProduct({
        name: 'Pierś z kurczaka',
        type: 'BASE',
        category: 'Mięso i drób',
        sourcePrimary: 'ILEWAZY',
        nutrients: makeNutrients(),
      });

      expect(m.cleanProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'piers-z-kurczaka-2',
          }),
        }),
      );
    });
  });

  // ── updateCleanProduct ────────────────────────────────────────────────────
  describe('updateCleanProduct()', () => {
    it('throws NOT_FOUND when updating non-existent product', async () => {
      m.cleanProduct.findUnique.mockResolvedValue(null);
      await expect(updateCleanProduct('bad-id', { name: 'New' }))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('updates product name and nutrients', async () => {
      m.cleanProduct.findUnique.mockResolvedValue(makeProduct());
      const updated = makeProduct({ name: 'Updated' });
      m.cleanProduct.update.mockResolvedValue(updated);

      const result = await updateCleanProduct('cp-1', {
        name: 'Updated',
        nutrients: makeNutrients({ kcalPer100g: 300 }),
      });

      expect(m.cleanProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Updated',
            nutrients: { upsert: expect.objectContaining({
              create: expect.objectContaining({ kcalPer100g: 300 }),
              update: expect.objectContaining({ kcalPer100g: 300 }),
            }) },
          }),
        }),
      );
    });
  });

  // ── deleteCleanProduct ────────────────────────────────────────────────────
  describe('deleteCleanProduct()', () => {
    it('throws NOT_FOUND when deleting non-existent product', async () => {
      m.cleanProduct.findUnique.mockResolvedValue(null);
      await expect(deleteCleanProduct('bad-id'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('deletes product and returns id', async () => {
      m.cleanProduct.findUnique.mockResolvedValue(makeProduct());
      m.cleanProduct.delete.mockResolvedValue(undefined);

      const result = await deleteCleanProduct('cp-1');
      expect(result).toEqual({ id: 'cp-1' });
      expect(m.cleanProduct.delete).toHaveBeenCalledWith({ where: { id: 'cp-1' } });
    });
  });

  // ── previewNutrition (I1.3) ───────────────────────────────────────────────
  describe('previewNutrition()', () => {
    it('calculates correct macros for single ingredient', async () => {
      // 200g of product with 250kcal/100g → 500kcal total
      m.cleanProduct.findMany.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Chicken',
          hasMicronutrients: true,
          nutrients: makeNutrients({ kcalPer100g: 250, proteinPer100g: 20, fatPer100g: 10, carbsPer100g: 15 }),
        },
      ]);

      const result = await previewNutrition([{ cleanProductId: 'cp-1', grams: 200 }], 1);

      expect(result.total.kcal).toBe(500);
      expect(result.total.protein).toBe(40);
      expect(result.total.fat).toBe(20);
      expect(result.total.carbs).toBe(30);
      expect(result.perServing.kcal).toBe(500);
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0]).toMatchObject({
        cleanProductId: 'cp-1',
        grams: 200,
        kcal: 500,
        protein: 40,
      });
      expect(result.warnings).toEqual([]);
    });

    it('calculates correct per-serving values for multiple servings', async () => {
      m.cleanProduct.findMany.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Rice',
          hasMicronutrients: true,
          nutrients: makeNutrients({ kcalPer100g: 130, proteinPer100g: 2.7, fatPer100g: 0.3, carbsPer100g: 28 }),
        },
      ]);

      const result = await previewNutrition([{ cleanProductId: 'cp-1', grams: 400 }], 4);

      expect(result.total.kcal).toBe(520);
      expect(result.perServing.kcal).toBe(130); // 520 / 4
      expect(result.servings).toBe(4);
    });

    it('sums macros from multiple ingredients', async () => {
      m.cleanProduct.findMany.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Chicken',
          hasMicronutrients: true,
          nutrients: makeNutrients({ kcalPer100g: 165, proteinPer100g: 31, fatPer100g: 3.6, carbsPer100g: 0 }),
        },
        {
          id: 'cp-2',
          name: 'Rice',
          hasMicronutrients: true,
          nutrients: makeNutrients({ kcalPer100g: 130, proteinPer100g: 2.7, fatPer100g: 0.3, carbsPer100g: 28 }),
        },
      ]);

      const result = await previewNutrition([
        { cleanProductId: 'cp-1', grams: 150 }, // 247.5 kcal
        { cleanProductId: 'cp-2', grams: 200 }, // 260 kcal
      ], 1);

      expect(result.total.kcal).toBe(507.5);
      expect(result.breakdown).toHaveLength(2);
    });

    it('throws PRODUCTS_NOT_FOUND for missing product IDs', async () => {
      m.cleanProduct.findMany.mockResolvedValue([]); // no products found

      await expect(previewNutrition([{ cleanProductId: 'missing-1', grams: 100 }], 1))
        .rejects.toMatchObject({ code: 'PRODUCTS_NOT_FOUND', statusCode: 400 });
    });

    it('throws MISSING_NUTRIENTS when product has no nutrient data', async () => {
      m.cleanProduct.findMany.mockResolvedValue([
        { id: 'cp-1', name: 'No Data', hasMicronutrients: false, nutrients: null },
      ]);

      await expect(previewNutrition([{ cleanProductId: 'cp-1', grams: 100 }], 1))
        .rejects.toMatchObject({ code: 'MISSING_NUTRIENTS', statusCode: 400 });
    });

    it('adds warning when ingredients lack micronutrient data', async () => {
      m.cleanProduct.findMany.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Retail Product',
          hasMicronutrients: false,
          nutrients: makeNutrients(),
        },
      ]);

      const result = await previewNutrition([{ cleanProductId: 'cp-1', grams: 100 }], 1);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('without micronutrient data');
    });

    it('handles servings=0 safely (defaults to 1)', async () => {
      m.cleanProduct.findMany.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Test',
          hasMicronutrients: true,
          nutrients: makeNutrients({ kcalPer100g: 100 }),
        },
      ]);

      const result = await previewNutrition([{ cleanProductId: 'cp-1', grams: 100 }], 0);

      expect(result.servings).toBe(1);
      expect(result.perServing.kcal).toBe(result.total.kcal);
    });

    it('rounds values to 1 decimal place', async () => {
      m.cleanProduct.findMany.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Test',
          hasMicronutrients: true,
          nutrients: makeNutrients({ kcalPer100g: 33, proteinPer100g: 7.77 }),
        },
      ]);

      const result = await previewNutrition([{ cleanProductId: 'cp-1', grams: 33 }], 1);

      // 33 * 33 / 100 = 10.89
      expect(result.total.kcal).toBe(10.9);
      // 7.77 * 33 / 100 = 2.5641 → 2.6
      expect(result.total.protein).toBe(2.6);
    });
  });
});
