import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as mealService from '../services/meal.service';

// ─── schemas ──────────────────────────────────────────────────────────────────

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'SUPPER'] as const;
const DIET_TYPES = ['STANDARD', 'VEGE', 'VEGAN', 'GLUTEN_FREE', 'LACTOSE_FREE'] as const;

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  mealType: z.enum(MEAL_TYPES),
  dietType: z.enum(DIET_TYPES).optional(),
  kcal: z.number().int().min(1).max(5000),
  proteinG: z.number().min(0).max(500),
  fatG: z.number().min(0).max(500),
  carbsG: z.number().min(0).max(500),
  hasGluten: z.boolean().optional(),
  hasLactose: z.boolean().optional(),
  hasNuts: z.boolean().optional(),
  hasSoy: z.boolean().optional(),
  hasEggs: z.boolean().optional(),
  hasFish: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  recipeId: z.string().cuid().optional(),
  source: z.string().max(50).optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
  recipeId: z.string().cuid().nullable().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  mealType: z.enum(MEAL_TYPES).optional(),
  dietType: z.enum(DIET_TYPES).optional(),
  minKcal: z.coerce.number().int().min(0).optional(),
  maxKcal: z.coerce.number().int().min(0).optional(),
  excludeGluten: z.coerce.boolean().optional(),
  excludeLactose: z.coerce.boolean().optional(),
  excludeNuts: z.coerce.boolean().optional(),
  excludeSoy: z.coerce.boolean().optional(),
  excludeEggs: z.coerce.boolean().optional(),
  excludeFish: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
});

const idSchema = z.string().cuid();

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await mealService.listMeals(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    const meal = await mealService.getMealById(id);
    res.json(meal);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createSchema.parse(req.body);
    const meal = await mealService.createMeal(input);
    res.status(201).json(meal);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    const input = updateSchema.parse(req.body);
    const meal = await mealService.updateMeal(id, input);
    res.json(meal);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    await mealService.deleteMeal(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function candidates(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      mealType: z.enum(MEAL_TYPES),
      targetKcal: z.coerce.number().int().min(50).max(2000),
      tolerancePct: z.coerce.number().min(5).max(50).optional(),
      dietType: z.enum(DIET_TYPES).optional(),
      excludeGluten: z.coerce.boolean().optional(),
      excludeLactose: z.coerce.boolean().optional(),
      excludeNuts: z.coerce.boolean().optional(),
      excludeSoy: z.coerce.boolean().optional(),
      excludeEggs: z.coerce.boolean().optional(),
      excludeFish: z.coerce.boolean().optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    });
    const opts = schema.parse(req.query);
    const meals = await mealService.getCandidateMeals(opts);
    res.json({ meals });
  } catch (err) {
    next(err);
  }
}
