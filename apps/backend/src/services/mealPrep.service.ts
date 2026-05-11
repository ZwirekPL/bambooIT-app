/**
 * Meal Prep Planner
 *
 * Identifies meal-prep friendly recipes in a diet plan and generates
 * a "Sunday prep" shopping list and schedule.
 */
import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { decryptJson } from '../utils/encryption';
import type { PlanContent, PlanDay, PlanMeal, PlanItem, PlanIngredient } from './planValidation.service';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface MealPrepPlan {
  /** Recipes that can be batch-prepped */
  batchRecipes: Array<{
    recipeId: string | null;
    title: string;
    servingsNeeded: number;
    totalPrepTimeMin: number;
    storageInfo: string;
    daysUsed: string[];
  }>;
  /** Total prep time for Sunday session */
  totalPrepTimeMin: number;
  /** Consolidated shopping list for prepped meals */
  shoppingList: Array<{ name: string; totalGrams: number; unit: string }>;
  /** Suggested prep order (longest first) */
  prepOrder: string[];
  /** Meals that DON'T need prep (fresh daily) */
  freshDaily: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function extractDays(content: Record<string, unknown>): PlanDay[] {
  const raw = content['days'];
  if (!Array.isArray(raw)) return [];
  return raw as PlanDay[];
}

function normalizeForAggregation(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

function extractIngredients(item: PlanItem): Array<{ name: string; grams: number }> {
  const ingredients = (item as PlanItem & { ingredients?: PlanIngredient[] }).ingredients;
  if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
    return ingredients.map(ing => ({ name: ing.name, grams: Number(ing.grams) || 0 }));
  }
  return [{ name: item.name, grams: Number(item.grams) || 0 }];
}

// ─── Storage info logic ─────────────────────────────────────────────────────────

const STORAGE_RULES: Array<{ keywords: string[]; info: string }> = [
  { keywords: ['zupa', 'bulion', 'rosół', 'krem'], info: 'Zamrażarka do 1 miesiąca' },
  { keywords: ['sałat', 'surówka', 'mix'], info: 'Lodówka 1 dzień (bez sosu)' },
  { keywords: ['kasza', 'ryż', 'makaron', 'quinoa', 'kuskus', 'płatki'], info: 'Lodówka 3-4 dni' },
  { keywords: ['kurczak', 'indyk', 'mięso', 'wołowina', 'wieprzowina', 'filet', 'pierś'], info: 'Lodówka 2-3 dni lub zamrażarka do 1 miesiąca' },
  { keywords: ['ryba', 'łosoś', 'dorsz', 'tuńczyk', 'makrela'], info: 'Lodówka 1-2 dni lub zamrażarka do 1 miesiąca' },
  { keywords: ['sos', 'dip', 'hummus', 'pesto'], info: 'Lodówka 3-5 dni' },
  { keywords: ['ciasto', 'muffin', 'pancake', 'naleśnik'], info: 'Zamrażarka do 2 tygodni' },
];

function getStorageInfo(mealName: string): string {
  const lower = mealName.toLowerCase();
  for (const rule of STORAGE_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.info;
    }
  }
  return 'Lodówka 2-3 dni';
}

/** Estimate prep time from recipe or by meal name heuristic */
function estimatePrepTime(mealName: string, recipeTimeMin: number | null): number {
  if (recipeTimeMin && recipeTimeMin > 0) return recipeTimeMin;

  const lower = mealName.toLowerCase();
  if (['zupa', 'bulion', 'rosół', 'krem'].some(kw => lower.includes(kw))) return 40;
  if (['sałat', 'surówka'].some(kw => lower.includes(kw))) return 15;
  if (['kasza', 'ryż', 'makaron', 'quinoa'].some(kw => lower.includes(kw))) return 20;
  if (['kurczak', 'indyk', 'mięso', 'filet', 'pierś'].some(kw => lower.includes(kw))) return 35;
  return 25; // default
}

// ─── Meal occurrence tracking ───────────────────────────────────────────────────

interface MealOccurrence {
  mealName: string;
  days: string[];
  prepTimeMin: number;
  ingredients: Map<string, { displayName: string; totalGrams: number }>;
}

function trackMealOccurrences(days: PlanDay[]): Map<string, MealOccurrence> {
  const occurrences = new Map<string, MealOccurrence>();

  for (const day of days) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        const key = normalizeForAggregation(item.name);
        const existing = occurrences.get(key);

        if (existing) {
          if (!existing.days.includes(day.day)) {
            existing.days.push(day.day);
          }
          // Accumulate ingredients
          for (const ing of extractIngredients(item)) {
            const ingKey = normalizeForAggregation(ing.name);
            const prev = existing.ingredients.get(ingKey);
            if (prev) {
              prev.totalGrams += ing.grams;
            } else {
              existing.ingredients.set(ingKey, { displayName: ing.name, totalGrams: ing.grams });
            }
          }
        } else {
          const ingredients = new Map<string, { displayName: string; totalGrams: number }>();
          for (const ing of extractIngredients(item)) {
            const ingKey = normalizeForAggregation(ing.name);
            const prev = ingredients.get(ingKey);
            if (prev) {
              prev.totalGrams += ing.grams;
            } else {
              ingredients.set(ingKey, { displayName: ing.name, totalGrams: ing.grams });
            }
          }

          const recipeTime = (meal.recipe?.prepTimeMin as number | undefined) ?? null;
          occurrences.set(key, {
            mealName: item.name,
            days: [day.day],
            prepTimeMin: estimatePrepTime(item.name, recipeTime),
            ingredients,
          });
        }
      }
    }
  }

  return occurrences;
}

// ─── Main function ──────────────────────────────────────────────────────────────

export async function generateMealPrepPlan(planId: string): Promise<MealPrepPlan> {
  const plan = await prisma.dietPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

  const content = decryptJson(plan.content) as Record<string, unknown>;
  const days = extractDays(content);

  if (days.length === 0) {
    return {
      batchRecipes: [],
      totalPrepTimeMin: 0,
      shoppingList: [],
      prepOrder: [],
      freshDaily: [],
    };
  }

  const occurrences = trackMealOccurrences(days);

  // Separate meals: batch-prep (appear 2+ times) vs fresh daily
  const batchRecipes: MealPrepPlan['batchRecipes'] = [];
  const freshDaily: string[] = [];
  const batchIngredients = new Map<string, { displayName: string; totalGrams: number }>();

  // Look up mealPrepFriendly recipes from DB
  const mealNames = [...occurrences.values()].map(o => o.mealName);
  const dbRecipes = await prisma.recipe.findMany({
    where: {
      title: { in: mealNames },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      mealPrepFriendly: true,
      totalTimeMinutes: true,
    },
  });
  const recipeMap = new Map(dbRecipes.map(r => [normalizeForAggregation(r.title), r]));

  for (const [key, occ] of occurrences) {
    const dbRecipe = recipeMap.get(key);

    if (occ.days.length >= 2) {
      // Check if mealPrepFriendly (default true for 2+ occurrences)
      const isFriendly = dbRecipe?.mealPrepFriendly ?? true;

      if (isFriendly) {
        const prepTime = dbRecipe?.totalTimeMinutes ?? occ.prepTimeMin;

        batchRecipes.push({
          recipeId: dbRecipe?.id ?? null,
          title: occ.mealName,
          servingsNeeded: occ.days.length,
          totalPrepTimeMin: prepTime,
          storageInfo: getStorageInfo(occ.mealName),
          daysUsed: occ.days,
        });

        // Collect ingredients for batch shopping list
        for (const [ingKey, ingData] of occ.ingredients) {
          const prev = batchIngredients.get(ingKey);
          if (prev) {
            prev.totalGrams += ingData.totalGrams;
          } else {
            batchIngredients.set(ingKey, { ...ingData });
          }
        }
      } else {
        freshDaily.push(occ.mealName);
      }
    } else {
      freshDaily.push(occ.mealName);
    }
  }

  // Build consolidated shopping list for batch meals
  const shoppingList = [...batchIngredients.values()]
    .map(({ displayName, totalGrams }) => ({
      name: displayName,
      totalGrams: Math.round(totalGrams),
      unit: 'g',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  // Sort by prep time descending (start with longest)
  batchRecipes.sort((a, b) => b.totalPrepTimeMin - a.totalPrepTimeMin);

  const totalPrepTimeMin = batchRecipes.reduce((sum, r) => sum + r.totalPrepTimeMin, 0);
  const prepOrder = batchRecipes.map(r => r.title);

  return {
    batchRecipes,
    totalPrepTimeMin,
    shoppingList,
    prepOrder,
    freshDaily: [...new Set(freshDaily)],
  };
}
