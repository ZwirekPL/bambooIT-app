/**
 * Step 8: Cross-source deduplication using title similarity + ingredient overlap.
 *
 * Uses deduplicateRecipes() from ../utils/deduplication which applies configurable
 * thresholds (title similarity >= 0.8, ingredient overlap >= 0.7).
 */

import * as fs from 'fs';
import * as path from 'path';
import { PIPELINE_CONFIG } from '../config';
import { loadProgress, updateStep } from '../progress';
import { deduplicateRecipes } from '../utils/deduplication';
import type { ProcessedRecipe } from '../types';

// ─── Main step ────────────────────────────────────────────────────────────────

export async function step8(opts?: { resume?: boolean }): Promise<void> {
  const dataDir = path.resolve(PIPELINE_CONFIG.dataDir);
  const inputPath = path.join(dataDir, 'scored.json');
  const outputPath = path.join(dataDir, 'deduplicated.json');
  const reportPath = path.join(dataDir, 'duplicates-report.json');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[step8] Input file not found: ${inputPath}`);
  }

  console.log('[step8] Loading scored recipes...');
  const recipes: ProcessedRecipe[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`[step8] Loaded ${recipes.length} recipes.`);

  console.log('[step8] Running deduplication...');
  const { unique, duplicates } = deduplicateRecipes(recipes);

  // Build duplicate report
  const report = {
    totalInput: recipes.length,
    totalUnique: unique.length,
    totalDuplicatesRemoved: duplicates.length,
    duplicatePairs: duplicates.map((d) => ({
      keptTitle: d.kept.title,
      keptSource: d.kept.sourceSite,
      keptScore: d.kept.qualityScore,
      removedTitle: d.removed.title,
      removedSource: d.removed.sourceSite,
      removedScore: d.removed.qualityScore,
      titleSimilarity: parseFloat(d.titleSimilarity.toFixed(3)),
      ingredientOverlap: parseFloat(d.ingredientOverlap.toFixed(3)),
    })),
  };

  // Log duplicate pairs
  if (duplicates.length > 0) {
    console.log(`[step8] Found ${duplicates.length} duplicate pairs:`);
    for (const d of duplicates.slice(0, 20)) {
      console.log(
        `  "${d.removed.title}" (${d.removed.sourceSite}, score=${d.removed.qualityScore}) ` +
        `-> kept "${d.kept.title}" (${d.kept.sourceSite}, score=${d.kept.qualityScore}) ` +
        `[title=${d.titleSimilarity.toFixed(2)}, ingredients=${d.ingredientOverlap.toFixed(2)}]`,
      );
    }
    if (duplicates.length > 20) {
      console.log(`  ... and ${duplicates.length - 20} more.`);
    }
  } else {
    console.log('[step8] No duplicates found.');
  }

  // Cross-source duplicate stats
  const crossSourceDups = duplicates.filter(
    (d) => d.kept.sourceSite !== d.removed.sourceSite,
  ).length;
  const sameSourceDups = duplicates.length - crossSourceDups;

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(unique, null, 2), 'utf-8');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  const progress = loadProgress();
  progress.deduplicated = unique.length;
  updateStep(progress, 8);

  console.log(`[step8] Cross-source duplicates: ${crossSourceDups}`);
  console.log(`[step8] Same-source duplicates: ${sameSourceDups}`);
  console.log(`[step8] Unique recipes: ${unique.length}`);
  console.log(`[step8] Saved deduplicated recipes to ${outputPath}`);
  console.log(`[step8] Saved duplicate report to ${reportPath}`);
}
