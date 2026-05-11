/**
 * Step 2: Normalize ingredients using OpenAI gpt-4.1-mini.
 *
 * Reads raw recipes from data/raw/*.json, batches ingredients, and saves
 * normalized recipes to data/normalized.json.
 *
 * Supports --resume to skip already-normalized recipes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PIPELINE_CONFIG, OPENAI_CONFIG, SITE_CONFIGS } from '../config';
import { loadProgress, saveProgress, updateStep } from '../progress';
import { normalizeIngredients } from '../utils/openai-normalize';
import type { RawRecipe, NormalizedIngredient, SiteName } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NormalizedRecipe extends RawRecipe {
  normalizedIngredients: NormalizedIngredient[];
}

// ─── File helpers ───────────────────────────────────────────────────────────

const rootDir = path.resolve(__dirname, '..', '..', '..');

function rawFilePath(site: SiteName): string {
  return path.join(rootDir, PIPELINE_CONFIG.rawDir, `${site}.json`);
}

function normalizedFilePath(): string {
  return path.join(rootDir, PIPELINE_CONFIG.dataDir, 'normalized.json');
}

function loadAllRawRecipes(): RawRecipe[] {
  const allRecipes: RawRecipe[] = [];

  for (const site of Object.keys(SITE_CONFIGS) as SiteName[]) {
    const filePath = rawFilePath(site);
    try {
      if (fs.existsSync(filePath)) {
        const recipes = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawRecipe[];
        allRecipes.push(...recipes);
        console.log(`  Loaded ${recipes.length} recipes from ${site}`);
      }
    } catch (err) {
      console.warn(`  Could not load raw file for ${site}:`, err instanceof Error ? err.message : err);
    }
  }

  return allRecipes;
}

function loadExistingNormalized(): NormalizedRecipe[] {
  const filePath = normalizedFilePath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as NormalizedRecipe[];
    }
  } catch {
    console.warn('[step2] Could not load existing normalized file, starting fresh.');
  }
  return [];
}

function saveNormalized(recipes: NormalizedRecipe[]): void {
  const filePath = normalizedFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(recipes, null, 2), 'utf-8');
}

// ─── Step 2 ─────────────────────────────────────────────────────────────────

export async function step2(opts?: { resume?: boolean; site?: string }): Promise<void> {
  const resume = opts?.resume ?? false;

  console.log('\n=== STEP 2: NORMALIZE INGREDIENTS ===');
  console.log(`  Resume: ${resume}`);

  const progress = loadProgress();
  updateStep(progress, 2);

  // Load raw recipes
  const rawRecipes = loadAllRawRecipes();
  if (rawRecipes.length === 0) {
    console.error('[step2] No raw recipes found. Run step 1 first.');
    return;
  }

  // Filter by site if requested
  const filteredRecipes = opts?.site
    ? rawRecipes.filter((r) => r.sourceSite === opts.site)
    : rawRecipes;

  console.log(`  Total raw recipes: ${filteredRecipes.length}`);

  // Load existing normalized recipes for resume
  let normalized: NormalizedRecipe[] = resume ? loadExistingNormalized() : [];
  const doneUrls = new Set(normalized.map((r) => r.sourceUrl));

  const toProcess = filteredRecipes.filter((r) => !doneUrls.has(r.sourceUrl));
  console.log(`  To normalize: ${toProcess.length} recipes (${doneUrls.size} already done)`);

  // Stats
  let totalIngredients = 0;
  let normalizedCount = 0;
  let failedCount = 0;
  let processedRecipes = 0;

  // Process recipes in parallel chunks of 10 for speed
  const PARALLEL_CHUNK = 10;

  async function normalizeOne(recipe: RawRecipe): Promise<NormalizedRecipe | null> {
    const ingredients = recipe.rawIngredients;
    if (ingredients.length === 0) return null;

    totalIngredients += ingredients.length;
    const allNormalized: NormalizedIngredient[] = [];

    // Most recipes have <12 ingredients = 1 API call
    for (let i = 0; i < ingredients.length; i += OPENAI_CONFIG.normalizeBatchSize) {
      const batch = ingredients.slice(i, i + OPENAI_CONFIG.normalizeBatchSize);
      try {
        const result = await normalizeIngredients(batch);
        allNormalized.push(...result);
        normalizedCount += result.filter((r) => r.grams > 0).length;
        failedCount += result.filter((r) => r.grams === 0).length;
      } catch (err) {
        for (const text of batch) {
          allNormalized.push({ originalText: text, name: text, grams: 0, isSpice: false });
          failedCount++;
        }
      }
    }

    return { ...recipe, normalizedIngredients: allNormalized };
  }

  for (let c = 0; c < toProcess.length; c += PARALLEL_CHUNK) {
    const chunk = toProcess.slice(c, c + PARALLEL_CHUNK);
    const results = await Promise.all(chunk.map(r => normalizeOne(r).catch(() => null)));

    for (const result of results) {
      if (result) {
        normalized.push(result);
        processedRecipes++;
      }
    }

    // Checkpoint every chunk
    saveNormalized(normalized);
    progress.normalized = normalized.length;
    saveProgress(progress);
    console.log(`  [step2] Checkpoint: ${processedRecipes}/${toProcess.length} recipes normalized`);
  }

  // Final save
  saveNormalized(normalized);
  progress.normalized = normalized.length;
  saveProgress(progress);

  // Log stats
  console.log('\n[step2] Normalization stats:');
  console.log(`  Total ingredients processed: ${totalIngredients}`);
  console.log(`  Successfully normalized (grams > 0): ${normalizedCount}`);
  console.log(`  Failed (grams = 0): ${failedCount}`);
  console.log(`  Total normalized recipes: ${normalized.length}`);
  console.log(`  Saved to: ${normalizedFilePath()}`);
}
