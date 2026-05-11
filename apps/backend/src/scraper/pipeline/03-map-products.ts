/**
 * Step 3: Map normalized ingredient names to CleanProduct IDs using fuzzy matching.
 *
 * Loads normalized recipes, matches each ingredient against CleanProduct names
 * from the database, and saves mapped recipes to data/mapped.json.
 *
 * Threshold: confidence >= 0.5 for a match, otherwise null.
 */

import * as fs from 'fs';
import * as path from 'path';
import { compareTwoStrings } from 'string-similarity';
import { prisma } from '@db';
import { PIPELINE_CONFIG } from '../config';
import { loadProgress, saveProgress, updateStep } from '../progress';
import type { NormalizedIngredient, MappedIngredient } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NormalizedRecipe {
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
  normalizedIngredients: NormalizedIngredient[];
}

interface MappedRecipe extends Omit<NormalizedRecipe, 'normalizedIngredients'> {
  ingredients: MappedIngredient[];
  ingredientMatchRate: number;
}

interface ProductEntry {
  id: string;
  name: string;
  nameLower: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const MATCH_THRESHOLD = 0.5;

// ─── File helpers ───────────────────────────────────────────────────────────

const rootDir = path.resolve(__dirname, '..', '..', '..');

function normalizedFilePath(): string {
  return path.join(rootDir, PIPELINE_CONFIG.dataDir, 'normalized.json');
}

function mappedFilePath(): string {
  return path.join(rootDir, PIPELINE_CONFIG.dataDir, 'mapped.json');
}

function loadNormalizedRecipes(): NormalizedRecipe[] {
  const filePath = normalizedFilePath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as NormalizedRecipe[];
    }
  } catch (err) {
    console.error('[step3] Could not load normalized recipes:', err instanceof Error ? err.message : err);
  }
  return [];
}

function loadExistingMapped(): MappedRecipe[] {
  const filePath = mappedFilePath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MappedRecipe[];
    }
  } catch {
    console.warn('[step3] Could not load existing mapped file, starting fresh.');
  }
  return [];
}

function saveMapped(recipes: MappedRecipe[]): void {
  const filePath = mappedFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(recipes, null, 2), 'utf-8');
}

// ─── Fuzzy matching ─────────────────────────────────────────────────────────

function findBestMatch(
  ingredientName: string,
  products: ProductEntry[],
): { product: ProductEntry; confidence: number } | null {
  const nameLower = ingredientName.toLowerCase().trim();

  // Exact match first (fast path)
  const exact = products.find((p) => p.nameLower === nameLower);
  if (exact) {
    return { product: exact, confidence: 1.0 };
  }

  // Fuzzy match
  let bestMatch: ProductEntry | null = null;
  let bestScore = 0;

  for (const product of products) {
    const score = compareTwoStrings(nameLower, product.nameLower);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }

  if (bestMatch && bestScore >= MATCH_THRESHOLD) {
    return { product: bestMatch, confidence: bestScore };
  }

  return null;
}

// ─── Step 3 ─────────────────────────────────────────────────────────────────

export async function step3(opts?: { resume?: boolean; site?: string }): Promise<void> {
  const resume = opts?.resume ?? false;

  console.log('\n=== STEP 3: MAP PRODUCTS ===');
  console.log(`  Resume: ${resume}`);

  const progress = loadProgress();
  updateStep(progress, 3);

  // Load normalized recipes
  const normalizedRecipes = loadNormalizedRecipes();
  if (normalizedRecipes.length === 0) {
    console.error('[step3] No normalized recipes found. Run step 2 first.');
    return;
  }

  // Filter by site if requested
  const filteredRecipes = opts?.site
    ? normalizedRecipes.filter((r) => r.sourceSite === opts.site)
    : normalizedRecipes;

  console.log(`  Total normalized recipes: ${filteredRecipes.length}`);

  // Load all CleanProducts from DB
  console.log('  Loading CleanProducts from database...');
  const dbProducts = await prisma.cleanProduct.findMany({
    select: { id: true, name: true },
  });

  const products: ProductEntry[] = dbProducts.map((p) => ({
    id: p.id,
    name: p.name,
    nameLower: p.name.toLowerCase(),
  }));

  console.log(`  Loaded ${products.length} products from database`);

  if (products.length === 0) {
    console.error('[step3] No CleanProducts in database. Import products first.');
    return;
  }

  // Load existing mapped recipes for resume
  let mapped: MappedRecipe[] = resume ? loadExistingMapped() : [];
  const doneUrls = new Set(mapped.map((r) => r.sourceUrl));

  const toProcess = filteredRecipes.filter((r) => !doneUrls.has(r.sourceUrl));
  console.log(`  To process: ${toProcess.length} recipes (${doneUrls.size} already done)`);

  // Stats
  let totalIngredients = 0;
  let matchedIngredients = 0;
  let unmatchedIngredients = 0;
  const unmatchedNames = new Map<string, number>(); // name -> count

  for (let i = 0; i < toProcess.length; i++) {
    const recipe = toProcess[i];
    const mappedIngredients: MappedIngredient[] = [];

    for (const ingredient of recipe.normalizedIngredients) {
      totalIngredients++;

      // Skip spices for matching (they rarely need product data)
      if (ingredient.isSpice) {
        mappedIngredients.push({
          ...ingredient,
          cleanProductId: null,
          cleanProductName: null,
          matchConfidence: 0,
        });
        continue;
      }

      const match = findBestMatch(ingredient.name, products);

      if (match) {
        matchedIngredients++;
        mappedIngredients.push({
          ...ingredient,
          cleanProductId: match.product.id,
          cleanProductName: match.product.name,
          matchConfidence: match.confidence,
        });
      } else {
        unmatchedIngredients++;
        const count = unmatchedNames.get(ingredient.name) ?? 0;
        unmatchedNames.set(ingredient.name, count + 1);
        mappedIngredients.push({
          ...ingredient,
          cleanProductId: null,
          cleanProductName: null,
          matchConfidence: 0,
        });
      }
    }

    // Calculate match rate (excluding spices)
    const nonSpice = mappedIngredients.filter((ing) => !ing.isSpice);
    const matchRate = nonSpice.length > 0
      ? nonSpice.filter((ing) => ing.cleanProductId !== null).length / nonSpice.length
      : 0;

    const { normalizedIngredients: _removed, ...recipeBase } = recipe;
    const mappedRecipe: MappedRecipe = {
      ...recipeBase,
      ingredients: mappedIngredients,
      ingredientMatchRate: Math.round(matchRate * 1000) / 1000,
    };

    mapped.push(mappedRecipe);

    // Periodic checkpoint save
    if ((i + 1) % 100 === 0) {
      saveMapped(mapped);
      progress.mapped = mapped.length;
      saveProgress(progress);
      console.log(`  [step3] Progress: ${i + 1}/${toProcess.length} recipes mapped`);
    }
  }

  // Final save
  saveMapped(mapped);
  progress.mapped = mapped.length;
  saveProgress(progress);

  // Log stats
  const matchPct = totalIngredients > 0
    ? ((matchedIngredients / totalIngredients) * 100).toFixed(1)
    : '0.0';

  console.log('\n[step3] Mapping stats:');
  console.log(`  Total ingredients: ${totalIngredients}`);
  console.log(`  Matched: ${matchedIngredients} (${matchPct}%)`);
  console.log(`  Unmatched: ${unmatchedIngredients}`);
  console.log(`  Total mapped recipes: ${mapped.length}`);
  console.log(`  Saved to: ${mappedFilePath()}`);

  // Log top unmatched ingredients
  if (unmatchedNames.size > 0) {
    const sorted = [...unmatchedNames.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    console.log('\n  Top 30 unmatched ingredients:');
    for (const [name, count] of sorted) {
      console.log(`    ${count}x  ${name}`);
    }
  }
}
