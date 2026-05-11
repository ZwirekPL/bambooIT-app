/**
 * 37.2 — Recipe Quality Scoring Service.
 * Computes a 0–100 quality score based on 13 completeness criteria.
 */

import { prisma } from '@db';

// ─── Scoring criteria ───────────────────────────────────────────────────────

interface ScoringCriterion {
  name: string;
  points: number;
  check: (recipe: RecipeForScoring) => boolean;
}

interface RecipeForScoring {
  title: string;
  description: string | null;
  category: string | null;
  mealType: string | null;
  difficulty: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servingWeightG: number | { toNumber(): number } | null;
  ingredients: Array<{ cleanProductId: string | null; foodProductId: string | null }>;
  instructionSteps: Array<{ id: string }>;
  nutritionSnapshot: { id: string } | null;
  allergens: Array<{ id: string }>;
  dietFlags: Array<{ id: string }>;
}

const CRITERIA: ScoringCriterion[] = [
  { name: 'has_title',           points: 5,  check: (r) => !!r.title?.trim() },
  { name: 'has_description',     points: 5,  check: (r) => !!r.description?.trim() },
  { name: 'has_category',        points: 5,  check: (r) => !!r.category?.trim() },
  { name: 'has_meal_type',       points: 5,  check: (r) => !!r.mealType },
  { name: 'has_difficulty',      points: 5,  check: (r) => !!r.difficulty },
  { name: 'has_2_ingredients',   points: 10, check: (r) => r.ingredients.filter(i => i.cleanProductId || i.foodProductId).length >= 2 },
  { name: 'all_linked',         points: 10, check: (r) => r.ingredients.length > 0 && r.ingredients.every(i => i.cleanProductId || i.foodProductId) },
  { name: 'has_2_steps',        points: 10, check: (r) => r.instructionSteps.length >= 2 },
  { name: 'has_times',          points: 5,  check: (r) => ((r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0)) > 0 },
  { name: 'has_serving_weight', points: 5,  check: (r) => (Number(r.servingWeightG) || 0) > 0 },
  { name: 'has_nutrition',      points: 15, check: (r) => !!r.nutritionSnapshot },
  { name: 'has_allergens',      points: 10, check: (r) => r.allergens.length > 0 },
  { name: 'has_diet_flags',     points: 10, check: (r) => r.dietFlags.length > 0 },
];

// ─── Core ───────────────────────────────────────────────────────────────────

export interface ScoringResult {
  score: number;
  maxScore: number;
  passed: string[];
  missing: string[];
}

/**
 * Compute quality score for a recipe based on completeness criteria.
 */
export function computeRecipeQualityScore(recipe: RecipeForScoring): ScoringResult {
  let score = 0;
  const passed: string[] = [];
  const missing: string[] = [];

  for (const criterion of CRITERIA) {
    if (criterion.check(recipe)) {
      score += criterion.points;
      passed.push(criterion.name);
    } else {
      missing.push(criterion.name);
    }
  }

  return { score, maxScore: 100, passed, missing };
}

/**
 * Fetch recipe data and compute quality score, then update in DB.
 */
export async function updateRecipeQualityScore(recipeId: string): Promise<number> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      title: true,
      description: true,
      category: true,
      mealType: true,
      difficulty: true,
      prepTimeMinutes: true,
      cookTimeMinutes: true,
      servingWeightG: true,
      ingredients: { select: { cleanProductId: true, foodProductId: true } },
      instructionSteps: { select: { id: true } },
      nutritionSnapshot: { select: { id: true } },
      allergens: { select: { id: true } },
      dietFlags: { select: { id: true } },
    },
  });

  if (!recipe) return 0;

  const { score } = computeRecipeQualityScore(recipe);

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { qualityScore: score },
  });

  return score;
}

/**
 * Batch recompute quality scores for all recipes.
 * Returns count of updated recipes.
 */
export async function recomputeAllScores(): Promise<{ updated: number; avgScore: number }> {
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      mealType: true,
      difficulty: true,
      prepTimeMinutes: true,
      cookTimeMinutes: true,
      servingWeightG: true,
      ingredients: { select: { cleanProductId: true, foodProductId: true } },
      instructionSteps: { select: { id: true } },
      nutritionSnapshot: { select: { id: true } },
      allergens: { select: { id: true } },
      dietFlags: { select: { id: true } },
    },
  });

  let totalScore = 0;

  for (const recipe of recipes) {
    const { score } = computeRecipeQualityScore(recipe);
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { qualityScore: score },
    });
    totalScore += score;
  }

  return {
    updated: recipes.length,
    avgScore: recipes.length > 0 ? Math.round(totalScore / recipes.length) : 0,
  };
}
