import 'dotenv/config';
import { prisma } from '@db';

async function main() {
  const types = await prisma.recipe.groupBy({
    by: ['mealType'],
    _count: true,
    where: { isActive: true, source: { in: ['imported', 'manual'] } },
    orderBy: { _count: { mealType: 'desc' } },
  });
  console.log('Recipe mealTypes:');
  types.forEach((t) => console.log(`  ${t.mealType}: ${t._count}`));

  // Check what mealDistribution returns for this patient
  const { loadPatientMealDistribution, computeMealDistribution } = await import('../src/services/mealDistribution.service');
  const patient = await prisma.patient.findFirst({ where: { nutritionTargets: { isNot: null } }, select: { id: true } });
  if (patient) {
    const distInput = await loadPatientMealDistribution(patient.id);
    const dist = computeMealDistribution(distInput);
    console.log('\nMeal slots for patient:');
    dist.slots.forEach((s) => console.log(`  ${s.mealType}: ${s.targetKcal} kcal`));
  }

  await prisma.$disconnect();
}

main();
