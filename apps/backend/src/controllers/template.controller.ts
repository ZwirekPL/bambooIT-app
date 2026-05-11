import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as templateService from '../services/template.service';
import { logAudit } from '../services/audit.service';

// ─── schemas ──────────────────────────────────────────────────────────────────

const GOALS = ['WEIGHT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN'] as const;
const DIET_TYPES = ['STANDARD', 'VEGE', 'VEGAN', 'GLUTEN_FREE', 'LACTOSE_FREE'] as const;

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  targetKcal: z.number().int().min(500).max(10000),
  targetProteinG: z.number().int().min(0).max(500),
  targetFatG: z.number().int().min(0).max(500),
  targetCarbsG: z.number().int().min(0).max(1000),
  goal: z.enum(GOALS),
  dietType: z.enum(DIET_TYPES).optional(),
  mealCount: z.number().int().min(1).max(10).optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  goal: z.enum(GOALS).optional(),
  dietType: z.enum(DIET_TYPES).optional(),
  minKcal: z.coerce.number().int().min(0).optional(),
  maxKcal: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

const idSchema = z.string().cuid();

const matchQuerySchema = z.object({
  goal: z.enum(GOALS),
  kcal: z.coerce.number().int().min(500).max(10000),
  mealCount: z.coerce.number().int().min(1).max(10),
  dietType: z.enum(DIET_TYPES),
});

const addMealSchema = z.object({
  mealId: z.string().cuid(),
  dayNumber: z.number().int().min(1).max(7),
  position: z.number().int().min(1).max(10),
});

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await templateService.listTemplatePlans(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    const plan = await templateService.getTemplatePlanById(id);
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createSchema.parse(req.body);
    const plan = await templateService.createTemplatePlan(input);
    logAudit({ userId: req.user?.sub, action: 'CREATE_TEMPLATE_PLAN', resourceType: 'TEMPLATE_PLAN', resourceId: plan.id, ip: req.ip });
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    const input = updateSchema.parse(req.body);
    const plan = await templateService.updateTemplatePlan(id, input);
    logAudit({ userId: req.user?.sub, action: 'UPDATE_TEMPLATE_PLAN', resourceType: 'TEMPLATE_PLAN', resourceId: id, ip: req.ip });
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    await templateService.deleteTemplatePlan(id);
    logAudit({ userId: req.user?.sub, action: 'DELETE_TEMPLATE_PLAN', resourceType: 'TEMPLATE_PLAN', resourceId: id, ip: req.ip });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function match(req: Request, res: Response, next: NextFunction) {
  try {
    const query = matchQuerySchema.parse(req.query);
    const plan = await templateService.findBestTemplatePlan(query);
    if (!plan) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No matching template plan found' } });
      return;
    }
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

export async function addMeal(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    const input = addMealSchema.parse(req.body);
    const slot = await templateService.addMealToTemplate(id, input);
    res.status(201).json(slot);
  } catch (err) {
    next(err);
  }
}

export async function removeMeal(req: Request, res: Response, next: NextFunction) {
  try {
    const slotId = idSchema.parse(req.params.slotId);
    await templateService.removeMealFromTemplate(slotId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
