/**
 * Step 6: Auto-detect allergens and diet flags from ingredient names and nutrition data.
 *
 * Allergens: EU 14, Polish keyword matching against MappedIngredient names.
 * Diet flags: delegated to scraper/utils/dietFlags.ts (S-11) — that module owns
 *   the tightened thresholds and 19-flag taxonomy. This file adapts its result
 *   shape to the persisted DietFlagEntry shape and applies site-config overrides.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PIPELINE_CONFIG, SITE_CONFIGS } from '../config';
import { loadProgress, saveProgress, updateStep } from '../progress';
import { computeDietFlags, type DietFlagCode, type DietFlagResult } from '../utils/dietFlags';
import type {
  ProcessedRecipe,
  AllergenFlag,
  DietFlagEntry,
  MappedIngredient,
  RecipeNutrition,
} from '../types';

// ─── Allergen keyword maps (Polish) ───────────────────────────────────────────

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: [
    'pszenica', 'żyto', 'jęczmień', 'owies', 'orkisz', 'mąka', 'makaron',
    'chleb', 'bułka', 'kasza manna', 'kuskus',
  ],
  milk: [
    'mleko', 'śmietana', 'jogurt', 'ser', 'twaróg', 'kefir', 'masło',
    'serwatka',
  ],
  eggs: ['jajko', 'jaja', 'jajka', 'żółtko', 'białko jajka'],
  fish: [
    'ryba', 'łosoś', 'dorsz', 'tuńczyk', 'makrela', 'śledź', 'pstrąg',
    'morszczuk', 'halibut', 'mintaj',
  ],
  crustaceans: ['krewetki', 'kraby', 'langustynki', 'homar', 'rak'],
  peanuts: ['orzeszki ziemne', 'orzech arachidowy', 'masło orzechowe'],
  soy: ['soja', 'tofu', 'tempeh', 'sos sojowy', 'edamame', 'mleko sojowe'],
  nuts: [
    'orzechy', 'migdały', 'orzechy włoskie', 'orzechy laskowe', 'pistacje',
    'nerkowce', 'pekan', 'makadamia',
  ],
  celery: ['seler', 'seler naciowy', 'seler korzeniowy'],
  mustard: ['musztarda', 'gorczyca'],
  sesame: ['sezam', 'tahini', 'pasta sezamowa'],
  sulphites: ['wino', 'ocet', 'suszone owoce', 'siarczyny'],
  lupin: ['łubin'],
  molluscs: ['małże', 'ostrygi', 'ośmiornice', 'kalmary', 'mięczaki'],
};

// ─── Allergen detection ──────────────────────────────────────────────────────

function ingredientText(ingredients: MappedIngredient[]): string {
  return ingredients.map((i) => i.name.toLowerCase()).join(' | ');
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function detectAllergens(ingredients: MappedIngredient[]): AllergenFlag[] {
  const flags: AllergenFlag[] = [];
  const allText = ingredientText(ingredients);

  for (const [code, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    const found = containsAny(allText, keywords);
    flags.push({
      allergenCode: code,
      presence: found ? 'CONTAINS' : 'FREE',
    });
  }

  return flags;
}

// ─── Diet flag detection (delegates to S-11 utils/dietFlags.ts) ───────────────

// Codes whose result is driven by ingredient analysis only — anything else
// (kcal/macro/sodium thresholds) is HEURISTIC.
const INGREDIENT_DRIVEN_CODES = new Set<DietFlagCode>([
  'vegetarian',
  'vegan',
  'pescatarian',
  'glutenFree',
  'lactoseFree',
  'ibsFriendly',
  'goutFriendly',
]);

function adaptToDietFlagEntry(r: DietFlagResult): DietFlagEntry {
  return {
    flagCode: r.code,
    value: r.value,
    confidence: r.confidence,
    source: INGREDIENT_DRIVEN_CODES.has(r.code) ? 'AUTO_RULE' : 'HEURISTIC',
  };
}

function buildDietFlags(
  ingredients: MappedIngredient[],
  nutrition: RecipeNutrition | null,
): DietFlagEntry[] {
  const results = computeDietFlags({
    ingredientNames: ingredients.map((i) => i.name),
    nutrition: nutrition
      ? {
          calories: nutrition.kcal,
          protein: nutrition.proteinG,
          fat: nutrition.fatG,
          saturatedFat: nutrition.saturatedFatG ?? null,
          carbs: nutrition.carbsG,
          sugar: nutrition.sugarsG,
          fiber: nutrition.fiberG,
          // Pipeline RecipeNutrition exposes saltG (g) instead of sodiumMg when
          // the source product table only had salt. Convert back to mg sodium
          // for the dietFlags rules that expect sodium in mg.
          sodium: nutrition.sodiumMg ?? Math.round(nutrition.saltG * 400),
          cholesterol: nutrition.cholesterolMg ?? null,
        }
      : null,
  });

  return results.map(adaptToDietFlagEntry);
}

// ─── Apply auto-flags from site config ─────────────────────────────────────

function applyAutoFlags(
  recipe: ProcessedRecipe,
  dietFlags: DietFlagEntry[],
): DietFlagEntry[] {
  const siteConfig = SITE_CONFIGS[recipe.sourceSite];
  if (!siteConfig.autoFlags) return dietFlags;

  const result = [...dietFlags];

  for (const [code, value] of Object.entries(siteConfig.autoFlags)) {
    const existing = result.find((f) => f.flagCode === code);
    if (existing) {
      // Override with source data if auto-flag says true
      if (value) {
        existing.value = true;
        existing.confidence = Math.max(existing.confidence, 0.95);
        existing.source = 'SOURCE_DATA';
      }
    } else {
      result.push({
        flagCode: code,
        value,
        confidence: 0.95,
        source: 'SOURCE_DATA',
      });
    }
  }

  return result;
}

// ─── Main step ────────────────────────────────────────────────────────────────

export async function step6(opts?: { resume?: boolean }): Promise<void> {
  const dataDir = path.resolve(PIPELINE_CONFIG.dataDir);
  const inputPath = path.join(dataDir, 'with-meta.json');
  const outputPath = path.join(dataDir, 'with-flags.json');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[step6] Input file not found: ${inputPath}`);
  }

  console.log('[step6] Loading recipes from with-meta.json...');
  const recipes: ProcessedRecipe[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`[step6] Loaded ${recipes.length} recipes.`);

  const progress = loadProgress();

  let processed = 0;
  const startIdx = opts?.resume ? (progress.flagsDetected || 0) : 0;

  for (let i = startIdx; i < recipes.length; i++) {
    const recipe = recipes[i];

    const allergens = detectAllergens(recipe.ingredients);
    let dietFlags = buildDietFlags(recipe.ingredients, recipe.nutrition);
    dietFlags = applyAutoFlags(recipe, dietFlags);

    recipe.allergens = allergens;
    recipe.dietFlags = dietFlags;

    processed++;
    if (processed % 200 === 0) {
      console.log(`[step6] Processed ${processed}/${recipes.length - startIdx} recipes...`);
      progress.flagsDetected = i + 1;
      saveProgress(progress);
    }
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2), 'utf-8');

  progress.flagsDetected = recipes.length;
  updateStep(progress, 6);

  const containsCount = recipes.reduce((sum, r) =>
    sum + r.allergens.filter((a) => a.presence === 'CONTAINS').length, 0,
  );
  const avgAllergens = recipes.length > 0
    ? (containsCount / recipes.length).toFixed(1)
    : '0';

  const trueFlags = recipes.reduce((sum, r) =>
    sum + r.dietFlags.filter((f) => f.value).length, 0,
  );
  const avgFlags = recipes.length > 0
    ? (trueFlags / recipes.length).toFixed(1)
    : '0';

  console.log(`[step6] Done. Processed ${processed} recipes.`);
  console.log(`[step6] Avg allergens detected per recipe: ${avgAllergens}`);
  console.log(`[step6] Avg true diet flags per recipe: ${avgFlags}`);
  console.log(`[step6] Saved to ${outputPath}`);
}
