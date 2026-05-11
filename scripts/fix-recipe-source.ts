import { prisma } from '../packages/database/dist/index.js';

async function main() {
  const result = await prisma.recipe.updateMany({
    where: { source: 'generated' },
    data: { source: 'ai_generated' },
  });
  console.log(`Updated ${result.count} recipes: source 'generated' → 'ai_generated'`);

  // Also set verificationStatus to UNVERIFIED and qualityScore to 0 for AI recipes
  const result2 = await prisma.recipe.updateMany({
    where: { source: 'ai_generated', verificationStatus: { not: 'MANUALLY_VERIFIED' } },
    data: { verificationStatus: 'UNVERIFIED', qualityScore: 0 },
  });
  console.log(`Set ${result2.count} AI recipes to UNVERIFIED with qualityScore=0`);

  // Stats
  const stats = await prisma.recipe.groupBy({
    by: ['source'],
    _count: true,
  });
  console.log('Recipe source distribution:');
  for (const s of stats) console.log(`  ${s.source}: ${s._count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
