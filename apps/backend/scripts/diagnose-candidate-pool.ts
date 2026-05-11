import 'dotenv/config';
import { prisma, Prisma } from '@db';
import {
  loadPatientMealDistribution,
  computeMealDistribution,
} from '../src/services/mealDistribution.service';
import { buildDbPolicyConstraints, mergeConstraintsIntoInput } from '../src/services/dbPolicyBridge.service';
import type { AssemblyInput } from '../src/services/dbPlanAssembly.service';
import { findCandidates } from '../src/services/recipeCandidate.service';

const PATIENT_ID = process.argv[2] ?? 'cmmru5qis0006uyjc499c4dkk';

async function countWithFilters(where: unknown): Promise<number> {
  return prisma.recipe.count({ where: where as Prisma.RecipeWhereInput });
}

async function main() {
  const patient = await prisma.patient.findUnique({
    where: { id: PATIENT_ID },
    select: { id: true, userId: true, dietitianId: true },
  });
  if (!patient) {
    console.log(`Patient ${PATIENT_ID} not found`);
    return;
  }

  console.log(`━━━ Patient: ${patient.id} ━━━`);

  // Build pipeline input the same way planPipeline does
  const dbConstraints = await buildDbPolicyConstraints(PATIENT_ID);
  console.log('\n━━━ Policy constraints ━━━');
  console.log(`excludeAllergens: ${JSON.stringify(dbConstraints.excludeAllergens)}`);
  console.log(`requiredDietFlags: ${JSON.stringify(dbConstraints.requiredDietFlags)}`);
  console.log(`appliedRules (${dbConstraints.appliedRulesCount}): ${dbConstraints.appliedRuleNames.slice(0, 10).join(', ')}`);

  const assemblyInput: AssemblyInput = mergeConstraintsIntoInput({
    patientId: PATIENT_ID,
    dietitianId: patient.dietitianId ?? undefined,
    days: 7,
  }, dbConstraints);

  console.log(`\nconditionFlags: ${JSON.stringify(assemblyInput.conditionFlags ?? [])}`);
  console.log(`maxCookingTimeMinutes: ${assemblyInput.maxCookingTimeMinutes ?? '-'}`);
  console.log(`maxCost: ${assemblyInput.maxCost ?? '-'}`);
  console.log(`excludeHighFodmap → from ibs flag: ${assemblyInput.conditionFlags?.includes('ibs') ?? false}`);
  console.log(`cuisinePreferences: ${JSON.stringify(assemblyInput.cuisinePreferences ?? [])}`);
  console.log(`excludeKeywords: ${JSON.stringify((assemblyInput as { excludeKeywords?: string[] }).excludeKeywords ?? [])}`);
  console.log(`composeMeals: ${(assemblyInput as { composeMeals?: boolean }).composeMeals ?? false}`);

  // Meal distribution
  const distInput = await loadPatientMealDistribution(PATIENT_ID);
  const distribution = computeMealDistribution(distInput);

  console.log(`\n━━━ Daily targets ━━━`);
  console.log(`kcal=${distribution.totalKcal} protein=${distribution.totalProteinG}g fat=${distribution.totalFatG}g carbs=${distribution.totalCarbsG}g`);

  console.log(`\n━━━ Slots (${distribution.slots.length}) ━━━`);
  for (const slot of distribution.slots) {
    console.log(`  [${slot.slotIndex}] ${slot.mealType}: target_kcal=${Math.round(slot.targetKcal)} protein=${Math.round(slot.targetProteinG)}g`);
  }

  // For each slot, measure pool size at every filter layer
  for (const slot of distribution.slots) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`SLOT [${slot.slotIndex}] ${slot.mealType} — target ${Math.round(slot.targetKcal)} kcal`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Layer 1: active + trusted + mealType
    const base: Record<string, unknown> = {
      isActive: true,
      source: { in: ['imported', 'manual'] },
      mealType: slot.mealType,
    };
    const c1 = await countWithFilters(base);
    console.log(`  L1 active+trusted+mealType=${slot.mealType}:            ${c1}`);

    // Layer 2: + has nutritionSnapshot with kcal>0
    const withSnap = { ...base, nutritionSnapshot: { is: { kcal: { gt: 0 } } } };
    const c2 = await countWithFilters(withSnap);
    console.log(`  L2 + has nutritionSnapshot (kcal>0):                    ${c2}`);

    // Layer 3: + allergens
    let withAllergens: Record<string, unknown> = withSnap;
    if (assemblyInput.excludeAllergens?.length) {
      withAllergens = {
        ...withSnap,
        allergens: {
          none: { allergenCode: { in: assemblyInput.excludeAllergens }, presence: 'CONTAINS' },
        },
      };
    }
    const c3 = await countWithFilters(withAllergens);
    console.log(`  L3 + excludeAllergens (${assemblyInput.excludeAllergens?.length ?? 0} flags):                      ${c3}`);

    // Layer 4: + requiredDietFlags (each = true)
    let withFlags: Record<string, unknown> = withAllergens;
    if (assemblyInput.requiredDietFlags?.length) {
      const flagConds = assemblyInput.requiredDietFlags.map((flagCode) => ({
        dietFlags: { some: { flagCode, value: true } },
      }));
      withFlags = { ...withAllergens, AND: flagConds };
    }
    const c4 = await countWithFilters(withFlags);
    console.log(`  L4 + requiredDietFlags (${assemblyInput.requiredDietFlags?.length ?? 0} flags):                     ${c4}`);

    // Layer 5: + maxCookingTime
    let withTime: Record<string, unknown> = withFlags;
    if (assemblyInput.maxCookingTimeMinutes != null) {
      const timeCond = {
        OR: [{ totalTimeMinutes: { lte: assemblyInput.maxCookingTimeMinutes } }, { totalTimeMinutes: null }],
      };
      const existingAnd = (withFlags.AND as unknown[] | undefined) ?? [];
      withTime = { ...withFlags, AND: [...existingAnd, timeCond] };
    }
    const c5 = await countWithFilters(withTime);
    console.log(`  L5 + maxCookingTime (${assemblyInput.maxCookingTimeMinutes ?? '∞'}):                            ${c5}`);

    // Now run the real findCandidates to see what comes out (incl. FODMAP post-filter)
    const baseFindArgs = {
      mealType: slot.mealType,
      targetKcal: slot.targetKcal,
      targetProteinG: slot.targetProteinG,
      targetFatG: slot.targetFatG,
      targetCarbsG: slot.targetCarbsG,
      excludeAllergens: assemblyInput.excludeAllergens,
      requiredDietFlags: assemblyInput.requiredDietFlags,
      maxTotalTimeMinutes: assemblyInput.maxCookingTimeMinutes,
      maxCost: assemblyInput.maxCost,
      excludeHighFodmap: assemblyInput.conditionFlags?.includes('ibs') ?? false,
      limit: 25,
      season: new Date().getMonth() + 1,
    } as const;
    const candsBase = await findCandidates(baseFindArgs);
    console.log(`  >> findCandidates() WITHOUT cuisine filter: ${candsBase.length}`);

    // The actual weekSolver call — adds cuisinePreferences (Faza D D1 hard filter)
    const candsFull = await findCandidates({
      ...baseFindArgs,
      cuisinePreferences: assemblyInput.cuisinePreferences,
    });
    console.log(`  >> findCandidates() WITH cuisine filter: ${candsFull.length}` +
      (candsBase.length > 0 && candsFull.length === 0 ? '   ← CUISINE FILTER WIPES POOL' : ''));

    const cands = candsFull;

    // Apply solver's post-filter kcal ±40%
    const kcalFiltered = cands.filter((c) => {
      return slot.targetKcal === 0 || Math.abs(c.scaledKcal - slot.targetKcal) / slot.targetKcal <= 0.40;
    });
    console.log(`  >> after solver kcal ±40% pre-filter: ${kcalFiltered.length}  ${kcalFiltered.length < 7 ? '  ← TOO FEW (needs ≥7)' : ''}`);

    if (cands.length > 0 && cands.length <= 10) {
      console.log(`  Candidates (scaledKcal, title):`);
      for (const c of cands.slice(0, 10)) {
        const dev = slot.targetKcal > 0 ? ((c.scaledKcal - slot.targetKcal) / slot.targetKcal * 100).toFixed(0) : '0';
        console.log(`    - ${Math.round(c.scaledKcal).toString().padStart(4)} kcal (${dev}%) ${c.title}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  prisma.$disconnect();
});
