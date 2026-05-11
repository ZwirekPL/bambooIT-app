/**
 * Retrospective S-7 audit: run the ingredient parser against all
 * `RecipeIngredient.displayName` values in the DB and report coverage.
 *
 * Reports:
 *   - how many rows parse into a structured shape (quantity/unit/name)
 *   - canonical unit distribution
 *   - top unparsed samples (for manual inspection / future parser tuning)
 *
 * Read-only.
 *
 * Usage:
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/audit-ingredient-parser.ts
 */

import 'dotenv/config';
import { prisma } from '@db';
import { parseIngredient, type CanonicalUnit } from '../src/scraper/utils/ingredientParser';

async function main() {
  console.log('=== S-7 Ingredient Parser — retrospective audit ===\n');

  const rows = await prisma.recipeIngredient.findMany({
    where: { displayName: { not: null } },
    select: { displayName: true },
  });

  console.log(`Loaded ${rows.length} RecipeIngredient rows with displayName.\n`);

  const stats = {
    total: rows.length,
    hasQty: 0,
    hasUnit: 0,
    hasGrams: 0,
    hasName: 0,
    tasteOnly: 0,
    empty: 0,
    unitDist: new Map<CanonicalUnit, number>(),
  };

  const unparsedSamples: string[] = [];
  const qtyNoUnitSamples: string[] = [];

  for (const r of rows) {
    const text = (r.displayName ?? '').trim();
    if (!text) {
      stats.empty++;
      continue;
    }

    const parsed = parseIngredient(text);
    if (parsed.quantity != null) stats.hasQty++;
    if (parsed.canonicalUnit !== 'none') stats.hasUnit++;
    if (parsed.estimatedGrams != null) stats.hasGrams++;
    if (parsed.name.length > 0) stats.hasName++;
    if (parsed.tasteOnly) stats.tasteOnly++;

    stats.unitDist.set(
      parsed.canonicalUnit,
      (stats.unitDist.get(parsed.canonicalUnit) ?? 0) + 1
    );

    // Collect unparsed samples for inspection
    const unparseable = parsed.quantity == null && !parsed.tasteOnly && parsed.canonicalUnit === 'none' && parsed.name.length > 0;
    if (unparseable && unparsedSamples.length < 30) unparsedSamples.push(text);

    // Quantity but no unit — probably "2 jajka" (piece without explicit unit)
    if (parsed.quantity != null && parsed.canonicalUnit === 'none' && qtyNoUnitSamples.length < 15) {
      qtyNoUnitSamples.push(text);
    }
  }

  const pct = (n: number) => (stats.total > 0 ? Math.round((100 * n) / stats.total) : 0);

  console.log('Coverage:');
  console.log(`  Total rows          : ${stats.total}`);
  console.log(`  Has quantity        : ${stats.hasQty} (${pct(stats.hasQty)}%)`);
  console.log(`  Has unit            : ${stats.hasUnit} (${pct(stats.hasUnit)}%)`);
  console.log(`  Has estimatedGrams  : ${stats.hasGrams} (${pct(stats.hasGrams)}%)`);
  console.log(`  Has name            : ${stats.hasName} (${pct(stats.hasName)}%)`);
  console.log(`  Taste-only          : ${stats.tasteOnly} (${pct(stats.tasteOnly)}%)`);
  console.log(`  Empty text          : ${stats.empty}`);

  console.log('\nCanonical unit distribution:');
  const sortedUnits = Array.from(stats.unitDist.entries()).sort((a, b) => b[1] - a[1]);
  for (const [unit, count] of sortedUnits) {
    console.log(`  ${unit.padEnd(10)} ${String(count).padStart(6)} (${pct(count)}%)`);
  }

  console.log('\nSamples: quantity without unit (likely bare count):');
  qtyNoUnitSamples.forEach((s) => console.log(`  "${s}"`));

  console.log('\nSamples: unparseable (no qty, no unit, no taste-marker):');
  unparsedSamples.forEach((s) => console.log(`  "${s}"`));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
