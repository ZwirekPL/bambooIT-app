/**
 * Recipe deduplication: title similarity + ingredient overlap.
 */

import { compareTwoStrings } from 'string-similarity';
import { PIPELINE_CONFIG } from '../config';
import type { ProcessedRecipe } from '../types';

/**
 * Normalize title for comparison: lowercase, strip diacritics, remove extra whitespace.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, '')    // strip non-alphanumeric
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate ingredient overlap between two recipes.
 * Returns 0.0 - 1.0 (ratio of shared CleanProduct IDs).
 */
function ingredientOverlap(a: ProcessedRecipe, b: ProcessedRecipe): number {
  const idsA = new Set(
    a.ingredients.filter((i) => i.cleanProductId).map((i) => i.cleanProductId!),
  );
  const idsB = new Set(
    b.ingredients.filter((i) => i.cleanProductId).map((i) => i.cleanProductId!),
  );

  if (idsA.size === 0 || idsB.size === 0) return 0;

  let shared = 0;
  for (const id of idsA) {
    if (idsB.has(id)) shared++;
  }

  const smaller = Math.min(idsA.size, idsB.size);
  return shared / smaller;
}

export interface DuplicatePair {
  kept: ProcessedRecipe;
  removed: ProcessedRecipe;
  titleSimilarity: number;
  ingredientOverlap: number;
}

/**
 * Find and remove duplicates from a list of processed recipes.
 * Returns deduplicated list + list of removed duplicates.
 */
export function deduplicateRecipes(
  recipes: ProcessedRecipe[],
): { unique: ProcessedRecipe[]; duplicates: DuplicatePair[] } {
  const duplicates: DuplicatePair[] = [];
  const removed = new Set<number>();

  // Pre-compute normalized titles
  const normalized = recipes.map((r) => normalizeTitle(r.title));

  for (let i = 0; i < recipes.length; i++) {
    if (removed.has(i)) continue;

    for (let j = i + 1; j < recipes.length; j++) {
      if (removed.has(j)) continue;

      const titleSim = compareTwoStrings(normalized[i], normalized[j]);
      if (titleSim < PIPELINE_CONFIG.titleSimilarityThreshold) continue;

      const overlap = ingredientOverlap(recipes[i], recipes[j]);
      if (overlap < PIPELINE_CONFIG.ingredientOverlapThreshold && titleSim < 0.95) continue;

      // It's a duplicate — keep the one with higher quality score
      const keepIdx = recipes[i].qualityScore >= recipes[j].qualityScore ? i : j;
      const removeIdx = keepIdx === i ? j : i;

      removed.add(removeIdx);
      duplicates.push({
        kept: recipes[keepIdx],
        removed: recipes[removeIdx],
        titleSimilarity: titleSim,
        ingredientOverlap: overlap,
      });
    }
  }

  const unique = recipes.filter((_, idx) => !removed.has(idx));
  return { unique, duplicates };
}
