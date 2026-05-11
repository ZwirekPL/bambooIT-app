import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@db';
import { apiError } from '../utils/errors';
import { logAudit } from '../services/audit.service';
import { importUsdaFile } from '../import/usda-importer';
import { computeAllergensForAllProducts } from '../import/allergen-engine';
import { computeDietFlagsForAllProducts } from '../import/diet-flag-engine';
import { computeFullRecipeData } from '../import/nutrition-snapshot';

// ─── USDA Import ──────────────────────────────────────────────────────────────

const importUsdaSchema = z.object({
  filePath: z.string().min(1),
  datasetType: z.enum(['sr_legacy', 'foundation']),
});

export async function triggerUsdaImport(req: Request, res: Response, next: NextFunction) {
  const parsed = importUsdaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid import parameters'));
  }
  try {
    const result = await importUsdaFile(parsed.data.filePath, parsed.data.datasetType, req.user?.sub);
    logAudit({ userId: req.user?.sub, action: 'IMPORT_FOOD_PRODUCTS', resourceType: 'FOOD_PRODUCT', ip: req.ip });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── Allergen computation ─────────────────────────────────────────────────────

export async function triggerAllergenComputation(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await computeAllergensForAllProducts({ onlyUnprocessed: true });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── Diet flag computation ────────────────────────────────────────────────────

export async function triggerDietFlagComputation(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await computeDietFlagsForAllProducts({ onlyUnprocessed: true });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── Recipe nutrition recompute ───────────────────────────────────────────────

const recipeIdSchema = z.object({ id: z.string().cuid() });

export async function recomputeRecipeNutrition(req: Request, res: Response, next: NextFunction) {
  const parsed = recipeIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid recipe id'));
  }
  try {
    await computeFullRecipeData(parsed.data.id);
    return res.json({ ok: true, message: 'Recipe nutrition recomputed' });
  } catch (err) {
    next(err);
  }
}

// ─── Bulk recipe nutrition recompute ─────────────────────────────────────────

const bulkRecomputeSchema = z.object({
  mode: z.enum(['missing', 'broken', 'missing_micro', 'all']).default('missing'),
});

export async function bulkRecomputeRecipeNutrition(req: Request, res: Response, next: NextFunction) {
  const parsed = bulkRecomputeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid mode'));
  }
  try {
    const { mode } = parsed.data;
    let where: Record<string, unknown> = {};

    if (mode === 'missing') {
      where = { nutritionSnapshot: null };
    } else if (mode === 'broken') {
      where = { nutritionSnapshot: { OR: [{ kcal: { lte: 0 } }, { protein_g: { lte: 0 } }] } };
    } else if (mode === 'missing_micro') {
      where = { nutritionSnapshot: { iron_mg: null } };
    }
    // mode === 'all' → no filter

    const recipes = await prisma.recipe.findMany({ where, select: { id: true } });

    let success = 0;
    let failed = 0;
    let improved = 0;
    const BATCH = 50;

    for (let i = 0; i < recipes.length; i += BATCH) {
      const batch = recipes.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (r) => {
          try {
            const old = await prisma.recipeNutritionSnapshot.findUnique({
              where: { recipeId: r.id },
              select: { kcal: true, iron_mg: true },
            });
            await computeFullRecipeData(r.id);
            const updated = await prisma.recipeNutritionSnapshot.findUnique({
              where: { recipeId: r.id },
              select: { kcal: true, iron_mg: true },
            });
            const wasImproved =
              (Number(old?.kcal ?? 0) === 0 && Number(updated?.kcal ?? 0) > 0) ||
              (old?.iron_mg === null && updated?.iron_mg !== null);
            if (wasImproved) improved++;
            success++;
          } catch {
            failed++;
          }
        }),
      );
    }

    logAudit({ userId: req.user?.sub, action: 'BULK_RECOMPUTE_NUTRITION', resourceType: 'RECIPE', ip: req.ip });
    return res.json({ ok: true, total: recipes.length, success, failed, improved });
  } catch (err) {
    next(err);
  }
}

// ─── Recipe Data Quality Report ──────────────────────────────────────────────

export async function recipeDataQualityReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const [
      totalRecipes,
      snapshotCount,
      zeroKcal,
      nullIron,
      noInstructionSteps,
      unmatchedIngredients,
      totalIngredients,
      recipesWithUnmatched,
      categoryCounts,
      qualityIssueGroups,
      componentRecipes,
      // Z3 (categorization audit) — coverage per dimension on active recipes only.
      activeTotal,
      mealTypeCounts,
      dishCompletenessCounts,
      categoryNullCount,
      dishCompletenessNullCount,
      cuisineTypeCounts,
    ] = await prisma.$transaction([
      prisma.recipe.count(),
      prisma.recipeNutritionSnapshot.count(),
      prisma.recipeNutritionSnapshot.count({ where: { kcal: { lte: 0 } } }),
      prisma.recipeNutritionSnapshot.count({ where: { iron_mg: null } }),
      prisma.recipe.count({ where: { instructionSteps: { none: {} } } }),
      prisma.recipeIngredient.count({ where: { cleanProductId: null } }),
      prisma.recipeIngredient.count(),
      prisma.recipe.count({ where: { ingredients: { some: { cleanProductId: null } } } }),
      prisma.recipe.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
      // Faza B.2: Aggregate unresolved DataQualityIssue counts by issueCode (Recipe scope).
      prisma.dataQualityIssue.groupBy({
        by: ['issueCode'],
        where: { entityType: 'Recipe', isResolved: false },
        _count: { _all: true },
        orderBy: { issueCode: 'asc' },
      }),
      // Faza A: Count of recipes reclassified as components (SAUCE/SIDE_DISH).
      prisma.recipe.count({ where: { mealType: { in: ['SAUCE', 'SIDE_DISH'] } } }),
      // Z3: active recipe denominator (the panel cares about live data, not
      // historical inactive rows).
      prisma.recipe.count({ where: { isActive: true } }),
      prisma.recipe.groupBy({
        by: ['mealType'],
        where: { isActive: true },
        _count: true,
        orderBy: { _count: { mealType: 'desc' } },
      }),
      prisma.recipe.groupBy({
        by: ['dishCompleteness'],
        where: { isActive: true },
        _count: true,
        orderBy: { _count: { dishCompleteness: 'desc' } },
      }),
      prisma.recipe.count({ where: { isActive: true, category: null } }),
      prisma.recipe.count({ where: { isActive: true, dishCompleteness: null } }),
      // Z4: cuisineType coverage on active recipes.
      prisma.recipe.groupBy({
        by: ['cuisineType'],
        where: { isActive: true },
        _count: true,
        orderBy: { _count: { cuisineType: 'desc' } },
      }),
    ]);
    // mealType is enum-required at the schema level — count is 0 by
    // construction. Surfaced here so the UI can plot it like the others.
    const mealTypeNullCount = 0;

    const qualityIssues: Record<string, number> = {};
    for (const group of qualityIssueGroups) {
      const count = group._count;
      if (count && typeof count === 'object' && '_all' in count && typeof count._all === 'number') {
        qualityIssues[group.issueCode] = count._all;
      }
    }

    // Z3: categorization coverage block. Active-recipes denominator so the
    // panel reflects what the solver actually sees today, not historical
    // inactive rows.
    const categorization = {
      activeTotal,
      nullCounts: {
        mealType: mealTypeNullCount,
        category: categoryNullCount,
        dishCompleteness: dishCompletenessNullCount,
      },
      mealTypeCounts: mealTypeCounts.map((c) => ({
        mealType: c.mealType,
        count: c._count,
      })),
      dishCompletenessCounts: dishCompletenessCounts.map((c) => ({
        dishCompleteness: c.dishCompleteness,
        count: c._count,
      })),
    };

    // Z4: cuisineType coverage. Each entry is checked against the canonical
    // 9-value set used by `apps/backend/src/utils/cuisineMapping.ts`; values
    // outside the set are flagged so dietitians notice if a future import
    // reintroduces typos / out-of-canonical labels.
    const CUISINE_CANONICAL = new Set<string>([
      'polska', 'włoska', 'azjatycka', 'śródziemnomorska', 'meksykańska',
      'indyjska', 'amerykańska', 'francuska', 'inna',
    ]);
    let cuisineNullCount = 0;
    const cuisineNonCanonical: Array<{ cuisineType: string; count: number }> = [];
    const cuisineRows = cuisineTypeCounts.map((c) => {
      // _count is numeric here (groupBy with `_count: true`); the runtime
      // type is `number` even though TS infers a wider union.
      const count = (c._count as unknown as number) ?? 0;
      if (c.cuisineType === null || c.cuisineType === '') {
        cuisineNullCount += count;
      } else if (!CUISINE_CANONICAL.has(c.cuisineType)) {
        // P0.3 dropped 'uniwersalna' — any non-canonical value (including
        // legacy stragglers) gets reported.
        cuisineNonCanonical.push({ cuisineType: c.cuisineType, count });
      }
      return { cuisineType: c.cuisineType, count };
    });
    const cuisineCoverage = {
      activeTotal,
      nullCount: cuisineNullCount,
      counts: cuisineRows,
      nonCanonical: cuisineNonCanonical,
    };

    return res.json({
      ok: true,
      report: {
        totalRecipes,
        withSnapshot: snapshotCount,
        withoutSnapshot: totalRecipes - snapshotCount,
        zeroKcal,
        missingMicronutrients: nullIron,
        noInstructionSteps,
        componentRecipes,
        ingredients: {
          total: totalIngredients,
          unmatchedToCleanProduct: unmatchedIngredients,
          matchRate: totalIngredients > 0
            ? Math.round(((totalIngredients - unmatchedIngredients) / totalIngredients) * 10000) / 100
            : 100,
        },
        recipesWithUnmatchedIngredients: recipesWithUnmatched,
        categories: categoryCounts.map((c) => ({ category: c.category, count: c._count })),
        qualityIssues,
        categorization,
        cuisineCoverage,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Import Jobs ──────────────────────────────────────────────────────────────

const listJobsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  source: z.string().optional(),
  status: z.string().optional(),
});

export async function listImportJobs(req: Request, res: Response, next: NextFunction) {
  const parsed = listJobsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }
  try {
    const { page, limit, source, status } = parsed.data;
    const skip = (page - 1) * limit;

    const where = {
      ...(source ? { source } : {}),
      ...(status ? { status: status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' } : {}),
    };

    const [jobs, total] = await prisma.$transaction([
      prisma.importJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.importJob.count({ where }),
    ]);

    return res.json({ ok: true, jobs, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// ─── Data Quality Issues ──────────────────────────────────────────────────────

const listIssuesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: z.string().optional(),
  issueCode: z.string().optional(),
  entityType: z.string().optional(),
  isResolved: z.coerce.boolean().optional(),
});

export async function listDataQualityIssues(req: Request, res: Response, next: NextFunction) {
  const parsed = listIssuesSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }
  try {
    const { page, limit, severity, issueCode, entityType, isResolved } = parsed.data;
    const skip = (page - 1) * limit;

    const where = {
      ...(severity ? { severity: severity as 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' } : {}),
      ...(issueCode ? { issueCode } : {}),
      ...(entityType ? { entityType } : {}),
      ...(isResolved !== undefined ? { isResolved } : {}),
    };

    const [issues, total] = await prisma.$transaction([
      prisma.dataQualityIssue.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.dataQualityIssue.count({ where }),
    ]);

    return res.json({ ok: true, issues, total, page, limit });
  } catch (err) {
    next(err);
  }
}

const resolveIssueSchema = z.object({ id: z.string().cuid() });

export async function resolveDataQualityIssue(req: Request, res: Response, next: NextFunction) {
  const parsed = resolveIssueSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid issue id'));
  }
  try {
    const issue = await prisma.dataQualityIssue.update({
      where: { id: parsed.data.id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user?.sub,
      },
    });
    return res.json({ ok: true, issue });
  } catch (err) {
    next(err);
  }
}

// ─── Manual Review Queue ──────────────────────────────────────────────────────

const listReviewSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  itemType: z.string().optional(),
  status: z.string().optional(),
});

export async function listReviewQueue(req: Request, res: Response, next: NextFunction) {
  const parsed = listReviewSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }
  try {
    const { page, limit, itemType, status } = parsed.data;
    const skip = (page - 1) * limit;

    const where = {
      ...(itemType ? { itemType: itemType as 'FOOD_PRODUCT' | 'RECIPE' } : {}),
      ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.manualReviewQueue.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.manualReviewQueue.count({ where }),
    ]);

    return res.json({ ok: true, items, total, page, limit });
  } catch (err) {
    next(err);
  }
}

const reviewActionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SKIPPED']),
  reviewNotes: z.string().max(2000).optional(),
});

export async function processReviewItem(req: Request, res: Response, next: NextFunction) {
  const idParsed = z.object({ id: z.string().cuid() }).safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  const bodyParsed = reviewActionSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid review action'));
  }
  try {
    const item = await prisma.manualReviewQueue.update({
      where: { id: idParsed.data.id },
      data: {
        status: bodyParsed.data.status,
        reviewNotes: bodyParsed.data.reviewNotes,
        resolvedAt: new Date(),
      },
    });
    return res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
}
