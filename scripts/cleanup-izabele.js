const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Delete related records first (nutrients, portions, allergens, dietFlags)
  const products = await p.cleanProduct.findMany({
    where: { category: 'wykonane-przez-izabele' },
    select: { id: true, name: true },
  });

  console.log(`Found ${products.length} products to delete`);

  const ids = products.map((pr) => pr.id);

  // Delete relations
  const delNutrients = await p.cleanProductNutrients.deleteMany({ where: { cleanProductId: { in: ids } } });
  console.log(`Deleted ${delNutrients.count} nutrient records`);

  const delPortions = await p.cleanProductPortion.deleteMany({ where: { cleanProductId: { in: ids } } });
  console.log(`Deleted ${delPortions.count} portion records`);

  const delAllergens = await p.cleanProductAllergen.deleteMany({ where: { cleanProductId: { in: ids } } });
  console.log(`Deleted ${delAllergens.count} allergen records`);

  const delFlags = await p.cleanProductDietFlag.deleteMany({ where: { cleanProductId: { in: ids } } });
  console.log(`Deleted ${delFlags.count} diet flag records`);

  // Delete the products themselves
  const delProducts = await p.cleanProduct.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${delProducts.count} products`);

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
