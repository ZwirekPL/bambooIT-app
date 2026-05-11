/**
 * Step 4: Calculate nutrition per serving from CleanProductNutrients.
 *
 * For each mapped recipe, loads nutrient data from the database,
 * calculates per-serving macros and micronutrients, and saves
 * to data/with-macros.json.
 *
 * Skips recipes where > 50% of non-spice ingredients are unmapped.
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@db';
import { PIPELINE_CONFIG } from '../config';
import { loadProgress, saveProgress, updateStep } from '../progress';
import { aggregateRetention, type CookingMethod } from '../utils/retentionFactor';
import type { MappedIngredient, RecipeNutrition } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MappedRecipe {
  sourceId: string;
  sourceUrl: string;
  sourceSite: string;
  title: string;
  rawIngredients: string[];
  steps: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  servings?: number;
  rating?: number;
  ratingCount?: number;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  ingredients: MappedIngredient[];
  ingredientMatchRate: number;
}

interface RecipeWithMacros extends MappedRecipe {
  nutrition: RecipeNutrition | null;
}

// ─── File helpers ───────────────────────────────────────────────────────────

const rootDir = path.resolve(__dirname, '..', '..', '..');

function mappedFilePath(): string {
  return path.join(rootDir, PIPELINE_CONFIG.dataDir, 'mapped.json');
}

function macrosFilePath(): string {
  return path.join(rootDir, PIPELINE_CONFIG.dataDir, 'with-macros.json');
}

function loadMappedRecipes(): MappedRecipe[] {
  const filePath = mappedFilePath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MappedRecipe[];
    }
  } catch (err) {
    console.error('[step4] Could not load mapped recipes:', err instanceof Error ? err.message : err);
  }
  return [];
}

function loadExistingMacros(): RecipeWithMacros[] {
  const filePath = macrosFilePath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RecipeWithMacros[];
    }
  } catch {
    console.warn('[step4] Could not load existing macros file, starting fresh.');
  }
  return [];
}

function saveMacros(recipes: RecipeWithMacros[]): void {
  const filePath = macrosFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(recipes, null, 2), 'utf-8');
}

// ─── Decimal helper ─────────────────────────────────────────────────────────

function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  // Prisma Decimal comes as Decimal object or string
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

// ─── Nutrient calculation ───────────────────────────────────────────────────

function calculateNutrition(
  ingredients: MappedIngredient[],
  nutrientsMap: Map<string, Record<string, unknown>>,
  servings: number,
): RecipeNutrition | null {
  // Only consider non-spice, mapped ingredients for macro calculation
  const mappedIngredients = ingredients.filter(
    (ing) => ing.cleanProductId !== null && ing.grams > 0,
  );

  if (mappedIngredients.length === 0) return null;

  // Accumulate total nutrients
  let kcal = 0;
  let proteinG = 0;
  let fatG = 0;
  let carbsG = 0;
  let fiberG = 0;
  let sugarsG = 0;
  let saltG = 0;
  let saturatedFatG = 0;
  let monounsaturatedFatG = 0;
  let polyunsaturatedFatG = 0;
  let omega3G = 0;
  let omega6G = 0;
  let cholesterolMg = 0;
  let vitaminAUg = 0;
  let vitaminB1Mg = 0;
  let vitaminB2Mg = 0;
  let vitaminB6Mg = 0;
  let vitaminB12Ug = 0;
  let vitaminCMg = 0;
  let vitaminDUg = 0;
  let vitaminEMg = 0;
  let vitaminKUg = 0;
  let folateMcg = 0;
  let niacinMg = 0;
  let calciumMg = 0;
  let ironMg = 0;
  let magnesiumMg = 0;
  let phosphorusMg = 0;
  let potassiumMg = 0;
  let sodiumMg = 0;
  let zincMg = 0;
  let seleniumUg = 0;
  let iodineMcg = 0;
  let copperMg = 0;
  let manganeseMg = 0;

  for (const ingredient of mappedIngredients) {
    const nutrients = nutrientsMap.get(ingredient.cleanProductId!);
    if (!nutrients) continue;

    // Formula: (nutrientPer100g * ingredientGrams / 100)
    const factor = ingredient.grams / 100;

    kcal += toNum(nutrients.kcalPer100g) * factor;
    proteinG += toNum(nutrients.proteinPer100g) * factor;
    fatG += toNum(nutrients.fatPer100g) * factor;
    carbsG += toNum(nutrients.carbsPer100g) * factor;
    fiberG += toNum(nutrients.fiberPer100g) * factor;
    sugarsG += toNum(nutrients.sugarsPer100g) * factor;
    saltG += toNum(nutrients.saltPer100g) * factor;
    saturatedFatG += toNum(nutrients.saturatedFatPer100g) * factor;
    monounsaturatedFatG += toNum(nutrients.monounsaturatedFatPer100g) * factor;
    polyunsaturatedFatG += toNum(nutrients.polyunsaturatedFatPer100g) * factor;
    omega3G += toNum(nutrients.omega3Per100g) * factor;
    omega6G += toNum(nutrients.omega6Per100g) * factor;
    cholesterolMg += toNum(nutrients.cholesterolMg) * factor;
    vitaminAUg += toNum(nutrients.vitaminAUg) * factor;
    vitaminB1Mg += toNum(nutrients.vitaminB1Mg) * factor;
    vitaminB2Mg += toNum(nutrients.vitaminB2Mg) * factor;
    vitaminB6Mg += toNum(nutrients.vitaminB6Mg) * factor;
    vitaminB12Ug += toNum(nutrients.vitaminB12Ug) * factor;
    vitaminCMg += toNum(nutrients.vitaminCMg) * factor;
    vitaminDUg += toNum(nutrients.vitaminDUg) * factor;
    vitaminEMg += toNum(nutrients.vitaminEMg) * factor;
    vitaminKUg += toNum(nutrients.vitaminKUg) * factor;
    folateMcg += toNum(nutrients.folateUg) * factor;
    niacinMg += toNum(nutrients.vitaminB3Mg) * factor;
    calciumMg += toNum(nutrients.calciumMg) * factor;
    ironMg += toNum(nutrients.ironMg) * factor;
    magnesiumMg += toNum(nutrients.magnesiumMg) * factor;
    phosphorusMg += toNum(nutrients.phosphorusMg) * factor;
    potassiumMg += toNum(nutrients.potassiumMg) * factor;
    sodiumMg += toNum(nutrients.sodiumMg) * factor;
    zincMg += toNum(nutrients.zincMg) * factor;
    seleniumUg += toNum(nutrients.seleniumUg) * factor;
    iodineMcg += toNum(nutrients.iodineUg) * factor;
    copperMg += toNum(nutrients.copperMg) * factor;
    manganeseMg += toNum(nutrients.manganeseMg) * factor;
  }

  // Divide by servings
  const s = Math.max(servings, 1);
  const round = (v: number): number => Math.round(v * 10) / 10;

  return {
    kcal: round(kcal / s),
    proteinG: round(proteinG / s),
    fatG: round(fatG / s),
    carbsG: round(carbsG / s),
    fiberG: round(fiberG / s),
    sugarsG: round(sugarsG / s),
    saltG: round(saltG / s),
    saturatedFatG: round(saturatedFatG / s) || undefined,
    monounsaturatedFatG: round(monounsaturatedFatG / s) || undefined,
    polyunsaturatedFatG: round(polyunsaturatedFatG / s) || undefined,
    omega3G: round(omega3G / s) || undefined,
    omega6G: round(omega6G / s) || undefined,
    cholesterolMg: round(cholesterolMg / s) || undefined,
    vitaminAUg: round(vitaminAUg / s) || undefined,
    vitaminB1Mg: round(vitaminB1Mg / s) || undefined,
    vitaminB2Mg: round(vitaminB2Mg / s) || undefined,
    vitaminB6Mg: round(vitaminB6Mg / s) || undefined,
    vitaminB12Ug: round(vitaminB12Ug / s) || undefined,
    vitaminCMg: round(vitaminCMg / s) || undefined,
    vitaminDUg: round(vitaminDUg / s) || undefined,
    vitaminEMg: round(vitaminEMg / s) || undefined,
    vitaminKUg: round(vitaminKUg / s) || undefined,
    folateMcg: round(folateMcg / s) || undefined,
    niacinMg: round(niacinMg / s) || undefined,
    calciumMg: round(calciumMg / s) || undefined,
    ironMg: round(ironMg / s) || undefined,
    magnesiumMg: round(magnesiumMg / s) || undefined,
    phosphorusMg: round(phosphorusMg / s) || undefined,
    potassiumMg: round(potassiumMg / s) || undefined,
    sodiumMg: round(sodiumMg / s) || undefined,
    zincMg: round(zincMg / s) || undefined,
    seleniumUg: round(seleniumUg / s) || undefined,
    iodineMcg: round(iodineMcg / s) || undefined,
    copperMg: round(copperMg / s) || undefined,
    manganeseMg: round(manganeseMg / s) || undefined,
  };
}

// ─── Cooking-loss adjustment (S-11 retentionFactor) ─────────────────────────
//
// Applies USDA-derived retention factors to heat-sensitive nutrients based on
// the most-destructive cooking method observed in recipe.steps. Stable
// nutrients (protein, fat, carbs, fiber, saturated/mono/poly fat fractions,
// sugars) pass through unchanged — retentionFor() returns 1.0 for them.

function applyRetention(
  nutrition: RecipeNutrition,
  steps: string[],
): { adjusted: RecipeNutrition; method: CookingMethod } {
  const report = aggregateRetention(steps);
  const f = report.perNutrient;
  const round = (v: number): number => Math.round(v * 10) / 10;
  const round2 = (v: number): number => Math.round(v * 100) / 100;
  const apply = (v: number | undefined, factor: number, twoDecimals = false): number | undefined =>
    v === undefined ? undefined : (twoDecimals ? round2(v * factor) : round(v * factor));

  const adjusted: RecipeNutrition = {
    ...nutrition,
    // Water-soluble vitamins
    vitaminB1Mg: apply(nutrition.vitaminB1Mg, f.vitB1, true),
    vitaminCMg: apply(nutrition.vitaminCMg, f.vitC),
    folateMcg: apply(nutrition.folateMcg, f.vitB9),
    vitaminB12Ug: apply(nutrition.vitaminB12Ug, f.vitB12, true),
    // Fat-soluble vitamins
    vitaminAUg: apply(nutrition.vitaminAUg, f.vitA),
    vitaminDUg: apply(nutrition.vitaminDUg, f.vitD, true),
    vitaminEMg: apply(nutrition.vitaminEMg, f.vitE, true),
    vitaminKUg: apply(nutrition.vitaminKUg, f.vitK),
    // Minerals (collective factor)
    calciumMg: apply(nutrition.calciumMg, f.minerals),
    ironMg: apply(nutrition.ironMg, f.minerals, true),
    magnesiumMg: apply(nutrition.magnesiumMg, f.minerals),
    phosphorusMg: apply(nutrition.phosphorusMg, f.minerals),
    potassiumMg: apply(nutrition.potassiumMg, f.minerals),
    sodiumMg: apply(nutrition.sodiumMg, f.minerals),
    zincMg: apply(nutrition.zincMg, f.minerals, true),
    seleniumUg: apply(nutrition.seleniumUg, f.minerals, true),
    iodineMcg: apply(nutrition.iodineMcg, f.minerals, true),
    copperMg: apply(nutrition.copperMg, f.minerals, true),
    manganeseMg: apply(nutrition.manganeseMg, f.minerals, true),
    // Omega-3 oxidation under high heat
    omega3G: apply(nutrition.omega3G, f.omega3, true),
  };

  return { adjusted, method: report.primaryMethod };
}

// ─── Step 4 ─────────────────────────────────────────────────────────────────

export async function step4(opts?: { resume?: boolean; site?: string }): Promise<void> {
  const resume = opts?.resume ?? false;

  console.log('\n=== STEP 4: CALCULATE MACROS ===');
  console.log(`  Resume: ${resume}`);

  const progress = loadProgress();
  updateStep(progress, 4);

  // Load mapped recipes
  const mappedRecipes = loadMappedRecipes();
  if (mappedRecipes.length === 0) {
    console.error('[step4] No mapped recipes found. Run step 3 first.');
    return;
  }

  // Filter by site if requested
  const filteredRecipes = opts?.site
    ? mappedRecipes.filter((r) => r.sourceSite === opts.site)
    : mappedRecipes;

  console.log(`  Total mapped recipes: ${filteredRecipes.length}`);

  // Load existing results for resume
  let results: RecipeWithMacros[] = resume ? loadExistingMacros() : [];
  const doneUrls = new Set(results.map((r) => r.sourceUrl));

  const toProcess = filteredRecipes.filter((r) => !doneUrls.has(r.sourceUrl));
  console.log(`  To process: ${toProcess.length} recipes (${doneUrls.size} already done)`);

  // Collect all unique CleanProduct IDs to batch-load nutrients
  const allProductIds = new Set<string>();
  for (const recipe of toProcess) {
    for (const ing of recipe.ingredients) {
      if (ing.cleanProductId) allProductIds.add(ing.cleanProductId);
    }
  }

  console.log(`  Loading nutrients for ${allProductIds.size} unique products...`);

  // Load all nutrients in one query
  const dbNutrients = await prisma.cleanProductNutrients.findMany({
    where: { cleanProductId: { in: [...allProductIds] } },
  });

  const nutrientsMap = new Map<string, Record<string, unknown>>();
  for (const n of dbNutrients) {
    nutrientsMap.set(n.cleanProductId, n as unknown as Record<string, unknown>);
  }

  console.log(`  Loaded nutrients for ${nutrientsMap.size} products`);

  // Stats
  let withNutrition = 0;
  let skippedLowMatch = 0;
  let skippedNoNutrition = 0;
  const methodCounts = new Map<CookingMethod, number>();

  for (let i = 0; i < toProcess.length; i++) {
    const recipe = toProcess[i];

    // Skip recipes where > 50% of non-spice ingredients are unmapped
    if (recipe.ingredientMatchRate < PIPELINE_CONFIG.minIngredientMatchRate) {
      skippedLowMatch++;
      results.push({ ...recipe, nutrition: null });
      continue;
    }

    const servings = recipe.servings ?? 1;
    const rawNutrition = calculateNutrition(recipe.ingredients, nutrientsMap, servings);

    let nutrition = rawNutrition;
    if (rawNutrition) {
      const { adjusted, method } = applyRetention(rawNutrition, recipe.steps);
      nutrition = adjusted;
      methodCounts.set(method, (methodCounts.get(method) ?? 0) + 1);
      withNutrition++;
    } else {
      skippedNoNutrition++;
    }

    results.push({ ...recipe, nutrition });

    // Periodic checkpoint save
    if ((i + 1) % 200 === 0) {
      saveMacros(results);
      saveProgress(progress);
      console.log(`  [step4] Progress: ${i + 1}/${toProcess.length} recipes processed`);
    }
  }

  // Final save
  saveMacros(results);
  saveProgress(progress);

  // Log stats
  console.log('\n[step4] Nutrition calculation stats:');
  console.log(`  With nutrition data: ${withNutrition}`);
  console.log(`  Skipped (low match rate < ${PIPELINE_CONFIG.minIngredientMatchRate}): ${skippedLowMatch}`);
  console.log(`  Skipped (no nutrients available): ${skippedNoNutrition}`);
  console.log(`  Total recipes saved: ${results.length}`);
  console.log(`  Saved to: ${macrosFilePath()}`);

  if (methodCounts.size > 0) {
    const sortedMethods = [...methodCounts.entries()].sort((a, b) => b[1] - a[1]);
    console.log('\n[step4] Retention factor — primary cooking method distribution:');
    for (const [method, count] of sortedMethods) {
      console.log(`  ${method.padEnd(12)} ${count}`);
    }
  }
}
