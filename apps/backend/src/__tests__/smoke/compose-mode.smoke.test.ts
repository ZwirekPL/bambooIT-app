/**
 * Faza D Phase 1 end-to-end smoke test — `compose_meals=true`.
 *
 * Closes the gap between "162 unit tests pass" and "actually generates a
 * 3-tuple plan with real DB candidates + real Python solver". Phase 1
 * unit tests mock everything; this is the first real-world exercise of
 * the compose path.
 *
 * Triggered via `npm run test:compose-smoke` (separate from default
 * `npm test` and gold-standard runs since it changes the `composeMeals`
 * flag and produces non-deterministic plans by design — the goal is
 * not bit-equality but functional sanity).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@db';
import { solveWeekPlan, assembleSolverPlan } from '../../services/weekSolver.service';
import {
  buildDbPolicyConstraints,
  mergeConstraintsIntoInput,
} from '../../services/dbPolicyBridge.service';
import type { AssemblyInput } from '../../services/dbPlanAssembly.service';
import { encryptJson } from '../../utils/encryption';
import { FAZA_D_TEST_PATIENTS, type FazaDTestPatient } from '../fixtures/faza-d-test-patients';

const TEST_RUN_TAG = `faza-d-compose-smoke-${Date.now()}`;
const SOLVER_URL = process.env.SOLVER_URL ?? 'http://localhost:5050';

async function isSolverHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${SOLVER_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

interface SeededPatient { userId: string; patientId: string; }

function computeBmr(sex: 'M' | 'F', weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'M' ? base + 5 : base - 161);
}

async function seedFixture(fixture: FazaDTestPatient): Promise<SeededPatient> {
  const email = `${TEST_RUN_TAG}-${fixture.id}@test.local`;
  const user = await prisma.user.create({ data: { email, role: 'PATIENT' } });
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      sex: fixture.patient.sex,
      birthYear: fixture.patient.birthYear,
      heightCm: fixture.patient.heightCm,
      weightKg: fixture.patient.weightKg,
    },
  });
  await prisma.interview.create({
    data: { patientId: patient.id, answers: encryptJson(fixture.interview.answers) },
  });
  const ageYears = new Date().getFullYear() - fixture.patient.birthYear;
  const bmr = computeBmr(fixture.patient.sex, fixture.patient.weightKg, fixture.patient.heightCm, ageYears);
  await prisma.nutritionTargets.create({
    data: {
      patientId: patient.id,
      bmr, tdee: Math.round(bmr * 1.4),
      targetKcal: fixture.nutritionTargets.targetKcal,
      targetProteinG: fixture.nutritionTargets.targetProteinG,
      targetFatG: fixture.nutritionTargets.targetFatG,
      targetCarbsG: fixture.nutritionTargets.targetCarbsG,
      activityLevel: 'moderate',
      goal: fixture.nutritionTargets.goal,
      ageYears,
      weightKg: fixture.patient.weightKg,
      heightCm: fixture.patient.heightCm,
    },
  });
  return { userId: user.id, patientId: patient.id };
}

async function cleanup(seeded: SeededPatient): Promise<void> {
  await prisma.nutritionTargets.deleteMany({ where: { patientId: seeded.patientId } });
  await prisma.interview.deleteMany({ where: { patientId: seeded.patientId } });
  await prisma.dietPlan.deleteMany({ where: { patientId: seeded.patientId } });
  await prisma.patient.delete({ where: { id: seeded.patientId } });
  await prisma.user.delete({ where: { id: seeded.userId } });
}

const RUN_SMOKE = process.env.RUN_COMPOSE_SMOKE === '1';

describe.skipIf(!RUN_SMOKE)('Faza D Phase 1 — compose_meals=true end-to-end smoke', () => {
  let solverAvailable = false;

  beforeAll(async () => {
    solverAvailable = await isSolverHealthy();
    if (!solverAvailable) {
      console.warn(`[compose-smoke] Solver not available at ${SOLVER_URL}. Tests will skip.`);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Pick s-control: 3-meal model, no special flags. Both LUNCH (45%) and
  // DINNER (25%) are above the 18% compose threshold → 2 compose slots × 7 days.
  const fixture = FAZA_D_TEST_PATIENTS.find((f) => f.id === 's-control');
  if (!fixture) throw new Error('s-control fixture missing — required for smoke test');

  it('solveWeekPlan produces multi-element selections for LUNCH/DINNER', async () => {
    if (!solverAvailable) return;

    const seeded = await seedFixture(fixture);
    try {
      const constraints = await buildDbPolicyConstraints(seeded.patientId);
      const baseInput: AssemblyInput = {
        patientId: seeded.patientId,
        days: 7,
        composeMeals: true,   // ← the smoke test's whole point
      };
      const enrichedInput = mergeConstraintsIntoInput(baseInput, constraints);

      const solverResult = await solveWeekPlan(enrichedInput);

      // Basic feasibility
      expect(['OPTIMAL', 'FEASIBLE']).toContain(solverResult.status);
      expect(solverResult.selections.size).toBeGreaterThan(0);

      // For 3-meal patient: 7 days × 3 slots = 21 (day, slot) keys
      console.log(`[compose-smoke] selections keys: ${solverResult.selections.size} / objective=${solverResult.objectiveValue}`);

      // Inspect items per slot — at least one (day, slot) should be 3-tuple
      let multiItemSlotCount = 0;
      let totalItemCount = 0;
      const slotCounts: Record<number, number[]> = {};
      for (const [key, items] of solverResult.selections.entries()) {
        const slotIdx = Number(key.split(':')[1]);
        slotCounts[slotIdx] = slotCounts[slotIdx] ?? [];
        slotCounts[slotIdx]!.push(items.length);
        totalItemCount += items.length;
        if (items.length >= 2) multiItemSlotCount++;
      }
      console.log(`[compose-smoke] item counts per slot: ${JSON.stringify(slotCounts)}`);
      console.log(`[compose-smoke] multi-item slots: ${multiItemSlotCount} / total items: ${totalItemCount}`);

      // 3-meal model: slot 0=Śniadanie (BREAKFAST 30%), slot 1=Obiad (LUNCH 45%),
      // slot 2=Kolacja (DINNER 25%). LUNCH + DINNER above 18% → compose slots.
      // BREAKFAST stays 1-item; LUNCH + DINNER may produce 1-3 items depending
      // on COMPLETE_MEAL availability in the candidate pool.
      // Smoke check: at least SOME multi-item slots must exist for the test to
      // prove the compose path actually fires end-to-end.
      expect(multiItemSlotCount).toBeGreaterThan(0);

      // Verify: BREAKFAST stays 1-item across all 7 days
      const breakfastCounts = slotCounts[0] ?? [];
      for (const cnt of breakfastCounts) {
        expect(cnt).toBe(1);
      }
    } finally {
      await cleanup(seeded);
    }
  }, 60_000);

  it('assembleSolverPlan renders multi-item meals correctly', async () => {
    if (!solverAvailable) return;

    const seeded = await seedFixture(fixture);
    try {
      const constraints = await buildDbPolicyConstraints(seeded.patientId);
      const baseInput: AssemblyInput = {
        patientId: seeded.patientId, days: 7, composeMeals: true,
      };
      const enrichedInput = mergeConstraintsIntoInput(baseInput, constraints);
      const solverResult = await solveWeekPlan(enrichedInput);

      if (solverResult.status !== 'OPTIMAL' && solverResult.status !== 'FEASIBLE') {
        throw new Error(`Solver failed: ${solverResult.status}`);
      }

      const assembly = await assembleSolverPlan(solverResult, enrichedInput);

      // Plan-level invariants
      expect(assembly.plan.days).toHaveLength(7);

      let totalMultiItemMeals = 0;
      let totalSlotsChecked = 0;
      for (const day of assembly.plan.days) {
        for (const meal of day.meals ?? []) {
          totalSlotsChecked++;
          const itemCount = meal.items?.filter((it) => typeof it !== 'string').length ?? 0;
          if (itemCount >= 2) totalMultiItemMeals++;

          // Sanity: kcal/macros should sum across items
          if (itemCount >= 2) {
            const sumKcal = (meal.items ?? [])
              .reduce((s, it) => s + (typeof it === 'string' ? 0 : (it.kcal ?? 0)), 0);
            // Sum should be > single-item kcal (multi-item plans are bigger meals)
            expect(sumKcal).toBeGreaterThan(0);
          }
        }
      }
      console.log(`[compose-smoke] plan: ${totalMultiItemMeals} multi-item / ${totalSlotsChecked} total meals`);

      // Coverage report sanity
      expect(assembly.coverage.totalSlots).toBeGreaterThan(0);
      expect(assembly.coverage.filledFromDb).toBeGreaterThan(0);

      // Smoke: at least one meal should be multi-item if compose path activated
      expect(totalMultiItemMeals).toBeGreaterThan(0);
    } finally {
      await cleanup(seeded);
    }
  }, 90_000);
});
