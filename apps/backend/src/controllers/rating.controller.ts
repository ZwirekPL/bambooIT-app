/**
 * 37.5 — Recipe Rating Controller.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { prisma } from '@db';
import * as ratingService from '../services/rating.service';

const rateSchema = z.object({
  recipeId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  dietPlanId: z.string().cuid().optional(),
  source: z.enum(['checkin', 'inline', 'manual']).optional(),
});

const batchRateSchema = z.object({
  ratings: z.array(z.object({
    recipeId: z.string().cuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  })).min(1).max(50),
  dietPlanId: z.string().cuid().optional(),
});

export async function rateRecipe(req: Request, res: Response, next: NextFunction) {
  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.message));
  }

  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(403).json(apiError('FORBIDDEN', 'Only patients can rate recipes'));
    }

    const result = await ratingService.rateRecipe({
      patientId,
      ...parsed.data,
    });
    return res.json({ ok: true, rating: result });
  } catch (err) {
    next(err);
  }
}

export async function batchRate(req: Request, res: Response, next: NextFunction) {
  const parsed = batchRateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.message));
  }

  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(403).json(apiError('FORBIDDEN', 'Only patients can rate recipes'));
    }

    const results = await ratingService.batchRateRecipes(
      patientId,
      parsed.data.ratings,
      parsed.data.dietPlanId,
    );
    return res.json({ ok: true, ratings: results });
  } catch (err) {
    next(err);
  }
}

export async function getMyRatings(req: Request, res: Response, next: NextFunction) {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(403).json(apiError('FORBIDDEN', 'Only patients can view their ratings'));
    }

    const dietPlanId = req.query.dietPlanId as string | undefined;
    const ratings = await ratingService.getPatientRatings(patientId, dietPlanId);
    return res.json({ ok: true, ratings });
  } catch (err) {
    next(err);
  }
}

export async function getRecipeRatings(req: Request, res: Response, next: NextFunction) {
  try {
    const { recipeId } = req.params;
    if (!recipeId) {
      return res.status(400).json(apiError('VALIDATION_ERROR', 'Missing recipeId'));
    }

    const ratings = await ratingService.getRecipeRatings(recipeId);
    return res.json({ ok: true, ratings });
  } catch (err) {
    next(err);
  }
}

export async function getTopRated(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const minRatings = req.query.minRatings ? Number(req.query.minRatings) : 3;
    const recipes = await ratingService.getTopRatedRecipes(limit, minRatings);
    return res.json({ ok: true, recipes });
  } catch (err) {
    next(err);
  }
}

export async function getLowRated(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const maxRating = req.query.maxRating ? Number(req.query.maxRating) : 2.5;
    const recipes = await ratingService.getLowRatedRecipes(limit, maxRating);
    return res.json({ ok: true, recipes });
  } catch (err) {
    next(err);
  }
}

// ── 64.2 Favorite Meals ─────────────────────────────────────────────────────

const favoriteSchema = z.object({
  recipeName: z.string().min(1).max(300),
  recipeId: z.string().optional(),
  dietPlanId: z.string().optional(),
});

export async function toggleFavorite(req: Request, res: Response, next: NextFunction) {
  const parsed = favoriteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));

  const patientId = req.user?.patientId;
  if (!patientId) return res.status(400).json(apiError('NO_PATIENT', 'No patient profile'));

  try {
    const existing = await prisma.favoriteMeal.findUnique({
      where: { patientId_recipeName: { patientId, recipeName: parsed.data.recipeName } },
    });

    if (existing) {
      await prisma.favoriteMeal.delete({ where: { id: existing.id } });
      return res.json({ ok: true, favorited: false });
    }

    await prisma.favoriteMeal.create({
      data: {
        patientId,
        recipeName: parsed.data.recipeName,
        recipeId: parsed.data.recipeId,
        dietPlanId: parsed.data.dietPlanId,
      },
    });
    return res.json({ ok: true, favorited: true });
  } catch (err) {
    next(err);
  }
}

export async function listFavorites(req: Request, res: Response, next: NextFunction) {
  const patientId = req.user?.patientId;
  if (!patientId) return res.status(400).json(apiError('NO_PATIENT', 'No patient profile'));

  try {
    const favorites = await prisma.favoriteMeal.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ ok: true, favorites: favorites.map((f) => f.recipeName) });
  } catch (err) {
    next(err);
  }
}
