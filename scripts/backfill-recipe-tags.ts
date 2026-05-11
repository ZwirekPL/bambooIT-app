/**
 * Backfill Recipe.tags via the auto-tagger (P0.6 — Recipe Overhaul Master Plan
 * 2026-04-29).
 *
 * Reads each active recipe with its ingredients and diet flags, runs
 * `computeRecipeTags()` and writes the resulting array back to Recipe.tags.
 *
 * Idempotency: re-running on already-tagged recipes is a no-op (autotagger is
 * deterministic, output is sorted+deduped). Pre-existing tags outside the
 * KNOWN_TAGS set (e.g. 'ai-generated', 'side', 'basic' seed markers) are
 * preserved via the autotagger's `existingTags` passthrough.
 *
 * Usage:
 *   npx ts-node --esm scripts/backfill-recipe-tags.ts                # dry-run
 *   npx ts-node --esm scripts/backfill-recipe-tags.ts --apply        # write
 *   npx ts-node --esm scripts/backfill-recipe-tags.ts --limit 50     # smoke
 *
 * Prereq: apps/backend must be built (`npm run build -w backend`) so the
 * autotagger is available under apps/backend/dist/scraper/utils/autotagger.js.
 */

import { prisma } from '../packages/database/dist/index.js';
import { computeRecipeTags } from '../apps/backend/dist/scraper/utils/autotagger.js';

interface CliArgs {
  apply: boolean;
  limit: number | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = { apply: false, limit: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--dry-run') out.apply = false;
    else if (a === '--limit') out.limit = parseInt(args[++i] ?? '', 10);
  }
  return out;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log('=== Backfill Recipe.tags (P0.6) ===');
  console.log(`Date:   ${new Date().toISOString()}`);
  console.log(`Mode:   ${args.apply ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  if (args.limit) console.log(`Limit:  ${args.limit}`);

  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      cuisineType: true,
      mealType: true,
      cookingMethod: true,
      totalTimeMinutes: true,
      containsVegetableServing: true,
      vegetableWeightG: true,
      tags: true,
      dietFlags: { select: { flagCode: true, value: true, confidence: true } },
      ingredients: {
        where: { isOptional: false },
        select: {
          displayName: true,
          cleanProduct: { select: { name: true } },
          foodProduct: { select: { name: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
    take: args.limit ?? undefined,
  });

  console.log(`\nRecipes: ${recipes.length}\n`);

  const tagFreq = new Map<string, number>();
  const sizeBuckets = new Map<string, number>();
  let updated = 0;
  let unchanged = 0;
  let totalTagsAfter = 0;

  for (const r of recipes) {
    const ingredientNames = r.ingredients
      .map((i) => i.cleanProduct?.name ?? i.foodProduct?.name ?? i.displayName ?? '')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newTags = computeRecipeTags({
      cuisineType: r.cuisineType,
      mealType: r.mealType,
      cookingMethod: r.cookingMethod,
      totalTimeMinutes: r.totalTimeMinutes,
      containsVegetableServing: r.containsVegetableServing,
      vegetableWeightG: r.vegetableWeightG ? Number(r.vegetableWeightG) : null,
      ingredientNames,
      dietFlags: r.dietFlags,
      existingTags: r.tags,
    });

    totalTagsAfter += newTags.length;
    for (const t of newTags) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);

    const bucket = newTags.length <= 2 ? '0-2' : newTags.length <= 5 ? '3-5' : newTags.length <= 8 ? '6-8' : '9+';
    sizeBuckets.set(bucket, (sizeBuckets.get(bucket) ?? 0) + 1);

    const sortedExisting = [...r.tags].sort();
    if (arraysEqual(sortedExisting, newTags)) {
      unchanged++;
      continue;
    }

    if (args.apply) {
      await prisma.recipe.update({ where: { id: r.id }, data: { tags: newTags } });
    }
    updated++;
  }

  console.log(`=== Summary ===`);
  console.log(`Recipes processed:  ${recipes.length}`);
  console.log(`${args.apply ? 'Updated' : 'Would update'}: ${updated}`);
  console.log(`Unchanged:          ${unchanged}`);
  console.log(`Avg tags/recipe:    ${(totalTagsAfter / Math.max(recipes.length, 1)).toFixed(2)}`);

  console.log(`\nTag-count distribution:`);
  for (const [bucket, n] of [...sizeBuckets.entries()].sort()) {
    const pct = ((n / Math.max(recipes.length, 1)) * 100).toFixed(1);
    console.log(`  ${bucket.padEnd(5)} ${n.toString().padStart(5)} (${pct}%)`);
  }

  console.log(`\nTop 25 tags by frequency:`);
  for (const [tag, n] of [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${tag.padEnd(24)} ${n}`);
  }

  if (!args.apply) console.log('\n(dry-run — re-run with --apply to write)');
}

main()
  .catch((err) => { console.error('FATAL:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
