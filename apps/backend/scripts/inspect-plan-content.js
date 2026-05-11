// Standalone JS diagnostic — runs in prod backend container using compiled modules.
// Usage (in prod container):
//   node /app/inspect-plan-content.js <planId>

/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv/config');

const { prisma } = require('/app/packages/database/dist/index.js');
const { decryptJson } = require('/app/apps/backend/dist/utils/encryption.js');

async function main() {
  const planId = process.argv[2];
  if (!planId) {
    console.error('Usage: node inspect-plan-content.js <planId>');
    process.exit(1);
  }

  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    select: {
      id: true, createdAt: true, aiModel: true, source: true, content: true,
    },
  });
  if (!plan) { console.error(`Plan ${planId} not found`); process.exit(1); }

  const decrypted = decryptJson(plan.content);
  const days = decrypted.days ?? [];
  let mealCount = 0;
  let mealsWithRecipe = 0;
  let mealsWithSteps = 0;
  let mealsWithIngredients = 0;

  for (const day of days) {
    for (const meal of day.meals ?? []) {
      mealCount++;
      if (meal.recipe) mealsWithRecipe++;
      if (Array.isArray(meal.recipe?.steps) && meal.recipe.steps.length > 0) mealsWithSteps++;
      for (const item of meal.items ?? []) {
        if (Array.isArray(item.ingredients) && item.ingredients.length > 0) { mealsWithIngredients++; break; }
      }
    }
  }

  console.log(`Plan ${plan.id}`);
  console.log(`  created:  ${plan.createdAt.toISOString()}`);
  console.log(`  source:   ${plan.source}`);
  console.log(`  aiModel:  ${plan.aiModel}`);
  console.log(`  days:     ${days.length}`);
  console.log(`  meals:    ${mealCount}`);
  console.log(`  with recipe field:       ${mealsWithRecipe}/${mealCount}`);
  console.log(`  with recipe.steps[]:     ${mealsWithSteps}/${mealCount}`);
  console.log(`  with items.ingredients:  ${mealsWithIngredients}/${mealCount}`);

  const firstMeal = days[0]?.meals?.[0];
  if (firstMeal) {
    console.log(`\nFirst meal structure:`);
    console.log(`  meal.keys: ${Object.keys(firstMeal).join(', ')}`);
    if (firstMeal.recipe) {
      console.log(`  recipe.keys: ${Object.keys(firstMeal.recipe).join(', ')}`);
      const steps = firstMeal.recipe.steps;
      if (Array.isArray(steps)) {
        console.log(`  recipe.steps.length: ${steps.length}`);
        console.log(`  recipe.steps[0-1]: ${JSON.stringify(steps.slice(0, 2))}`);
      }
    }
    const firstItem = firstMeal.items?.[0];
    if (firstItem) {
      console.log(`  item.keys: ${Object.keys(firstItem).join(', ')}`);
      const ings = firstItem.ingredients;
      if (Array.isArray(ings)) {
        console.log(`  item.ingredients.length: ${ings.length}`);
        console.log(`  item.ingredients[0-2]: ${JSON.stringify(ings.slice(0, 2))}`);
      }
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
