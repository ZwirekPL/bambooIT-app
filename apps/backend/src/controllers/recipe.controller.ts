import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@db';
import { apiError } from '../utils/errors';
import * as recipeService from '../services/recipe.service';
import { logAudit } from '../services/audit.service';
import { recomputeAllScores } from '../services/recipeScoring.service';

// ─── schemas ──────────────────────────────────────────────────────────────────

const idSchema = z.object({ id: z.string().cuid() });

const ingredientSchema = z.object({
  foodProductId: z.string().cuid().optional(),
  cleanProductId: z.string().cuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
  quantity: z.number().positive(),
  unit: z.string().max(50).optional(),
  grams: z.number().positive(),
  displayName: z.string().max(200).optional(),
  isOptional: z.boolean().optional(),
  groupName: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  retentionFactor: z.number().min(0).max(2).optional(),
}).refine(d => d.cleanProductId || d.foodProductId, {
  message: 'cleanProductId or foodProductId is required',
});

const stepSchema = z.object({
  stepNumber: z.number().int().min(1),
  instruction: z.string().min(1),
  durationMinutes: z.number().int().min(0).optional(),
  phase: z.enum(['prep', 'cook']).optional(),
});

const createSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  name: z.string().min(1).max(300).optional(),
  source: z.string().max(50).optional(),
  sourceId: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  cuisineType: z.string().max(100).optional(),
  mealType: z.string().optional(),
  difficulty: z.string().optional(),
  prepTimeMinutes: z.number().int().min(0).optional(),
  cookTimeMinutes: z.number().int().min(0).optional(),
  totalTimeMinutes: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  servingWeightG: z.number().positive().optional(),
  yieldWeightG: z.number().positive().optional(),
  yieldFactor: z.number().min(0).max(5).optional(),
  tips: z.string().max(5000).optional(),
  notesDietitian: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional(),
  tags: z.array(z.string().max(50)).optional(),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).optional(),
}).transform(({ name, title, ...rest }) => ({
  ...rest,
  title: title ?? name ?? '',
})).refine(d => d.title.length > 0, { message: 'title or name is required' });

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  name: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  cuisineType: z.string().max(100).optional(),
  mealType: z.string().optional(),
  difficulty: z.string().optional(),
  prepTimeMinutes: z.number().int().min(0).optional(),
  cookTimeMinutes: z.number().int().min(0).optional(),
  totalTimeMinutes: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  servingWeightG: z.number().positive().optional(),
  yieldWeightG: z.number().positive().optional(),
  yieldFactor: z.number().min(0).max(5).optional(),
  tips: z.string().max(5000).optional(),
  notesDietitian: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional(),
  tags: z.array(z.string().max(50)).optional(),
  isActive: z.boolean().optional(),
  ingredients: z.array(ingredientSchema).min(1).optional(),
  steps: z.array(stepSchema).optional(),
}).transform(({ name, title, ...rest }) => ({
  ...rest,
  ...(title || name ? { title: title ?? name } : {}),
}));

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  mealType: z.string().optional(),
  tag: z.string().optional(),
  difficulty: z.string().optional(),
  maxTotalTime: z.coerce.number().optional(),
  allergenFree: z.string().optional(),
  dietFlags: z.string().optional(),
  minKcal: z.coerce.number().optional(),
  maxKcal: z.coerce.number().optional(),
  isActive: z.coerce.boolean().optional(),
  // 37.4 new filters
  verificationStatus: z.string().optional(),
  source: z.string().optional(),
  sourceExclude: z.string().optional(),
  qualityScoreMin: z.coerce.number().int().min(0).max(100).optional(),
  qualityScoreMax: z.coerce.number().int().min(0).max(100).optional(),
  sortBy: z.enum(['title', 'qualityScore', 'createdAt', 'totalTime', 'averageRating']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── response mapper ──────────────────────────────────────────────────────────

/** Map DB field names to frontend-expected names (title→name, instructionSteps→steps) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecipe(r: any) {
  if (!r) return r;
  const { title, instructionSteps, ...rest } = r;
  return { ...rest, name: title, steps: instructionSteps };
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }
  try {
    const { allergenFree, dietFlags, ...rest } = parsed.data;
    const result = await recipeService.listRecipes({
      ...rest,
      allergenFree: allergenFree?.split(',').filter(Boolean),
      dietFlags: dietFlags?.split(',').filter(Boolean),
    });
    const { recipes, ...rest2 } = result;
    return res.json({ ok: true, items: recipes.map(mapRecipe), ...rest2 });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  try {
    const recipe = await recipeService.getRecipeById(parsed.data.id);
    return res.json({ ok: true, item: mapRecipe(recipe) });
  } catch (err) {
    next(err);
  }
}

export async function search(req: Request, res: Response, next: NextFunction) {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Missing or invalid q parameter'));
  }
  try {
    const recipes = await recipeService.searchRecipes(parsed.data.q, parsed.data.limit);
    return res.json({ ok: true, recipes: recipes.map(mapRecipe) });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }
  try {
    const recipe = await recipeService.createRecipe(parsed.data);
    logAudit({ userId: req.user?.sub, action: 'CREATE_RECIPE', resourceType: 'RECIPE', resourceId: recipe.id, ip: req.ip });
    return res.status(201).json({ ok: true, item: mapRecipe(recipe) });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const idParsed = idSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  const bodyParsed = updateSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }
  try {
    const recipe = await recipeService.updateRecipe(idParsed.data.id, bodyParsed.data);
    logAudit({ userId: req.user?.sub, action: 'UPDATE_RECIPE', resourceType: 'RECIPE', resourceId: recipe.id, ip: req.ip });
    return res.json({ ok: true, item: mapRecipe(recipe) });
  } catch (err) {
    next(err);
  }
}

// ─── 37.2.3 recomputeScores ──────────────────────────────────────────────────

export async function recomputeScores(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await recomputeAllScores();
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── 37.1 bulk update ────────────────────────────────────────────────────────

const bulkActionEnum = z.enum([
  'SET_CATEGORY', 'SET_MEAL_TYPE', 'SET_DIFFICULTY',
  'SET_VERIFICATION_STATUS', 'SET_ACTIVE', 'ADD_TAGS', 'REMOVE_TAGS', 'DELETE',
]);

const bulkSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
  action: bulkActionEnum,
  value: z.unknown().optional(),
});

export async function bulkUpdate(req: Request, res: Response, next: NextFunction) {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.message));
  }

  try {
    const { ids, action, value } = parsed.data;
    const result = await recipeService.bulkUpdateRecipes(ids, action, value);
    logAudit({
      userId: req.user?.sub,
      action: 'BULK_UPDATE_RECIPES',
      resourceType: 'RECIPE',
      metadata: { action, count: ids.length, result },
      ip: req.ip,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  try {
    const result = await recipeService.deleteRecipe(parsed.data.id);
    logAudit({ userId: req.user?.sub, action: 'DELETE_RECIPE', resourceType: 'RECIPE', resourceId: parsed.data.id, ip: req.ip });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── 37.3 find duplicates ────────────────────────────────────────────────────

export async function findDuplicates(req: Request, res: Response, next: NextFunction) {
  try {
    const minSimilarity = req.query.minSimilarity ? Number(req.query.minSimilarity) : 80;
    const clusters = await recipeService.findDuplicates(minSimilarity);
    return res.json({ ok: true, clusters, totalClusters: clusters.length });
  } catch (err) {
    next(err);
  }
}

const mergeSchema = z.object({
  masterId: z.string().cuid(),
  duplicateIds: z.array(z.string().cuid()).min(1).max(20),
});

export async function mergeRecipes(req: Request, res: Response, next: NextFunction) {
  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.message));
  }

  try {
    const { masterId, duplicateIds } = parsed.data;
    const result = await recipeService.mergeRecipes(masterId, duplicateIds);
    logAudit({
      userId: req.user?.sub,
      action: 'MERGE_RECIPES',
      resourceType: 'RECIPE',
      resourceId: masterId,
      metadata: { masterId, duplicateIds, merged: result.merged },
      ip: req.ip,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

