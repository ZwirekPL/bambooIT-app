/**
 * Reclassify recipes with category='other' based on their mealType enum.
 * Run: npx ts-node --esm scripts/fix-other-categories.ts
 */
import { prisma } from '../packages/database/dist/index.js';

const MEAL_TYPE_TO_CATEGORY: Record<string, string> = {
  BREAKFAST: 'breakfast',
  SECOND_BREAKFAST: 'snack',
  LUNCH: 'main',
  DINNER: 'main',
  SUPPER: 'main',
  SNACK: 'snack',
  DESSERT: 'dessert',
  DRINK: 'drink',
  SAUCE: 'side_dish',
  SIDE_DISH: 'side_dish',
};

async function main() {
  const others = await prisma.recipe.findMany({
    where: { category: 'other', isActive: true },
    select: { id: true, mealType: true, title: true },
  });

  console.log(`Przepisy z category='other': ${others.length}`);

  const stats = new Map<string, number>();

  for (const r of others) {
    const newCat = MEAL_TYPE_TO_CATEGORY[r.mealType] ?? 'other';
    stats.set(newCat, (stats.get(newCat) ?? 0) + 1);
    if (newCat !== 'other') {
      await prisma.recipe.update({
        where: { id: r.id },
        data: { category: newCat },
      });
    }
  }

  console.log('\nReklasyfikacja:');
  for (const [cat, count] of [...stats.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Final distribution
  const dist = await prisma.recipe.groupBy({
    by: ['category'],
    where: { isActive: true },
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });
  console.log('\nKońcowy rozkład kategorii:');
  for (const r of dist) {
    console.log(`  ${r.category ?? '(null)'}: ${r._count}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
