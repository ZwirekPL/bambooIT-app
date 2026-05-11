/**
 * D: Fix recipes incorrectly marked as 1 serving (kcal > 1200).
 *
 * From S-3/S-8 audit: 547 recipes have servings=1 AND per-serving kcal > 1200,
 * which is unrealistic — these are batch dishes (cakes 6000+ kcal, soups
 * 2000+ kcal, casseroles 5000+ kcal) with the wrong servings count.
 *
 * Strategy:
 *   1. Pick a target per-serving kcal based on title pattern (dessert) or
 *      category (main/soup/snack/breakfast/etc).
 *   2. Compute new_servings = max(2, round(total_kcal / target)).
 *   3. Update Recipe.servings and proportionally scale every numeric column
 *      in RecipeNutritionSnapshot (which currently holds the *total* recipe
 *      values in the per-serving columns because it was divided by 1).
 *   4. Print a dry-run summary first; require --apply to write.
 *
 * Idempotent guard: only touches recipes that *currently* have servings=1.
 * Re-running after apply finds 0 candidates.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/fix-1serving-recipes.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/fix-1serving-recipes.ts --apply
 *   node -r tsconfig-paths/register dist/scripts/fix-1serving-recipes.js --apply   # in prod container
 */

import { prisma } from '@db';

const APPLY = process.argv.includes('--apply');
const KCAL_THRESHOLD = 1200;

// Per-serving target kcal — used to derive servings from total kcal
const TARGET_BY_CATEGORY: Record<string, number> = {
  main: 550,
  dessert: 400,
  snack: 250,
  soup: 300,
  breakfast: 450,
  side_dish: 200,
  drink: 200,
};
const DEFAULT_TARGET = 500;

// Title patterns that override category — these are nearly always batch desserts
// regardless of how the source site categorized them.
const DESSERT_TITLE_RE = /\b(ciasto|ciasteczk|sernik|tort|torcik|brownie|placek|placki|rolada|szarlotk|babka|babeczk|mufink|muffin)\b/i;
const SOUP_TITLE_RE = /\b(zupa|krem)\b/i;

// Per-serving columns in RecipeNutritionSnapshot. Scaled by 1/newServings.
// Excludes the `total*` columns (totalKcal/totalProtein_g/totalFat_g/totalCarbs_g)
// which represent recipe-wide totals and should NOT change when servings change.
const NUMERIC_COLS = [
  'kcal', 'protein_g', 'fat_g', 'saturatedFat_g', 'carbs_g', 'sugars_g', 'fiber_g',
  'salt_g', 'monounsaturatedFat_g', 'polyunsaturatedFat_g', 'transFat_g',
  'omega3_g', 'omega6_g', 'epa_g', 'dha_g', 'ala_g', 'starch_g', 'addedSugars_g',
  'sodium_mg', 'potassium_mg', 'calcium_mg', 'magnesium_mg', 'phosphorus_mg',
  'chloride_mg', 'iron_mg', 'zinc_mg', 'copper_mg', 'manganese_mg', 'iodine_ug',
  'selenium_ug', 'chromium_ug', 'molybdenum_ug', 'fluoride_ug',
  'vitaminA_ug', 'vitaminD_ug', 'vitaminE_mg', 'vitaminK_ug',
  'vitaminB1_mg', 'vitaminB2_mg', 'vitaminB3_mg', 'vitaminB5_mg', 'vitaminB6_mg',
  'vitaminB12_ug', 'vitaminC_mg', 'folate_ug', 'biotin_ug', 'choline_mg',
  'cholesterol_mg',
] as const;

interface Candidate {
  id: string;
  title: string;
  category: string | null;
  totalKcal: number;
  newServings: number;
  reason: string;
}

function pickTarget(title: string, category: string | null): { target: number; reason: string } {
  if (DESSERT_TITLE_RE.test(title)) return { target: TARGET_BY_CATEGORY.dessert, reason: 'title:dessert' };
  if (SOUP_TITLE_RE.test(title)) return { target: TARGET_BY_CATEGORY.soup, reason: 'title:soup' };
  if (category && TARGET_BY_CATEGORY[category]) return { target: TARGET_BY_CATEGORY[category], reason: `cat:${category}` };
  return { target: DEFAULT_TARGET, reason: 'default' };
}

async function main() {
  console.log(`\n=== D: Fix 1-serving recipes (kcal > ${KCAL_THRESHOLD}) ===`);
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}\n`);

  const rows = await prisma.recipe.findMany({
    where: {
      servings: 1,
      nutritionSnapshot: { kcal: { gt: KCAL_THRESHOLD } },
    },
    select: {
      id: true,
      title: true,
      category: true,
      nutritionSnapshot: { select: { kcal: true } },
    },
  });

  console.log(`Found ${rows.length} candidates.\n`);

  const candidates: Candidate[] = rows.map((r) => {
    const totalKcal = Number(r.nutritionSnapshot!.kcal);
    const { target, reason } = pickTarget(r.title, r.category);
    const newServings = Math.max(2, Math.round(totalKcal / target));
    return { id: r.id, title: r.title, category: r.category, totalKcal, newServings, reason };
  });

  // Distribution of new servings
  const servingsHist = new Map<number, number>();
  const reasonHist = new Map<string, number>();
  for (const c of candidates) {
    servingsHist.set(c.newServings, (servingsHist.get(c.newServings) ?? 0) + 1);
    reasonHist.set(c.reason, (reasonHist.get(c.reason) ?? 0) + 1);
  }

  console.log('New servings distribution:');
  for (const [s, n] of [...servingsHist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(s).padStart(3)} servings  → ${n} recipes`);
  }
  console.log('\nReason distribution:');
  for (const [r, n] of [...reasonHist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r.padEnd(15)} → ${n}`);
  }

  console.log('\nSample (top 15 by total kcal):');
  for (const c of [...candidates].sort((a, b) => b.totalKcal - a.totalKcal).slice(0, 15)) {
    const newKcal = Math.round(c.totalKcal / c.newServings);
    console.log(`  ${String(c.totalKcal).padStart(5)} kcal → ${String(c.newServings).padStart(2)}× ${String(newKcal).padStart(4)} kcal/p  [${c.reason}]  ${c.title}`);
  }

  if (!APPLY) {
    console.log('\n(dry-run — pass --apply to write changes)\n');
    return;
  }

  console.log('\nApplying updates...');
  let n = 0;
  for (const c of candidates) {
    // Build SET clause: scale every numeric column by 1/newServings.
    // We use parameterized raw SQL to update many columns in one statement.
    const factor = 1 / c.newServings;
    const setClauses = NUMERIC_COLS.map((col) => `"${col}" = "${col}" * ${factor}`).join(', ');

    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `UPDATE "RecipeNutritionSnapshot" SET ${setClauses} WHERE "recipeId" = $1`,
        c.id,
      ),
      prisma.recipe.update({
        where: { id: c.id },
        data: { servings: c.newServings },
      }),
    ]);

    n++;
    if (n % 100 === 0) console.log(`  Updated ${n}/${candidates.length}...`);
  }

  console.log(`\nDone. Updated ${n} recipes.\n`);
}

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
