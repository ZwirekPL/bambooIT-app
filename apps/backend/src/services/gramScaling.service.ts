/**
 * Smart per-day gram scaling to hit target kcal.
 * Scales ingredients by tier (PROTEIN/CARB/VEGETABLE/FAT/FIXED)
 * with different max factors to maintain realistic portions.
 */

import type { PlanContent, PlanDay, PlanMeal, PlanItem, PlanIngredient } from './planValidation.service';
import { classifyUnmatched } from './nutritionCalculator.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScalingTier = 'PROTEIN' | 'CARB' | 'VEGETABLE' | 'FAT' | 'FIXED';

export interface NutrientsPer100g {
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

export interface ScalingConfig {
  targetKcal: number;
  /** ±tolerance before scaling kicks in (default 0.05 = 5%) */
  tolerance?: number;
  /** Max iterations for convergence (default 5) */
  maxIterations?: number;
}

export interface DayScalingDetail {
  day: string;
  originalKcal: number;
  finalKcal: number;
  scaledIngredients: number;
  fixedIngredients: number;
  iterations: number;
}

export interface ScalingReport {
  daysScaled: number;
  daysSkipped: number;
  details: DayScalingDetail[];
}

// ─── Tier configuration ─────────────────────────────────────────────────────

const TIER_MAX_FACTOR: Record<ScalingTier, number> = {
  CARB:      1.30,  // Primary lever — rice, pasta, bread
  VEGETABLE: 1.50,  // Cheap in kcal, can go generous
  PROTEIN:   1.25,  // Moderate — meat/fish portions shouldn't balloon
  FAT:       1.10,  // Very calorie-dense, small changes = big kcal
  FIXED:     1.00,  // Never scale — spices, water, condiments
};

const TIER_MIN_FACTOR: Record<ScalingTier, number> = {
  CARB:      0.70,
  VEGETABLE: 0.60,
  PROTEIN:   0.80,
  FAT:       0.85,
  FIXED:     1.00,
};

// ─── Tier classification ────────────────────────────────────────────────────

/** Items below this gram threshold are FIXED (spices, condiments) */
const FIXED_GRAM_THRESHOLD = 10;

const FAT_KEYWORDS = /oli[wv]|masło|olej|smalec|ghee|śmietana 30|śmietanka 30/i;
const PROTEIN_KEYWORDS = /kurczak|indyk|drob|filet|pierś|udko|łosoś|dorsz|tuńczyk|pstrąg|ryb|makrela|krewet|wołowin|wieprzow|cielęc|szynk|polędwic|mięs|jaj[ko]|białko jaja|żółtko|tofu|tempeh|seitan|twaróg|ser /i;
const CARB_KEYWORDS = /ryż|kasza|makaron|chleb|bułk|mąka|płatki|owsian|tortill|pita|naleśnik|bagiet|rogalik|bulgur|kuskus|quinoa|orkisz|ziemniak|batat|pieczywo|wrap|granola|musli|soczewic|ciecierzyc|groch|bób|fasol[ae]/i;
const VEGETABLE_KEYWORDS = /pomidor|ogórek|sałat|marchew|cebul|czosnek|papryk|brokuł|kalafior|szpinak|kapust|burak|dyni|cukini|bakłażan|por[y ]|rzodkiew|seler|pietru|koper|bazylia|rukola|jarmuż|szparag|grzyb|pieczark|kabaczek|kukurydz|rzep[aą]|jabłk|banan|gruszk|truskawk|malin|jagod|borówk|pomarańcz|kiwi|mango|ananas|śliwk|winogrono|awokado|avocado/i;

/**
 * Classify an ingredient into a scaling tier based on name, nutrients, and grams.
 */
export function classifyScalingTier(
  ingredientName: string,
  grams: number,
  nutrientsPer100g: NutrientsPer100g | null,
): ScalingTier {
  // Tiny amounts = FIXED (spices, salt, pepper, etc.)
  if (grams <= FIXED_GRAM_THRESHOLD) return 'FIXED';

  const name = ingredientName.toLowerCase();

  // Water, seasonings
  if (/^woda$|sól|pieprz|przyprawa|cynamon|kurkuma|oregano|tymianek|imbir|papryka (mielona|słodka|ostra)|curry|gałka|ziele angielskie/i.test(name)) {
    return 'FIXED';
  }

  // Keyword-based classification (most reliable)
  if (FAT_KEYWORDS.test(name)) return 'FAT';
  if (PROTEIN_KEYWORDS.test(name)) return 'PROTEIN';
  if (CARB_KEYWORDS.test(name)) return 'CARB';
  if (VEGETABLE_KEYWORDS.test(name)) return 'VEGETABLE';

  // Nutrient-based fallback
  if (nutrientsPer100g) {
    const { kcalPer100g, proteinPer100g, fatPer100g, carbsPer100g } = nutrientsPer100g;
    if (fatPer100g > 40) return 'FAT';
    if (proteinPer100g > 15 && proteinPer100g > carbsPer100g) return 'PROTEIN';
    if (carbsPer100g > 40) return 'CARB';
    if (kcalPer100g < 50) return 'VEGETABLE';
  }

  // Use category classifier from nutritionCalculator as last resort
  const category = classifyUnmatched(ingredientName);
  switch (category) {
    case 'fat': return 'FAT';
    case 'meat': case 'poultry': case 'fish': case 'egg': case 'dairy': return 'PROTEIN';
    case 'grain': case 'legume': return 'CARB';
    case 'vegetable': case 'fruit': return 'VEGETABLE';
    case 'nut': return 'FAT';
    default: return 'CARB'; // Default scalable
  }
}

// ─── Portioned items snapping ───────────────────────────────────────────────

interface PortionRule {
  gramsPerUnit: number;
}

const PORTION_RULES: Array<[RegExp, PortionRule]> = [
  [/jaj[ko]|jaja|jajka/i,          { gramsPerUnit: 60 }],
  [/chleb|pieczywo|kromk/i,        { gramsPerUnit: 30 }],
  [/bułk/i,                         { gramsPerUnit: 80 }],
  [/tortill/i,                      { gramsPerUnit: 60 }],
];

/** Snap grams to the nearest valid portion size */
function snapToPortionSize(name: string, grams: number): number {
  for (const [pattern, rule] of PORTION_RULES) {
    if (pattern.test(name)) {
      return Math.round(grams / rule.gramsPerUnit) * rule.gramsPerUnit || rule.gramsPerUnit;
    }
  }
  return grams;
}

// ─── Day-level kcal computation ─────────────────────────────────────────────

/**
 * Compute day kcal. Prefers item-level kcal (already enriched by nutritionCalculator
 * with fallback values). Falls back to ingredient-level from nutrientMap when item.kcal = 0.
 */
function computeDayKcal(day: PlanDay, nutrientMap: Map<string, NutrientsPer100g>): number {
  let total = 0;
  for (const meal of day.meals) {
    for (const item of meal.items) {
      if (item.kcal && item.kcal > 0) {
        total += item.kcal;
      } else if (item.ingredients?.length) {
        // Fallback: compute from nutrientMap (for unit tests or pre-enrichment)
        for (const ing of item.ingredients) {
          const nutrients = nutrientMap.get(ing.name.trim().toLowerCase());
          if (nutrients) {
            total += (ing.grams * nutrients.kcalPer100g) / 100;
          }
        }
      }
    }
  }
  return total;
}

function computeIngredientKcal(ing: PlanIngredient, nutrientMap: Map<string, NutrientsPer100g>): number {
  const nutrients = nutrientMap.get(ing.name.trim().toLowerCase());
  if (!nutrients) return 0;
  return (ing.grams * nutrients.kcalPer100g) / 100;
}

/**
 * Compute day kcal directly from ingredient grams + nutrientMap.
 * Used inside the scaling loop so we always see the effect of gram changes
 * (unlike computeDayKcal which prefers stale item.kcal).
 */
function computeDayKcalFromIngredients(day: PlanDay, nutrientMap: Map<string, NutrientsPer100g>): number {
  let total = 0;
  for (const meal of day.meals) {
    for (const item of meal.items) {
      if (item.ingredients?.length) {
        for (const ing of item.ingredients) {
          total += computeIngredientKcal(ing, nutrientMap);
        }
      } else if (item.kcal && item.kcal > 0) {
        // Items without ingredients — use item-level kcal (can't be scaled anyway)
        total += item.kcal;
      }
    }
  }
  return total;
}

// ─── Core scaling algorithm ─────────────────────────────────────────────────

interface TieredIngredient {
  /** Reference to the original ingredient (will be mutated) */
  ref: PlanIngredient;
  tier: ScalingTier;
  originalGrams: number;
  kcalContribution: number;
  nutrients: NutrientsPer100g | null;
}

/** Find the original (pre-scale) item by meal name and item name */
function findOriginalItem(origDay: PlanDay, mealName: string, itemName: string): PlanItem | undefined {
  for (const meal of origDay.meals) {
    if (meal.name !== mealName) continue;
    for (const item of meal.items) {
      if (item.name === itemName) return item;
    }
  }
  return undefined;
}

/**
 * Scale a single day's ingredients to hit targetKcal.
 * Returns a new PlanDay with adjusted grams (and recomputed item-level macros).
 */
export function scaleDayIngredients(
  day: PlanDay,
  nutrientMap: Map<string, NutrientsPer100g>,
  config: ScalingConfig,
): { scaledDay: PlanDay; detail: DayScalingDetail } {
  const tolerance = config.tolerance ?? 0.05;
  const maxIter = config.maxIterations ?? 5;

  // Deep clone the day
  const clonedDay: PlanDay = JSON.parse(JSON.stringify(day));

  // Collect all ingredients with their tier classification
  const tiered: TieredIngredient[] = [];
  for (const meal of clonedDay.meals) {
    for (const item of meal.items) {
      if (!item.ingredients?.length) continue;
      for (const ing of item.ingredients) {
        const nutrients = nutrientMap.get(ing.name.trim().toLowerCase()) ?? null;
        const tier = classifyScalingTier(ing.name, ing.grams, nutrients);
        const kcal = nutrients
          ? (ing.grams * nutrients.kcalPer100g) / 100
          : 0;
        tiered.push({
          ref: ing,
          tier,
          originalGrams: ing.grams,
          kcalContribution: kcal,
          nutrients,
        });
      }
    }
  }

  // Use item-level kcal as accurate baseline (includes matched + fallback ingredients)
  const baselineKcal = computeDayKcal(clonedDay, nutrientMap);
  const originalKcal = baselineKcal;
  const detail: DayScalingDetail = {
    day: day.day,
    originalKcal: Math.round(originalKcal),
    finalKcal: Math.round(originalKcal),
    scaledIngredients: 0,
    fixedIngredients: tiered.filter((t) => t.tier === 'FIXED').length,
    iterations: 0,
  };

  // Check if already within tolerance
  if (config.targetKcal <= 0 || originalKcal === 0) {
    return { scaledDay: clonedDay, detail };
  }

  const lowerBound = config.targetKcal * (1 - tolerance);
  const upperBound = config.targetKcal * (1 + tolerance);

  if (originalKcal >= lowerBound && originalKcal <= upperBound) {
    return { scaledDay: clonedDay, detail };
  }

  // Iterative scaling with cross-tier overflow
  const scalable = tiered.filter((t) => t.tier !== 'FIXED');
  if (scalable.length === 0) {
    return { scaledDay: clonedDay, detail };
  }

  /**
   * Delta-based kcal tracking: baseline (from item.kcal, accurate) + delta (from gram changes).
   * This handles unmatched ingredients correctly — their kcal is in the baseline,
   * and since we don't scale them, their delta is always 0.
   */
  function computeCurrentKcal(): number {
    let delta = 0;
    for (const t of tiered) {
      if (!t.nutrients) continue;
      const origKcal = (t.originalGrams * t.nutrients.kcalPer100g) / 100;
      const currKcal = (t.ref.grams * t.nutrients.kcalPer100g) / 100;
      delta += currKcal - origKcal;
    }
    return baselineKcal + delta;
  }

  for (let iter = 0; iter < maxIter; iter++) {
    detail.iterations = iter + 1;

    const currentKcal = computeCurrentKcal();
    if (currentKcal >= lowerBound && currentKcal <= upperBound) break;
    if (currentKcal === 0) break;

    let remainingDeficit = config.targetKcal - currentKcal;

    // Track which tiers are capped (hit their limit) so overflow skips them
    const cappedTiers = new Set<ScalingTier>();

    // Inner overflow loop: distribute deficit, then redistribute what couldn't be absorbed
    for (let pass = 0; pass < 3 && Math.abs(remainingDeficit) > 1; pass++) {
      // Compute scalable kcal per tier (excluding capped tiers)
      const tierKcal: Record<ScalingTier, number> = {
        PROTEIN: 0, CARB: 0, VEGETABLE: 0, FAT: 0, FIXED: 0,
      };
      for (const t of scalable) {
        if (cappedTiers.has(t.tier)) continue;
        const currentIngKcal = t.nutrients
          ? (t.ref.grams * t.nutrients.kcalPer100g) / 100
          : 0;
        tierKcal[t.tier] += currentIngKcal;
      }

      const totalScalableKcal = tierKcal.PROTEIN + tierKcal.CARB + tierKcal.VEGETABLE + tierKcal.FAT;
      if (totalScalableKcal === 0) break;

      let absorbedKcal = 0;
      const newCapped = new Set<ScalingTier>();

      // Distribute deficit proportionally by tier caloric contribution
      for (const t of scalable) {
        if (cappedTiers.has(t.tier)) continue;
        if (!t.nutrients || t.nutrients.kcalPer100g === 0) continue;

        const currentIngKcal = (t.ref.grams * t.nutrients.kcalPer100g) / 100;
        const tierShare = tierKcal[t.tier] / totalScalableKcal;
        const ingShare = tierKcal[t.tier] > 0
          ? currentIngKcal / tierKcal[t.tier]
          : 0;

        const kcalDelta = remainingDeficit * tierShare * ingShare;
        const gramDelta = (kcalDelta / t.nutrients.kcalPer100g) * 100;

        let newGrams = t.ref.grams + gramDelta;

        // Respect tier limits relative to original grams
        const maxGrams = t.originalGrams * TIER_MAX_FACTOR[t.tier];
        const minGrams = t.originalGrams * TIER_MIN_FACTOR[t.tier];
        const clampedGrams = Math.max(minGrams, Math.min(maxGrams, newGrams));

        // Detect if this ingredient hit its tier limit
        if (clampedGrams !== newGrams) {
          newCapped.add(t.tier);
        }

        // Track how much kcal this ingredient actually absorbed
        const actualGramDelta = clampedGrams - t.ref.grams;
        absorbedKcal += (actualGramDelta * t.nutrients.kcalPer100g) / 100;

        // Minimum 1g
        t.ref.grams = Math.round(Math.max(1, clampedGrams));
      }

      // Update remaining deficit for overflow pass
      remainingDeficit -= absorbedKcal;

      // Mark newly capped tiers
      for (const tier of newCapped) {
        cappedTiers.add(tier);
      }

      // If all scalable tiers are capped, nothing more we can do
      const allTiers: ScalingTier[] = ['CARB', 'VEGETABLE', 'PROTEIN', 'FAT'];
      const allCapped = allTiers.every((t) => cappedTiers.has(t) || tierKcal[t] === 0);
      if (allCapped) break;
    }
  }

  // Snap portioned items
  for (const t of tiered) {
    if (t.tier !== 'FIXED') {
      t.ref.grams = snapToPortionSize(t.ref.name, t.ref.grams);
    }
  }

  // Recompute item-level macros using delta-based approach:
  // original item.kcal + delta from known ingredient changes.
  // This preserves the contribution from unmatched/fallback ingredients.
  for (const meal of clonedDay.meals) {
    for (const item of meal.items) {
      if (!item.ingredients?.length) continue;

      const origItem = findOriginalItem(day, meal.name, item.name);
      if (!origItem?.ingredients) continue;

      // Compute delta from known ingredients (those in nutrientMap)
      let deltaKcal = 0, deltaProtein = 0, deltaFat = 0, deltaCarbs = 0;
      let totalGrams = 0;

      for (let i = 0; i < item.ingredients.length; i++) {
        const ing = item.ingredients[i];
        const origIng = origItem.ingredients[i];
        totalGrams += ing.grams;

        if (!origIng) continue;
        const nutrients = nutrientMap.get(ing.name.trim().toLowerCase());
        if (!nutrients) continue;

        const gramDiff = ing.grams - origIng.grams;
        deltaKcal += (gramDiff * nutrients.kcalPer100g) / 100;
        deltaProtein += (gramDiff * nutrients.proteinPer100g) / 100;
        deltaFat += (gramDiff * nutrients.fatPer100g) / 100;
        deltaCarbs += (gramDiff * nutrients.carbsPer100g) / 100;
      }

      item.grams = Math.round(totalGrams);
      item.kcal = Math.round((origItem.kcal || 0) + deltaKcal);
      item.protein = Math.round(((origItem.protein || 0) + deltaProtein) * 10) / 10;
      item.fat = Math.round(((origItem.fat || 0) + deltaFat) * 10) / 10;
      item.carbs = Math.round(((origItem.carbs || 0) + deltaCarbs) * 10) / 10;
    }
  }

  const finalKcal = computeCurrentKcal();
  detail.finalKcal = Math.round(finalKcal);
  detail.scaledIngredients = scalable.length;

  return { scaledDay: clonedDay, detail };
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Smart-scale entire plan content to hit target kcal per day.
 * Replaces the crude uniform autoAdjustContent().
 */
export function smartScaleContent(
  content: PlanContent,
  nutrientMap: Map<string, NutrientsPer100g>,
  config: ScalingConfig,
): { scaledContent: PlanContent; report: ScalingReport } {
  const report: ScalingReport = {
    daysScaled: 0,
    daysSkipped: 0,
    details: [],
  };

  if (!content.days?.length || config.targetKcal <= 0) {
    return { scaledContent: content, report };
  }

  const scaledDays: PlanDay[] = [];

  for (const day of content.days) {
    const { scaledDay, detail } = scaleDayIngredients(day, nutrientMap, config);
    scaledDays.push(scaledDay);
    report.details.push(detail);

    if (detail.originalKcal !== detail.finalKcal) {
      report.daysScaled++;
    } else {
      report.daysSkipped++;
    }
  }

  return {
    scaledContent: { ...content, days: scaledDays },
    report,
  };
}
