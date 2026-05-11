/**
 * Bulk recompute RecipeNutritionSnapshots.
 *
 * Modes:
 *   --broken    Recompute only recipes with kcal=0 or protein=0
 *   --missing-micro  Recompute recipes where iron_mg is null (may gain micro data if products were updated)
 *   --all       Recompute ALL recipes
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/recompute-nutrition-snapshots.ts --broken
 */
import { PrismaClient } from '@prisma/client';
import { computeNutritionSnapshot } from '../src/import/nutrition-snapshot';

const prisma = new PrismaClient();

const BATCH_SIZE = 50;

async function recomputeBroken() {
  const recipes = await prisma.recipe.findMany({
    where: {
      nutritionSnapshot: {
        OR: [
          { kcal: { lte: 0 } },
          { protein_g: { lte: 0 } },
        ],
      },
    },
    select: { id: true, title: true },
  });
  return recipes;
}

async function recomputeMissingMicro() {
  const recipes = await prisma.recipe.findMany({
    where: {
      nutritionSnapshot: { iron_mg: null },
    },
    select: { id: true, title: true },
  });
  return recipes;
}

async function recomputeAll() {
  const recipes = await prisma.recipe.findMany({
    select: { id: true, title: true },
  });
  return recipes;
}

async function main() {
  const mode = process.argv[2] || '--broken';

  let recipes: { id: string; title: string }[];

  switch (mode) {
    case '--broken':
      recipes = await recomputeBroken();
      console.log(`Mode: broken — ${recipes.length} recipes with kcal≤0 or protein≤0`);
      break;
    case '--missing-micro':
      recipes = await recomputeMissingMicro();
      console.log(`Mode: missing-micro — ${recipes.length} recipes with iron_mg=null`);
      break;
    case '--all':
      recipes = await recomputeAll();
      console.log(`Mode: all — ${recipes.length} recipes`);
      break;
    default:
      console.error('Unknown mode. Use --broken, --missing-micro, or --all');
      process.exit(1);
  }

  let success = 0;
  let failed = 0;
  let improved = 0;

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (recipe) => {
        try {
          // Get old snapshot for comparison
          const old = await prisma.recipeNutritionSnapshot.findUnique({
            where: { recipeId: recipe.id },
            select: { kcal: true, iron_mg: true },
          });

          await computeNutritionSnapshot(recipe.id);

          // Check if improved
          const updated = await prisma.recipeNutritionSnapshot.findUnique({
            where: { recipeId: recipe.id },
            select: { kcal: true, iron_mg: true },
          });

          const wasImproved =
            (Number(old?.kcal ?? 0) === 0 && Number(updated?.kcal ?? 0) > 0) ||
            (old?.iron_mg === null && updated?.iron_mg !== null);

          if (wasImproved) improved++;
          success++;
        } catch (err) {
          failed++;
          console.error(`  FAIL: ${recipe.title} — ${(err as Error).message}`);
        }
      }),
    );

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, recipes.length)}/${recipes.length} (improved: ${improved})`);
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}, Improved: ${improved}`);

  // Final stats
  const zeroKcal = await prisma.recipeNutritionSnapshot.count({ where: { kcal: { lte: 0 } } });
  const nullIron = await prisma.recipeNutritionSnapshot.count({ where: { iron_mg: null } });
  console.log(`Remaining: kcal≤0 = ${zeroKcal}, iron_mg=null = ${nullIron}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
