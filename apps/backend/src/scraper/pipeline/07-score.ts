/**
 * Step 7: Calculate quality score (0-100) for each recipe and filter low-quality ones.
 *
 * Scoring criteria:
 *   Title (5), Description (10), Ingredients >= 3 (10), Steps >= 2 (10),
 *   Time data (5), Servings (5), Image (5), Ingredient match rate (5-15),
 *   Nutrition (10), Allergens (5), Diet flags (5), Source rating (5-10),
 *   Seasons (5).
 */

import * as fs from 'fs';
import * as path from 'path';
import { PIPELINE_CONFIG } from '../config';
import { loadProgress, saveProgress, updateStep } from '../progress';
import type { ProcessedRecipe } from '../types';

// ─── Score calculation ───────────────────────────────────────────────────────

function calculateScore(recipe: ProcessedRecipe): number {
  let score = 0;

  // Has title (5 pts)
  if (recipe.title && recipe.title.trim().length > 0) {
    score += 5;
  }

  // Has description (10 pts)
  if (recipe.description && recipe.description.trim().length > 0) {
    score += 10;
  }

  // Has >= 3 ingredients (10 pts)
  if (recipe.ingredients.length >= 3) {
    score += 10;
  }

  // Has >= 2 steps (10 pts)
  if (recipe.steps.length >= 2) {
    score += 10;
  }

  // Has prep or cook time (5 pts)
  if (recipe.prepTimeMinutes || recipe.cookTimeMinutes || recipe.totalTimeMinutes) {
    score += 5;
  }

  // Has servings (5 pts)
  if (recipe.servings && recipe.servings > 0) {
    score += 5;
  }

  // Has image (5 pts)
  if (recipe.imageUrl) {
    score += 5;
  }

  // Ingredient match rate (5-15 pts)
  if (recipe.ingredientMatchRate > 0.8) {
    score += 15;
  } else if (recipe.ingredientMatchRate > 0.5) {
    score += 10;
  } else if (recipe.ingredientMatchRate > 0.3) {
    score += 5;
  }

  // Has nutrition data (10 pts)
  if (recipe.nutrition) {
    score += 10;
  }

  // Has allergen detection (5 pts)
  if (recipe.allergens && recipe.allergens.length > 0) {
    score += 5;
  }

  // Has diet flags (5 pts)
  if (recipe.dietFlags && recipe.dietFlags.length > 0) {
    score += 5;
  }

  // Source rating (5-10 pts)
  if (recipe.sourceRating !== null && recipe.sourceRating !== undefined) {
    if (recipe.sourceRating >= 4.5) {
      score += 10;
    } else if (recipe.sourceRating >= 4.0) {
      score += 5;
    }
  }

  // Has seasons data (5 pts)
  if (recipe.seasons && recipe.seasons.length > 0) {
    score += 5;
  }

  return Math.min(score, 100);
}

// ─── Main step ────────────────────────────────────────────────────────────────

export async function step7(opts?: { resume?: boolean }): Promise<void> {
  const dataDir = path.resolve(PIPELINE_CONFIG.dataDir);
  const inputPath = path.join(dataDir, 'with-flags.json');
  const outputPath = path.join(dataDir, 'scored.json');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[step7] Input file not found: ${inputPath}`);
  }

  console.log('[step7] Loading recipes from with-flags.json...');
  const recipes: ProcessedRecipe[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`[step7] Loaded ${recipes.length} recipes.`);

  const progress = loadProgress();

  // Score each recipe
  for (const recipe of recipes) {
    recipe.qualityScore = calculateScore(recipe);
  }

  // Filter by minimum score
  const minScore = PIPELINE_CONFIG.minQualityScore;
  const passed = recipes.filter((r) => r.qualityScore >= minScore);
  const rejected = recipes.length - passed.length;

  // Sort by quality score descending
  passed.sort((a, b) => b.qualityScore - a.qualityScore);

  // Compute stats
  const scores = passed.map((r) => r.qualityScore);
  const avgScore = scores.length > 0
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : '0';
  const minActual = scores.length > 0 ? Math.min(...scores) : 0;
  const maxActual = scores.length > 0 ? Math.max(...scores) : 0;

  // Score distribution buckets
  const buckets: Record<string, number> = {
    '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0,
    '50-59': 0, '40-49': 0, '30-39': 0,
  };
  for (const s of scores) {
    if (s >= 90) buckets['90-100']++;
    else if (s >= 80) buckets['80-89']++;
    else if (s >= 70) buckets['70-79']++;
    else if (s >= 60) buckets['60-69']++;
    else if (s >= 50) buckets['50-59']++;
    else if (s >= 40) buckets['40-49']++;
    else buckets['30-39']++;
  }

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(passed, null, 2), 'utf-8');

  progress.scored = passed.length;
  updateStep(progress, 7);

  console.log(`[step7] Scored ${recipes.length} recipes.`);
  console.log(`[step7] Passed (score >= ${minScore}): ${passed.length}`);
  console.log(`[step7] Rejected: ${rejected}`);
  console.log(`[step7] Score range: ${minActual}-${maxActual}, avg: ${avgScore}`);
  console.log('[step7] Distribution:', JSON.stringify(buckets));
  console.log(`[step7] Saved to ${outputPath}`);
}
