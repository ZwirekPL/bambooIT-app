/**
 * 37.7 — Meal Prep Friendly auto-computation.
 * 37.8 — Seasonality auto-tagging.
 */

import { prisma } from '@db';

// ─── 37.7 Meal prep friendly ────────────────────────────────────────────────

const BATCH_FRIENDLY_CATEGORIES = ['zupy', 'gulasz', 'zapiekanka', 'curry', 'sos', 'potrawka', 'leczo', 'chili'];

export function computeMealPrepFriendly(recipe: {
  cookTimeMinutes: number | null;
  servings: number;
  category: string | null;
  title: string;
}): boolean {
  const hasCookTime = (recipe.cookTimeMinutes ?? 0) >= 5;
  const multiServing = recipe.servings >= 2;
  const batchCategory = BATCH_FRIENDLY_CATEGORIES.some(
    (cat) => recipe.category?.toLowerCase().includes(cat) || recipe.title.toLowerCase().includes(cat)
  );
  return hasCookTime && (multiServing || batchCategory);
}

export async function updateRecipeMealPrepFlag(recipeId: string): Promise<boolean> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { cookTimeMinutes: true, servings: true, category: true, title: true },
  });
  if (!recipe) return false;

  const mealPrepFriendly = computeMealPrepFriendly(recipe);
  await prisma.recipe.update({
    where: { id: recipeId },
    data: { mealPrepFriendly },
  });
  return mealPrepFriendly;
}

// ─── 37.8 Seasonality ──────────────────────────────────────────────────────

// Seasonal ingredients mapped to months (1=January, 12=December)
const SEASONAL_INGREDIENTS: Record<string, number[]> = {
  szparagi:            [4, 5, 6],
  rzodkiewka:          [4, 5, 6, 7],
  rabarbar:            [4, 5, 6],
  szczypiorek:         [3, 4, 5, 6, 7, 8, 9],
  sałata:              [4, 5, 6, 7, 8, 9],
  szpinak:             [3, 4, 5, 9, 10],
  truskawki:           [5, 6, 7],
  kalarepa:            [5, 6, 7, 8, 9],
  pomidory:            [6, 7, 8, 9],
  ogórki:              [6, 7, 8, 9],
  papryka:             [7, 8, 9, 10],
  cukinia:             [6, 7, 8, 9],
  bakłażan:            [7, 8, 9],
  maliny:              [6, 7, 8],
  borówki:             [6, 7, 8, 9],
  arbuz:               [7, 8],
  kukurydza:           [7, 8, 9],
  'fasolka szparagowa': [6, 7, 8, 9],
  dynia:               [9, 10, 11],
  gruszka:             [8, 9, 10],
  jabłka:              [7, 8, 9, 10, 11],
  śliwki:              [7, 8, 9],
  kapusta:             [9, 10, 11, 12, 1, 2, 3],
  burak:               [9, 10, 11, 12, 1, 2],
  brukselka:           [10, 11, 12, 1, 2],
  topinambur:          [10, 11, 12, 1, 2, 3],
  pigwa:               [10, 11],
  'kapusta kiszona':   [10, 11, 12, 1, 2, 3],
  buraki:              [9, 10, 11, 12, 1, 2],
  seler:               [9, 10, 11, 12, 1, 2, 3],
  por:                 [9, 10, 11, 12, 1, 2, 3],
  brukiew:             [10, 11, 12, 1, 2, 3],
  jarmuż:              [10, 11, 12, 1, 2, 3],
  mandarynki:          [11, 12, 1, 2],
  grapefruit:          [11, 12, 1, 2, 3],
};

export function computeSeasons(ingredientNames: string[]): number[] {
  const months = new Set<number>();
  const lowerNames = ingredientNames.map((n) => n.toLowerCase());

  for (const [keyword, seasonMonths] of Object.entries(SEASONAL_INGREDIENTS)) {
    if (lowerNames.some((name) => name.includes(keyword))) {
      for (const m of seasonMonths) months.add(m);
    }
  }

  // If no seasonal ingredients found, recipe is all-season
  if (months.size === 0) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return [...months].sort((a, b) => a - b);
}

export async function updateRecipeSeasons(recipeId: string): Promise<number[]> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      ingredients: {
        select: {
          displayName: true,
          cleanProduct: { select: { name: true } },
          foodProduct: { select: { name: true } },
        },
      },
    },
  });
  if (!recipe) return [];

  const names = recipe.ingredients.map(
    (i) => i.cleanProduct?.name ?? i.foodProduct?.name ?? i.displayName ?? ''
  );
  const seasons = computeSeasons(names);

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { seasons },
  });

  return seasons;
}
