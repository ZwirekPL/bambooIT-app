// ─── Parse raw diet plan content into structured data ─────────────────────────

import type { Day, Meal, MealItem, ParsedContent, ShoppingCategory, Recipe, MealRecipeData } from './types';
import { MEAL_LABELS } from './types';
import {
  buildCategorizedShoppingList,
  type PlanContent,
} from '../services/planValidation.service';

// ─── Meal name normalization ──────────────────────────────────────────────────

function normalizeMealName(name: string): string {
  const lower = name.toLowerCase().trim();

  // Check if it matches a known label
  if (MEAL_LABELS[lower]) return MEAL_LABELS[lower];

  // Check for "Posiłek (snack)" or similar placeholder patterns
  if (lower.includes('posiłek') && lower.includes('snack')) return 'Przekąska';
  if (lower === 'snack') return 'Przekąska';

  // Return original with first letter capitalized
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─── Detect meal type for grouping ────────────────────────────────────────────

function detectMealType(name: string, index: number): string {
  const lower = name.toLowerCase().trim();

  if (lower.includes('śniadanie') || lower.includes('breakfast')) {
    if (lower.includes('drug') || lower.includes('ii') || lower.includes('second')) {
      return 'Drugie śniadanie';
    }
    return 'Śniadanie';
  }
  if (lower.includes('obiad') || lower.includes('lunch')) return 'Obiad';
  if (lower.includes('kolacja') || lower.includes('dinner') || lower.includes('supper')) return 'Kolacja';
  if (lower.includes('przekąsk') || lower.includes('snack') || lower.includes('posiłek')) return 'Przekąska';

  // Fallback by index position
  const typeByIndex = ['Śniadanie', 'Obiad', 'Przekąska', 'Kolacja'];
  return typeByIndex[index] ?? 'Posiłek';
}

// ─── Check if a name looks like a generic meal type ───────────────────────────

const MEAL_TYPE_KEYWORDS = [
  'śniadanie', 'obiad', 'kolacja', 'przekąska', 'posiłek',
  'breakfast', 'lunch', 'dinner', 'supper', 'snack',
  'drugie śniadanie', 'ii śniadanie', 'podwieczorek',
];

export function isMealTypeName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return MEAL_TYPE_KEYWORDS.some(k => lower === k || lower.startsWith(k + ' '));
}

/**
 * Resolve the "effective" meal display name.
 *
 * `meal.name` often stores a generic meal-type label like "Śniadanie" / "Obiad" — the real
 * dish name (e.g. "Naleśniki z mąki orkiszowej") lives in `meal.items[0].name`. When a
 * consumer needs the dish name (e.g. for comparing against `slotDecision.chosen.title`),
 * it should call this helper so it doesn't mistake a generic label for a manual edit.
 */
export function resolveEffectiveMealName(mealName: string | undefined, firstItemName: string | undefined): string {
  const m = (mealName ?? '').trim();
  const i = (firstItemName ?? '').trim();
  if (isMealTypeName(m) && i && !isMealTypeName(i)) return i;
  return m;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseContent(content: Record<string, unknown>): ParsedContent {
  const rawDays = (content.days ?? []) as Array<Record<string, unknown>>;

  // Normalize meal names and detect types, extract recipes
  const days: Day[] = [];
  const extractedRecipes: Recipe[] = [];

  for (const rawDay of rawDays) {
    const dayName = (rawDay.day ?? '') as string;
    const rawMeals = (rawDay.meals ?? []) as Array<Record<string, unknown>>;
    const meals: Meal[] = [];

    for (let idx = 0; idx < rawMeals.length; idx++) {
      const rawMeal = rawMeals[idx];
      const mealName = (rawMeal.name ?? '') as string;
      const mealType = detectMealType(mealName, idx);
      const rawItems = (rawMeal.items ?? []) as Array<string | Record<string, unknown>>;
      const rawRecipe = rawMeal.recipe as Record<string, unknown> | undefined;

      // Parse items
      const items: (string | MealItem)[] = rawItems.map(rawItem => {
        if (typeof rawItem === 'string') return rawItem;
        const ingredients = Array.isArray(rawItem.ingredients)
          ? (rawItem.ingredients as Array<{ name: string; grams: number }>)
          : undefined;
        return {
          name: (rawItem.name ?? '') as string,
          grams: rawItem.grams as number | undefined,
          kcal: rawItem.kcal as number | undefined,
          protein: rawItem.protein as number | undefined,
          fat: rawItem.fat as number | undefined,
          carbs: rawItem.carbs as number | undefined,
          ingredients,
        } as MealItem;
      });

      // Determine display name:
      // - If items[0].name is a real dish name (not a meal type), use it
      // - If meal.name is already a dish name (not a generic meal type), keep it
      const firstItem = items[0];
      const itemName = (typeof firstItem === 'object' && firstItem !== null) ? firstItem.name : null;

      let displayName: string;
      if (isMealTypeName(mealName) && itemName && !isMealTypeName(itemName)) {
        // meal.name is generic type, items[0].name is the actual dish name
        displayName = itemName;
      } else if (!isMealTypeName(mealName)) {
        // meal.name is already a dish name
        displayName = normalizeMealName(mealName);
      } else {
        // Both are generic — use normalized meal name
        displayName = normalizeMealName(mealName);
      }

      // Parse recipe data from meal
      let recipeData: MealRecipeData | undefined;
      if (rawRecipe && Array.isArray(rawRecipe.steps) && rawRecipe.steps.length > 0) {
        recipeData = {
          prepTimeMin: rawRecipe.prepTimeMin as number | undefined,
          steps: rawRecipe.steps as string[],
          tips: (rawRecipe.tips ?? null) as string | null,
        };

        // Extract recipe for the recipes section
        const recipeIngredients: string[] = [];
        for (const item of items) {
          if (typeof item === 'object' && item.ingredients && item.ingredients.length > 0) {
            for (const ing of item.ingredients) {
              recipeIngredients.push(ing.grams > 0 ? `${ing.name} — ${Math.round(ing.grams)}g` : ing.name);
            }
          }
        }

        extractedRecipes.push({
          name: displayName,
          ingredients: recipeIngredients.length > 0
            ? recipeIngredients
            : items.map(it => typeof it === 'string' ? it : it.name),
          steps: recipeData.steps,
        });
      }

      meals.push({
        name: displayName,
        items,
        recipe: recipeData,
        _type: mealType,
      });
    }

    days.push({ day: dayName, meals });
  }

  const mealsPerDay = days.length > 0 ? (days[0].meals?.length ?? 0) : 0;

  // ─── Generate shopping list — delegates to planValidation builder for aggregation,
  //     junk filter, min-purchase portion, and taste-only detection ─────────────
  const categorized = buildCategorizedShoppingList(content as unknown as PlanContent);

  const formatShoppingItem = (it: { name: string; totalGrams: number; pieces?: string; tasteOnly?: boolean }): string => {
    if (it.tasteOnly) return `${it.name} (do smaku)`;
    const rounded = Math.round(it.totalGrams);
    const pieces = it.pieces ? ` (${it.pieces})` : '';
    return rounded > 0 ? `${it.name} — ${rounded}g${pieces}` : `${it.name}${pieces}`;
  };

  let shoppingList: ShoppingCategory[] = categorized.map(cat => ({
    category: cat.category,
    items: cat.items.map(formatShoppingItem).sort(),
  }));

  // Override with content-provided shopping list if available and valid
  const contentShopping = content.shoppingList;
  if (contentShopping && typeof contentShopping === 'object') {
    const normalizeItem = (item: unknown): string | null => {
      if (typeof item === 'string') {
        return item.trim() || null;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const name = String(obj.name ?? '').trim();
        if (!name) return null; // Skip items with empty names
        const grams = Number(obj.totalGrams ?? obj.grams ?? 0);
        const pieces = obj.pieces ? ` (${obj.pieces})` : '';
        return grams > 0 ? `${name} — ${Math.round(grams)}g${pieces}` : `${name}${pieces}`;
      }
      return null;
    };

    let overrideList: ShoppingCategory[] = [];

    if (Array.isArray(contentShopping)) {
      const items = contentShopping.map(normalizeItem).filter((x): x is string => x !== null);
      if (items.length > 0) {
        overrideList = [{ category: 'Wszystkie produkty', items }];
      }
    } else {
      for (const [category, rawItems] of Object.entries(contentShopping as Record<string, unknown[]>)) {
        const items = (rawItems ?? []).map(normalizeItem).filter((x): x is string => x !== null);
        if (items.length > 0) {
          overrideList.push({ category, items });
        }
      }
    }

    // Only use override if it actually has valid items
    if (overrideList.length > 0) {
      shoppingList = overrideList;
    }
  }

  // ─── Recipes: use content.recipes if available, otherwise extracted from meals ──
  let recipes = (content.recipes ?? []) as Recipe[];
  if (recipes.length === 0 && extractedRecipes.length > 0) {
    recipes = extractedRecipes;
  }

  const rules = (content.rules ?? []) as string[];

  return { days, shoppingList, recipes, rules, mealsPerDay };
}
