/**
 * Step 5: Generate metadata using OpenAI gpt-4.1-mini.
 *
 * Loads recipes from data/with-macros.json, batches 5 recipes per API call,
 * and enriches each recipe with:
 *   description, mealType, cuisineType, difficulty, seasons,
 *   mealPrepFriendly, mealPrepTip, estimatedCost
 *
 * Saves to data/with-meta.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PIPELINE_CONFIG, OPENAI_CONFIG } from '../config';
import { loadProgress, saveProgress, updateStep } from '../progress';
import { generateMetadata } from '../utils/openai-normalize';
import type { MappedIngredient, RecipeNutrition } from '../types';
import type { RecipeMetadata } from '../utils/openai-normalize';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecipeWithMacros {
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
  nutrition: RecipeNutrition | null;
}

interface RecipeWithMeta extends RecipeWithMacros {
  description: string;
  mealType: string;
  cuisineType: string;
  difficulty: string;
  seasons: number[];
  mealPrepFriendly: boolean;
  mealPrepTip: string | null;
  estimatedCost: 'BUDGET' | 'STANDARD' | 'PREMIUM';
}

// ─── File helpers ───────────────────────────────────────────────────────────

const rootDir = path.resolve(__dirname, '..', '..', '..');

function macrosFilePath(): string {
  return path.join(rootDir, PIPELINE_CONFIG.dataDir, 'with-macros.json');
}

function metaFilePath(): string {
  return path.join(rootDir, PIPELINE_CONFIG.dataDir, 'with-meta.json');
}

function loadMacrosRecipes(): RecipeWithMacros[] {
  const filePath = macrosFilePath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RecipeWithMacros[];
    }
  } catch (err) {
    console.error('[step5] Could not load macros recipes:', err instanceof Error ? err.message : err);
  }
  return [];
}

function loadExistingMeta(): RecipeWithMeta[] {
  const filePath = metaFilePath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RecipeWithMeta[];
    }
  } catch {
    console.warn('[step5] Could not load existing meta file, starting fresh.');
  }
  return [];
}

function saveMeta(recipes: RecipeWithMeta[]): void {
  const filePath = metaFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(recipes, null, 2), 'utf-8');
}

// ─── Apply metadata to recipe ───────────────────────────────────────────────

function applyMetadata(recipe: RecipeWithMacros, meta: RecipeMetadata): RecipeWithMeta {
  return {
    ...recipe,
    description: meta.description,
    mealType: meta.mealType,
    cuisineType: meta.cuisineType,
    difficulty: meta.difficulty,
    seasons: meta.seasons,
    mealPrepFriendly: meta.mealPrepFriendly,
    mealPrepTip: meta.mealPrepTip,
    estimatedCost: meta.estimatedCost,
  };
}

function defaultMetadata(): RecipeMetadata {
  return {
    description: '',
    mealType: 'LUNCH',
    cuisineType: 'inna',
    difficulty: 'MEDIUM',
    seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    mealPrepFriendly: false,
    mealPrepTip: null,
    estimatedCost: 'STANDARD',
  };
}

// ─── Step 5 ─────────────────────────────────────────────────────────────────

export async function step5(opts?: { resume?: boolean; site?: string }): Promise<void> {
  const resume = opts?.resume ?? false;

  console.log('\n=== STEP 5: GENERATE METADATA ===');
  console.log(`  Resume: ${resume}`);

  const progress = loadProgress();
  updateStep(progress, 5);

  // Load recipes with macros
  const macrosRecipes = loadMacrosRecipes();
  if (macrosRecipes.length === 0) {
    console.error('[step5] No recipes with macros found. Run step 4 first.');
    return;
  }

  // Filter by site if requested
  const filteredRecipes = opts?.site
    ? macrosRecipes.filter((r) => r.sourceSite === opts.site)
    : macrosRecipes;

  console.log(`  Total recipes with macros: ${filteredRecipes.length}`);

  // Load existing meta for resume
  let results: RecipeWithMeta[] = resume ? loadExistingMeta() : [];
  const doneUrls = new Set(results.map((r) => r.sourceUrl));

  const toProcess = filteredRecipes.filter((r) => !doneUrls.has(r.sourceUrl));
  console.log(`  To process: ${toProcess.length} recipes (${doneUrls.size} already done)`);

  if (toProcess.length === 0) {
    console.log('[step5] Nothing to process.');
    return;
  }

  // Stats
  let successCount = 0;
  let failedCount = 0;
  let batchCount = 0;

  // Process in batches
  for (let i = 0; i < toProcess.length; i += OPENAI_CONFIG.metaBatchSize) {
    const batch = toProcess.slice(i, i + OPENAI_CONFIG.metaBatchSize);
    batchCount++;

    // Prepare API input
    const apiInput = batch.map((recipe) => ({
      title: recipe.title,
      ingredients: recipe.ingredients.map((ing) => ing.name || ing.originalText),
      steps: recipe.steps,
      category: recipe.category,
      totalTimeMinutes: recipe.totalTimeMinutes,
    }));

    try {
      const metadataResults = await generateMetadata(apiInput);

      // Apply metadata to each recipe in the batch
      for (let j = 0; j < batch.length; j++) {
        const meta = metadataResults[j] ?? defaultMetadata();
        const enriched = applyMetadata(batch[j], meta);
        results.push(enriched);
        successCount++;
      }
    } catch (err) {
      console.error(
        `  [step5] Batch ${batchCount} failed:`,
        err instanceof Error ? err.message : err,
      );

      // Apply default metadata for failed batch
      for (const recipe of batch) {
        const enriched = applyMetadata(recipe, defaultMetadata());
        results.push(enriched);
        failedCount++;
      }
    }

    // Periodic checkpoint save (every 10 batches)
    if (batchCount % 10 === 0) {
      saveMeta(results);
      progress.metaGenerated = results.length;
      saveProgress(progress);
      const processed = Math.min(i + OPENAI_CONFIG.metaBatchSize, toProcess.length);
      console.log(`  [step5] Progress: ${processed}/${toProcess.length} recipes (batch ${batchCount})`);
    }
  }

  // Final save
  saveMeta(results);
  progress.metaGenerated = results.length;
  saveProgress(progress);

  // Log stats
  console.log('\n[step5] Metadata generation stats:');
  console.log(`  Successfully generated: ${successCount}`);
  console.log(`  Failed (used defaults): ${failedCount}`);
  console.log(`  Total batches: ${batchCount}`);
  console.log(`  Total recipes with meta: ${results.length}`);
  console.log(`  Saved to: ${metaFilePath()}`);
}
