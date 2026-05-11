/**
 * Recipe-based Meal Swap Service
 *
 * Provides recipe-based meal swap alternatives for the DB-first pipeline.
 * Complements the existing Meal-table based approach in mealSwap.service.ts.
 */

import { findCandidates, type RecipeCandidateQuery, type ScoredRecipeCandidate } from './recipeCandidate.service';
import { scaleRecipeForMeal } from './recipeScaler.service';
import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import type { PlanMeal, PlanItem } from './planValidation.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RecipeSwapParams {
  /** The meal to replace */
  originalMeal: PlanMeal;
  /** Polish name (Śniadanie, Obiad, etc.) */
  mealName: string;
  patientId: string;
  /** Recipes already in the plan */
  excludeRecipeIds?: string[];
  /** Number of alternatives (default 3) */
  count?: number;
}

export interface RecipeSwapAlternative {
  recipeId: string;
  title: string;
  /** Ready to insert into plan */
  meal: PlanMeal;
  /** Why this is a good swap */
  reason: string;
  /** How well it matches macros (0-100) */
  fitScore: number;
  /** Overall quality score (0-100) */
  totalScore: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_COUNT = 3;
const CANDIDATE_LIMIT = 10;

/** Map Polish meal name → RecipeMealType enum value */
const MEAL_NAME_TO_TYPE: Record<string, string> = {
  'śniadanie': 'BREAKFAST',
  'drugie śniadanie': 'SECOND_BREAKFAST',
  'ii śniadanie': 'SECOND_BREAKFAST',
  'obiad': 'LUNCH',
  'podwieczorek': 'SUPPER',
  'kolacja': 'DINNER',
  'przekąska': 'SNACK',
  'snack': 'SNACK',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Map a Polish meal name to the RecipeMealType enum */
export function mealNameToMealType(name: string): string {
  const lower = name.toLowerCase().trim();
  return MEAL_NAME_TO_TYPE[lower] ?? 'LUNCH';
}

/** Sum macros from meal items */
function sumMealMacros(meal: PlanMeal): { kcal: number; protein: number; fat: number; carbs: number } {
  return meal.items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (item.kcal || 0),
      protein: acc.protein + (item.protein || 0),
      fat: acc.fat + (item.fat || 0),
      carbs: acc.carbs + (item.carbs || 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

/** Load patient allergens from the latest interview */
async function getPatientAllergens(patientId: string): Promise<string[]> {
  const interview = await prisma.interview.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    select: { answers: true },
  });

  if (!interview?.answers) return [];

  const answers = decryptJson(interview.answers) as Record<string, unknown>;
  const allergies = answers.allergies ?? answers.alergie ?? [];

  if (!Array.isArray(allergies)) return [];

  return allergies.filter((a): a is string => typeof a === 'string');
}

/** Build PlanMeal from a scaled recipe */
async function buildPlanMealFromRecipe(
  recipeId: string,
  mealName: string,
  scaledNutrition: { kcal: number; proteinG: number; fatG: number; carbsG: number },
  ingredients: Array<{ ingredientId: string; displayName: string | null; grams: number }>,
): Promise<PlanMeal> {
  // Load recipe details (instruction steps)
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      title: true,
      totalTimeMinutes: true,
      instructionSteps: {
        select: { stepNumber: true, instruction: true },
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  const items: PlanItem[] = ingredients.map((ing) => ({
    name: ing.displayName ?? 'Składnik',
    grams: ing.grams,
    kcal: 0, // Individual ingredient kcal not tracked at item level
    protein: 0,
    fat: 0,
    carbs: 0,
  }));

  // Set totals on the first item for plan compatibility
  if (items.length > 0) {
    items[0].kcal = scaledNutrition.kcal;
    items[0].protein = scaledNutrition.proteinG;
    items[0].fat = scaledNutrition.fatG;
    items[0].carbs = scaledNutrition.carbsG;
  }

  const meal: PlanMeal = {
    name: mealName,
    items,
  };

  // Attach recipe steps if available (with scaled weight references)
  const instructionSteps = recipe?.instructionSteps;
  if (instructionSteps && instructionSteps.length > 0) {
    meal.recipe = {
      prepTimeMin: recipe?.totalTimeMinutes ?? 0,
      steps: instructionSteps.map((s) => s.instruction),
    };
  }

  return meal;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Find recipe-based swap alternatives for a meal.
 *
 * 1. Compute macros of originalMeal from items
 * 2. Map mealName to RecipeMealType
 * 3. Build RecipeCandidateQuery with target macros
 * 4. Get patient allergens from latest interview
 * 5. Call findCandidates()
 * 6. Take top `count` results
 * 7. For each: scale recipe, load details, build PlanMeal
 */
export async function findRecipeSwapAlternatives(
  params: RecipeSwapParams,
): Promise<RecipeSwapAlternative[]> {
  const { originalMeal, mealName, patientId, excludeRecipeIds, count = DEFAULT_COUNT } = params;

  // 1. Compute macros of the original meal
  const macros = sumMealMacros(originalMeal);

  if (macros.kcal <= 0) return [];

  // 2. Map meal name to meal type
  const mealType = mealNameToMealType(mealName);

  // 3-4. Get patient allergens
  const allergens = await getPatientAllergens(patientId);

  // 5. Build query and find candidates
  const query: RecipeCandidateQuery = {
    mealType,
    targetKcal: macros.kcal,
    targetProteinG: macros.protein,
    targetFatG: macros.fat,
    targetCarbsG: macros.carbs,
    excludeAllergens: allergens.length > 0 ? allergens : undefined,
    excludeRecipeIds,
    limit: CANDIDATE_LIMIT,
    season: new Date().getMonth() + 1,
  };

  const candidates = await findCandidates(query);

  // 6. Take top N results
  const topCandidates = candidates.slice(0, count);

  // 7. Build alternatives
  const alternatives: RecipeSwapAlternative[] = [];

  for (const candidate of topCandidates) {
    try {
      const scaled = await scaleRecipeForMeal(candidate.recipeId, {
        targetKcal: macros.kcal,
        targetProteinG: macros.protein,
        targetFatG: macros.fat,
        targetCarbsG: macros.carbs,
      });

      const meal = await buildPlanMealFromRecipe(
        candidate.recipeId,
        mealName,
        scaled.scaledNutrition,
        scaled.ingredients,
      );

      alternatives.push({
        recipeId: candidate.recipeId,
        title: candidate.title,
        meal,
        reason: `Podobne makro (${Math.round(scaled.scaledNutrition.kcal)} kcal), ${candidate.category || 'inna kategoria'}`,
        fitScore: candidate.nutritionFitScore,
        totalScore: candidate.totalScore,
      });
    } catch {
      // Skip recipes that fail to scale — continue with the next candidate
      continue;
    }
  }

  return alternatives;
}
