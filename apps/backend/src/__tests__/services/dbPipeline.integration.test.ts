import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  // prisma
  patient: { findUnique: vi.fn() },
  dietPlan: { create: vi.fn(), update: vi.fn() },
  // services
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
const PLAN_ID = 'plan-cuid-001';

function makePatient(overrides: object = {}) {
  return {
    id: PATIENT_ID,
    userId: 'user-001',
    dietitianId: 'dietitian-001',
    nutritionTargets: { targetKcal: 2000 },
    ...overrides,
  };
}

function makeConstraints(overrides: object = {}) {
  return {
    excludeAllergens: [],
    requiredDietFlags: [],
    excludeKeywords: [],
    mealDistributions: [],
    nutrientLimits: [],
    clinicalNotes: ['Bez uwag'],
    supplements: ['Wit. D3'],
    appliedRulesCount: 5,
    appliedRuleNames: ['RULE_A', 'RULE_B'],
    ...overrides,
  };
}

function makeAssembly(coveragePct: number) {
  return {
    plan: { days: [] },
    coverage: {
      totalSlots: 35,
      filledFromDb: Math.round((coveragePct / 100) * 35),
      uncoveredSlots: 35 - Math.round((coveragePct / 100) * 35),
      filledFromDbPct: coveragePct,
      dailyKcal: new Array(7).fill(2000),
      dailyProteinG: new Array(7).fill(100),
      dailyFatG: new Array(7).fill(70),
      dailyCarbsG: new Array(7).fill(250),
    },
    recipeIds: ['r1', 'r2'],
    generationMethod: 'database',
    durationMs: 120,
  };
}

function setupDefaults(coveragePct = 100) {
  m.patient.findUnique.mockResolvedValue(makePatient());
  m.buildDbPolicyConstraints.mockResolvedValue(makeConstraints());
  m.mergeConstraintsIntoInput.mockImplementation((_base: object, _c: object) => _base);
  m.assembleDbPlan.mockResolvedValue(makeAssembly(coveragePct));
  m.encryptJson.mockReturnValue({ iv: 'x', ciphertext: 'y', tag: 'z' });
  m.dietPlan.create.mockResolvedValue({ id: PLAN_ID });
  m.validatePlan.mockResolvedValue({ status: 'OK', issues: [] });
  m.autoAdjustContent.mockImplementation((plan: object) => plan);
  m.createRevision.mockResolvedValue(undefined);
  m.logAudit.mockReturnValue(undefined);
  m.logAiUsage.mockReturnValue(undefined);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('dbPipeline.service — generateDbPlan()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Guard: patient not found ───────────────────────────────────────────────

  it('throws AppError 404 when patient does not exist', async () => {
    m.patient.findUnique.mockResolvedValue(null);

    await expect(generateDbPlan({ patientId: PATIENT_ID })).rejects.toMatchObject({
      statusCode: 404,
      code: 'PATIENT_NOT_FOUND',
    });
  });

  // ── Guard: no nutrition targets ────────────────────────────────────────────

  it('throws AppError 400 when patient has no nutrition targets', async () => {
    m.patient.findUnique.mockResolvedValue(makePatient({ nutritionTargets: null }));

    await expect(generateDbPlan({ patientId: PATIENT_ID })).rejects.toMatchObject({
      statusCode: 400,
      code: 'NO_NUTRITION_TARGETS',
    });
  });

  // ── Happy path: full coverage ──────────────────────────────────────────────

  it('returns source=database and needsAiFallback=false when coverage ≥ 80%', async () => {
    setupDefaults(100);

    const result = await generateDbPlan({ patientId: PATIENT_ID });

    expect(result.source).toBe('database');
    expect(result.needsAiFallback).toBe(false);
    expect(result.dietPlanId).toBe(PLAN_ID);
    expect(result.coveragePct).toBe(100);
  });

  // ── Low coverage: AI fallback needed ──────────────────────────────────────

  it('returns source=database_ai_hybrid and needsAiFallback=true when coverage < 80%', async () => {
    setupDefaults(60);

    const result = await generateDbPlan({ patientId: PATIENT_ID });

    expect(result.source).toBe('database_ai_hybrid');
    expect(result.needsAiFallback).toBe(true);
    expect(result.coveragePct).toBe(60);
  });

  // ── Boundary: exactly 80% = no fallback ───────────────────────────────────

  it('does NOT trigger AI fallback when coverage is exactly 80%', async () => {
    setupDefaults(80);

    const result = await generateDbPlan({ patientId: PATIENT_ID });

    expect(result.needsAiFallback).toBe(false);
    expect(result.source).toBe('database');
  });

  // ── Assembly failure → signal AI fallback ─────────────────────────────────

  it('signals needsAiFallback=true and returns coveragePct=0 when assembleDbPlan throws', async () => {
    m.patient.findUnique.mockResolvedValue(makePatient());
    m.buildDbPolicyConstraints.mockResolvedValue(makeConstraints());
    m.mergeConstraintsIntoInput.mockImplementation((base: object) => base);
    m.assembleDbPlan.mockRejectedValue(new Error('No candidates found'));

    const result = await generateDbPlan({ patientId: PATIENT_ID });

    expect(result.needsAiFallback).toBe(true);
    expect(result.coveragePct).toBe(0);
    expect(result.validationStatus).toBe('GENERATION_FAILED');
    expect(result.dietPlanId).toBe('');
  });

  // ── Validation NEEDS_ADJUST ────────────────────────────────────────────────

  it('calls autoAdjustContent and updates plan when validation returns NEEDS_ADJUST', async () => {
    setupDefaults(100);
    m.validatePlan.mockResolvedValue({ status: 'NEEDS_ADJUST', issues: ['kcal too low'] });
    const adjustedPlan = { days: [], _adjusted: true };
    m.autoAdjustContent.mockReturnValue(adjustedPlan);

    const result = await generateDbPlan({ patientId: PATIENT_ID });

    expect(m.autoAdjustContent).toHaveBeenCalledOnce();
    expect(m.dietPlan.update).toHaveBeenCalledOnce();
    expect(result.validationStatus).toBe('NEEDS_ADJUST');
  });

  // ── Validation OK → no adjust ─────────────────────────────────────────────

  it('does NOT call autoAdjustContent when validation returns OK', async () => {
    setupDefaults(100);
    m.validatePlan.mockResolvedValue({ status: 'OK', issues: [] });

    await generateDbPlan({ patientId: PATIENT_ID });

    expect(m.autoAdjustContent).not.toHaveBeenCalled();
    expect(m.dietPlan.update).not.toHaveBeenCalled();
  });

  // ── Policy constraints propagated to result ────────────────────────────────

  it('returns appliedRules, clinicalNotes and supplements from policy constraints', async () => {
    setupDefaults(100);
    m.buildDbPolicyConstraints.mockResolvedValue(
      makeConstraints({
        appliedRuleNames: ['RULE_HYPERTENSION', 'RULE_SODIUM'],
        clinicalNotes: ['Ogranicz sód do 1500 mg'],
        supplements: ['Wit. D3', 'Omega-3'],
      }),
    );

    const result = await generateDbPlan({ patientId: PATIENT_ID });

    expect(result.appliedRules).toEqual(['RULE_HYPERTENSION', 'RULE_SODIUM']);
    expect(result.clinicalNotes).toEqual(['Ogranicz sód do 1500 mg']);
    expect(result.supplements).toEqual(['Wit. D3', 'Omega-3']);
  });

  // ── Audit log and usage log are fired ─────────────────────────────────────

  it('calls logAudit and logAiUsage after successful generation', async () => {
    setupDefaults(100);

    await generateDbPlan({ patientId: PATIENT_ID });

    expect(m.logAudit).toHaveBeenCalledOnce();
    expect(m.logAiUsage).toHaveBeenCalledOnce();
  });

  // ── Revision is created ────────────────────────────────────────────────────

  it('calls createRevision with AI_GENERATED reason', async () => {
    setupDefaults(100);

    await generateDbPlan({ patientId: PATIENT_ID });

    expect(m.createRevision).toHaveBeenCalledOnce();
    expect(m.createRevision).toHaveBeenCalledWith(
      PLAN_ID,
      expect.anything(),
      'AI_GENERATED',
    );
  });

  // ── Plan is saved with correct status ─────────────────────────────────────

  it('saves plan with status=GENERATED for high coverage', async () => {
    setupDefaults(100);

    await generateDbPlan({ patientId: PATIENT_ID });

    expect(m.dietPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'GENERATED' }),
      }),
    );
  });

  it('saves plan with status=AI_DRAFT for low coverage', async () => {
    setupDefaults(50);

    await generateDbPlan({ patientId: PATIENT_ID });

    expect(m.dietPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AI_DRAFT' }),
      }),
    );
  });

  // ── durationMs is a non-negative number ───────────────────────────────────

  it('returns durationMs as a non-negative number', async () => {
    setupDefaults(100);

    const result = await generateDbPlan({ patientId: PATIENT_ID });

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── forceAi option does NOT skip DB path in generateDbPlan ────────────────
  // (forceAi is handled upstream in planPipeline.service — generateDbPlan
  //  always runs the DB path when called directly)

  it('still runs DB path even if forceAi=true (handled by caller)', async () => {
    setupDefaults(100);

    const result = await generateDbPlan({ patientId: PATIENT_ID, forceAi: true });

    expect(m.assembleDbPlan).toHaveBeenCalledOnce();
    expect(result.source).toBe('database');
  });
});
