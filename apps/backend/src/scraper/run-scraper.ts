import 'dotenv/config';

/**
 * CLI entry point for the recipe scraping pipeline.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scraper/run-scraper.ts [options]
 *
 * Options:
 *   --step=N       Run only step N (1-9). Without this flag, all steps run sequentially.
 *   --site=NAME    Filter scraping to a specific site (step 1 only).
 *   --resume       Resume from last progress checkpoint.
 *   --dry-run      Run without writing to DB (step 9 skipped).
 *   --report       Generate validation report after pipeline.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PIPELINE_CONFIG } from './config';
import { loadProgress } from './progress';
import type { ProcessedRecipe, SiteName } from './types';
import { step1 } from './pipeline/01-scrape';
import { step2 } from './pipeline/02-normalize';
import { step3 } from './pipeline/03-map-products';
import { step4 } from './pipeline/04-calculate-macros';
import { step5 } from './pipeline/05-generate-meta';
import { step6 } from './pipeline/06-detect-flags';
import { step7 } from './pipeline/07-score';
import { step8 } from './pipeline/08-deduplicate';
import { step9 } from './pipeline/09-save';

// ─── Parse CLI args ──────────────────────────────────────────────────────────

interface CliOptions {
  step: number | null;
  site: SiteName | null;
  resume: boolean;
  dryRun: boolean;
  report: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    step: null,
    site: null,
    resume: false,
    dryRun: false,
    report: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--step=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (isNaN(val) || val < 1 || val > 9) {
        console.error(`Invalid step: ${arg}. Must be 1-9.`);
        process.exit(1);
      }
      opts.step = val;
    } else if (arg.startsWith('--site=')) {
      const val = arg.split('=')[1] as SiteName;
      const validSites: SiteName[] = [
        'aniagotuje', 'kwestiasmaku', 'dietetykpowszechny', 'jadlonomia', 'paleosmak',
      ];
      if (!validSites.includes(val)) {
        console.error(`Invalid site: ${val}. Must be one of: ${validSites.join(', ')}`);
        process.exit(1);
      }
      opts.site = val;
    } else if (arg === '--resume') {
      opts.resume = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--report') {
      opts.report = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.warn(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function printUsage(): void {
  console.log(`
Recipe Scraping Pipeline
========================

Usage:
  npx ts-node -r tsconfig-paths/register src/scraper/run-scraper.ts [options]

Options:
  --step=N       Run only step N (1-9)
  --site=NAME    Scrape only one site (aniagotuje|kwestiasmaku|dietetykpowszechny|jadlonomia|paleosmak)
  --resume       Resume from last progress checkpoint
  --dry-run      Skip database save (step 9)
  --report       Generate validation report at the end
  --help, -h     Show this help message

Steps:
  1  Scrape raw recipes from configured sites
  2  Normalize ingredients (parse quantities, units, names)
  3  Map ingredients to CleanProduct database
  4  Calculate nutrition from mapped ingredients
  5  Generate metadata (description, classification) via OpenAI
  6  Detect allergens and diet flags
  7  Score recipe quality (0-100)
  8  Deduplicate across sources
  9  Save to database
  `);
}

// ─── Step loader ──────────

type StepFn = (opts?: { resume?: boolean; site?: string }) => Promise<void>;

async function loadStep(step: number): Promise<StepFn> {
  switch (step) {
    case 1: return step1;
    case 2: return step2;
    case 3: return step3;
    case 4: return step4;
    case 5: return step5;
    case 6: return step6;
    case 7: return step7;
    case 8: return step8;
    case 9: return step9;
    default:
      throw new Error(`Unknown step: ${step}`);
  }
}

// ─── Validation report ──────────────────────────────────────────────────────

interface ValidationReport {
  generatedAt: string;
  totalRecipes: number;
  recipesPerSource: Record<string, number>;
  mealTypeDistribution: Record<string, number>;
  cuisineTypeDistribution: Record<string, number>;
  dietFlagDistribution: Record<string, number>;
  ingredientMatchRate: { avg: number; min: number; max: number; median: number };
  qualityScore: { avg: number; min: number; max: number; median: number };
  sanityChecks: SanityCheck[];
}

interface SanityCheck {
  name: string;
  passed: boolean;
  message: string;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function generateReport(recipes: ProcessedRecipe[]): ValidationReport {
  const recipesPerSource: Record<string, number> = {};
  const mealTypeDistribution: Record<string, number> = {};
  const cuisineTypeDistribution: Record<string, number> = {};
  const dietFlagDistribution: Record<string, number> = {};
  const matchRates: number[] = [];
  const scores: number[] = [];

  for (const r of recipes) {
    // Source
    recipesPerSource[r.sourceSite] = (recipesPerSource[r.sourceSite] || 0) + 1;

    // Meal type
    mealTypeDistribution[r.mealType] = (mealTypeDistribution[r.mealType] || 0) + 1;

    // Cuisine type
    cuisineTypeDistribution[r.cuisineType] = (cuisineTypeDistribution[r.cuisineType] || 0) + 1;

    // Diet flags
    for (const f of r.dietFlags) {
      if (f.value) {
        dietFlagDistribution[f.flagCode] = (dietFlagDistribution[f.flagCode] || 0) + 1;
      }
    }

    matchRates.push(r.ingredientMatchRate);
    scores.push(r.qualityScore);
  }

  // Sanity checks
  const sanityChecks: SanityCheck[] = [];

  // Check: kcal range
  const recipesWithNutrition = recipes.filter((r) => r.nutrition);
  const kcalOutOfRange = recipesWithNutrition.filter(
    (r) => r.nutrition!.kcal < PIPELINE_CONFIG.kcalMin || r.nutrition!.kcal > PIPELINE_CONFIG.kcalMax,
  );
  sanityChecks.push({
    name: 'kcal_range',
    passed: kcalOutOfRange.length === 0,
    message: kcalOutOfRange.length === 0
      ? `All ${recipesWithNutrition.length} recipes with nutrition have kcal in range ${PIPELINE_CONFIG.kcalMin}-${PIPELINE_CONFIG.kcalMax}`
      : `${kcalOutOfRange.length} recipes have kcal outside range ${PIPELINE_CONFIG.kcalMin}-${PIPELINE_CONFIG.kcalMax}`,
  });

  // Check: minimum ingredients
  const tooFewIngredients = recipes.filter(
    (r) => r.ingredients.length < PIPELINE_CONFIG.minIngredients,
  );
  sanityChecks.push({
    name: 'min_ingredients',
    passed: tooFewIngredients.length === 0,
    message: tooFewIngredients.length === 0
      ? `All recipes have >= ${PIPELINE_CONFIG.minIngredients} ingredients`
      : `${tooFewIngredients.length} recipes have < ${PIPELINE_CONFIG.minIngredients} ingredients`,
  });

  // Check: minimum steps
  const tooFewSteps = recipes.filter(
    (r) => r.steps.length < PIPELINE_CONFIG.minSteps,
  );
  sanityChecks.push({
    name: 'min_steps',
    passed: tooFewSteps.length === 0,
    message: tooFewSteps.length === 0
      ? `All recipes have >= ${PIPELINE_CONFIG.minSteps} steps`
      : `${tooFewSteps.length} recipes have < ${PIPELINE_CONFIG.minSteps} steps`,
  });

  // Check: ingredient match rate
  const avgMatchRate = matchRates.length > 0
    ? matchRates.reduce((a, b) => a + b, 0) / matchRates.length
    : 0;
  sanityChecks.push({
    name: 'ingredient_match_rate',
    passed: avgMatchRate >= PIPELINE_CONFIG.minIngredientMatchRate,
    message: `Average ingredient match rate: ${(avgMatchRate * 100).toFixed(1)}% ` +
      `(threshold: ${PIPELINE_CONFIG.minIngredientMatchRate * 100}%)`,
  });

  // Check: minimum quality score
  const belowMinScore = recipes.filter(
    (r) => r.qualityScore < PIPELINE_CONFIG.minQualityScore,
  );
  sanityChecks.push({
    name: 'min_quality_score',
    passed: belowMinScore.length === 0,
    message: belowMinScore.length === 0
      ? `All recipes have quality score >= ${PIPELINE_CONFIG.minQualityScore}`
      : `${belowMinScore.length} recipes below minimum score ${PIPELINE_CONFIG.minQualityScore}`,
  });

  // Check: at least 3 meal types present
  const mealTypes = Object.keys(mealTypeDistribution);
  sanityChecks.push({
    name: 'meal_type_diversity',
    passed: mealTypes.length >= 3,
    message: `${mealTypes.length} distinct meal types: ${mealTypes.join(', ')}`,
  });

  return {
    generatedAt: new Date().toISOString(),
    totalRecipes: recipes.length,
    recipesPerSource,
    mealTypeDistribution,
    cuisineTypeDistribution,
    dietFlagDistribution,
    ingredientMatchRate: {
      avg: parseFloat((avgMatchRate * 100).toFixed(1)),
      min: matchRates.length > 0 ? parseFloat((Math.min(...matchRates) * 100).toFixed(1)) : 0,
      max: matchRates.length > 0 ? parseFloat((Math.max(...matchRates) * 100).toFixed(1)) : 0,
      median: parseFloat((median(matchRates) * 100).toFixed(1)),
    },
    qualityScore: {
      avg: scores.length > 0
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : 0,
      min: scores.length > 0 ? Math.min(...scores) : 0,
      max: scores.length > 0 ? Math.max(...scores) : 0,
      median: median(scores),
    },
    sanityChecks,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();

  console.log('========================================');
  console.log('  Recipe Scraping Pipeline');
  console.log('========================================');
  console.log(`Options: step=${opts.step ?? 'all'}, site=${opts.site ?? 'all'}, resume=${opts.resume}, dry-run=${opts.dryRun}, report=${opts.report}`);
  console.log('');

  const startTime = Date.now();

  if (opts.step !== null) {
    // Run a single step
    if (opts.dryRun && opts.step === 9) {
      console.log('[dry-run] Skipping step 9 (database save).');
    } else {
      console.log(`Running step ${opts.step}...`);
      const stepFn = await loadStep(opts.step);
      await stepFn({ resume: opts.resume, site: opts.site ?? undefined });
    }
  } else {
    // Run all steps sequentially
    for (let s = 1; s <= 9; s++) {
      if (opts.dryRun && s === 9) {
        console.log('[dry-run] Skipping step 9 (database save).');
        continue;
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`  Step ${s}/9`);
      console.log('='.repeat(60));

      try {
        const stepFn = await loadStep(s);
        await stepFn({ resume: opts.resume, site: opts.site ?? undefined });
      } catch (err) {
        console.error(`\nStep ${s} failed:`, err instanceof Error ? err.message : err);
        console.error('Pipeline aborted.');
        process.exit(1);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nPipeline completed in ${elapsed}s.`);

  // Generate report if requested or after full run
  if (opts.report || opts.step === null) {
    const dataDir = path.resolve(PIPELINE_CONFIG.dataDir);
    const finalFile = opts.dryRun
      ? path.join(dataDir, 'deduplicated.json')
      : path.join(dataDir, 'deduplicated.json');

    if (fs.existsSync(finalFile)) {
      console.log('\nGenerating validation report...');
      const recipes: ProcessedRecipe[] = JSON.parse(fs.readFileSync(finalFile, 'utf-8'));
      const report = generateReport(recipes);

      const reportPath = path.resolve(PIPELINE_CONFIG.reportFile);
      const reportDir = path.dirname(reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

      // Print summary
      console.log('\n========================================');
      console.log('  Validation Report');
      console.log('========================================');
      console.log(`Total recipes: ${report.totalRecipes}`);
      console.log('\nRecipes per source:');
      for (const [site, count] of Object.entries(report.recipesPerSource)) {
        console.log(`  ${site}: ${count}`);
      }
      console.log('\nMeal type distribution:');
      for (const [type, count] of Object.entries(report.mealTypeDistribution)) {
        console.log(`  ${type}: ${count}`);
      }
      console.log('\nCuisine type distribution:');
      for (const [type, count] of Object.entries(report.cuisineTypeDistribution)) {
        console.log(`  ${type}: ${count}`);
      }
      console.log('\nDiet flag distribution:');
      for (const [flag, count] of Object.entries(report.dietFlagDistribution)) {
        console.log(`  ${flag}: ${count}`);
      }
      console.log(`\nIngredient match rate: avg=${report.ingredientMatchRate.avg}%, median=${report.ingredientMatchRate.median}%, range=${report.ingredientMatchRate.min}-${report.ingredientMatchRate.max}%`);
      console.log(`Quality score: avg=${report.qualityScore.avg}, median=${report.qualityScore.median}, range=${report.qualityScore.min}-${report.qualityScore.max}`);
      console.log('\nSanity checks:');
      for (const check of report.sanityChecks) {
        const icon = check.passed ? 'PASS' : 'FAIL';
        console.log(`  [${icon}] ${check.name}: ${check.message}`);
      }
      console.log(`\nReport saved to ${reportPath}`);
    } else {
      console.log(`\nNo data file found at ${finalFile}, skipping report.`);
    }
  }

  // Print progress summary
  const progress = loadProgress();
  console.log('\nProgress summary:');
  console.log(`  Normalized: ${progress.normalized}`);
  console.log(`  Mapped: ${progress.mapped}`);
  console.log(`  Meta generated: ${progress.metaGenerated}`);
  console.log(`  Flags detected: ${progress.flagsDetected}`);
  console.log(`  Scored: ${progress.scored}`);
  console.log(`  Deduplicated: ${progress.deduplicated}`);
  console.log(`  Saved to DB: ${progress.saved}`);
}

main().catch((err) => {
  console.error('Pipeline fatal error:', err);
  process.exit(1);
});
