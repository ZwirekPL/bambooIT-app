/**
 * Faza D.6 — Audit side-dish coverage (read-only).
 *
 * Solver in Faza D will compose LUNCH/DINNER/SUPPER from:
 *   1× MAIN_DISH + 1× CARB_SIDE + 1× VEG_SIDE
 * (or skip CARB_SIDE / VEG_SIDE if main already contains them).
 *
 * Need to know whether the recipe pool has enough CARB_SIDE and VEG_SIDE
 * options across categories — so the composer doesn't always pick "ziemniaki"
 * (low diversity = bored patient).
 *
 * Outputs:
 *   1. CARB_SIDE breakdown by main carb type (potato/grain/pasta/legume)
 *   2. VEG_SIDE breakdown by preparation (raw salad / cooked / pickled)
 *   3. kcal/p distribution (whether sides are scaled to ~150–300 kcal range
 *      typical for a side portion)
 *   4. Per-meal feasibility check: for each LUNCH MAIN_DISH without veg,
 *      does the cuisine have a matching veg_side?
 *   5. Gap report — recommend manual recipes to add
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/audit-side-dish-coverage.ts
 */

import { prisma } from '@db';
import { normalizeProductName } from '../scraper/utils/productMatcher';

// CARB_SIDE classification — main carb source
const CARB_TYPE_PATTERNS: Array<[string, RegExp]> = [
  ['potato',     /\b(ziemniak|ziemniaki|frytki|placki\s+ziemniaczane|kopytka|rosti|puree|gnocchi)\w*/],
  ['rice',       /\b(ryz|risotto)\w*/],
  ['pasta',      /\b(makaron|spaghetti|penne|farfalle|tagliatelle|orzo|nudle|kluski|kopytka|łazanki|lazanki)\w*/],
  ['grain',      /\b(kasza|kasze|kuskus|bulgur|quinoa|jaglan|gryczan|peczak|jeczmienn|mann|pszenicz|orkiszow)\w*/],
  ['legume',     /\b(fasol|soczewic|cieciec|ciecierzyc|groszek)\w*/],
  ['bread',      /\b(chleb|tortilla|pita|focaccia|bulk|bulka|grzank|tost)\w*/],
];

// VEG_SIDE classification — preparation method
const VEG_PREP_PATTERNS: Array<[string, RegExp]> = [
  ['raw_salad',  /\b(salatk|surowk|coleslaw|mizeria|salat\w*)\w*/],
  ['steamed',   /\b(na\s+parze|gotowan|blanszowan|duszone|duszony|duszona)\w*/],
  ['roasted',   /\b(piecz|roast|grillowan|smażon|smazon|przyprażan)\w*/],
  ['raw_veg',   /\b(\w+(?<!sał)k(?!a)|pomidor|ogorek|ogórek|rzodkiew|seler|marchew|kiszone|kiszony|kiszona)\w*/],
  ['pickled',   /\b(kiszon|marynowan)\w*/],
];

interface RecipeRow {
  id: string;
  title: string;
  category: string | null;
  cuisineType: string | null;
  mealType: string;
  servings: number;
  servingType: string;
  totalTimeMinutes: number | null;
  kcalPerServing: number | null;
}

async function main() {
  console.log('\n=== Faza D.6 — Side-dish coverage audit (read-only) ===\n');

  // Pull all CARB_SIDE and VEG_SIDE recipes
  const sides = await prisma.recipe.findMany({
    where: {
      isActive: true,
      dishCompleteness: { in: ['CARB_SIDE', 'VEG_SIDE'] },
    },
    select: {
      id: true,
      title: true,
      category: true,
      cuisineType: true,
      mealType: true,
      servings: true,
      servingType: true,
      totalTimeMinutes: true,
      dishCompleteness: true,
      nutritionSnapshot: { select: { kcal: true } },
    },
  });

  const carbSides: RecipeRow[] = sides
    .filter((r) => r.dishCompleteness === 'CARB_SIDE')
    .map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      cuisineType: r.cuisineType,
      mealType: r.mealType,
      servings: r.servings,
      servingType: r.servingType,
      totalTimeMinutes: r.totalTimeMinutes,
      kcalPerServing: r.nutritionSnapshot ? Number(r.nutritionSnapshot.kcal) : null,
    }));

  const vegSides: RecipeRow[] = sides
    .filter((r) => r.dishCompleteness === 'VEG_SIDE')
    .map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      cuisineType: r.cuisineType,
      mealType: r.mealType,
      servings: r.servings,
      servingType: r.servingType,
      totalTimeMinutes: r.totalTimeMinutes,
      kcalPerServing: r.nutritionSnapshot ? Number(r.nutritionSnapshot.kcal) : null,
    }));

  console.log(`CARB_SIDE total: ${carbSides.length}`);
  console.log(`VEG_SIDE total:  ${vegSides.length}\n`);

  // ─── CARB_SIDE breakdown by carb type ───────────────────────────────────
  console.log('--- CARB_SIDE by main carb type ---');
  const carbTypeHist = new Map<string, RecipeRow[]>();
  for (const r of carbSides) {
    const t = normalizeProductName(r.title);
    let matched = false;
    for (const [type, re] of CARB_TYPE_PATTERNS) {
      if (re.test(t)) {
        if (!carbTypeHist.has(type)) carbTypeHist.set(type, []);
        carbTypeHist.get(type)!.push(r);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!carbTypeHist.has('other')) carbTypeHist.set('other', []);
      carbTypeHist.get('other')!.push(r);
    }
  }
  for (const [type, list] of [...carbTypeHist.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const avgKcal = list.reduce((s, r) => s + (r.kcalPerServing ?? 0), 0) / Math.max(list.length, 1);
    console.log(`  ${type.padEnd(10)} → ${String(list.length).padStart(3)}  (avg ${Math.round(avgKcal)} kcal/p)`);
  }

  console.log('\n--- CARB_SIDE samples (first 25, alphabetically) ---');
  for (const r of [...carbSides].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 25)) {
    const kcal = r.kcalPerServing != null ? `${Math.round(r.kcalPerServing)} kcal/p` : 'no kcal';
    console.log(`  [${r.servingType.padEnd(11)} ${kcal.padStart(11)}]  ${r.title}`);
  }

  // ─── VEG_SIDE breakdown by preparation ──────────────────────────────────
  console.log('\n--- VEG_SIDE by preparation ---');
  const vegPrepHist = new Map<string, RecipeRow[]>();
  for (const r of vegSides) {
    const t = normalizeProductName(r.title);
    let matched = false;
    for (const [type, re] of VEG_PREP_PATTERNS) {
      if (re.test(t)) {
        if (!vegPrepHist.has(type)) vegPrepHist.set(type, []);
        vegPrepHist.get(type)!.push(r);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!vegPrepHist.has('other')) vegPrepHist.set('other', []);
      vegPrepHist.get('other')!.push(r);
    }
  }
  for (const [type, list] of [...vegPrepHist.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const avgKcal = list.reduce((s, r) => s + (r.kcalPerServing ?? 0), 0) / Math.max(list.length, 1);
    console.log(`  ${type.padEnd(11)} → ${String(list.length).padStart(3)}  (avg ${Math.round(avgKcal)} kcal/p)`);
  }

  console.log('\n--- VEG_SIDE samples (first 25) ---');
  for (const r of [...vegSides].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 25)) {
    const kcal = r.kcalPerServing != null ? `${Math.round(r.kcalPerServing)} kcal/p` : 'no kcal';
    console.log(`  [${r.servingType.padEnd(11)} ${kcal.padStart(11)}]  ${r.title}`);
  }

  // ─── kcal range diagnosis ───────────────────────────────────────────────
  console.log('\n--- kcal/p ranges ---');
  const kcalBucket = (kcal: number | null): string => {
    if (kcal == null || kcal === 0) return 'no kcal';
    if (kcal < 50) return '<50';
    if (kcal < 100) return '50-100';
    if (kcal < 200) return '100-200';
    if (kcal < 300) return '200-300';
    if (kcal < 500) return '300-500';
    return '500+';
  };
  for (const [bucketName, list] of [['CARB_SIDE', carbSides], ['VEG_SIDE', vegSides]] as Array<[string, RecipeRow[]]>) {
    console.log(`  ${bucketName}:`);
    const bucketHist = new Map<string, number>();
    for (const r of list) {
      const b = kcalBucket(r.kcalPerServing);
      bucketHist.set(b, (bucketHist.get(b) ?? 0) + 1);
    }
    for (const [b, n] of [...bucketHist.entries()].sort((a, b) => {
      const order = ['no kcal', '<50', '50-100', '100-200', '200-300', '300-500', '500+'];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    })) {
      console.log(`    ${b.padEnd(10)} → ${n}`);
    }
  }

  // ─── How many MAIN_DISH need a veg_side? ────────────────────────────────
  const mainNeedsVeg = await prisma.recipe.count({
    where: {
      isActive: true,
      dishCompleteness: 'MAIN_DISH',
      containsVegetableServing: false,
    },
  });
  const mainHasVeg = await prisma.recipe.count({
    where: {
      isActive: true,
      dishCompleteness: 'MAIN_DISH',
      containsVegetableServing: true,
    },
  });
  console.log('\n--- Composition demand ---');
  console.log(`MAIN_DISH with veg already (no veg_side needed): ${mainHasVeg}`);
  console.log(`MAIN_DISH without veg (veg_side required):       ${mainNeedsVeg}`);

  // ─── Gap analysis ───────────────────────────────────────────────────────
  console.log('\n--- Gap analysis ---');

  const REQUIRED_CARB_TYPES = ['potato', 'rice', 'pasta', 'grain'];
  const carbGaps: string[] = [];
  for (const t of REQUIRED_CARB_TYPES) {
    const count = carbTypeHist.get(t)?.length ?? 0;
    if (count < 5) {
      carbGaps.push(`${t} (${count}, target ≥5)`);
    }
  }
  if (carbGaps.length === 0) {
    console.log('  ✓ CARB_SIDE coverage adequate across all main types');
  } else {
    console.log(`  ⚠ CARB_SIDE gaps: ${carbGaps.join(', ')}`);
  }

  const REQUIRED_VEG_PREPS = ['raw_salad', 'steamed', 'roasted'];
  const vegGaps: string[] = [];
  for (const p of REQUIRED_VEG_PREPS) {
    const count = vegPrepHist.get(p)?.length ?? 0;
    if (count < 5) {
      vegGaps.push(`${p} (${count}, target ≥5)`);
    }
  }
  if (vegGaps.length === 0) {
    console.log('  ✓ VEG_SIDE coverage adequate across all preparation types');
  } else {
    console.log(`  ⚠ VEG_SIDE gaps: ${vegGaps.join(', ')}`);
  }

  console.log('\n=== End of audit ===\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
