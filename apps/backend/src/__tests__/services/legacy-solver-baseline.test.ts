/**
 * Faza D Phase 0 Task #1 — Gold Standard Snapshots.
 *
 * For each of 11 test patient fixtures, seeds a Patient + Interview +
 * NutritionTargets in the dev DB, runs the full assembly pipeline (with
 * deterministic seed via SOLVER_SEED env var), snapshots the resulting plan,
 * then cleans up.
 *
 * Post-Faza-D refactor with `compose_meals=false` MUST produce identical
 * snapshots. Any diff = unintended regression.
 *
 * Run:
 *   docker compose up -d   # postgres + solver must be running
 *   cd apps/backend
 *   npm run test:goldstandard
 *
 * Excluded from default `npm test` because:
 *   1. Hits real DB (requires docker compose up)
 *   2. Hits real Python solver via HTTP
 *   3. ~30-90s total runtime
 *
 * Snapshot file: src/__tests__/services/__snapshots__/legacy-solver-baseline.test.ts.snap
 * This file is the gold standard reference — committed to git.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@db';
import { assembleDbPlan, type AssemblyInput } from '../../services/dbPlanAssembly.service';
import { buildDbPolicyConstraints, mergeConstraintsIntoInput } from '../../services/dbPolicyBridge.service';
import { encryptJson } from '../../utils/encryption';
import { FAZA_D_TEST_PATIENTS, type FazaDTestPatient } from '../fixtures/faza-d-test-patients';

const TEST_RUN_TAG = `faza-d-baseline-${Date.now()}`;

// ─── Solver availability check ───────────────────────────────────────────────

const SOLVER_URL = process.env.SOLVER_URL ?? 'http://localhost:5050';

async function isSolverHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${SOLVER_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Seeding helpers ─────────────────────────────────────────────────────────

interface SeededPatient {
  userId: string;
  patientId: string;
}

/** Mifflin-St Jeor BMR — used to satisfy schema requirement on NutritionTargets.bmr */
function computeBmr(sex: 'M' | 'F', weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'M' ? base + 5 : base - 161);
}

async function seedFixture(fixture: FazaDTestPatient): Promise<SeededPatient> {
  // Unique email per fixture run — avoids collisions if previous cleanup was incomplete
  const email = `${TEST_RUN_TAG}-${fixture.id}@test.local`;

  const user = await prisma.user.create({
    data: {
      email,
      role: 'PATIENT',
    },
  });

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
    data: {
      patientId: patient.id,
      answers: encryptJson(fixture.interview.answers),
    },
  });

  const ageYears = new Date().getFullYear() - fixture.patient.birthYear;
  const bmr = computeBmr(fixture.patient.sex, fixture.patient.weightKg, fixture.patient.heightCm, ageYears);

  await prisma.nutritionTargets.create({
    data: {
      patientId: patient.id,
      bmr,
      tdee: Math.round(bmr * 1.4),  // light-moderate activity factor
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
  // Delete in reverse FK dependency order
  await prisma.nutritionTargets.deleteMany({ where: { patientId: seeded.patientId } });
  await prisma.interview.deleteMany({ where: { patientId: seeded.patientId } });
  await prisma.dietPlan.deleteMany({ where: { patientId: seeded.patientId } });
  await prisma.patient.delete({ where: { id: seeded.patientId } });
  await prisma.user.delete({ where: { id: seeded.userId } });
}

// ─── Snapshot sanitizer — strip non-deterministic fields ─────────────────────

/**
 * Recursively sanitizes a plan-shaped object for snapshotting:
 *  - Removes ID/timestamp fields that vary between runs (DB-generated for our seed)
 *  - Recipe IDs are KEPT — they reference DB recipes (stable across runs);
 *    detecting if solver post-refactor picks a different recipe is the WHOLE POINT.
 *  - Rounds tiny float jitter to 2 decimals
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 20) return '<too-deep>';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value;
    return Math.round(value * 100) / 100;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(v => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // Strip seed-row IDs (these are random per test run)
      if (k === 'id' || k === 'patientId' || k === 'userId' || k === 'dietPlanId' || k === 'interviewId') continue;
      // Strip timestamps + runtime metrics
      if (k === 'createdAt' || k === 'updatedAt' || k === 'durationMs' || k === 'duration_ms' || k === 'startMs') continue;
      result[k] = sanitize(v, depth + 1);
    }
    return result;
  }
  return value;
}

// ─── Test ────────────────────────────────────────────────────────────────────

// Self-skip in default `npm test` runs. Run via `npm run test:goldstandard`.
const RUN_GOLD_STANDARD = process.env.RUN_GOLD_STANDARD === '1';

describe.skipIf(!RUN_GOLD_STANDARD)('Faza D — legacy solver gold standard baseline', () => {
  let solverAvailable = false;

  beforeAll(async () => {
    solverAvailable = await isSolverHealthy();
    if (!solverAvailable) {
      console.warn(`[gold-standard] Solver not available at ${SOLVER_URL}. Tests will skip.`);
    }
  });

  afterAll(async () => {
    // Disconnect prisma to avoid hanging vitest process
    await prisma.$disconnect();
  });

  // 60s per fixture — solver may take 5-10s, plus DB I/O
  const PER_FIXTURE_TIMEOUT_MS = 60_000;

  for (const fixture of FAZA_D_TEST_PATIENTS) {
    it(`baseline ${fixture.id} (${fixture.expectedCoverage.join(', ')})`, async () => {
      if (!solverAvailable) {
        console.warn(`[gold-standard] skipping ${fixture.id} — solver unreachable`);
        return;
      }

      const seeded = await seedFixture(fixture);
      try {
        // Build assembly input via real policy engine + dbPolicyBridge
        const constraints = await buildDbPolicyConstraints(seeded.patientId);
        const baseInput: AssemblyInput = {
          patientId: seeded.patientId,
          days: 7,
        };
        const enrichedInput = mergeConstraintsIntoInput(baseInput, constraints);

        // Run real assembly (calls real Python solver via HTTP)
        const result = await assembleDbPlan(enrichedInput);

        // Snapshot a curated subset of the result — high signal, low noise
        const snapshot = {
          fixtureId: fixture.id,
          fixtureCoverage: fixture.expectedCoverage,
          generationMethod: result.generationMethod,
          coverage: sanitize(result.coverage),
          // recipeIds sorted for deterministic snapshot ordering
          recipeIds: [...result.recipeIds].sort(),
          plan: sanitize(result.plan),
          slotDecisions: sanitize(result.slotDecisions),
        };

        expect(snapshot).toMatchSnapshot();
      } finally {
        await cleanup(seeded);
      }
    }, PER_FIXTURE_TIMEOUT_MS);
  }
});
