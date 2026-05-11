/**
 * Step 9: Delete all existing recipes and save deduplicated recipes to the database.
 *
 * Uses Prisma transactions in batches of 50. Creates Recipe with nested:
 * RecipeIngredient[], RecipeInstructionStep[], RecipeNutritionSnapshot,
 * RecipeAllergen[], RecipeDietFlag[].
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@db';
import { PIPELINE_CONFIG } from '../config';
import { loadProgress, updateStep } from '../progress';
import { uniqueSlug } from '../utils/slug';
import { validateIngredientName } from '../../services/planValidation.service';
import { computeRecipeTags } from '../utils/autotagger';
import type { ProcessedRecipe, MappedIngredient, RecipeNutrition } from '../types';

// ─── Auto-tagging (P0.5/P0.8) ─────────────────────────────────────────────────
// Enriches ProcessedRecipe.tags with the autotagger output so newly-scraped
// recipes hit the DB pre-tagged. The autotagger is deterministic, sorted, and
// dedupes — re-running on already-tagged recipes is a no-op.
function enrichWithAutoTags(recipe: ProcessedRecipe): void {
  recipe.tags = computeRecipeTags({
    cuisineType: recipe.cuisineType,
    mealType: recipe.mealType,
    cookingMethod: null, // not present in ProcessedRecipe; populated post-import.
    totalTimeMinutes: recipe.totalTimeMinutes,
    containsVegetableServing: null,
    vegetableWeightG: null,
    ingredientNames: recipe.ingredients.map((i) => i.name),
    dietFlags: recipe.dietFlags.map((f) => ({
      flagCode: f.flagCode,
      value: f.value,
      // ProcessedRecipe.dietFlags carries confidence as 0-1; autotagger expects 0-100.
      confidence: Math.round(f.confidence * 100),
    })),
    existingTags: recipe.tags,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDecimalOrNull(val: number | undefined | null): number | null {
  return val !== undefined && val !== null ? val : null;
}

function buildIngredientData(
  ingredients: MappedIngredient[],
  recipeTitle?: string,
): Array<{
  cleanProductId: string | null;
  sortOrder: number;
  quantity: number;
  unit: string;
  grams: number;
  displayName: string | null;
  notes: string | null;
}> {
  return ingredients.map((ing, idx) => {
    // BUG-3 prevention: log warning for problematic displayName (not blocking in current mode)
    const validation = validateIngredientName(ing.originalText ?? null);
    if (!validation.valid) {
      console.warn(
        `[scraper:09-save] invalid ingredient displayName in recipe "${recipeTitle ?? '?'}": "${ing.originalText}" — reasons: ${validation.reasons.join(', ')}`,
      );
    }
    // displayName is a *label fallback* shown only when no CleanProduct
    // mapping is present. Previously this stored ing.originalText (raw HTML
    // like "60 g chałki"), which duplicated the quantity the UI already
    // renders. Store the canonical normalized name ("Chałka") instead, and
    // skip it entirely when a CleanProduct link exists.
    return {
      cleanProductId: ing.cleanProductId || null,
      sortOrder: idx,
      quantity: ing.grams,
      unit: ing.unit || 'g',
      grams: ing.grams,
      displayName: ing.cleanProductId ? null : ing.name || null,
      notes: ing.notes || null,
    };
  });
}

function buildStepsData(
  steps: string[],
): Array<{
  stepNumber: number;
  instruction: string;
}> {
  return steps.map((text, idx) => ({
    stepNumber: idx + 1,
    instruction: text,
  }));
}

function buildNutritionData(
  nutrition: RecipeNutrition,
  servings: number,
): {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sugars_g: number | null;
  fiber_g: number | null;
  salt_g: number | null;
  saturatedFat_g: number | null;
  monounsaturatedFat_g: number | null;
  polyunsaturatedFat_g: number | null;
  omega3_g: number | null;
  omega6_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  magnesium_mg: number | null;
  phosphorus_mg: number | null;
  iron_mg: number | null;
  zinc_mg: number | null;
  copper_mg: number | null;
  manganese_mg: number | null;
  iodine_ug: number | null;
  selenium_ug: number | null;
  vitaminA_ug: number | null;
  vitaminD_ug: number | null;
  vitaminE_mg: number | null;
  vitaminK_ug: number | null;
  vitaminC_mg: number | null;
  vitaminB1_mg: number | null;
  vitaminB2_mg: number | null;
  vitaminB6_mg: number | null;
  folate_ug: number | null;
  vitaminB12_ug: number | null;
  totalKcal: number;
  totalProtein_g: number;
  totalFat_g: number;
  totalCarbs_g: number;
} {
  return {
    kcal: nutrition.kcal,
    protein_g: nutrition.proteinG,
    fat_g: nutrition.fatG,
    carbs_g: nutrition.carbsG,
    sugars_g: toDecimalOrNull(nutrition.sugarsG),
    fiber_g: toDecimalOrNull(nutrition.fiberG),
    salt_g: toDecimalOrNull(nutrition.saltG),
    saturatedFat_g: toDecimalOrNull(nutrition.saturatedFatG),
    monounsaturatedFat_g: toDecimalOrNull(nutrition.monounsaturatedFatG),
    polyunsaturatedFat_g: toDecimalOrNull(nutrition.polyunsaturatedFatG),
    omega3_g: toDecimalOrNull(nutrition.omega3G),
    omega6_g: toDecimalOrNull(nutrition.omega6G),
    cholesterol_mg: toDecimalOrNull(nutrition.cholesterolMg),
    sodium_mg: toDecimalOrNull(nutrition.sodiumMg),
    potassium_mg: toDecimalOrNull(nutrition.potassiumMg),
    calcium_mg: toDecimalOrNull(nutrition.calciumMg),
    magnesium_mg: toDecimalOrNull(nutrition.magnesiumMg),
    phosphorus_mg: toDecimalOrNull(nutrition.phosphorusMg),
    iron_mg: toDecimalOrNull(nutrition.ironMg),
    zinc_mg: toDecimalOrNull(nutrition.zincMg),
    copper_mg: toDecimalOrNull(nutrition.copperMg),
    manganese_mg: toDecimalOrNull(nutrition.manganeseMg),
    iodine_ug: toDecimalOrNull(nutrition.iodineMcg),
    selenium_ug: toDecimalOrNull(nutrition.seleniumUg),
    vitaminA_ug: toDecimalOrNull(nutrition.vitaminAUg),
    vitaminD_ug: toDecimalOrNull(nutrition.vitaminDUg),
    vitaminE_mg: toDecimalOrNull(nutrition.vitaminEMg),
    vitaminK_ug: toDecimalOrNull(nutrition.vitaminKUg),
    vitaminC_mg: toDecimalOrNull(nutrition.vitaminCMg),
    vitaminB1_mg: toDecimalOrNull(nutrition.vitaminB1Mg),
    vitaminB2_mg: toDecimalOrNull(nutrition.vitaminB2Mg),
    vitaminB6_mg: toDecimalOrNull(nutrition.vitaminB6Mg),
    folate_ug: toDecimalOrNull(nutrition.folateMcg),
    vitaminB12_ug: toDecimalOrNull(nutrition.vitaminB12Ug),
    totalKcal: nutrition.kcal * servings,
    totalProtein_g: nutrition.proteinG * servings,
    totalFat_g: nutrition.fatG * servings,
    totalCarbs_g: nutrition.carbsG * servings,
  };
}

function mapMealType(mealType: string): string {
  const valid = [
    'BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER',
    'SNACK', 'DESSERT', 'DRINK', 'SAUCE', 'SIDE_DISH',
  ];
  const upper = mealType.toUpperCase();
  return valid.includes(upper) ? upper : 'LUNCH';
}

function mapDifficulty(difficulty: string): string {
  const valid = ['EASY', 'MEDIUM', 'HARD'];
  const upper = difficulty.toUpperCase();
  return valid.includes(upper) ? upper : 'MEDIUM';
}

function mapEstimatedCost(cost: string): string {
  const valid = ['BUDGET', 'STANDARD', 'PREMIUM'];
  const upper = cost.toUpperCase();
  return valid.includes(upper) ? upper : 'STANDARD';
}

// ─── Main step ────────────────────────────────────────────────────────────────

export async function step9(opts?: { resume?: boolean }): Promise<void> {
  const dataDir = path.resolve(PIPELINE_CONFIG.dataDir);
  const inputPath = path.join(dataDir, 'deduplicated.json');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[step9] Input file not found: ${inputPath}`);
  }

  console.log('[step9] Loading deduplicated recipes...');
  const recipes: ProcessedRecipe[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`[step9] Loaded ${recipes.length} recipes.`);

  // Auto-tag (P0.5/P0.8): runs over every recipe post-detection so dietFlags
  // and ingredient names from earlier steps feed the tagger. Idempotent.
  for (const r of recipes) enrichWithAutoTags(r);

  // Step 1: Delete all existing imported recipes
  console.log('[step9] Deleting all existing recipes...');
  try {
    const deleted = await prisma.recipe.deleteMany({});
    console.log(`[step9] Deleted ${deleted.count} existing recipes.`);
  } catch (err) {
    console.error('[step9] Error deleting existing recipes:', err);
    throw err;
  }

  // Step 2: Save recipes in batches
  const batchSize = PIPELINE_CONFIG.saveBatchSize;
  const existingSlugs = new Set<string>();
  let savedCount = 0;
  let errorCount = 0;
  const startIdx = opts?.resume ? savedCount : 0;

  const totalBatches = Math.ceil(recipes.length / batchSize);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * batchSize;
    const end = Math.min(start + batchSize, recipes.length);
    const batch = recipes.slice(start, end);

    if (start < startIdx) continue;

    try {
      await prisma.$transaction(async (tx) => {
        for (const recipe of batch) {
          const slug = uniqueSlug(recipe.title, existingSlugs);

          await tx.recipe.create({
            data: {
              source: 'imported',
              sourceId: recipe.sourceId,
              title: recipe.title,
              slug,
              description: recipe.description || null,
              category: recipe.category || null,
              cuisineType: recipe.cuisineType || null,
              mealType: mapMealType(recipe.mealType) as 'LUNCH',
              difficulty: mapDifficulty(recipe.difficulty) as 'MEDIUM',
              prepTimeMinutes: recipe.prepTimeMinutes,
              cookTimeMinutes: recipe.cookTimeMinutes,
              totalTimeMinutes: recipe.totalTimeMinutes,
              servings: recipe.servings || 1,
              tips: recipe.tips || null,
              imageUrl: recipe.imageUrl || null,
              sourceUrl: recipe.sourceUrl,
              estimatedCost: mapEstimatedCost(recipe.estimatedCost) as 'STANDARD',
              isActive: true,
              qualityScore: recipe.qualityScore,
              averageRating: recipe.sourceRating ?? null,
              ratingCount: recipe.sourceRatingCount ?? 0,
              verificationStatus: 'UNVERIFIED',
              mealPrepFriendly: recipe.mealPrepFriendly || false,
              seasons: recipe.seasons || [],
              tags: recipe.tags || [],

              // Nested: Ingredients
              ingredients: {
                create: buildIngredientData(recipe.ingredients, recipe.title),
              },

              // Nested: Instruction Steps
              instructionSteps: {
                create: buildStepsData(recipe.steps),
              },

              // Nested: Nutrition Snapshot
              ...(recipe.nutrition ? {
                nutritionSnapshot: {
                  create: buildNutritionData(recipe.nutrition, recipe.servings || 1),
                },
              } : {}),

              // Nested: Allergens
              allergens: {
                create: recipe.allergens.map((a) => ({
                  allergenCode: a.allergenCode,
                  presence: a.presence as 'CONTAINS',
                })),
              },

              // Nested: Diet Flags
              dietFlags: {
                create: recipe.dietFlags.map((f) => ({
                  flagCode: f.flagCode,
                  value: f.value,
                  source: f.source as 'AUTO_RULE',
                  confidence: Math.round(f.confidence * 100),
                })),
              },
            },
          });
        }
      });

      savedCount += batch.length;
      console.log(
        `[step9] Batch ${batchIdx + 1}/${totalBatches}: saved ${batch.length} recipes ` +
        `(${savedCount}/${recipes.length} total)`,
      );
    } catch (err) {
      errorCount += batch.length;
      console.error(
        `[step9] Error saving batch ${batchIdx + 1}/${totalBatches}:`,
        err instanceof Error ? err.message : err,
      );

      // Try saving individually to find the problematic recipe
      for (const recipe of batch) {
        try {
          const slug = uniqueSlug(recipe.title, existingSlugs);

          await prisma.recipe.create({
            data: {
              source: 'imported',
              sourceId: recipe.sourceId,
              title: recipe.title,
              slug,
              description: recipe.description || null,
              category: recipe.category || null,
              cuisineType: recipe.cuisineType || null,
              mealType: mapMealType(recipe.mealType) as 'LUNCH',
              difficulty: mapDifficulty(recipe.difficulty) as 'MEDIUM',
              prepTimeMinutes: recipe.prepTimeMinutes,
              cookTimeMinutes: recipe.cookTimeMinutes,
              totalTimeMinutes: recipe.totalTimeMinutes,
              servings: recipe.servings || 1,
              tips: recipe.tips || null,
              imageUrl: recipe.imageUrl || null,
              sourceUrl: recipe.sourceUrl,
              estimatedCost: mapEstimatedCost(recipe.estimatedCost) as 'STANDARD',
              isActive: true,
              qualityScore: recipe.qualityScore,
              averageRating: recipe.sourceRating ?? null,
              ratingCount: recipe.sourceRatingCount ?? 0,
              verificationStatus: 'UNVERIFIED',
              mealPrepFriendly: recipe.mealPrepFriendly || false,
              seasons: recipe.seasons || [],
              tags: recipe.tags || [],
              ingredients: {
                create: buildIngredientData(recipe.ingredients, recipe.title),
              },
              instructionSteps: {
                create: buildStepsData(recipe.steps),
              },
              ...(recipe.nutrition ? {
                nutritionSnapshot: {
                  create: buildNutritionData(recipe.nutrition, recipe.servings || 1),
                },
              } : {}),
              allergens: {
                create: recipe.allergens.map((a) => ({
                  allergenCode: a.allergenCode,
                  presence: a.presence as 'CONTAINS',
                })),
              },
              dietFlags: {
                create: recipe.dietFlags.map((f) => ({
                  flagCode: f.flagCode,
                  value: f.value,
                  source: f.source as 'AUTO_RULE',
                  confidence: Math.round(f.confidence * 100),
                })),
              },
            },
          });

          savedCount++;
          errorCount--;
        } catch (innerErr) {
          console.error(
            `[step9] Failed to save recipe "${recipe.title}" (${recipe.sourceUrl}):`,
            innerErr instanceof Error ? innerErr.message : innerErr,
          );
        }
      }
    }
  }

  const progress = loadProgress();
  progress.saved = savedCount;
  updateStep(progress, 9);

  console.log(`[step9] Done. Saved: ${savedCount}, Errors: ${errorCount}`);

  // Verify saved count in DB
  try {
    const dbCount = await prisma.recipe.count();
    console.log(`[step9] Verification: ${dbCount} recipes in database.`);
  } catch (err) {
    console.error('[step9] Could not verify DB count:', err);
  }
}
