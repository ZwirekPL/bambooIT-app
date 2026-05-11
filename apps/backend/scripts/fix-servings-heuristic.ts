/**
 * Fix Recipe.servings using heuristic: compute from total ingredient kcal.
 * Targets recipes where kcal/serving is <80 or >1200 (clearly wrong servings).
 *
 * Logic: newServings = ROUND(totalKcal / targetKcalPerServing)
 * where targetKcalPerServing = 400 (average meal)
 *
 * Usage:
 *   DRY RUN:  npx ts-node -r tsconfig-paths/register scripts/fix-servings-heuristic.ts
 *   APPLY:    npx ts-node -r tsconfig-paths/register scripts/fix-servings-heuristic.ts --apply
 */

import { prisma, Prisma } from '@db';
import { computeNutritionSnapshot } from '../src/import/nutrition-snapshot';

const DRY_RUN = !process.argv.includes('--apply');
const TARGET_KCAL_PER_SERVING = 400;
const MIN_KCAL_PER_SERVING = 80;
const MAX_KCAL_PER_SERVING = 1200;

function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== APPLYING ===');

  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      servings: true,
      nutritionSnapshot: { select: { kcal: true } },
      ingredients: {
        select: {
          grams: true,
          cleanProduct: { select: { nutrients: { select: { kcalPer100g: true } } } },
        },
      },
    },
  });

  let fixed = 0;
  let skipped = 0;
  let deactivated = 0;

  for (const r of recipes) {
    const snapKcal = r.nutritionSnapshot ? toNum(r.nutritionSnapshot.kcal) : 0;
    const kcalPerServing = snapKcal;

    // Skip if already reasonable
    if (kcalPerServing >= MIN_KCAL_PER_SERVING && kcalPerServing <= MAX_KCAL_PER_SERVING) {
      skipped++;
      continue;
    }

    // Compute total kcal from ingredients
    let totalKcal = 0;
    for (const ing of r.ingredients) {
      const grams = toNum(ing.grams);
      const kcalPer100 = ing.cleanProduct?.nutrients ? toNum(ing.cleanProduct.nutrients.kcalPer100g) : 0;
      totalKcal += grams * kcalPer100 / 100;
    }

    if (totalKcal < 50) {
      // Recipe has no meaningful nutrition data — deactivate
      if (!DRY_RUN) {
        await prisma.recipe.update({ where: { id: r.id }, data: { isActive: false } });
      }
      deactivated++;
      continue;
    }

    const newServings = Math.max(1, Math.round(totalKcal / TARGET_KCAL_PER_SERVING));

    if (newServings === r.servings) {
      skipped++;
      continue;
    }

    console.log(`  ${r.title}: ${r.servings} → ${newServings} (total ${Math.round(totalKcal)} kcal, was ${Math.round(kcalPerServing)} kcal/s → now ${Math.round(totalKcal / newServings)} kcal/s)`);
    fixed++;

    if (!DRY_RUN) {
      await prisma.recipe.update({ where: { id: r.id }, data: { servings: newServings } });
      await computeNutritionSnapshot(r.id);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Deactivated (no kcal data): ${deactivated}`);
  console.log(`Skipped (already OK): ${skipped}`);
  console.log(DRY_RUN ? '→ Run with --apply to save' : '→ Changes saved');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
