/**
 * 37.5 — Recipe Rating Service.
 * Handles patient ratings for recipes, cached averages, and auto-deactivation.
 */

import { prisma } from '@db';
import { AppError } from '../utils/errors';

// ─── Rate a recipe (upsert) ─────────────────────────────────────────────────

export async function rateRecipe(input: {
  patientId: string;
  recipeId: string;
  rating: number;
  comment?: string;
  dietPlanId?: string;
  source?: string;
}) {
  const { patientId, recipeId, rating, comment, dietPlanId, source = 'inline' } = input;

  // Verify recipe exists
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) throw new AppError(404, 'NOT_FOUND', 'Recipe not found');

  // Upsert rating (one per patient per recipe)
  const result = await prisma.recipeRating.upsert({
    where: { recipeId_patientId: { recipeId, patientId } },
    create: { recipeId, patientId, rating, comment, dietPlanId, source },
    update: { rating, comment, dietPlanId, source },
  });

  // Update cached averages on Recipe
  await updateRecipeRatingCache(recipeId);

  return result;
}

// ─── Batch rate (from check-in) ─────────────────────────────────────────────

export async function batchRateRecipes(
  patientId: string,
  ratings: Array<{ recipeId: string; rating: number; comment?: string }>,
  dietPlanId?: string,
) {
  const results = [];
  for (const r of ratings) {
    const result = await rateRecipe({
      patientId,
      recipeId: r.recipeId,
      rating: r.rating,
      comment: r.comment,
      dietPlanId,
      source: 'checkin',
    });
    results.push(result);
  }
  return results;
}

// ─── Update cached average on Recipe ────────────────────────────────────────

async function updateRecipeRatingCache(recipeId: string) {
  const agg = await prisma.recipeRating.aggregate({
    where: { recipeId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const avgRating = agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : null;
  const ratingCount = agg._count.rating;

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { averageRating: avgRating, ratingCount },
  });

  // Auto-deactivate if avg <= 2.0 and count >= 5
  if (avgRating !== null && avgRating <= 2.0 && ratingCount >= 5) {
    await prisma.recipe.update({
      where: { id: recipeId },
      data: { isActive: false },
    });
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getRecipeRatings(recipeId: string) {
  return prisma.recipeRating.findMany({
    where: { recipeId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPatientRatings(patientId: string, dietPlanId?: string) {
  return prisma.recipeRating.findMany({
    where: {
      patientId,
      ...(dietPlanId ? { dietPlanId } : {}),
    },
    include: {
      recipe: { select: { id: true, title: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTopRatedRecipes(limit = 20, minRatings = 3) {
  return prisma.recipe.findMany({
    where: {
      ratingCount: { gte: minRatings },
      averageRating: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      mealType: true,
      averageRating: true,
      ratingCount: true,
      qualityScore: true,
    },
    orderBy: { averageRating: 'desc' },
    take: limit,
  });
}

export async function getLowRatedRecipes(limit = 20, maxRating = 2.5) {
  return prisma.recipe.findMany({
    where: {
      ratingCount: { gte: 3 },
      averageRating: { lte: maxRating },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      mealType: true,
      averageRating: true,
      ratingCount: true,
      qualityScore: true,
    },
    orderBy: { averageRating: 'asc' },
    take: limit,
  });
}

// ─── For AI prompt (37.5.11) ────────────────────────────────────────────────

export async function getHighlyRatedRecipeNames(minRating = 4.0, minCount = 3, limit = 15): Promise<string[]> {
  const recipes = await prisma.recipe.findMany({
    where: {
      averageRating: { gte: minRating },
      ratingCount: { gte: minCount },
      isActive: true,
    },
    select: { title: true },
    orderBy: { averageRating: 'desc' },
    take: limit,
  });
  return recipes.map((r) => r.title);
}
