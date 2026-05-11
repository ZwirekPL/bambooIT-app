import { prisma } from '@db';
import { buildCategorizedShoppingList, type PlanContent } from './planValidation.service';

/**
 * Calculate average daily macros from plan content items.
 */
export function calculateActualMacros(content: PlanContent): { kcal: number; proteinG: number; fatG: number; carbsG: number } {
  let totalKcal = 0, totalP = 0, totalF = 0, totalC = 0;
  for (const day of content.days ?? []) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        totalKcal += item.kcal ?? 0;
        totalP += item.protein ?? 0;
        totalF += item.fat ?? 0;
        totalC += item.carbs ?? 0;
      }
    }
  }
  const numDays = content.days?.length || 1;
  const avgP = Math.round(totalP / numDays);
  const avgF = Math.round(totalF / numDays);
  const avgC = Math.round(totalC / numDays);
  return {
    kcal: Math.round(avgP * 4 + avgF * 9 + avgC * 4),
    proteinG: avgP,
    fatG: avgF,
    carbsG: avgC,
  };
}

/**
 * Round grams for portioned products (eggs, bread slices) to whole units.
 *
 * NOTE: This only rounds when the ingredient name EXACTLY matches a CleanProduct
 * in the DB. Descriptive AI names (e.g. "2 duże jajka - 120g po rozbiciu") won't
 * match and are left unchanged — this is intentional to avoid breaking macro
 * consistency. The shopping list builder handles display-level portion snapping
 * separately via snapPortionedTotal().
 */
export async function roundPortionedProducts(content: PlanContent): Promise<number> {
  // Collect all ingredient names
  const allNames = new Set<string>();
  for (const day of content.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        allNames.add(item.name);
        for (const ing of item.ingredients ?? []) {
          allNames.add(ing.name);
        }
      }
    }
  }

  // Look up products with portion data (Sztuka, Kromka)
  const portionProducts = await prisma.cleanProduct.findMany({
    where: { name: { in: Array.from(allNames) } },
    select: {
      name: true,
      portions: {
        where: { portionName: { in: ['Sztuka', 'Kromka'] } },
        select: { portionName: true, weightG: true },
      },
    },
  });

  const portionMap = new Map<string, number>();
  for (const p of portionProducts) {
    if (p.portions.length === 0) continue;
    const kromka = p.portions.find(por => por.portionName === 'Kromka');
    const best = kromka ?? p.portions[0];
    portionMap.set(p.name, Number(best.weightG));
  }

  if (portionMap.size === 0) return 0;

  let corrected = 0;
  for (const day of content.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const itemUnit = portionMap.get(item.name);
        if (itemUnit && itemUnit > 0 && item.grams % itemUnit !== 0) {
          item.grams = Math.max(itemUnit, Math.round(item.grams / itemUnit) * itemUnit);
          corrected++;
        }
        for (const ing of item.ingredients ?? []) {
          const ingUnit = portionMap.get(ing.name);
          if (ingUnit && ingUnit > 0 && ing.grams % ingUnit !== 0) {
            ing.grams = Math.max(ingUnit, Math.round(ing.grams / ingUnit) * ingUnit);
          }
        }
      }
    }
  }
  return corrected;
}

/**
 * Add categorized shopping list to plan content.
 */
export function addShoppingList(content: PlanContent): PlanContent {
  const categories = buildCategorizedShoppingList(content);
  return { ...content, shoppingList: categories };
}

/**
 * Full post-processing pipeline for DB-first generated plans.
 * Mutates content in place and returns updated macros.
 */
export async function postProcessPlan(content: PlanContent): Promise<{
  macros: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  portionsRounded: number;
}> {
  // 1. Round portioned products
  const portionsRounded = await roundPortionedProducts(content);

  // 2. Add shopping list
  const categories = buildCategorizedShoppingList(content);
  (content as Record<string, unknown>).shoppingList = categories;

  // 3. Calculate actual macros
  const macros = calculateActualMacros(content);

  return { macros, portionsRounded };
}
