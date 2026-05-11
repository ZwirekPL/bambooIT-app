import 'dotenv/config';
import { prisma } from '@db';
import { findCandidates } from '../src/services/recipeCandidate.service';

async function main() {
  console.log('Testing single candidate query...');
  const t0 = Date.now();

  try {
    const candidates = await findCandidates({
      mealType: 'LUNCH',
      targetKcal: 600,
      targetProteinG: 30,
      targetFatG: 20,
      targetCarbsG: 70,
      limit: 10,
    });

    console.log(`Query time: ${Date.now() - t0}ms`);
    console.log(`Candidates: ${candidates.length}`);
    if (candidates[0]) {
      console.log(`Top: ${candidates[0].title} (score: ${candidates[0].totalScore})`);
    }
  } catch (err) {
    console.error('Error:', (err as Error).message);
  }

  await prisma.$disconnect();
}

main();
