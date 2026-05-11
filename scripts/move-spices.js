const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find products with "przyprawa" or "przyprawy" in name
  const spiceProducts = await p.cleanProduct.findMany({
    where: {
      OR: [
        { name: { contains: 'przyprawa', mode: 'insensitive' } },
        { name: { contains: 'przyprawy', mode: 'insensitive' } },
        { name: { contains: 'przypraw ', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, category: true },
  });

  console.log(`Found ${spiceProducts.length} spice products:`);
  spiceProducts.forEach((s) => console.log(`  [${s.category}] ${s.name}`));

  if (spiceProducts.length > 0) {
    const ids = spiceProducts.map((s) => s.id);
    const result = await p.cleanProduct.updateMany({
      where: { id: { in: ids } },
      data: { category: 'przyprawy' },
    });
    console.log(`\nMoved ${result.count} products to 'przyprawy' category`);
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
