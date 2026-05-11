import 'dotenv/config';
import { prisma } from '@db';
import { solveWeekPlan } from '../src/services/weekSolver.service';

async function main() {
  const patient = await prisma.patient.findFirst({
    where: { nutritionTargets: { isNot: null } },
    select: { id: true },
  });

  if (!patient) {
    console.log('No patient with NutritionTargets found');
    await prisma.$disconnect();
    return;
  }

  console.log(`Patient: ${patient.id}`);
  console.log('Solving 7 days with 10 candidates per slot...\n');

  const t0 = Date.now();
  const result = await solveWeekPlan({ patientId: patient.id, days: 7 });
  const totalMs = Date.now() - t0;

  console.log(`Status: ${result.status}`);
  console.log(`Variables: ${result.totalVariables}`);
  console.log(`Constraints: ${result.totalConstraints}`);
  console.log(`Objective: ${result.objectiveValue}`);
  console.log(`Solver duration: ${result.durationMs}ms`);
  console.log(`Total (incl. queries): ${totalMs}ms`);
  console.log(`Selections: ${result.selections.size}`);

  if (result.selections.size > 0) {
    console.log('\nSelected recipes:');
    for (const [key, recipe] of result.selections) {
      console.log(`  ${key}: ${recipe.title} (score: ${recipe.totalScore})`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  prisma.$disconnect();
});
