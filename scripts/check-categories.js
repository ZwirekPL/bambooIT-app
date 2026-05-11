const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const izaCount = await p.cleanProduct.count({ where: { category: 'wykonane-przez-izabele' } });
  console.log('wykonane-przez-izabele count:', izaCount);

  const izaSamples = await p.cleanProduct.findMany({
    where: { category: 'wykonane-przez-izabele' },
    take: 10,
    select: { name: true }
  });
  console.log('samples:', izaSamples.map(x => x.name));

  const spices = await p.cleanProduct.findMany({
    where: {
      OR: [
        { name: { contains: 'sól', mode: 'insensitive' } },
        { name: { contains: 'pieprz', mode: 'insensitive' } },
        { name: { contains: 'oregano', mode: 'insensitive' } },
        { name: { contains: 'cynamon', mode: 'insensitive' } },
        { name: { contains: 'kurkuma', mode: 'insensitive' } },
        { name: { contains: 'przypraw', mode: 'insensitive' } },
        { name: { contains: 'tymianek', mode: 'insensitive' } },
        { name: { contains: 'kminek', mode: 'insensitive' } },
      ]
    },
    take: 50,
    select: { name: true, category: true }
  });
  console.log('\nSpice-related products:');
  spices.forEach(s => console.log(' ', s.category, '|', s.name));

  const cats = await p.cleanProduct.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' }
  });
  console.log('\nAll categories:', cats.map(c => c.category));

  await p.$disconnect();
}

main();
