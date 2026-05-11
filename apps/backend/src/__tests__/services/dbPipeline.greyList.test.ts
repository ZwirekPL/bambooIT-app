/**
 * Z1 — Grey-list wiring test (post-Z5 follow-up).
 *
 * Verifies dbPipeline.generateDbPlan correctly:
 *   1. Reads the dietitian's grey-list window via getGreyListWindow.
 *   2. Pulls the patient's previous N plans via getGreyListRecipeIds.
 *   3. Hands the resulting Set to assembleDbPlan via AssemblyInput.greyListRecipeIds.
 *   4. No-ops when the patient has no prior plans (gold-standard parity).
 *   5. No-ops when window=0 (feature disabled by dietitian).
 *
 * Per-candidate penalty arithmetic is already covered by
 * `apps/solver/tests/test_grey_list.py`. This test closes the integration
 * gap: confirms the DB → Python solver plumbing actually carries the
 * grey list through.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  patient: { findUnique: vi.fn() },
  dietPlan: { create: vi.fn(), findMany: vi.fn() },
  dietitianProfile: { findUnique: vi.fn() },
  appSettings: { findUnique: vi.fn() },
  buildDbPolicyConstraints: vi.fn(),
  mergeConstraintsIntoInput: vi.fn(),
  assembleDbPlan: vi.fn(),
  validatePlan: vi.fn(),
  autoAdjustContent: vi.fn(),
  logAudit: vi.fn(),
  logAiUsage: vi.fn(),
  createRevision: vi.fn(),
  encryptJson: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    patient: m.patient,
    dietPlan: m.dietPlan,
    dietitianProfile: m.dietitianProfile,
    appSettings: m.appSettings,
  },
  Prisma: {},
}));

vi.mock('../../services/dbPolicyBridge.service', () => ({
  buildDbPolicyConstraints: m.buildDbPolicyConstraints,
  mergeConstraintsIntoInput: m.mergeConstraintsIntoInput,
}));

vi.mock('../../services/dbPlanAssembly.service', () => ({
  assembleDbPlan: m.assembleDbPlan,
}));

vi.mock('../../services/planValidation.service', () => ({
  validatePlan: m.validatePlan,
  autoAdjustContent: m.autoAdjustContent,
}));

vi.mock('../../services/audit.service', () => ({
  logAudit: m.logAudit,
}));

vi.mock('../../services/aiUsage.service', () => ({
  logAiUsage: m.logAiUsage,
  PipelineTimer: class PipelineTimer {
    mark() { return 0; }
    get totalMs() { return 0; }
    get timings() { return []; }
  },
}));

vi.mock('../../services/revision.service', () => ({
  createRevision: m.createRevision,
}));

vi.mock('../../utils/encryption', () => ({
  encryptJson: m.encryptJson,
}));

import { generateDbPlan } from '../../services/dbPipeline.service';

// ── helpers ───────────────────────────────────────────────────────────────────

const PATIENT_ID = 'patient-cuid-001';
const DIETITIAN_ID = 'dietitian-cuid-001';

function defaultAssembly() {
  return {
    plan: { days: [] },
    coverage: {
      totalSlots: 35,
      filledFromDb: 35,
      uncoveredSlots: 0,
      filledFromDbPct: 100,
      dailyKcal: new Array(7).fill(2000),
      dailyProteinG: new Array(7).fill(100),
      dailyFatG: new Array(7).fill(70),
      dailyCarbsG: new Array(7).fill(250),
    },
    recipeIds: ['r-new-1', 'r-new-2'],
    generationMethod: 'database' as const,
    durationMs: 120,
  };
}

function commonSetup() {
  m.patient.findUnique.mockResolvedValue({
    id: PATIENT_ID,
    userId: 'user-001',
    dietitianId: DIETITIAN_ID,
    nutritionTargets: { targetKcal: 2000 },
  });
  m.buildDbPolicyConstraints.mockResolvedValue({
    excludeAllergens: [],
    requiredDietFlags: [],
    excludeKeywords: [],
    mealDistributions: [],
    nutrientLimits: [],
    clinicalNotes: [],
    supplements: [],
    appliedRulesCount: 0,
    appliedRuleNames: [],
  });
  m.mergeConstraintsIntoInput.mockImplementation((base: object) => base);
  m.assembleDbPlan.mockResolvedValue(defaultAssembly());
  m.encryptJson.mockReturnValue({ iv: 'x', ciphertext: 'y', tag: 'z' });
  m.dietPlan.create.mockResolvedValue({ id: 'plan-new' });
  m.validatePlan.mockResolvedValue({ status: 'OK', issues: [] });
  m.autoAdjustContent.mockImplementation((plan: object) => plan);
  m.createRevision.mockResolvedValue(undefined);
  m.logAudit.mockReturnValue(undefined);
  m.logAiUsage.mockReturnValue(undefined);
  // Defaults: no previous plans, no AppSettings override, no profile override.
  m.dietPlan.findMany.mockResolvedValue([]);
  m.appSettings.findUnique.mockResolvedValue(null);
  m.dietitianProfile.findUnique.mockResolvedValue(null);
}

function getAssemblyInputArg() {
  expect(m.assembleDbPlan).toHaveBeenCalledTimes(1);
  return m.assembleDbPlan.mock.calls[0][0] as { greyListRecipeIds?: ReadonlySet<string> };
}

describe('dbPipeline grey-list wiring (Z1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commonSetup();
  });

  it('passes greyListRecipeIds=undefined when patient has no prior plans (gold-standard parity)', async () => {
    m.dietitianProfile.findUnique.mockResolvedValue({ greyListWindow: 1 });
    m.dietPlan.findMany.mockResolvedValue([]);

    await generateDbPlan({ patientId: PATIENT_ID });

    const input = getAssemblyInputArg();
    expect(input.greyListRecipeIds).toBeUndefined();
  });

  it('builds greyListRecipeIds from previous plan policyMetadata.recipeIds', async () => {
    m.dietitianProfile.findUnique.mockResolvedValue({ greyListWindow: 1 });
    m.dietPlan.findMany.mockResolvedValue([
      { policyMetadata: { recipeIds: ['r-prev-1', 'r-prev-2', 'r-prev-3'] } },
    ]);

    await generateDbPlan({ patientId: PATIENT_ID });

    const input = getAssemblyInputArg();
    expect(input.greyListRecipeIds).toBeInstanceOf(Set);
    expect(input.greyListRecipeIds!.size).toBe(3);
    expect(input.greyListRecipeIds!.has('r-prev-1')).toBe(true);
    expect(input.greyListRecipeIds!.has('r-prev-2')).toBe(true);
    expect(input.greyListRecipeIds!.has('r-prev-3')).toBe(true);
  });

  it('respects dietitian window=0 → no grey list applied even with prior plans', async () => {
    m.dietitianProfile.findUnique.mockResolvedValue({ greyListWindow: 0 });
    m.dietPlan.findMany.mockResolvedValue([
      { policyMetadata: { recipeIds: ['r-prev-1', 'r-prev-2'] } },
    ]);

    await generateDbPlan({ patientId: PATIENT_ID });

    const input = getAssemblyInputArg();
    expect(input.greyListRecipeIds).toBeUndefined();
    // window=0 short-circuits before findMany is even queried for prior plans.
    expect(m.dietPlan.findMany).not.toHaveBeenCalled();
  });

  it('respects dietitian window=3 → asks for last 3 plans', async () => {
    m.dietitianProfile.findUnique.mockResolvedValue({ greyListWindow: 3 });
    m.dietPlan.findMany.mockResolvedValue([
      { policyMetadata: { recipeIds: ['r-1'] } },
      { policyMetadata: { recipeIds: ['r-2'] } },
      { policyMetadata: { recipeIds: ['r-3'] } },
    ]);

    await generateDbPlan({ patientId: PATIENT_ID });

    expect(m.dietPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
    );
    const input = getAssemblyInputArg();
    expect(input.greyListRecipeIds!.size).toBe(3);
  });

  it('falls back to global AppSettings grey_list_window when no profile override', async () => {
    m.dietitianProfile.findUnique.mockResolvedValue(null);
    m.appSettings.findUnique.mockResolvedValue({
      key: 'grey_list_window',
      value: 2,
      updatedAt: new Date(),
    });
    m.dietPlan.findMany.mockResolvedValue([
      { policyMetadata: { recipeIds: ['r-a'] } },
      { policyMetadata: { recipeIds: ['r-b'] } },
    ]);

    await generateDbPlan({ patientId: PATIENT_ID });

    expect(m.dietPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
    const input = getAssemblyInputArg();
    expect(input.greyListRecipeIds!.size).toBe(2);
  });

  it('continues generation when grey-list lookup throws (downgrades to no-op)', async () => {
    m.dietitianProfile.findUnique.mockRejectedValue(new Error('DB transient'));

    // Should NOT throw — pipeline must finish without grey list.
    const result = await generateDbPlan({ patientId: PATIENT_ID });

    expect(result.dietPlanId).toBe('plan-new');
    const input = getAssemblyInputArg();
    expect(input.greyListRecipeIds).toBeUndefined();
  });

  it('deduplicates recipe IDs that appear in multiple prior plans', async () => {
    m.dietitianProfile.findUnique.mockResolvedValue({ greyListWindow: 2 });
    m.dietPlan.findMany.mockResolvedValue([
      { policyMetadata: { recipeIds: ['r-x', 'r-y'] } },
      { policyMetadata: { recipeIds: ['r-y', 'r-z'] } }, // r-y repeats
    ]);

    await generateDbPlan({ patientId: PATIENT_ID });

    const input = getAssemblyInputArg();
    expect(input.greyListRecipeIds!.size).toBe(3); // x, y, z (deduped)
  });
});
