/**
 * Retrospective S-10 audit: run 3-level deduplication against every Recipe in
 * the DB and report how many AUTO_MERGE clusters / REVIEW pairs exist.
 *
 * Read-only.
 */

import 'dotenv/config';
import { prisma } from '@db';
import { findDuplicatesInCorpus, type DedupInput } from '../src/scraper/utils/dedup3';

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log('=== S-10 3-level deduplication — retrospective DB audit ===\n');

  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      ingredients: {
        select: { cleanProduct: { select: { name: true } }, displayName: true },
      },
      nutritionSnapshot: {
        select: { kcal: true, protein_g: true, fat_g: true, carbs_g: true },
      },
    },
  });

  console.log(`Loaded ${recipes.length} recipes.\n`);

  const corpus: DedupInput[] = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    ingredients: r.ingredients
      .map((i) => i.cleanProduct?.name ?? i.displayName ?? '')
      .filter((s) => s.length > 0),
    nutrition: r.nutritionSnapshot
      ? {
          calories: decimalToNumber(r.nutritionSnapshot.kcal),
          protein: decimalToNumber(r.nutritionSnapshot.protein_g),
          fat: decimalToNumber(r.nutritionSnapshot.fat_g),
          carbs: decimalToNumber(r.nutritionSnapshot.carbs_g),
        }
      : null,
  }));

  const report = findDuplicatesInCorpus(corpus);

  console.log('Summary:');
  console.log(`  Total recipes          : ${corpus.length}`);
  console.log(`  AUTO_MERGE clusters    : ${report.autoMerge.length}`);
  const inAutoMerge = report.autoMerge.reduce((a, c) => a + c.recipes.length, 0);
  console.log(`    total recipes in them: ${inAutoMerge}`);
  console.log(`  REVIEW pairs           : ${report.review.length}`);
  console.log(`  Unique                 : ${report.unique.length}`);
  console.log();

  console.log('Sample AUTO_MERGE clusters (first 20):');
  for (const c of report.autoMerge.slice(0, 20)) {
    console.log(`  [${c.recipes.length}×] "${c.recipes[0].title.slice(0, 60)}"`);
    for (const r of c.recipes.slice(0, 4)) {
      const host = (r as DedupInput & { sourceUrl?: string }).sourceUrl
        ? new URL((r as DedupInput & { sourceUrl?: string }).sourceUrl!).host
        : 'n/a';
      console.log(`       - ${r.id} (${host})`);
    }
    if (c.recipes.length > 4) console.log(`       ... +${c.recipes.length - 4} more`);
  }

  console.log('\nSample REVIEW pairs (first 25):');
  for (const p of report.review.slice(0, 25)) {
    const [a, b] = p.pair;
    const flagStr = [
      p.levels.title ? 'T' : '-',
      p.levels.ingredients ? 'I' : '-',
      p.levels.macros ? 'M' : '-',
    ].join('');
    console.log(`  [${flagStr}] "${a.title.slice(0, 42)}" ≈ "${b.title.slice(0, 42)}"`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
