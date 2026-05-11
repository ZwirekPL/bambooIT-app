const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const salt = await p.cleanProduct.findMany({
    where: { name: { startsWith: 'sól', mode: 'insensitive' } },
    select: { name: true, category: true },
  });
  console.log('Salt:', salt.length);
  salt.forEach((s) => console.log('  ', s.category, '|', s.name));

  const pepper = await p.cleanProduct.findMany({
    where: { name: { startsWith: 'pieprz', mode: 'insensitive' } },
    select: { name: true, category: true },
  });
  console.log('Pepper:', pepper.length);
  pepper.forEach((s) => console.log('  ', s.category, '|', s.name));

  // Also check current przyprawy category count
  const count = await p.cleanProduct.count({ where: { category: 'przyprawy' } });
  console.log('\nTotal in przyprawy:', count);

  // All categories now
  const cats = await p.cleanProduct.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  console.log('Categories:', cats.map((c) => c.category));

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
