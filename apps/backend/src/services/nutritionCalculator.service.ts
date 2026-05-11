/**
 * 36.3 — Backend Nutrition Calculator.
 * Computes kcal/protein/fat/carbs from ingredient grams + CleanProductNutrients DB.
 * Used in V2 pipeline where AI provides only dish names + ingredients with grams.
 */

import { prisma } from '@db';
import type { PlanContent, PlanDay, PlanMeal, PlanItem } from './planValidation.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NutrientsPer100g {
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

export interface NutritionCalculationReport {
  totalIngredients: number;
  matchedCount: number;
  unmatchedCount: number;
  fallbackCount: number;
  unmatchedNames: string[];
  fallbackDetails: Array<{ name: string; category: string; usedValues: NutrientsPer100g }>;
}

// ─── Fallback Nutrition Table ───────────────────────────────────────────────

type FallbackCategory =
  | 'vegetable' | 'fruit' | 'meat' | 'poultry' | 'fish'
  | 'dairy' | 'grain' | 'fat' | 'legume' | 'nut'
  | 'egg' | 'beverage' | 'unknown';

const FALLBACK_NUTRITION: Record<FallbackCategory, NutrientsPer100g> = {
  vegetable:  { kcalPer100g: 25,   proteinPer100g: 1.5, fatPer100g: 0.3, carbsPer100g: 4.5 },
  fruit:      { kcalPer100g: 50,   proteinPer100g: 0.7, fatPer100g: 0.3, carbsPer100g: 12 },
  meat:       { kcalPer100g: 180,  proteinPer100g: 22,  fatPer100g: 10,  carbsPer100g: 0 },
  poultry:    { kcalPer100g: 150,  proteinPer100g: 25,  fatPer100g: 5,   carbsPer100g: 0 },
  fish:       { kcalPer100g: 120,  proteinPer100g: 20,  fatPer100g: 4,   carbsPer100g: 0 },
  dairy:      { kcalPer100g: 80,   proteinPer100g: 5,   fatPer100g: 4,   carbsPer100g: 5 },
  grain:      { kcalPer100g: 340,  proteinPer100g: 10,  fatPer100g: 2,   carbsPer100g: 70 },
  fat:        { kcalPer100g: 800,  proteinPer100g: 0,   fatPer100g: 90,  carbsPer100g: 0 },
  legume:     { kcalPer100g: 120,  proteinPer100g: 8,   fatPer100g: 0.5, carbsPer100g: 20 },
  nut:        { kcalPer100g: 600,  proteinPer100g: 18,  fatPer100g: 50,  carbsPer100g: 15 },
  egg:        { kcalPer100g: 155,  proteinPer100g: 13,  fatPer100g: 11,  carbsPer100g: 1 },
  beverage:   { kcalPer100g: 5,    proteinPer100g: 0.1, fatPer100g: 0,   carbsPer100g: 1 },
  unknown:    { kcalPer100g: 100,  proteinPer100g: 3,   fatPer100g: 3,   carbsPer100g: 15 },
};

// ─── Category classification ────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<[FallbackCategory, RegExp]> = [
  ['fat',     /oli[wv]|masło|olej|smalec|margary|dressing|sos sałatkowy|mayonnaise|majonez|śmietana 30|śmietanka 30/i],
  ['egg',     /jaj[ko]|białko jaja|żółtko/i],
  ['poultry', /kurczak|indyk|drob|filet z kurczaka|pierś z indyka|pierś kurczaka|udko|skrzydełk/i],
  ['fish',    /łosoś|dorsz|tuńczyk|pstrąg|ryb[ay]|śledź|makrela|sardynk|morszczuk|mintaj|karp|flądra|tilapia|krewet/i],
  ['meat',    /wołowin|wieprzow|cielęc|baranin|jagnięc|szynk|kiełbas|boczek|schabowy|polędwic|mięs/i],
  ['dairy',   /mleko|jogurt|kefir|twaróg|ser |serek|maślank|śmietan|mozzarell|ricott|feta|parmezan|camembert/i],
  ['nut',     /orzech|migdał|orzeszy|pistacj|nerkowc|pecan|makadami|kasztan|siemię|nasion|pestk|ziarnist|chia|sezam|słonecznik|dyni nasion|lniany/i],
  ['legume',  /fasol|soczewic|ciecierzyc|groch|soj[aoe]|tofu|tempeh|edamame|bób|łubin|hummus/i],
  ['grain',   /ryż|kasza|makaron|chleb|bułk|mąka|płatki|owsian|granola|musli|kukurydz|tortill|pita|naleśnik|bagiet|rogalik|bulgur|kuskus|quinoa|gryczane|jaglane|orkisz|żytn/i],
  ['fruit',   /jabłk|banan|gruszk|truskawk|malina|jagod|borówk|wisn|czereśni|pomarańcz|mandarynk|grejpfrut|cytryn|limone|kiwi|mango|ananas|arbuz|melon|śliwk|brzoskwini|morela|nektarynk|winogrono|avocado|awokado|rodzynk|daktyl|fig[aiy]/i],
  ['vegetable', /pomidor|ogórek|sałata|marchew|cebul|czosnek|papryka|brokuł|kalafior|szpinak|kapust|burak|dyni[ae]|cukini|bakłażan|por[y ]|rzodkiew|seler|pietru|koper|bazylia|rukola|jarmuż|szparag|grzyb|pieczark|fasola szparagow|kabaczek|kukurydza|rzep[aą]|batata?/i],
  ['beverage', /woda|sok |herbata|kawa|napój|kompot/i],
];

export function classifyUnmatched(name: string): FallbackCategory {
  const lower = name.toLowerCase();
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(lower)) return category;
  }
  return 'unknown';
}

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Batch-fetch nutrition data for a list of ingredient names from CleanProduct + CleanProductNutrients.
 * Uses case-insensitive exact match first, then ILIKE fallback for unmatched.
 */
async function batchLookupNutrients(
  ingredientNames: string[],
): Promise<Map<string, NutrientsPer100g>> {
  if (ingredientNames.length === 0) return new Map();

  // Normalize names for lookup
  const uniqueNames = [...new Set(ingredientNames.map((n) => n.trim()))];

  const rows = await prisma.cleanProduct.findMany({
    where: {
      name: { in: uniqueNames, mode: 'insensitive' },
    },
    include: {
      nutrients: {
        select: {
          kcalPer100g: true,
          proteinPer100g: true,
          fatPer100g: true,
          carbsPer100g: true,
        },
      },
    },
  });

  const result = new Map<string, NutrientsPer100g>();
  for (const row of rows) {
    if (!row.nutrients) continue;
    result.set(row.name.toLowerCase(), {
      kcalPer100g: Number(row.nutrients.kcalPer100g),
      proteinPer100g: Number(row.nutrients.proteinPer100g),
      fatPer100g: Number(row.nutrients.fatPer100g),
      carbsPer100g: Number(row.nutrients.carbsPer100g),
    });
  }

  return result;
}

/**
 * Compute nutrition for an entire V2 plan (no kcal/B/T/W from AI).
 * Looks up each ingredient in CleanProduct DB, falls back to category estimates.
 * Returns enriched PlanContent with kcal/B/T/W per item + report.
 */
export async function computeNutritionFromIngredients(
  content: PlanContent,
): Promise<{ enrichedContent: PlanContent; report: NutritionCalculationReport; nutrientMap: Map<string, NutrientsPer100g> }> {
  // 1. Collect all unique ingredient names
  const allIngredientNames: string[] = [];
  for (const day of content.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        if (item.ingredients?.length) {
          for (const ing of item.ingredients) {
            allIngredientNames.push(ing.name.trim());
          }
        }
      }
    }
  }

  // 2. Batch lookup from DB
  const nutrientMap = await batchLookupNutrients(allIngredientNames);

  // 3. Process each item
  const report: NutritionCalculationReport = {
    totalIngredients: 0,
    matchedCount: 0,
    unmatchedCount: 0,
    fallbackCount: 0,
    unmatchedNames: [],
    fallbackDetails: [],
  };

  const seenFallback = new Set<string>();

  const enrichedDays: PlanDay[] = content.days.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => {
        if (!item.ingredients?.length) {
          // V1 item (already has kcal etc.) or no ingredients — pass through
          return item;
        }

        let totalKcal = 0;
        let totalProtein = 0;
        let totalFat = 0;
        let totalCarbs = 0;
        let totalGrams = 0;

        for (const ing of item.ingredients) {
          report.totalIngredients++;
          const nameKey = ing.name.trim().toLowerCase();
          const grams = ing.grams || 0;
          totalGrams += grams;

          let nutrients = nutrientMap.get(nameKey);

          if (nutrients) {
            report.matchedCount++;
          } else {
            // Fallback
            const category = classifyUnmatched(ing.name);
            nutrients = FALLBACK_NUTRITION[category];
            report.fallbackCount++;

            if (!seenFallback.has(nameKey)) {
              seenFallback.add(nameKey);
              report.fallbackDetails.push({
                name: ing.name,
                category,
                usedValues: nutrients,
              });
              if (category === 'unknown') {
                report.unmatchedCount++;
                report.unmatchedNames.push(ing.name);
              }
            }
          }

          totalKcal += (grams * nutrients.kcalPer100g) / 100;
          totalProtein += (grams * nutrients.proteinPer100g) / 100;
          totalFat += (grams * nutrients.fatPer100g) / 100;
          totalCarbs += (grams * nutrients.carbsPer100g) / 100;
        }

        return {
          ...item,
          grams: Math.round(totalGrams),
          kcal: Math.round(totalKcal),
          protein: Math.round(totalProtein * 10) / 10,
          fat: Math.round(totalFat * 10) / 10,
          carbs: Math.round(totalCarbs * 10) / 10,
        };
      }),
    })),
  }));

  return {
    enrichedContent: { days: enrichedDays },
    report,
    nutrientMap,
  };
}

/**
 * Scale ingredient grams proportionally to hit a target kcal for an item.
 * Used by autoAdjust in V2 mode.
 */
export function scaleItemIngredients(item: PlanItem, scaleFactor: number): PlanItem {
  if (!item.ingredients?.length) return item;

  return {
    ...item,
    ingredients: item.ingredients.map((ing) => ({
      ...ing,
      grams: Math.round(ing.grams * scaleFactor),
    })),
  };
}

/**
 * Detect if a plan content is V2 (no kcal on items, has ingredients).
 * V2 items have ingredients but no kcal field (or kcal === 0).
 */
export function isV2Plan(content: PlanContent): boolean {
  const firstDay = content.days[0];
  if (!firstDay?.meals?.[0]?.items?.[0]) return false;
  const firstItem = firstDay.meals[0].items[0];
  return (
    Array.isArray(firstItem.ingredients) &&
    firstItem.ingredients.length > 0 &&
    (firstItem.kcal === undefined || firstItem.kcal === 0)
  );
}
