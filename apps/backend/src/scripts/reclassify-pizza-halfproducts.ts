/**
 * Z2 — Targeted reclassification for pizza/yeast-dough half-products.
 *
 * Why a dedicated script (rather than extending reclassify-component-recipes):
 *
 *   The general reclassifier scopes by `mealType: { notIn: ['SAUCE',
 *   'SIDE_DISH'] }` so it skips recipes already mis-tagged as SIDE_DISH.
 *   The two half-products we found in the audit (Z2.1) sit precisely in
 *   that excluded scope:
 *
 *     - "Ciasto na pizzę" — currently SIDE_DISH / CARB_SIDE
 *     - "Ciasto drożdżowe" — currently BREAKFAST / COMPLETE_MEAL
 *
 *   Both are bare doughs, never a meal. Solver should treat them as
 *   COMPONENTS and never offer them as a slot fill.
 *
 *   Additionally, a small pizza/focaccia-snack subset (4 records) sits
 *   in mealType=SNACK with no clear right answer — these are legit
 *   "small focaccia / pizza-tost" snacks but worth dietitian review;
 *   we surface them as DataQualityIssue (review queue) instead of
 *   forcing a reclassification.
 *
 * Idempotent: re-running after --apply finds nothing to change.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register \
 *       apps/backend/src/scripts/reclassify-pizza-halfproducts.ts          (dry run)
 *   npx ts-node -r tsconfig-paths/register \
 *       apps/backend/src/scripts/reclassify-pizza-halfproducts.ts --apply
 */

import { prisma } from '@db';
import { normalizeProductName } from '../scraper/utils/productMatcher';

const APPLY = process.argv.includes('--apply');
const BATCH_ID = '2026-04-28-pizza-halfproducts';

// Patterns identical to audit-recipes-pizza-halfproducts.ts. Keep in sync.
const PATTERN_PIZZA_BASE = /^(ciasto na pizz|baza (pod|do) pinsi?e?|baza (pod|do) pizz|sos do pizz|sos pizza|sos pomidorowy do pizz|baza pizz)/;
const PATTERN_YEAST_DOUGH = /^ciasto drozdzow/;
const YEAST_DOUGH_EXCLUSIONS: RegExp[] = [
  /\b(z |ze |na )/,
  /\b(jablk|sliwk|truskawk|borowk|jagod|wisn|gruszk|maliny?|porzeczk)/,
  /\b(kakao|nutell|krem|polewa|lukier|posypk|powidl|dzem)/,
  /\b(makiem|serem|twarog|szynk|kielbas|jajk|salami)/,
];
const PATTERN_PIZZA_AS_MEAL = /^(pizza|pinsa|focaccia|focacc)\b/;
const PIZZA_MEAL_EXCLUSIONS: RegExp[] = [/\b(ciasto|baza|sos)\b/];

interface Reclassify {
  id: string;
  title: string;
  fromMealType: string;
  fromDishCompleteness: string | null;
  reason: string;
}
interface ReviewFlag {
  id: string;
  title: string;
  mealType: string;
  reason: string;
}

async function scan(): Promise<{ reclassify: Reclassify[]; review: ReviewFlag[] }> {
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

  const reclassify: Reclassify[] = [];
  const review: ReviewFlag[] = [];

  for (const r of recipes) {
    const norm = normalizeProductName(r.title);

    // 1. Pizza/pinsa half-product — base/sauce/dough.
    if (PATTERN_PIZZA_BASE.test(norm)) {
      const alreadyOk =
        r.mealType === 'SAUCE' && r.dishCompleteness === 'COMPONENT';
      if (!alreadyOk) {
        reclassify.push({
          id: r.id,
          title: r.title,
          fromMealType: r.mealType,
          fromDishCompleteness: r.dishCompleteness,
          reason: 'pizza-base-halfproduct',
        });
      }
      continue;
    }

    // 2. Bare yeast dough.
    if (PATTERN_YEAST_DOUGH.test(norm) && !YEAST_DOUGH_EXCLUSIONS.some((rx) => rx.test(norm))) {
      const alreadyOk =
        r.mealType === 'SAUCE' && r.dishCompleteness === 'COMPONENT';
      if (!alreadyOk) {
        reclassify.push({
          id: r.id,
          title: r.title,
          fromMealType: r.mealType,
          fromDishCompleteness: r.dishCompleteness,
          reason: 'yeast-dough-bare',
        });
      }
      continue;
    }

    // 3. Pizza-as-meal subset that's mealType=SNACK — surface to review,
    // don't force a reclassification.
    if (PATTERN_PIZZA_AS_MEAL.test(norm) && !PIZZA_MEAL_EXCLUSIONS.some((rx) => rx.test(norm))) {
      if (r.mealType === 'SNACK') {
        review.push({
          id: r.id,
          title: r.title,
          mealType: r.mealType,
          reason: 'pizza-or-focaccia-as-snack',
        });
      }
    }
  }

  return { reclassify, review };
}

async function applyReclassify(rows: Reclassify[]): Promise<number> {
  let updated = 0;
  for (const r of rows) {
    await prisma.$transaction([
      prisma.recipe.update({
        where: { id: r.id },
        data: { mealType: 'SAUCE', dishCompleteness: 'COMPONENT' },
      }),
      prisma.auditLog.create({
        data: {
          action: 'RECLASSIFY_PIZZA_HALFPRODUCT',
          resourceType: 'RECIPE',
          resourceId: r.id,
          metadata: {
            from: { mealType: r.fromMealType, dishCompleteness: r.fromDishCompleteness },
            to: { mealType: 'SAUCE', dishCompleteness: 'COMPONENT' },
            reason: r.reason,
            title: r.title,
            batchId: BATCH_ID,
          },
        },
      }),
    ]);
    updated++;
  }
  return updated;
}

async function applyReview(rows: ReviewFlag[]): Promise<number> {
  if (rows.length === 0) return 0;

  // Skip already-existing open issues with the same code+entity.
  const existing = await prisma.dataQualityIssue.findMany({
    where: {
      entityType: 'Recipe',
      issueCode: 'RECIPE_PIZZA_SNACK_REVIEW',
      isResolved: false,
      entityId: { in: rows.map((r) => r.id) },
    },
    select: { entityId: true },
  });
  const existingIds = new Set(existing.map((e) => e.entityId));
  const toCreate = rows.filter((r) => !existingIds.has(r.id));
  if (toCreate.length === 0) return 0;

  await prisma.dataQualityIssue.createMany({
    data: toCreate.map((r) => ({
      entityType: 'Recipe',
      entityId: r.id,
      field: 'mealType',
      severity: 'WARNING',
      issueCode: 'RECIPE_PIZZA_SNACK_REVIEW',
      description: `"${r.title}" — pizza/focaccia oznaczona jako SNACK. Czy to świadome (mała porcja, przekąska) czy literówka mealType?`,
      suggestedFix: 'Zostaw jako SNACK jeśli to mała porcja focaccii/pizza-tostu; zmień na LUNCH/DINNER jeśli pełnowymiarowa pizza.',
      isResolved: false,
    })),
  });

  return toCreate.length;
}

async function main(): Promise<void> {
  console.log('\n=== Z2 — pizza/yeast-dough half-product reclassify ===');
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}`);
  console.log(`Batch ID: ${BATCH_ID}\n`);

  const { reclassify, review } = await scan();

  console.log(`Reclassify (mealType→SAUCE, dishCompleteness→COMPONENT): ${reclassify.length}`);
  for (const r of reclassify) {
    console.log(
      `  ${r.title.padEnd(40)} ` +
      `[${r.fromMealType}/${r.fromDishCompleteness ?? '-'}] → [SAUCE/COMPONENT]  ` +
      `(${r.reason})`,
    );
  }

  console.log(`\nReview queue (RECIPE_PIZZA_SNACK_REVIEW): ${review.length}`);
  for (const r of review) {
    console.log(`  ${r.title.padEnd(50)} [${r.mealType}]`);
  }

  if (!APPLY) {
    console.log('\n(dry-run — pass --apply to write)\n');
    return;
  }

  console.log('\nApplying reclassifications...');
  const reclassified = await applyReclassify(reclassify);
  console.log(`Reclassified ${reclassified} recipe(s).`);

  console.log('\nWriting review queue entries...');
  const reviewed = await applyReview(review);
  console.log(`Wrote ${reviewed} new RECIPE_PIZZA_SNACK_REVIEW issue(s).\n`);

  console.log('Done.\n');
}

main()
  .catch((err) => { console.error('FAILED:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
