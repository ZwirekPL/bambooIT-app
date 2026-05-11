/**
 * Faza D Phase 0 Task #10 — extract full Interview.answers + Patient + NutritionTargets
 * for the 3 selected dev DB patients to bake into test fixtures.
 *
 * Run: cd apps/backend && npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/faza-d-extract-real.ts
 */

import { prisma } from '@db';
import { decryptJson } from '../src/utils/encryption';

const SELECTED_IDS = [
  // Find the 3 patients whose IDs end with these short hashes
  'ime9bykx',  // r-hypertension-dash (M/50, hypertension+DASH, 4 meals)
  'fv8bl8k5',  // r-multi-condition (T1 diabetes+NAFLD+shellfish, 5 meals)
  'gpnq42sc',  // r-3-meals (29yo M, 3 meals + 4 disliked)
];

async function main() {
  for (const shortId of SELECTED_IDS) {
    const patients = await prisma.patient.findMany({
      where: { id: { endsWith: shortId } },
      include: {
        interviews: { orderBy: { createdAt: 'desc' }, take: 1 },
        nutritionTargets: true,
      },
    });

    if (patients.length === 0) {
      console.log(`\n=== ${shortId}: NOT FOUND ===`);
      continue;
    }
    const p = patients[0];
    if (p.interviews.length === 0) {
      console.log(`\n=== ${shortId}: no interview ===`);
      continue;
    }

    const answers = decryptJson(p.interviews[0].answers) as Record<string, unknown>;

    console.log(`\n=== ${shortId} (full ID: ${p.id}) ===`);
    console.log(`Patient: sex=${p.sex} birthYear=${p.birthYear} birthDate=${p.birthDate?.toISOString()} weightKg=${p.weightKg} heightCm=${p.heightCm}`);
    console.log(`NutritionTargets: kcal=${p.nutritionTargets?.targetKcal} P=${p.nutritionTargets?.targetProteinG}g F=${p.nutritionTargets?.targetFatG}g C=${p.nutritionTargets?.targetCarbsG}g goal=${p.nutritionTargets?.goal}`);
    console.log(`Interview.answers (decrypted):`);
    console.log(JSON.stringify(answers, null, 2));
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
