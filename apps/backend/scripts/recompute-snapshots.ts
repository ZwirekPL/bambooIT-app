/**
 * Recompute RecipeNutritionSnapshot for all active recipes.
 * Run after changing Recipe.servings to update per-serving nutrition values.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/recompute-snapshots.ts
 */

import { prisma } from '@db';
import { computeNutritionSnapshot } from '../src/import/nutrition-snapshot';

async function main() {
  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  console.log(`Recomputing snapshots for ${recipes.length} active recipes...`);

  let done = 0;
  let errors = 0;

  for (const r of recipes) {
    try {
      await computeNutritionSnapshot(r.id);
      done++;
    } catch (e) {
      errors++;
      if (errors <= 5) console.log(`  ERROR: ${r.id} — ${(e as Error).message}`);
    }

    if (done % 200 === 0) {
      console.log(`  [${done}/${recipes.length}] done, ${errors} errors`);
    }
  }

  console.log(`\nDone: ${done} updated, ${errors} errors`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
