/**
 * Z2 — Pizza / yeast-dough / half-product audit (read-only).
 *
 * Reads every active recipe and groups titles into three buckets:
 *
 *   1. PIZZA_BASE_HALFPRODUCT — "Ciasto na pizzę", "Baza do pinsy", "Sos
 *      pizza", etc. These are doughs / sauces / bases meant to be parts
 *      of a pizza meal, NOT a meal on their own.
 *
 *   2. PIZZA_AS_MEAL — "Pizza margherita", "Pinsa z szynką", "Pizza
 *      hawajska". Full meals — the patient eats one slice of these as
 *      lunch / dinner. They should keep mealType=LUNCH/DINNER but get
 *      `category` set to something pizza-shaped (currently nullable).
 *
 *   3. YEAST_DOUGH_HALFPRODUCT — "Ciasto drożdżowe", "Ciasto drożdżowe
 *      podstawowe" — bare yeast dough is a base recipe, not a meal.
 *      We exclude anything with a filler ("Ciasto drożdżowe ze
 *      śliwkami") because that IS a dessert.
 *
 * Reports counts per bucket with up to 30 sample titles each. Existing
 * mealType / category / dishCompleteness distributions per bucket help
 * the operator decide whether HIGH-confidence reclassification is safe
 * before extending reclassify-component-recipes.ts.
 *
 * Usage:
 *   npx tsx apps/backend/src/scripts/audit-recipes-pizza-halfproducts.ts
 */

import { prisma } from '@db';
import { normalizeProductName } from '../scraper/utils/productMatcher';

interface Bucket {
  name: string;
  description: string;
  pattern: RegExp;
  exclusions?: RegExp[];
  hits: Array<{
    id: string;
    title: string;
    mealType: string;
    category: string | null;
    dishCompleteness: string | null;
  }>;
}

// All patterns run on `normalizeProductName(title)` — lowercase, ascii-only,
// diacritics stripped. Hand-verified against ~30 sample titles each.
const BUCKETS: Bucket[] = [
  {
    name: 'PIZZA_BASE_HALFPRODUCT',
    description: 'Pizza/pinsa half-products (dough, sauce, base) that should become COMPONENT/SAUCE',
    pattern: /^(ciasto na pizz|baza (pod|do) pinsi?e?|baza (pod|do) pizz|sos do pizz|sos pizza|sos pomidorowy do pizz|baza pizz)/,
    hits: [],
  },
  {
    name: 'PIZZA_AS_MEAL',
    description: 'Pizza/pinsa as standalone full meal — keeps mealType, may need category="pizza_fastfood"',
    pattern: /^(pizza|pinsa|focaccia|focacc)\b/,
    // Exclude half-products that pattern 1 already catches — both regexes start
    // at ^, so a "Ciasto na pizzę" never reaches here. But "Pizza margherita
    // baza" sounds component-ish; flag any title with "ciasto" / "baza" / "sos"
    // anywhere as ambiguous and skip.
    exclusions: [/\b(ciasto|baza|sos)\b/],
    hits: [],
  },
  {
    name: 'YEAST_DOUGH_HALFPRODUCT',
    description: 'Bare yeast dough recipes (Ciasto drożdżowe X, where X has no filler keyword)',
    pattern: /^ciasto drozdzow/,
    // Exclude any title with a dish-target / filler / fruit / cream — those
    // are full desserts, not bases:  "Ciasto drożdżowe ze śliwkami".
    exclusions: [
      /\b(z |ze |na )/, // most filler indicators ("z śliwkami", "ze sliwkami", "na sniadanie")
      /\b(jablk|sliwk|truskawk|borowk|jagod|wisn|gruszk|maliny?|porzeczk)/, // fruits
      /\b(kakao|nutell|krem|polewa|lukier|posypk|powidl|dzem)/,         // toppings
      /\b(makiem|serem|twarog|szynk|kielbas|jajk|salami)/,                // savoury fillings
    ],
    hits: [],
  },
];

async function main(): Promise<void> {
  console.log('\n=== Z2 audit — pizza / yeast-dough / half-products ===\n');

  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      mealType: true,
      category: true,
      dishCompleteness: true,
    },
  });

  console.log(`Total active recipes scanned: ${recipes.length}\n`);

  for (const r of recipes) {
    const norm = normalizeProductName(r.title);
    for (const b of BUCKETS) {
      if (!b.pattern.test(norm)) continue;
      if (b.exclusions?.some((rx) => rx.test(norm))) continue;
      b.hits.push({
        id: r.id,
        title: r.title,
        mealType: r.mealType,
        category: r.category,
        dishCompleteness: r.dishCompleteness,
      });
      break; // first match wins
    }
  }

  for (const b of BUCKETS) {
    console.log(`\n--- ${b.name} (${b.hits.length}) ---`);
    console.log(`     ${b.description}`);
    if (b.hits.length === 0) {
      console.log('     (no hits)');
      continue;
    }

    // Distribution of current mealType / category / dishCompleteness.
    const byMealType = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byDishCompleteness = new Map<string, number>();
    for (const h of b.hits) {
      byMealType.set(h.mealType, (byMealType.get(h.mealType) ?? 0) + 1);
      const catKey = h.category ?? '(null)';
      byCategory.set(catKey, (byCategory.get(catKey) ?? 0) + 1);
      const dcKey = h.dishCompleteness ?? '(null)';
      byDishCompleteness.set(dcKey, (byDishCompleteness.get(dcKey) ?? 0) + 1);
    }

    console.log('  mealType:        ' + [...byMealType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}=${n}`).join(', '));
    console.log('  category:        ' + [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, n]) => `${k}=${n}`).join(', '));
    console.log('  dishCompleteness:' + [...byDishCompleteness.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}=${n}`).join(', '));

    console.log('  Sample (first 30):');
    for (const h of b.hits.slice(0, 30)) {
      const meta = `[${h.mealType.padEnd(8)} ${h.category ?? '-'} ${h.dishCompleteness ?? '-'}]`;
      console.log(`    ${meta.padEnd(40)} ${h.title}`);
    }
    if (b.hits.length > 30) console.log(`    ... +${b.hits.length - 30} more`);
  }

  console.log('\n=== End audit (read-only, no writes) ===\n');
}

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  })
  .finally(async () => { await prisma.$disconnect(); });
