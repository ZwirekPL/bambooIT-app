/**
 * Retrospective audit of S-11 auto-taggers against the current DB.
 *
 *   - Protein source: compare proposed (argmax protein×weight) vs current
 *   - Cuisine: count recipes where "inna" → classified cuisine would fire
 *   - Meal type: % that changes vs current mealType
 *   - Difficulty: distribution
 */

import 'dotenv/config';
import { prisma } from '@db';
import { computeRecipeProteinSource } from '../src/scraper/utils/proteinSource';
import { classifyCuisine } from '../src/scraper/utils/cuisineClassifier';
import { classifyMealType, scoreDifficulty, type MealType } from '../src/scraper/utils/recipeClassifier';

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log('=== S-11 auto-tagging — retrospective DB audit ===\n');

  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      cuisineType: true,
      mealType: true,
      difficulty: true,
      totalTimeMinutes: true,
      ingredients: {
        select: {
          displayName: true,
          grams: true,
          cleanProduct: {
            select: {
              name: true,
              nutrients: { select: { proteinPer100g: true } },
            },
          },
        },
      },
      instructionSteps: { select: { instruction: true } },
      nutritionSnapshot: { select: { kcal: true } },
    },
  });

  console.log(`Loaded ${recipes.length} recipes.\n`);

  // Protein source
  const proteinStats = { classified: 0, other: 0, differsFromCurrent: 0 };
  const proteinDist = new Map<string, number>();

  // Cuisine
  const cuisineStats = { total: 0, wasInna: 0, reclassified: 0, stillInna: 0 };
  const cuisineDist = new Map<string, number>();

  // Meal type
  const mealStats = { total: 0, changed: 0 };

  // Difficulty
  const diffDist = new Map<string, number>();

  for (const r of recipes) {
    // ── Protein ──
    const ingredientInputs = r.ingredients.map((i) => ({
      name: i.cleanProduct?.name ?? i.displayName ?? '',
      grams: Number(i.grams) || 0,
      proteinPer100g: decimalToNumber(i.cleanProduct?.nutrients?.proteinPer100g),
    }));
    const pReport = computeRecipeProteinSource(ingredientInputs);
    proteinDist.set(pReport.source, (proteinDist.get(pReport.source) ?? 0) + 1);
    if (pReport.source !== 'other') proteinStats.classified++;
    else proteinStats.other++;

    // ── Cuisine ──
    const ingredientNames = ingredientInputs.map((i) => i.name).filter(Boolean);
    const cReport = classifyCuisine(r.title, ingredientNames);
    cuisineDist.set(cReport.cuisine, (cuisineDist.get(cReport.cuisine) ?? 0) + 1);
    cuisineStats.total++;
    if (r.cuisineType === 'inna' || r.cuisineType == null) {
      cuisineStats.wasInna++;
      if (cReport.cuisine !== 'inna') cuisineStats.reclassified++;
      else cuisineStats.stillInna++;
    }

    // ── Meal type ──
    const mReport = classifyMealType(r.title, decimalToNumber(r.nutritionSnapshot?.kcal), 'LUNCH');
    mealStats.total++;
    if (mReport.mealType !== (r.mealType as MealType)) mealStats.changed++;

    // ── Difficulty ──
    const dReport = scoreDifficulty(
      r.totalTimeMinutes ?? null,
      r.instructionSteps.length,
      r.title,
      r.instructionSteps.map((s) => s.instruction).slice(0, 6),
    );
    diffDist.set(dReport.difficulty, (diffDist.get(dReport.difficulty) ?? 0) + 1);
  }

  console.log('── Protein source distribution (computed by argmax protein×weight):');
  for (const [src, count] of [...proteinDist.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((100 * count) / recipes.length);
    console.log(`  ${src.padEnd(12)} ${String(count).padStart(5)} (${pct}%)`);
  }
  console.log(`  Classified (not 'other'): ${proteinStats.classified} (${Math.round((100 * proteinStats.classified) / recipes.length)}%)`);

  console.log('\n── Cuisine reclassification (recipes currently "inna"/null):');
  console.log(`  Currently "inna"/null : ${cuisineStats.wasInna} (${Math.round((100 * cuisineStats.wasInna) / cuisineStats.total)}% of corpus)`);
  console.log(`  Would reclassify      : ${cuisineStats.reclassified} (${cuisineStats.wasInna > 0 ? Math.round((100 * cuisineStats.reclassified) / cuisineStats.wasInna) : 0}% of "inna")`);
  console.log(`  Still "inna"          : ${cuisineStats.stillInna}`);
  console.log('  Full distribution (what we propose):');
  for (const [c, n] of [...cuisineDist.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((100 * n) / recipes.length);
    console.log(`    ${c.padEnd(22)} ${String(n).padStart(5)} (${pct}%)`);
  }

  console.log('\n── Meal type:');
  console.log(`  Changed vs current: ${mealStats.changed}/${mealStats.total} (${Math.round((100 * mealStats.changed) / mealStats.total)}%)`);

  console.log('\n── Difficulty distribution (computed):');
  for (const [d, n] of diffDist) {
    const pct = Math.round((100 * n) / recipes.length);
    console.log(`  ${d.padEnd(8)} ${String(n).padStart(5)} (${pct}%)`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
