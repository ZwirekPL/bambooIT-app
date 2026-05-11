/**
 * S-7 product matcher real-world audit.
 * Takes unique normalized ingredient names from RecipeIngredient and tries to
 * match them against the full CleanProduct catalog (~16k).
 * Reports:
 *   - match rate at different thresholds
 *   - match type distribution (exact / canonical-exact / fuzzy)
 *   - top unmatched queries (for future tuning)
 */

import 'dotenv/config';
import { prisma } from '@db';
import { matchProduct, type ProductCandidate } from '../src/scraper/utils/productMatcher';
import { parseIngredientList } from '../src/scraper/utils/ingredientParser';

const SAMPLE_SIZE = 2000;
const THRESHOLD = 0.85;

async function main() {
  console.log('=== S-7 product matcher — real DB audit ===\n');

  const productsRaw = await prisma.cleanProduct.findMany({
    select: { id: true, name: true },
  });
  const candidates: ProductCandidate[] = productsRaw.map((p) => ({ id: p.id, name: p.name }));
  console.log(`Loaded ${candidates.length} CleanProducts.`);

  const rows = await prisma.recipeIngredient.findMany({
    where: { displayName: { not: null } },
    select: { displayName: true },
    distinct: ['displayName'],
    take: SAMPLE_SIZE,
  });
  console.log(`Loaded ${rows.length} distinct ingredient names.\n`);

  const stats = {
    total: 0,
    matched: 0,
    exact: 0,
    canonicalExact: 0,
    fuzzy: 0,
    unmatched: 0,
    byScoreBucket: { '100': 0, '95-99': 0, '90-94': 0, '85-89': 0, '<85': 0 },
  };
  const unmatchedSamples: string[] = [];
  const fuzzySamples: Array<{ query: string; name: string; matched: string; score: number }> = [];

  for (const r of rows) {
    const rawText = (r.displayName ?? '').trim();
    if (!rawText || rawText.length < 2) continue;

    // Split compounds ("sól i pieprz" → ["sól", "pieprz"]) and score each.
    const parsedList = parseIngredientList([rawText]);
    for (const parsed of parsedList) {
      stats.total++;
      const name = parsed.name;
      if (!name || name.length < 2) {
        stats.unmatched++;
        if (unmatchedSamples.length < 30) unmatchedSamples.push(`[no-name] "${rawText}"`);
        continue;
      }

      const m = matchProduct(name, candidates, THRESHOLD);
      if (!m) {
        stats.unmatched++;
        if (unmatchedSamples.length < 30) unmatchedSamples.push(`"${rawText}" → name="${name}"`);
        continue;
      }

      stats.matched++;
      if (m.matchType === 'exact') stats.exact++;
      else if (m.matchType === 'canonical-exact') stats.canonicalExact++;
      else {
        stats.fuzzy++;
        if (fuzzySamples.length < 30) {
          fuzzySamples.push({ query: rawText, name, matched: m.product.name, score: m.score });
        }
      }

      const pct100 = Math.round(m.score * 100);
      if (pct100 >= 100) stats.byScoreBucket['100']++;
      else if (pct100 >= 95) stats.byScoreBucket['95-99']++;
      else if (pct100 >= 90) stats.byScoreBucket['90-94']++;
      else if (pct100 >= 85) stats.byScoreBucket['85-89']++;
      else stats.byScoreBucket['<85']++;
    }
  }

  const pct = (n: number) => (stats.total > 0 ? Math.round((100 * n) / stats.total) : 0);

  console.log(`Match coverage (threshold ${THRESHOLD}):`);
  console.log(`  Total queries     : ${stats.total}`);
  console.log(`  Matched           : ${stats.matched} (${pct(stats.matched)}%)`);
  console.log(`    exact           : ${stats.exact}`);
  console.log(`    canonical-exact : ${stats.canonicalExact}`);
  console.log(`    fuzzy           : ${stats.fuzzy}`);
  console.log(`  Unmatched         : ${stats.unmatched} (${pct(stats.unmatched)}%)`);

  console.log('\nScore bucket distribution (matched only):');
  for (const [k, v] of Object.entries(stats.byScoreBucket)) {
    console.log(`  ${k.padEnd(8)} ${v}`);
  }

  console.log('\nSamples: unmatched (first 30):');
  unmatchedSamples.forEach((s) => console.log(`  ${s}`));

  console.log('\nSamples: fuzzy matches (first 30) — CHECK FOR FALSE POSITIVES:');
  fuzzySamples.forEach((s) => {
    console.log(`  [${s.score.toFixed(2)}] "${s.query}" | name="${s.name}" → "${s.matched}"`);
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
