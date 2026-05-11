import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as blogCategoryService from '../services/blogCategory.service';

const idParamSchema = z.object({ id: z.string().cuid() });

const createSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

// Public
export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await blogCategoryService.listActiveCategories();
    return res.json({ ok: true, categories });
  } catch (err) {
    next(err);
  }
}

// Admin
export async function adminListCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await blogCategoryService.listAllCategories();
    return res.json({ ok: true, categories });
  } catch (err) {
    next(err);
  }
}

export async function adminCreateCategory(req: Request, res: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid data'));
  }
  try {
    const category = await blogCategoryService.createCategory(parsed.data);
    return res.status(201).json({ ok: true, category });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdateCategory(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = idParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid category id'));
  }
  const bodyParsed = updateSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res
      .status(400)
      .json(apiError('VALIDATION_ERROR', bodyParsed.error.issues[0]?.message ?? 'Invalid data'));
  }
  try {
    const category = await blogCategoryService.updateCategory(paramsParsed.data.id, bodyParsed.data);
    return res.json({ ok: true, category });
  } catch (err) {
    next(err);
  }
}

export async function adminDeleteCategory(req: Request, res: Response, next: NextFunction) {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid category id'));
  }
  try {
    await blogCategoryService.deactivateCategory(parsed.data.id);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
