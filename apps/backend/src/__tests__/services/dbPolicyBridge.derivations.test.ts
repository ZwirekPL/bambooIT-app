/**
 * Faza D Phase 1 W2-Tue: tests for D3-D8 patient-input derivations in
 * `buildDbPolicyConstraints` + `mergeConstraintsIntoInput`.
 *
 * Each test seeds a controlled PatientContext via the mocked policy-engine,
 * runs the bridge, and asserts that derived condition flags / nutrient
 * limits surface correctly. Solver-side activation of the new flags is
 * scheduled for W2-Wed (distribution variants) and W2-Fri (PCOS module +
 * nutrient_limits enforcement).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PatientContext, PolicyResult } from '../../policies/types';
import type { AssemblyInput } from '../../services/dbPlanAssembly.service';
import {
  buildDbPolicyConstraints,
  mergeConstraintsIntoInput,
} from '../../services/dbPolicyBridge.service';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

vi.mock('@db', () => ({
  prisma: {},
}));

// vitest hoists `vi.mock` factories above all top-level `const` declarations,
// so any references inside need to live in `vi.hoisted` to be available at
// hoist time. Without this we'd hit `Cannot access ... before initialization`.
const { mockBuildPatientContext, mockEvaluatePolicies, mockLoadPolicyRules } = vi.hoisted(() => ({
  mockBuildPatientContext: vi.fn(),
  mockEvaluatePolicies: vi.fn(),
  mockLoadPolicyRules: vi.fn(),
}));

vi.mock('../../policies/policy-engine', () => ({
  buildPatientContext: mockBuildPatientContext,
  evaluatePolicies: mockEvaluatePolicies,
  mapDislikedFoodsToKeywords: (foods: string[]) => foods,
  // P1.2 / P1.8: derivations test doesn't exercise SC30; return the empty
  // mapping shape so the bridge code path doesn't NPE.
  mapPreferredFoodsToKeywords: () => ({ keywords: [], canonicalBuckets: [], filteredCodes: [] }),
}));

vi.mock('../../policies/rule-store', () => ({
  loadPolicyRules: mockLoadPolicyRules,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePatientContext(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    patientId: 'patient_test',
    chronicDiseases: [],
    digestiveIssues: [],
    allergies: [],
    dietType: '',
    medications: '',
    mealsPerDay: 5,
    targetKcal: 2000,
    targetProteinG: 100,
    targetFatG: 70,
    targetCarbsG: 220,
    sex: 'F',
    weightKg: 70,
    heightCm: 170,
    ageYears: 30,
    goal: 'maintain',
    ...overrides,
  };
}

function makeEmptyPolicyResult(): PolicyResult {
  return {
    appliedRules: [],
    excludeAllergens: [],
    excludeKeywords: [],
    excludeFlags: [],
    preferProducts: [],
    nutrientLimits: [],
    mealDistributions: [],
    clinicalNotes: [],
    supplements: [],
    targetModifiers: [],
  } as unknown as PolicyResult;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadPolicyRules.mockResolvedValue([]);
  mockEvaluatePolicies.mockReturnValue(makeEmptyPolicyResult());
});

// ─── 1. D8 PCOS — derived from hormonalIssues ────────────────────────────────

describe('Faza D W2-Tue — D8 PCOS derivation', () => {
  it('adds pcos to derivedConditionFlags when hormonalIssues includes pcos', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      hormonalIssues: ['PCOS', 'hipotyreoza'],
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags).toContain('pcos');
  });

  it('matches case-insensitively (Pcos / pcos)', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      hormonalIssues: ['Pcos symptoms'],
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags).toContain('pcos');
  });

  it('skips pcos when hormonalIssues does not contain it', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      hormonalIssues: ['hashimoto'],
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags ?? []).not.toContain('pcos');
  });
});

// ─── 2. D3 eatsAtNight + D5 lastMealTime — meal-rhythm derivations ───────────

describe('Faza D W2-Tue — D3 / D5 meal rhythm derivations', () => {
  it('adds no_night_eating when mealRhythm.eatsAtNight === false', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      mealRhythm: { eatsAtNight: false },
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags).toContain('no_night_eating');
  });

  it('does not add no_night_eating when eatsAtNight is true or missing', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      mealRhythm: { eatsAtNight: true },
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags ?? []).not.toContain('no_night_eating');
  });

  it('adds eats_before_18 when lastMealTime is before_18', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      mealRhythm: { lastMealTime: 'before_18' },
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags).toContain('eats_before_18');
  });

  it('does not add eats_before_18 for other lastMealTime values', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      mealRhythm: { lastMealTime: 'before_20' },
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags ?? []).not.toContain('eats_before_18');
  });
});

// ─── 3. D7 shift_night — work type derivation ────────────────────────────────

describe('Faza D W2-Tue — D7 shift_night derivation', () => {
  it('adds shift_night when workType === shift_night', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      workType: 'shift_night',
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags).toContain('shift_night');
  });

  it('does not add shift_night for other work types', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      workType: 'office',
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags ?? []).not.toContain('shift_night');
  });
});

// ─── 4. D6 CKD-stage tier — nutrient_limits + flag ───────────────────────────

describe('Faza D W2-Tue — D6 CKD stadium tier limits', () => {
  it('emits stage-3 protein 0.8 g/kg + phosphorus 1000mg', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      ckdStadium: 3,
      weightKg: 80,
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');

    expect(constraints.derivedConditionFlags).toContain('ckd_stage_3');
    expect(constraints.ckdStadium).toBe(3);
    const proteinLimit = constraints.nutrientLimits.find((l) => l.nutrient === 'protein');
    expect(proteinLimit?.max).toBe(80 * 0.8);   // 64g
    const phosphorusLimit = constraints.nutrientLimits.find((l) => l.nutrient === 'phosphorus');
    expect(phosphorusLimit?.max).toBe(1000);
  });

  it('emits stage-4 protein 0.6 g/kg + phosphorus 900mg', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      ckdStadium: 4,
      weightKg: 70,
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');

    expect(constraints.derivedConditionFlags).toContain('ckd_stage_4');
    const proteinLimit = constraints.nutrientLimits.find((l) => l.nutrient === 'protein');
    expect(proteinLimit?.max).toBe(70 * 0.6);   // 42g
    const phosphorusLimit = constraints.nutrientLimits.find((l) => l.nutrient === 'phosphorus');
    expect(phosphorusLimit?.max).toBe(900);
  });

  it('emits stage-5 protein 0.6 g/kg + phosphorus 800mg + potassium 2500mg', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      ckdStadium: 5,
      weightKg: 75,
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');

    expect(constraints.derivedConditionFlags).toContain('ckd_stage_5');
    const proteinLimit = constraints.nutrientLimits.find((l) => l.nutrient === 'protein');
    expect(proteinLimit?.max).toBe(75 * 0.6);   // 45g
    const phosphorusLimit = constraints.nutrientLimits.find((l) => l.nutrient === 'phosphorus');
    expect(phosphorusLimit?.max).toBe(800);
    const potassiumLimit = constraints.nutrientLimits.find((l) => l.nutrient === 'potassium');
    expect(potassiumLimit?.max).toBe(2500);
  });

  it('skips CKD limits for stages 1-2 (subclinical)', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      ckdStadium: 2,
      weightKg: 70,
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');

    expect(constraints.derivedConditionFlags ?? []).not.toContain('ckd_stage_2');
    expect(constraints.nutrientLimits.find((l) => l.nutrient === 'protein')).toBeUndefined();
  });

  it('falls back to weightKg=70 when patient weight is missing', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      ckdStadium: 3,
      weightKg: 0,
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');

    const proteinLimit = constraints.nutrientLimits.find((l) => l.nutrient === 'protein');
    expect(proteinLimit?.max).toBe(70 * 0.8);   // 56g via fallback weight
  });
});

// ─── 5. mergeConstraintsIntoInput — derived flags propagate to AssemblyInput ─

describe('Faza D W2-Tue — mergeConstraintsIntoInput propagation', () => {
  it('appends derivedConditionFlags to AssemblyInput.conditionFlags', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      hormonalIssues: ['pcos'],
      mealRhythm: { eatsAtNight: false, lastMealTime: 'before_18' },
      workType: 'shift_night',
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');

    const baseInput: AssemblyInput = { patientId: 'patient_test' };
    const merged = mergeConstraintsIntoInput(baseInput, constraints);

    const flags = merged.conditionFlags ?? [];
    expect(flags).toContain('pcos');
    expect(flags).toContain('no_night_eating');
    expect(flags).toContain('eats_before_18');
    expect(flags).toContain('shift_night');
  });

  it('caller-supplied conditionFlags survive alongside derived ones', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      hormonalIssues: ['pcos'],
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');

    const merged = mergeConstraintsIntoInput(
      { patientId: 'p', conditionFlags: ['hypertension'] },
      constraints,
    );

    expect(merged.conditionFlags).toContain('hypertension');
    expect(merged.conditionFlags).toContain('pcos');
  });
});

// ─── 6. No derivations → empty derivedConditionFlags ─────────────────────────

describe('Faza D W2-Tue — no derivations leaves field undefined', () => {
  it('omits derivedConditionFlags when none of D3/D5/D6/D7/D8 trigger', async () => {
    mockBuildPatientContext.mockResolvedValue(makePatientContext({
      // no hormonalIssues, no mealRhythm, no workType, no ckdStadium
    }));
    const constraints = await buildDbPolicyConstraints('patient_test');
    expect(constraints.derivedConditionFlags).toBeUndefined();
  });
});
