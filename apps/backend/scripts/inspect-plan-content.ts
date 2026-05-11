/**
 * Decrypt a plan's content and report whether recipe/steps/ingredients are present.
 * Used for diagnosing prod "brak przepisów przy potrawach" issue.
 *
 * Usage (in prod backend container):
 *   docker compose -f docker-compose.prod.yml exec -T backend \
 *     node dist/scripts/inspect-plan-content.js <planId>
 *
 * Or locally:
 *   cd apps/backend
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register \
 *     scripts/inspect-plan-content.ts <planId>
 */

import 'dotenv/config';
import { prisma } from '@db';
import { decryptJson } from '../src/utils/encryption';

async function main(): Promise<void> {
  const planId = process.argv[2];
  if (!planId) {
    console.error('Usage: inspect-plan-content.ts <planId>');
    process.exit(1);
  }

  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    select: {
      id: true, createdAt: true, aiModel: true, source: true,
      content: true,
    },
  });
  if (!plan) {
    console.error(`Plan ${planId} not found`);
    process.exit(1);
  }

  const decrypted = decryptJson(plan.content as unknown as string) as {
    days?: Array<{
      day: string;
      meals?: Array<{
        name?: string;
        items?: Array<{
          name?: string;
          ingredients?: unknown;
        }>;
        recipe?: {
          steps?: unknown;
          prepTimeMin?: number;
        };
      }>;
    }>;
  };

  const days = decrypted.days ?? [];
  const dayCount = days.length;
  let mealCount = 0;
  let mealsWithRecipe = 0;
  let mealsWithSteps = 0;
  let mealsWithIngredients = 0;

  for (const day of days) {
    for (const meal of day.meals ?? []) {
      mealCount++;
      if (meal.recipe) mealsWithRecipe++;
      if (Array.isArray(meal.recipe?.steps) && meal.recipe.steps.length > 0) {
        mealsWithSteps++;
      }
      for (const item of meal.items ?? []) {
        if (Array.isArray(item.ingredients) && item.ingredients.length > 0) {
          mealsWithIngredients++;
          break;
        }
      }
    }
  }

  console.log(`Plan ${plan.id}`);
  console.log(`  created:  ${plan.createdAt.toISOString()}`);
  console.log(`  source:   ${plan.source}`);
  console.log(`  aiModel:  ${plan.aiModel}`);
  console.log(`  days:     ${dayCount}`);
  console.log(`  meals:    ${mealCount}`);
  console.log(`  with recipe field:     ${mealsWithRecipe}/${mealCount}`);
  console.log(`  with recipe.steps[]:   ${mealsWithSteps}/${mealCount}`);
  console.log(`  with items.ingredients[]: ${mealsWithIngredients}/${mealCount}`);

  // Sample first meal structure
  const firstMeal = days[0]?.meals?.[0];
  if (firstMeal) {
    console.log(`\nFirst meal structure (keys only):`);
    console.log(`  meal.keys:  ${Object.keys(firstMeal).join(', ')}`);
    if (firstMeal.recipe) {
      console.log(`  recipe.keys: ${Object.keys(firstMeal.recipe).join(', ')}`);
      console.log(`  recipe.steps (if present, first 2): ${JSON.stringify((firstMeal.recipe.steps as unknown[] | undefined)?.slice(0, 2))}`);
    }
    const firstItem = firstMeal.items?.[0];
    if (firstItem) {
      console.log(`  item.keys:  ${Object.keys(firstItem).join(', ')}`);
      console.log(`  item.ingredients (if present, first 2): ${JSON.stringify((firstItem.ingredients as unknown[] | undefined)?.slice(0, 2))}`);
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
