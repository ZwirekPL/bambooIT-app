/**
 * Recipe Scaling Precision Service
 *
 * Per-ingredient tiered scaling of recipe portions to hit macro targets.
 * Unlike the uniform scaling in recipeCandidate.service.ts, this service
 * adjusts each ingredient independently based on its nutritional tier
 * (protein / carb / fat / vegetable / seasoning) with iterative convergence.
 *
 * Key features:
 *  - F.1: Per-tier scaling with iterative refinement (max 5 iterations, <3% deviation)
 *  - F.2: Realistic portion bounds per category (e.g. meat 80-300g, rice 30-150g)
 *  - F.3: Smart gram rounding (≥100g → 10g steps, 10-100g → 5g steps, <10g → 1g)
 */

import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Ingredient category for tiered scaling */
export type IngredientTier = 'protein' | 'carb' | 'fat' | 'vegetable' | 'seasoning' | 'other';

/** Per-ingredient scaling result */
export interface ScaledIngredient {
  ingredientId: string;
  displayName: string | null;
  tier: IngredientTier;
  originalGrams: number;
  scaledGrams: number;
  minGrams: number;
  maxGrams: number;
  clampedToMin: boolean;
  clampedToMax: boolean;
}

/** Macro targets for scaling */
export interface MacroTargets {
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
}

/** Result of precision scaling */
export interface ScalingResult {
  recipeId: string;
  originalServings: number;
  globalScaleFactor: number;
  iterations: number;
  finalDeviation: {
    kcalPct: number;
    proteinPct: number;
    fatPct: number;
    carbsPct: number;
  };
  scaledNutrition: {
    kcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    fiberG: number;
  };
  ingredients: ScaledIngredient[];
}

// ─── Internal types ─────────────────────────────────────────────────────────

interface LoadedIngredient {
  id: string;
  grams: number;
  displayName: string | null;
  retentionFactor: number | null;
  cleanProductName: string | null;
  cleanProductCategory: string | null;
  nutrients: {
    kcalPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
    carbsPer100g: number;
    fiberPer100g: number;
  } | null;
}

interface TieredIngredient extends LoadedIngredient {
  tier: IngredientTier;
  currentGrams: number;
  tierMultiplier: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TARGET_DEVIATION_PCT = 3;
const MIN_SERVINGS = 1.0;   // Never scale below 1 full serving
const MAX_SERVINGS = 3.0;   // Max 3x original recipe

/** Meal type portion limits (grams) — optimal = solver target, max = hard limit */
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'soup';

/** Base limits for standard diet (~1600-2000 kcal/day) */
const BASE_PORTION_LIMITS: Record<MealType, { optimal: number; max: number }> = {
  breakfast: { optimal: 300, max: 450 },
  lunch:     { optimal: 400, max: 550 },
  snack:     { optimal: 200, max: 300 },
  dinner:    { optimal: 350, max: 450 },
  soup:      { optimal: 400, max: 500 },
};

/**
 * Scale portion limits based on daily kcal target.
 * - ≤2000 kcal: base limits (1.0x)
 * - 2000-3000 kcal: up to 1.25x
 * - >3000 kcal: up to 1.5x
 */
export function getPortionLimits(mealType: MealType, dailyKcalTarget?: number): { optimal: number; max: number } {
  const base = BASE_PORTION_LIMITS[mealType];
  if (!dailyKcalTarget || dailyKcalTarget <= 2000) return base;

  // Linear scale: 1.0 at 2000 kcal → 1.5 at 3500 kcal, capped at 1.5
  const scale = Math.min(1.5, 1.0 + (dailyKcalTarget - 2000) / 3000);
  return {
    optimal: Math.round(base.optimal * scale),
    max: Math.round(base.max * scale),
  };
}

/** Realistic portion bounds per serving (grams) — kept for classifyIngredient */
const PORTION_BOUNDS: Record<IngredientTier, { min: number; max: number }> = {
  protein:   { min: 80,  max: 300 },
  carb:      { min: 30,  max: 150 },
  fat:       { min: 3,   max: 50 },
  vegetable: { min: 30,  max: 400 },
  seasoning: { min: 0.5, max: 15 },
  other:     { min: 5,   max: 300 },
};

// ─── Polish name patterns for tier classification ───────────────────────────

const PROTEIN_PATTERNS = [
  /kurczak/i, /pierś\s*(z\s*)?kurczak/i, /filet/i, /indyk/i, /drob/i, /udko/i,
  /łosoś/i, /dorsz/i, /tuńczyk/i, /pstrąg/i, /makrela/i, /krewet/i, /ryb/i,
  /wołowin/i, /wieprzow/i, /cielęc/i, /szynk/i, /polędwic/i, /mięs/i,
  /jaj[ko]/i, /jaja/i, /jajka/i, /białko\s*jaj/i, /żółtko/i,
  /tofu/i, /tempeh/i, /seitan/i,
  /soczewic/i, /ciecierzyc/i, /fasol[ae]/i, /groch/i, /bób\b/i,
  /twaróg/i, /ser\b/i, /ser\s/i, /jogurt/i, /kefir/i, /skyr/i,
  /cottage/i, /ricotta/i, /mozzarella/i, /feta/i, /parmezan/i,
];

const CARB_PATTERNS = [
  /ryż/i, /makaron/i, /chleb/i, /bułk/i, /pieczywo/i,
  /kasza/i, /ziemniak/i, /batat/i, /owsiank/i, /płatki/i,
  /mąka/i, /tortill/i, /pita/i, /naleśnik/i, /bagiet/i,
  /bulgur/i, /kuskus/i, /quinoa/i, /orkisz/i, /wrap/i,
  /granola/i, /musli/i, /rogalik/i, /kromk/i, /kukurydz/i,
];

const FAT_PATTERNS = [
  /oliwa/i, /olej/i, /masło/i, /margaryn/i, /smalec/i, /ghee/i,
  /orzechy/i, /orzech\b/i, /migdał/i, /nerkowiec/i,
  /awokado/i, /avocado/i,
  /siemię/i, /pestki/i, /nasion/i, /słonecznik/i,
  /tahini/i, /masło\s*orzechowe/i, /masło\s*migdałowe/i,
  /śmietana\s*(30|36)/i, /śmietanka\s*(30|36)/i,
  /kokos.*olej/i, /olej.*kokos/i,
];

const VEGETABLE_PATTERNS = [
  /pomidor/i, /ogórek/i, /sałat/i, /marchew/i, /cebul/i, /papryk/i,
  /brokuł/i, /kalafior/i, /szpinak/i, /kapust/i, /burak/i,
  /dyni/i, /cukini/i, /bakłażan/i, /por[y ]/i, /rzodkiew/i,
  /seler/i, /pietru/i, /koper/i, /rukola/i, /jarmuż/i,
  /szparag/i, /grzyb/i, /pieczark/i, /kabaczek/i, /rzep[aą]/i,
  /jabłk/i, /banan/i, /gruszk/i, /truskawk/i, /malin/i,
  /jagod/i, /borówk/i, /pomarańcz/i, /kiwi/i, /mango/i,
  /ananas/i, /śliwk/i, /winogrono/i, /cytry/i, /limonk/i,
  /arbuz/i, /melon/i, /brzoskwini/i, /nektarynk/i, /morela/i,
  /rabarbar/i, /szalotk/i, /fenkuł/i, /karczoch/i,
];

const SEASONING_PATTERNS = [
  /^sól$/i, /sól\b/i, /pieprz/i, /przyprawa/i, /czosnek/i,
  /bazylia/i, /oregano/i, /cynamon/i, /kurkuma/i, /imbir/i,
  /tymianek/i, /rozmaryn/i, /papryka\s*(mielona|słodka|ostra|wędzona)/i,
  /curry/i, /gałka/i, /ziele\s*angielskie/i, /kminek/i, /kolendra/i,
  /wanilia/i, /szafran/i, /majeranek/i, /lubczyk/i, /liść\s*laurowy/i,
  /ocet/i, /musztarda/i, /sos\s*sojowy/i, /tabasco/i,
  /^woda$/i,
];

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Convert Prisma Decimal to number safely. */
function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round grams according to the rounding rules:
 *  - ≥100g → round to nearest 10g
 *  - 10–99g → round to nearest 5g
 *  - <10g → round to nearest 1g
 */
function roundGrams(grams: number): number {
  if (grams >= 100) return Math.round(grams / 10) * 10;
  if (grams >= 10) return Math.round(grams / 5) * 5;
  return Math.round(grams);
}

/** Compute % deviation. Returns 0 if target is 0. */
function pctDeviation(actual: number, target: number): number {
  if (target === 0) return 0;
  return Math.abs((actual - target) / target) * 100;
}

// ─── Tier Classification ────────────────────────────────────────────────────

/**
 * Classify an ingredient into a scaling tier.
 *
 * Uses a layered heuristic:
 *  1. Polish name pattern matching (most reliable for Polish product database)
 *  2. CleanProduct category from DB
 *  3. Nutrient profile as secondary signal
 *  4. Fallback to 'other'
 */
export function classifyIngredient(
  ingredient: LoadedIngredient,
): IngredientTier {
  const name = (ingredient.displayName ?? ingredient.cleanProductName ?? '').toLowerCase();
  const category = (ingredient.cleanProductCategory ?? '').toLowerCase();

  // Check seasonings first — small quantities and spice names
  if (ingredient.grams < 10 && SEASONING_PATTERNS.some((p) => p.test(name))) {
    return 'seasoning';
  }
  if (SEASONING_PATTERNS.some((p) => p.test(name)) && ingredient.grams <= 15) {
    return 'seasoning';
  }

  // Keyword-based classification (order matters: protein > fat > carb > vegetable)
  if (PROTEIN_PATTERNS.some((p) => p.test(name))) return 'protein';
  if (FAT_PATTERNS.some((p) => p.test(name))) return 'fat';
  if (CARB_PATTERNS.some((p) => p.test(name))) return 'carb';
  if (VEGETABLE_PATTERNS.some((p) => p.test(name))) return 'vegetable';

  // Category-based classification from CleanProduct.category
  if (category) {
    if (/mięs|drob|ryb|jaj|nabiał|mlecz/i.test(category)) return 'protein';
    if (/tłuszcz|olej|orzechy/i.test(category)) return 'fat';
    if (/zboż|pieczywo|makaron|kasza|ziemniak/i.test(category)) return 'carb';
    if (/warzy|owoc|sałat/i.test(category)) return 'vegetable';
    if (/przyprawa|zioła|sos/i.test(category)) return 'seasoning';
  }

  // Nutrient-profile fallback
  if (ingredient.nutrients) {
    const { proteinPer100g, fatPer100g, carbsPer100g, kcalPer100g } = ingredient.nutrients;

    if (fatPer100g > 40) return 'fat';
    if (proteinPer100g > 15 && proteinPer100g > carbsPer100g) return 'protein';
    if (carbsPer100g > 50) return 'carb';
    if (kcalPer100g < 50 && ingredient.grams > 15) return 'vegetable';
  }

  // Very small amounts are likely seasonings even if name didn't match
  if (ingredient.grams < 5) return 'seasoning';

  return 'other';
}

// ─── Nutrition Computation ──────────────────────────────────────────────────

interface ComputedMacros {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
}

/**
 * Compute total nutrition from ingredients with given gram amounts (per serving).
 *
 * @param ingredients - ingredients with their current gram amounts and per-100g nutrients
 * @param servings - recipe servings (divides total by servings for per-serving values)
 */
function computeNutritionFromIngredients(
  ingredients: TieredIngredient[],
  servings: number,
): ComputedMacros {
  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalFiber = 0;

  for (const ing of ingredients) {
    if (!ing.nutrients) continue;
    const factor = ing.currentGrams / 100;
    totalKcal += ing.nutrients.kcalPer100g * factor;
    totalProtein += ing.nutrients.proteinPer100g * factor;
    totalFat += ing.nutrients.fatPer100g * factor;
    totalCarbs += ing.nutrients.carbsPer100g * factor;
    totalFiber += ing.nutrients.fiberPer100g * factor;
  }

  const s = Math.max(servings, 1);
  return {
    kcal: totalKcal / s,
    proteinG: totalProtein / s,
    fatG: totalFat / s,
    carbsG: totalCarbs / s,
    fiberG: totalFiber / s,
  };
}

// ─── Recipe Loading ─────────────────────────────────────────────────────────

async function loadRecipeWithIngredients(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      id: true,
      servings: true,
      ingredients: {
        select: {
          id: true,
          grams: true,
          displayName: true,
          retentionFactor: true,
          cleanProduct: {
            select: {
              name: true,
              category: true,
              nutrients: {
                select: {
                  kcalPer100g: true,
                  proteinPer100g: true,
                  fatPer100g: true,
                  carbsPer100g: true,
                  fiberPer100g: true,
                },
              },
            },
          },
          // Legacy fallback: recipes created before CleanProduct migration
          foodProduct: {
            select: {
              name: true,
              category: { select: { name: true } },
              nutrients: {
                select: {
                  kcal: true,
                  protein_g: true,
                  fat_g: true,
                  carbs_g: true,
                  fiber_g: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!recipe) {
    throw new AppError(404, 'RECIPE_NOT_FOUND', `Recipe ${recipeId} not found`);
  }

  const loaded: LoadedIngredient[] = recipe.ingredients.map((ing) => {
    // Prefer cleanProduct nutrients; fall back to legacy foodProduct nutrients
    let nutrients: LoadedIngredient['nutrients'] = null;
    if (ing.cleanProduct?.nutrients) {
      nutrients = {
        kcalPer100g: toNum(ing.cleanProduct.nutrients.kcalPer100g),
        proteinPer100g: toNum(ing.cleanProduct.nutrients.proteinPer100g),
        fatPer100g: toNum(ing.cleanProduct.nutrients.fatPer100g),
        carbsPer100g: toNum(ing.cleanProduct.nutrients.carbsPer100g),
        fiberPer100g: toNum(ing.cleanProduct.nutrients.fiberPer100g),
      };
    } else if (ing.foodProduct?.nutrients) {
      // FoodProductNutrients uses different field names — map them to LoadedIngredient format
      nutrients = {
        kcalPer100g: toNum(ing.foodProduct.nutrients.kcal),
        proteinPer100g: toNum(ing.foodProduct.nutrients.protein_g),
        fatPer100g: toNum(ing.foodProduct.nutrients.fat_g),
        carbsPer100g: toNum(ing.foodProduct.nutrients.carbs_g),
        fiberPer100g: toNum(ing.foodProduct.nutrients.fiber_g ?? 0),
      };
    }

    const productName = ing.cleanProduct?.name ?? ing.foodProduct?.name ?? null;
    const productCategory = ing.cleanProduct?.category ?? ing.foodProduct?.category?.name ?? null;

    return {
      id: ing.id,
      grams: toNum(ing.grams),
      displayName: ing.displayName,
      retentionFactor: ing.retentionFactor ? toNum(ing.retentionFactor) : null,
      cleanProductName: productName,
      cleanProductCategory: productCategory,
      nutrients,
    };
  });

  return { servings: recipe.servings, ingredients: loaded };
}

// ─── Main Scaling Algorithm ─────────────────────────────────────────────────

/**
 * Scale a recipe's ingredients to match macro targets with per-tier precision.
 *
 * Algorithm:
 *  1. Load recipe ingredients with CleanProduct nutrient data
 *  2. Classify each ingredient into a tier (protein/carb/fat/vegetable/seasoning/other)
 *  3. Compute initial global scale factor from kcal ratio
 *  4. Iteratively adjust tier-specific multipliers to converge on macro targets:
 *     - Protein tier adjusts to match protein target
 *     - Carb tier adjusts to match carb target
 *     - Fat tier adjusts to compensate remaining kcal
 *     - Vegetables and seasonings stay at global factor (no distortion)
 *  5. Clamp to realistic portion bounds, round grams, recompute final nutrition
 *
 * @param recipeId - recipe to scale (must exist in DB)
 * @param targets - desired per-serving macro targets
 * @returns detailed scaling result with per-ingredient breakdown
 */
export async function scaleRecipe(
  recipeId: string,
  targets: MacroTargets,
  mealType?: MealType,
  dailyKcalTarget?: number,
  /**
   * Override the lower bound on servingScale. Default behaviour gates at
   * MIN_SERVINGS (1.0) for non-snack targets. Faza D scaleMealComposition
   * passes 0.5 because each element claims only a fraction of the slot kcal
   * and may need to scale below a full original serving.
   */
  minServingsOverride?: number,
): Promise<ScalingResult> {
  if (targets.targetKcal <= 0) {
    throw new AppError(400, 'INVALID_TARGET', 'targetKcal must be > 0');
  }

  // 1. Load recipe
  const { servings, ingredients: loaded } = await loadRecipeWithIngredients(recipeId);

  if (loaded.length === 0) {
    throw new AppError(400, 'NO_INGREDIENTS', `Recipe ${recipeId} has no ingredients`);
  }

  // 2. Classify and prepare tiered ingredients
  const tiered: TieredIngredient[] = loaded.map((ing) => ({
    ...ing,
    tier: classifyIngredient(ing),
    currentGrams: ing.grams,
    tierMultiplier: 1.0,
  }));

  // 3. Compute original per-serving nutrition
  const originalNutrition = computeNutritionFromIngredients(tiered, servings);

  if (originalNutrition.kcal === 0) {
    // No ingredient-level nutrients — fall back to RecipeNutritionSnapshot.
    // This handles recipes where CleanProductNutrients records are missing.
    const snapshot = await prisma.recipeNutritionSnapshot.findUnique({
      where: { recipeId },
      select: { kcal: true, protein_g: true, fat_g: true, carbs_g: true, fiber_g: true },
    });

    const snapKcal = snapshot ? toNum(snapshot.kcal) : 0;
    if (snapKcal === 0) {
      throw new AppError(400, 'ZERO_NUTRITION', `Recipe ${recipeId} has zero computed calories`);
    }

    const s0 = Math.max(servings, 1);
    const minServ0 = minServingsOverride ?? (targets.targetKcal <= 250 ? 0.5 : MIN_SERVINGS);
    const snapScale = clamp(targets.targetKcal / snapKcal, minServ0, MAX_SERVINGS);

    const snapIngredients: ScaledIngredient[] = tiered.map((ing) => {
      const perServing = roundGrams((ing.grams / s0) * snapScale);
      const bounds = PORTION_BOUNDS[ing.tier];
      return {
        ingredientId: ing.id,
        displayName: ing.cleanProductName ?? ing.displayName,
        tier: ing.tier,
        originalGrams: Math.round(ing.grams * 100) / 100,
        scaledGrams: perServing,
        minGrams: bounds.min,
        maxGrams: bounds.max,
        clampedToMin: false,
        clampedToMax: false,
      };
    });

    const snapNutr = {
      kcal: snapKcal * snapScale,
      proteinG: toNum(snapshot!.protein_g) * snapScale,
      fatG: toNum(snapshot!.fat_g) * snapScale,
      carbsG: toNum(snapshot!.carbs_g) * snapScale,
      fiberG: toNum(snapshot?.fiber_g ?? 0) * snapScale,
    };

    return {
      recipeId,
      originalServings: servings,
      globalScaleFactor: Math.round(snapScale * 1000) / 1000,
      iterations: 0,
      finalDeviation: {
        kcalPct: Math.round(pctDeviation(snapNutr.kcal, targets.targetKcal) * 100) / 100,
        proteinPct: targets.targetProteinG > 0 ? Math.round(pctDeviation(snapNutr.proteinG, targets.targetProteinG) * 100) / 100 : 0,
        fatPct: targets.targetFatG > 0 ? Math.round(pctDeviation(snapNutr.fatG, targets.targetFatG) * 100) / 100 : 0,
        carbsPct: targets.targetCarbsG > 0 ? Math.round(pctDeviation(snapNutr.carbsG, targets.targetCarbsG) * 100) / 100 : 0,
      },
      scaledNutrition: {
        kcal: Math.round(snapNutr.kcal),
        proteinG: Math.round(snapNutr.proteinG * 10) / 10,
        fatG: Math.round(snapNutr.fatG * 10) / 10,
        carbsG: Math.round(snapNutr.carbsG * 10) / 10,
        fiberG: Math.round(snapNutr.fiberG * 10) / 10,
      },
      ingredients: snapIngredients,
    };
  }

  // 4. Uniform scaling — one multiplier for entire recipe, preserves proportions
  const s = Math.max(servings, 1);
  const portionLimit = mealType
    ? getPortionLimits(mealType, dailyKcalTarget)
    : getPortionLimits('lunch', dailyKcalTarget);

  // Compute grams per serving to know weight limits
  let totalGramsPerServing = 0;
  for (const ing of tiered) {
    totalGramsPerServing += ing.grams / s;
  }

  // Scale by kcal target first, clamp to serving range
  // For small slots (snacks ≤250 kcal), allow scaling below 1 serving (min 0.5)
  // to avoid overshooting kcal target
  const minServ = minServingsOverride ?? (targets.targetKcal <= 250 ? 0.5 : MIN_SERVINGS);
  const rawServingScale = targets.targetKcal / originalNutrition.kcal;
  let servingScale = clamp(rawServingScale, minServ, MAX_SERVINGS);

  // Then enforce gram limits — these override serving limits when recipe is too heavy
  const gramsAtScale = totalGramsPerServing * servingScale;
  if (gramsAtScale > portionLimit.max) {
    // Hard limit — gram limit beats MIN_SERVINGS
    servingScale = portionLimit.max / totalGramsPerServing;
  } else if (gramsAtScale > portionLimit.optimal) {
    // Between optimal and max — pull toward optimal
    servingScale = portionLimit.optimal / totalGramsPerServing;
  }

  // Absolute floor: never below 0.3 (recipe would be unrecognizable)
  servingScale = Math.max(servingScale, 0.3);

  // Apply uniform scale to all ingredients — every ingredient gets the same multiplier
  for (const ing of tiered) {
    ing.currentGrams = ing.grams * servingScale;
    ing.tierMultiplier = servingScale;
  }

  const iterations = 0; // No iterative adjustment — uniform only

  // 5. Round grams (no PORTION_BOUNDS clamping — recipe proportions are sacred)
  const scaledIngredients: ScaledIngredient[] = tiered.map((ing) => {
    const perServing = ing.currentGrams / s;
    const roundedPerServing = roundGrams(perServing);
    const totalGrams = roundedPerServing * s;

    // Update for final nutrition computation
    ing.currentGrams = totalGrams;

    const bounds = PORTION_BOUNDS[ing.tier];
    return {
      ingredientId: ing.id,
      displayName: ing.cleanProductName ?? ing.displayName,
      tier: ing.tier,
      originalGrams: Math.round(ing.grams * 100) / 100,
      scaledGrams: roundedPerServing,
      minGrams: bounds.min,
      maxGrams: bounds.max,
      clampedToMin: false,
      clampedToMax: false,
    };
  });

  // 7. Final nutrition recomputation from rounded grams
  const finalNutrition = computeNutritionFromIngredients(tiered, servings);

  const finalDeviation = {
    kcalPct: Math.round(pctDeviation(finalNutrition.kcal, targets.targetKcal) * 100) / 100,
    proteinPct: Math.round(pctDeviation(finalNutrition.proteinG, targets.targetProteinG) * 100) / 100,
    fatPct: Math.round(pctDeviation(finalNutrition.fatG, targets.targetFatG) * 100) / 100,
    carbsPct: Math.round(pctDeviation(finalNutrition.carbsG, targets.targetCarbsG) * 100) / 100,
  };

  return {
    recipeId,
    originalServings: servings,
    globalScaleFactor: Math.round(servingScale * 1000) / 1000,
    iterations,
    finalDeviation,
    scaledNutrition: {
      kcal: Math.round(finalNutrition.kcal),
      proteinG: Math.round(finalNutrition.proteinG * 10) / 10,
      fatG: Math.round(finalNutrition.fatG * 10) / 10,
      carbsG: Math.round(finalNutrition.carbsG * 10) / 10,
      fiberG: Math.round(finalNutrition.fiberG * 10) / 10,
    },
    ingredients: scaledIngredients,
  };
}

/**
 * Scale a recipe and return only the final per-serving nutrition and ingredients.
 * Convenience wrapper around scaleRecipe for pipeline integration.
 *
 * @param recipeId - recipe to scale
 * @param targets - desired per-serving macro targets
 * @returns simplified scaling result with ingredient list
 */
export async function scaleRecipeForMeal(
  recipeId: string,
  targets: MacroTargets,
  mealType?: MealType,
  dailyKcalTarget?: number,
): Promise<{
  scaledNutrition: ScalingResult['scaledNutrition'];
  ingredients: Array<{ ingredientId: string; displayName: string | null; grams: number }>;
  deviationOk: boolean;
  globalScaleFactor: number;
}> {
  const result = await scaleRecipe(recipeId, targets, mealType, dailyKcalTarget);

  const deviationOk =
    result.finalDeviation.kcalPct < TARGET_DEVIATION_PCT
    && result.finalDeviation.proteinPct < TARGET_DEVIATION_PCT
    && result.finalDeviation.fatPct < TARGET_DEVIATION_PCT
    && result.finalDeviation.carbsPct < TARGET_DEVIATION_PCT;

  return {
    scaledNutrition: result.scaledNutrition,
    ingredients: result.ingredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      displayName: ing.displayName,
      grams: ing.scaledGrams,
    })),
    deviationOk,
    globalScaleFactor: result.globalScaleFactor,
  };
}

// ─── Faza D §M1: Joint scaler for 3-tuple meal composition ──────────────────

/**
 * Element type within a composed meal (LUNCH/DINNER 3-tuple).
 * Drives macro share allocation when scaling each recipe to its slot share.
 */
export type CompositionElement = 'main' | 'carb' | 'veg';

/**
 * kcal share each element claims of the slot target. Derived from the dietetic
 * spec (PTNF/EFSA): for a 600 kcal lunch, typical composition is
 * Kotlet (~370 kcal) + Ryż 150 g (~170 kcal) + Sałatka (~60 kcal). Shares
 * adjust depending on which sides are present.
 *
 * Per element macro role (master plan dietitian-macro-distribution-spec.md):
 *  - MAIN dominates protein + fat (kotlet schabowy is meat → ~25g B / 18g T)
 *  - CARB_SIDE dominates carbs (ryż gotowany 150g → ~45g W)
 *  - VEG_SIDE provides fiber + cooking oil fat (sałatka mizeria 200g → ~5g T from oil + 4g fiber)
 */
const KCAL_SHARES: Record<string, { main: number; carb: number; veg: number }> = {
  // Only main → it gets full slot kcal
  'main':         { main: 1.0,  carb: 0,    veg: 0    },
  // Main + carb (no veg) → main 72% + carb 28%
  'main+carb':    { main: 0.72, carb: 0.28, veg: 0    },
  // Main + veg (no carb) → main 85% + veg 15%
  'main+veg':     { main: 0.85, carb: 0,    veg: 0.15 },
  // Full 3-tuple → main 60% + carb 28% + veg 12%
  'main+carb+veg':{ main: 0.60, carb: 0.28, veg: 0.12 },
};

function compositionKey(hasCarb: boolean, hasVeg: boolean): keyof typeof KCAL_SHARES {
  if (hasCarb && hasVeg) return 'main+carb+veg';
  if (hasCarb) return 'main+carb';
  if (hasVeg) return 'main+veg';
  return 'main';
}

export interface MealComposition {
  mainRecipeId: string;
  carbRecipeId?: string;
  vegRecipeId?: string;
}

export interface ScaledMealComposition {
  main: ScalingResult;
  carb?: ScalingResult;
  veg?: ScalingResult;
  /** Sum of macros across all elements (per-serving) */
  totals: {
    kcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    fiberG: number;
  };
  /** Deviation of summed totals vs. slot targets, in % */
  deviation: {
    kcalPct: number;
    proteinPct: number;
    fatPct: number;
    carbsPct: number;
  };
  /** True iff every macro is within ±15% of slot target (master plan tolerance) */
  withinTolerance: boolean;
  /** Which composition shape was used */
  compositionKey: keyof typeof KCAL_SHARES;
}

/** ±15% from master plan §M1 — solver SC23-26 should keep us well inside */
const COMPOSITION_TOLERANCE_PCT = 15;

/**
 * Scale a multi-element meal composition (1-3 recipes) to fit slot macro
 * targets jointly. Each element gets its kcal share of the slot, then existing
 * scaleRecipe handles the per-recipe scaling. Aggregated totals are validated
 * against ±15% of slot targets.
 *
 * Solver SC23-26 (macro role constraints) should ensure that combinations
 * produced by the OR-Tools solver actually reconcile here — if a composition
 * comes through with `withinTolerance=false`, the upstream solver penalty
 * weights need tuning, not the scaler.
 *
 * @param composition - 1-3 recipe IDs (main + optional carb + optional veg)
 * @param slotTargets - macro targets for the WHOLE slot (sum across elements)
 * @param mealType - LUNCH/DINNER (used by sub-scalers for portion bounds)
 * @param dailyKcalTarget - patient daily kcal (used by sub-scalers for limit scaling)
 */
export async function scaleMealComposition(
  composition: MealComposition,
  slotTargets: MacroTargets,
  mealType?: MealType,
  dailyKcalTarget?: number,
): Promise<ScaledMealComposition> {
  if (slotTargets.targetKcal <= 0) {
    throw new AppError(400, 'INVALID_TARGET', 'slot targetKcal must be > 0');
  }

  const hasCarb = !!composition.carbRecipeId;
  const hasVeg = !!composition.vegRecipeId;
  const key = compositionKey(hasCarb, hasVeg);
  const shares = KCAL_SHARES[key];

  // Compute per-element targets. We allocate kcal proportionally and let each
  // element's natural ingredient profile determine the macro split — the solver
  // upstream picks recipes that fit each element's macro role (SC23-26).
  function shareTargets(s: number): MacroTargets {
    return {
      targetKcal:    slotTargets.targetKcal    * s,
      targetProteinG: slotTargets.targetProteinG * s,
      targetFatG:    slotTargets.targetFatG    * s,
      targetCarbsG:  slotTargets.targetCarbsG  * s,
    };
  }

  // Per master plan §M1: composition elements may scale within [0.5, 3.0]
  // — each element claims a slot share, may need to go below a full original
  // serving. Without this override scaleRecipe gates at 1.0 for >250 kcal targets.
  const COMPOSITION_MIN_SERVINGS = 0.5;

  // Scale main (always present)
  const main = await scaleRecipe(
    composition.mainRecipeId, shareTargets(shares.main), mealType, dailyKcalTarget, COMPOSITION_MIN_SERVINGS,
  );

  // Scale carb_side if present
  let carb: ScalingResult | undefined;
  if (composition.carbRecipeId) {
    carb = await scaleRecipe(
      composition.carbRecipeId, shareTargets(shares.carb), mealType, dailyKcalTarget, COMPOSITION_MIN_SERVINGS,
    );
  }

  // Scale veg_side if present
  let veg: ScalingResult | undefined;
  if (composition.vegRecipeId) {
    veg = await scaleRecipe(
      composition.vegRecipeId, shareTargets(shares.veg), mealType, dailyKcalTarget, COMPOSITION_MIN_SERVINGS,
    );
  }

  // Aggregate totals
  const sum = (field: keyof ScalingResult['scaledNutrition']): number => {
    let total = main.scaledNutrition[field];
    if (carb) total += carb.scaledNutrition[field];
    if (veg) total += veg.scaledNutrition[field];
    return total;
  };
  const totals = {
    kcal:     sum('kcal'),
    proteinG: sum('proteinG'),
    fatG:     sum('fatG'),
    carbsG:   sum('carbsG'),
    fiberG:   sum('fiberG'),
  };

  // Deviation vs slot targets
  const deviation = {
    kcalPct:    pctDeviation(totals.kcal,     slotTargets.targetKcal),
    proteinPct: slotTargets.targetProteinG > 0 ? pctDeviation(totals.proteinG, slotTargets.targetProteinG) : 0,
    fatPct:     slotTargets.targetFatG > 0     ? pctDeviation(totals.fatG,     slotTargets.targetFatG)     : 0,
    carbsPct:   slotTargets.targetCarbsG > 0   ? pctDeviation(totals.carbsG,   slotTargets.targetCarbsG)   : 0,
  };
  const withinTolerance =
    deviation.kcalPct    < COMPOSITION_TOLERANCE_PCT &&
    deviation.proteinPct < COMPOSITION_TOLERANCE_PCT &&
    deviation.fatPct     < COMPOSITION_TOLERANCE_PCT &&
    deviation.carbsPct   < COMPOSITION_TOLERANCE_PCT;

  return {
    main,
    carb,
    veg,
    totals: {
      kcal:     Math.round(totals.kcal),
      proteinG: Math.round(totals.proteinG * 10) / 10,
      fatG:     Math.round(totals.fatG * 10) / 10,
      carbsG:   Math.round(totals.carbsG * 10) / 10,
      fiberG:   Math.round(totals.fiberG * 10) / 10,
    },
    deviation: {
      kcalPct:    Math.round(deviation.kcalPct * 100) / 100,
      proteinPct: Math.round(deviation.proteinPct * 100) / 100,
      fatPct:     Math.round(deviation.fatPct * 100) / 100,
      carbsPct:   Math.round(deviation.carbsPct * 100) / 100,
    },
    withinTolerance,
    compositionKey: key,
  };
}
