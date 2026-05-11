import { prisma } from '@db';
import { decryptJson } from '../src/utils/encryption';

async function main() {
  const plan = await prisma.dietPlan.findUnique({
    where: { id: 'cmn7pd2e5000fuy8w8yer2wjy' },
    select: { id: true, content: true, status: true, source: true, kcal: true, proteinG: true, fatG: true, carbsG: true }
  });
  if (!plan) { console.log('NOT FOUND'); return; }

  const content = decryptJson(plan.content) as any;

  console.log(`Status: ${plan.status}, Source: ${plan.source}`);
  console.log(`Macros: ${plan.kcal} kcal, B:${plan.proteinG}g, T:${plan.fatG}g, W:${plan.carbsG}g`);
  console.log('---');

  const days = content?.days ?? [];
  for (let d = 0; d < Math.min(days.length, 2); d++) {
    const day = days[d];
    console.log(`\n=== ${day.day} ===`);
    for (const meal of day.meals ?? []) {
      console.log(`\n  ${meal.name}:`);
      for (const item of meal.items ?? []) {
        if (typeof item === 'string') { console.log(`    ${item}`); continue; }
        console.log(`    ${item.name} — ${item.grams}g — (${item.kcal} kcal, B:${item.protein}g, T:${item.fat}g, W:${item.carbs}g)`);
        if (item.ingredients?.length) {
          for (const ing of item.ingredients) {
            console.log(`      - ${ing.name}: ${ing.grams}g`);
          }
        }
      }
    }
  }

  console.log('\n\n=== ALL DAYS SUMMARY ===');
  for (const day of days) {
    let dayKcal = 0;
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        if (typeof item === 'object') dayKcal += item.kcal ?? 0;
      }
    }
    console.log(`${day.day}: ${dayKcal} kcal`);
  }

  await prisma.$disconnect();
}
main();
