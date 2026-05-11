import 'dotenv/config';
import { prisma } from '@db';

async function main() {
  // 1. Global FODMAP distribution in CleanProduct
  const all = await prisma.cleanProduct.groupBy({
    by: ['fodmapLevel'],
    _count: { _all: true },
  });
  console.log('━━━ CleanProduct.fodmapLevel distribution ━━━');
  const total = all.reduce((s, r) => s + r._count._all, 0);
  for (const row of all.sort((a, b) => b._count._all - a._count._all)) {
    const pct = ((row._count._all / total) * 100).toFixed(1);
    console.log(`  ${String(row.fodmapLevel ?? 'NULL').padEnd(10)} ${String(row._count._all).padStart(6)}  ${pct}%`);
  }
  console.log(`  ${'TOTAL'.padEnd(10)} ${String(total).padStart(6)}`);

  // 2. Which HIGH products appear most often in RecipeIngredient (mandatory only)?
  const highProducts = await prisma.cleanProduct.findMany({
    where: { fodmapLevel: 'HIGH' },
    select: { id: true, name: true },
  });
  const highIds = new Set(highProducts.map((p) => p.id));

  const ingredients = await prisma.recipeIngredient.findMany({
    where: {
      cleanProductId: { in: [...highIds] },
      isOptional: false,
    },
    select: { cleanProductId: true, recipeId: true },
  });

  // count usages per product
  const usagePerProduct = new Map<string, number>();
  for (const ing of ingredients) {
    if (!ing.cleanProductId) continue;
    usagePerProduct.set(ing.cleanProductId, (usagePerProduct.get(ing.cleanProductId) ?? 0) + 1);
  }

  const productName = new Map(highProducts.map((p) => [p.id, p.name]));
  const sorted = [...usagePerProduct.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`\n━━━ Top 40 HIGH-FODMAP products by recipe usage (mandatory ingredients only) ━━━`);
  console.log(`(każde wystąpienie wywala cały przepis z puli dla pacjentów IBS)`);
  console.log(`${'uses'.padStart(6)}  product`);
  for (const [id, uses] of sorted.slice(0, 40)) {
    console.log(`  ${String(uses).padStart(4)}  ${productName.get(id) ?? id}`);
  }

  // 3. How many recipes are "poisoned" by at least one HIGH-FODMAP mandatory ingredient?
  const poisonedRecipeIds = new Set(ingredients.map((i) => i.recipeId));
  const totalActiveRecipes = await prisma.recipe.count({
    where: { isActive: true, source: { in: ['imported', 'manual'] } },
  });

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Recipes with ≥1 HIGH-FODMAP mandatory ingredient: ${poisonedRecipeIds.size} / ${totalActiveRecipes}  (${((poisonedRecipeIds.size / totalActiveRecipes) * 100).toFixed(1)}%)`);

  // 4. Per-mealType breakdown
  const byMealType = await prisma.recipe.groupBy({
    by: ['mealType'],
    where: { isActive: true, source: { in: ['imported', 'manual'] } },
    _count: { _all: true },
  });
  console.log(`\n━━━ Per mealType — surviving recipes after FODMAP exclusion ━━━`);
  for (const row of byMealType) {
    const total = row._count._all;
    const poisoned = await prisma.recipe.count({
      where: {
        mealType: row.mealType,
        isActive: true,
        source: { in: ['imported', 'manual'] },
        id: { in: [...poisonedRecipeIds] },
      },
    });
    const surviving = total - poisoned;
    console.log(`  ${String(row.mealType).padEnd(20)} total=${String(total).padStart(4)}  poisoned=${String(poisoned).padStart(4)}  → ${String(surviving).padStart(4)} surviving (${((surviving / total) * 100).toFixed(1)}%)`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  prisma.$disconnect();
});
