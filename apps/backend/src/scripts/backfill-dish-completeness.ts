/**
 * Faza C.2 etap 1 + 2 — Rule-based backfill of Recipe.dishCompleteness
 * + audit of vegetable weight.
 *
 * Etap 1 (deterministyczne mapowanie po mealType + tytule):
 *   mealType=SAUCE / DRINK     → COMPONENT
 *   mealType=SIDE_DISH         → CARB_SIDE / VEG_SIDE based on title keywords
 *                                (ambiguous left as null for GPT/manual review)
 *   mealType=DESSERT / SNACK   → COMPLETE_MEAL (standalone)
 *   mealType=SECOND_BREAKFAST  → COMPLETE_MEAL (lunchbox)
 *   mealType=BREAKFAST         → COMPLETE_MEAL if title indicates a known
 *                                self-contained breakfast (owsianka/omlet/...)
 *   mealType=LUNCH/DINNER/SUPPER:
 *     - title starts with "zupa"/"krem z" → COMPLETE_MEAL (soup self-contained)
 *     - title contains "z makaronem/ryżem/ziemniakami/kaszą/..." → COMPLETE_MEAL
 *     - title contains one-pot indicator (gulasz/risotto/leczo/bigos/...) → COMPLETE_MEAL
 *     - else → MAIN_DISH (needs carb_side + veg_side in Faza D)
 *
 * Etap 2 (vegetable weight audit):
 *   For each recipe, sum grams of ingredients where cleanProduct.category='warzywa'.
 *   If sum ≥ 100g → containsVegetableServing=true. Always store vegetableWeightG.
 *
 * Idempotent: skips recipes that already have non-null dishCompleteness
 * (so re-runs only fill gaps).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-dish-completeness.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-dish-completeness.ts --apply
 */

import { prisma } from '@db';
import { normalizeProductName } from '../scraper/utils/productMatcher';

const APPLY = process.argv.includes('--apply');

const VEGETABLE_CATEGORY = 'warzywa';
const MIN_VEGETABLE_WEIGHT_G = 100;

// Patterns operate on normalized titles (lowercase, no diacritics, ascii-only).
const CARB_SIDE_RE = /\b(ziemniak|ziemniaki|frytki|kasza|kasze|kasza\s+(jaglana|gryczana|peczak|jeczmienna|manna)|ryz|makaron|spaghetti|kluski|peczak|bulgur|quinoa|kus[-\s]?kus|kuskus|gnocchi|placki\s+ziemniaczane|pierogi)\w*/;
const VEG_SIDE_RE = /\b(salatk|surowk|coleslaw|mizeria|szpinak|brokul|kapust|fasolk(?!\s)|warzyw|buraczki|buraki|marchewk|cukini|bukiet\s+warzyw|kalafior|szparag|por|seler\s+nacin|patison|kabaczk)\w*/;

const SOUP_RE = /^(zupa|krem\s+z)\b/;
const HAS_CARB_RE = /\bz\s+(makaronem|ryzem|ziemniakami|kasza|kaszami|fasola|soczewica|quinoa|bulgurem|kuskusem|kus[-\s]?kusem|gnocchi|pierogami|kluskami|plackami|fasolka|nalesnikami)\b/;
const ONE_POT_RE = /\b(gulasz|risotto|leczo|bigos|paella|lasagna|moussaka|spaghetti|carbonara|chili\s+con\s+carne|tagine|jambalaya|kaszotto|owsianka|jaglanka|szakszuka|shakshuka|placek\s+ziemniaczany|zapiekanka|musaka|paëlla|paelle|jednogarnkow)\w*/;

const COMPLETE_BREAKFAST_RE = /\b(owsianka|jaglanka|granol|musli|muesli|smoothie\s+bowl|jajeczn|omlet|nalesnik|nalesniki|placki|placuszki|placuszek|tost|kanapk|chia\s+pudding|wafelk|gofr|szakszuka|shakshuka|jajka|jajko|jaja|kasza|owsiana|owsiane|jaglane)\w*/;

type Completeness = 'COMPLETE_MEAL' | 'MAIN_DISH' | 'CARB_SIDE' | 'VEG_SIDE' | 'COMPONENT' | null;

interface Classification {
  completeness: Completeness;
  reason: string;
}

function classify(title: string, mealType: string): Classification {
  const t = normalizeProductName(title);

  switch (mealType) {
    case 'SAUCE':
      return { completeness: 'COMPONENT', reason: 'mealType=SAUCE' };
    case 'DRINK':
      return { completeness: 'COMPONENT', reason: 'mealType=DRINK' };
    case 'SIDE_DISH':
      if (CARB_SIDE_RE.test(t)) return { completeness: 'CARB_SIDE', reason: 'side_dish:carb-keyword' };
      if (VEG_SIDE_RE.test(t)) return { completeness: 'VEG_SIDE', reason: 'side_dish:veg-keyword' };
      return { completeness: null, reason: 'side_dish:ambiguous' };
    case 'DESSERT':
      return { completeness: 'COMPLETE_MEAL', reason: 'dessert:standalone' };
    case 'SNACK':
      return { completeness: 'COMPLETE_MEAL', reason: 'snack:standalone' };
    case 'SECOND_BREAKFAST':
      return { completeness: 'COMPLETE_MEAL', reason: 'second_breakfast:lunchbox' };
    case 'BREAKFAST':
      if (COMPLETE_BREAKFAST_RE.test(t)) return { completeness: 'COMPLETE_MEAL', reason: 'breakfast:complete-keyword' };
      return { completeness: null, reason: 'breakfast:ambiguous' };
    case 'SUPPER':
    case 'LUNCH':
    case 'DINNER':
      if (SOUP_RE.test(t)) return { completeness: 'COMPLETE_MEAL', reason: 'soup:self-contained' };
      if (ONE_POT_RE.test(t)) return { completeness: 'COMPLETE_MEAL', reason: 'one-pot' };
      if (HAS_CARB_RE.test(t)) return { completeness: 'COMPLETE_MEAL', reason: 'title:has-carb' };
      return { completeness: 'MAIN_DISH', reason: 'main:requires-sides' };
    default:
      return { completeness: null, reason: `unknown mealType: ${mealType}` };
  }
}

async function auditVegetableWeight(recipeId: string): Promise<number> {
  const rows = await prisma.recipeIngredient.findMany({
    where: {
      recipeId,
      isOptional: false,
      cleanProduct: { category: VEGETABLE_CATEGORY },
    },
    select: { grams: true },
  });
  return Math.round(rows.reduce((sum, r) => sum + Number(r.grams), 0));
}

interface Result {
  id: string;
  title: string;
  mealType: string;
  newCompleteness: Completeness;
  reason: string;
  vegWeightG: number;
  containsVeg: boolean;
}

async function main() {
  console.log('\n=== Faza C.2 etap 1+2 — Rule-based dishCompleteness backfill ===');
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}\n`);

  // Idempotent: skip already-classified recipes (re-runs only fill gaps).
  const recipes = await prisma.recipe.findMany({
    where: {
      isActive: true,
      dishCompleteness: null,
    },
    select: { id: true, title: true, mealType: true },
  });

  console.log(`Recipes to process (dishCompleteness IS NULL): ${recipes.length}\n`);

  const results: Result[] = [];

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    const cls = classify(r.title, r.mealType);
    const vegWeightG = await auditVegetableWeight(r.id);
    const containsVeg = vegWeightG >= MIN_VEGETABLE_WEIGHT_G;

    results.push({
      id: r.id,
      title: r.title,
      mealType: r.mealType,
      newCompleteness: cls.completeness,
      reason: cls.reason,
      vegWeightG,
      containsVeg,
    });

    if ((i + 1) % 500 === 0) {
      console.log(`  Scanned ${i + 1}/${recipes.length}...`);
    }
  }

  // ─── Distribution by completeness ──────────────────────────────────────
  console.log('\n--- Distribution by new dishCompleteness ---');
  const compHist = new Map<string, number>();
  for (const r of results) {
    const key = r.newCompleteness ?? 'NULL (ambiguous)';
    compHist.set(key, (compHist.get(key) ?? 0) + 1);
  }
  for (const [k, n] of [...compHist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} → ${n}`);
  }

  // ─── Distribution by reason ─────────────────────────────────────────────
  console.log('\n--- By reason (top 15) ---');
  const reasonHist = new Map<string, number>();
  for (const r of results) {
    reasonHist.set(r.reason, (reasonHist.get(r.reason) ?? 0) + 1);
  }
  for (const [k, n] of [...reasonHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${k.padEnd(40)} → ${n}`);
  }

  // ─── Vegetable audit summary ────────────────────────────────────────────
  console.log('\n--- Vegetable content audit ---');
  const withVeg = results.filter((r) => r.containsVeg).length;
  const withoutVeg = results.length - withVeg;
  const avgVegG = results.reduce((s, r) => s + r.vegWeightG, 0) / Math.max(results.length, 1);
  console.log(`  Recipes with ≥${MIN_VEGETABLE_WEIGHT_G}g veg:  ${withVeg}`);
  console.log(`  Recipes without:               ${withoutVeg}`);
  console.log(`  Avg veg weight per recipe:     ${avgVegG.toFixed(1)}g`);

  // Cross-tab: completeness × veg
  console.log('\n--- containsVegetableServing by completeness ---');
  const cross = new Map<string, { with: number; without: number }>();
  for (const r of results) {
    const key = r.newCompleteness ?? 'NULL';
    if (!cross.has(key)) cross.set(key, { with: 0, without: 0 });
    cross.get(key)![r.containsVeg ? 'with' : 'without']++;
  }
  for (const [k, v] of [...cross.entries()]) {
    console.log(`  ${k.padEnd(20)} with veg: ${String(v.with).padStart(4)}  without: ${String(v.without).padStart(4)}`);
  }

  // ─── Sample outputs ─────────────────────────────────────────────────────
  console.log('\n--- Sample MAIN_DISH (first 15) ---');
  for (const r of results.filter((x) => x.newCompleteness === 'MAIN_DISH').slice(0, 15)) {
    console.log(`  [${r.mealType.padEnd(8)}] veg:${r.containsVeg ? 'Y' : 'N'} ${String(r.vegWeightG).padStart(4)}g  ${r.title}`);
  }
  console.log('\n--- Sample COMPLETE_MEAL one-pot (first 10) ---');
  for (const r of results.filter((x) => x.reason === 'one-pot').slice(0, 10)) {
    console.log(`  [${r.mealType.padEnd(8)}] veg:${r.containsVeg ? 'Y' : 'N'} ${String(r.vegWeightG).padStart(4)}g  ${r.title}`);
  }
  console.log('\n--- Sample NULL (ambiguous, czeka na GPT) — first 15 ---');
  for (const r of results.filter((x) => x.newCompleteness === null).slice(0, 15)) {
    console.log(`  [${r.mealType.padEnd(18)}] (${r.reason})  ${r.title}`);
  }

  if (!APPLY) {
    console.log('\n(dry-run — pass --apply to write)\n');
    return;
  }

  // ─── Apply ──────────────────────────────────────────────────────────────
  console.log('\nApplying writes...');
  let written = 0;
  // Update in transactions of 100 for safety + speed
  const BATCH = 100;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.recipe.update({
          where: { id: r.id },
          data: {
            dishCompleteness: r.newCompleteness ?? undefined, // null skipped (stays null in DB)
            containsVegetableServing: r.containsVeg,
            vegetableWeightG: r.vegWeightG,
          },
        }),
      ),
    );
    written += batch.length;
    if (written % 500 === 0 || written === results.length) {
      console.log(`  Updated ${written}/${results.length}...`);
    }
  }
  console.log(`\nDone. Updated ${written} recipes.\n`);
}

main()
  .catch((err) => { console.error('FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
