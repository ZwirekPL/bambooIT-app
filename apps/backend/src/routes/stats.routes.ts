import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@db';

export const statsRouter = Router();

/**
 * GET /stats/database — public endpoint returning database stats
 * for landing page showcase (product count, recipe count, nutrient coverage).
 * Cached in-memory for 10 minutes.
 */

let cachedStats: Record<string, unknown> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

statsRouter.get('/database', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = Date.now();
    if (cachedStats && now - cacheTimestamp < CACHE_TTL) {
      return res.json({ ok: true, ...cachedStats });
    }

    // Count products and recipes
    const [
      cleanProductCount,
      recipeCount,
      verifiedRecipeCount,
      nutrientCoverage,
    ] = await Promise.all([
      prisma.cleanProduct.count({}),
      prisma.recipe.count({}),
      prisma.recipe.count({ where: { isActive: true, verificationStatus: 'MANUALLY_VERIFIED' } }),
      calculateNutrientCoverage(),
    ]);

    const stats = {
      products: cleanProductCount,
      recipes: recipeCount,
      verifiedRecipes: verifiedRecipeCount,
      nutrientCoverage,
    };

    cachedStats = stats;
    cacheTimestamp = now;

    return res.json({ ok: true, ...stats });
  } catch (err) {
    next(err);
  }
});

// ─── Nutrient coverage calculation ───────────────────────────────────────────

const MACRO_FIELDS = [
  'kcalPer100g', 'proteinPer100g', 'fatPer100g', 'carbsPer100g',
] as const;

const MICRO_FIELDS = [
  // Vitamins
  'vitaminAUg', 'vitaminDUg', 'vitaminEMg', 'vitaminKUg',
  'vitaminCMg', 'vitaminB1Mg', 'vitaminB2Mg', 'vitaminB3Mg',
  'vitaminB5Mg', 'vitaminB6Mg', 'folateUg', 'vitaminB12Ug',
  'biotinUg', 'cholineMg',
  // Minerals
  'sodiumMg', 'potassiumMg', 'calciumMg', 'magnesiumMg',
  'phosphorusMg', 'ironMg', 'zincMg', 'copperMg',
  'manganeseMg', 'seleniumUg', 'iodineUg', 'chromiumUg',
  // Fats breakdown
  'saturatedFatPer100g', 'omega3Per100g', 'omega6Per100g',
  // Other
  'fiberPer100g', 'sugarsPer100g', 'cholesterolMg',
] as const;

async function calculateNutrientCoverage() {
  const totalProducts = await prisma.cleanProduct.count({});
  if (totalProducts === 0) {
    return { macro: { fields: 4, avgCoveragePct: 0 }, micro: { fields: MICRO_FIELDS.length, avgCoveragePct: 0 } };
  }

  // Use raw SQL to count non-null values for all fields in one query
  const allFields = [...MACRO_FIELDS, ...MICRO_FIELDS];
  const selectParts = allFields.map(
    (f) => `COUNT("${f}") AS "${f}"`
  ).join(', ');

  const result = await prisma.$queryRawUnsafe<Record<string, bigint>[]>(
    `SELECT ${selectParts} FROM "CleanProductNutrients"`
  );

  const counts = result[0] ?? {};

  const macroResults = MACRO_FIELDS.map((field) => {
    const count = Number(counts[field] ?? 0);
    return { field, count, pct: Math.round((count / totalProducts) * 100) };
  });

  const microResults = MICRO_FIELDS.map((field) => {
    const count = Number(counts[field] ?? 0);
    return { field, count, pct: Math.round((count / totalProducts) * 100) };
  });

  const macroAvg = Math.round(macroResults.reduce((sum, r) => sum + r.pct, 0) / macroResults.length);
  const microAvg = Math.round(microResults.reduce((sum, r) => sum + r.pct, 0) / microResults.length);

  return {
    macro: {
      fields: MACRO_FIELDS.length,
      avgCoveragePct: macroAvg,
    },
    micro: {
      fields: MICRO_FIELDS.length,
      avgCoveragePct: microAvg,
    },
    totalTrackedNutrients: MACRO_FIELDS.length + MICRO_FIELDS.length,
  };
}

/** Convert camelCase to snake_case for SQL column names */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
