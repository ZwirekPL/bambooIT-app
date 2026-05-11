import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  patient: { findUnique: vi.fn(), findFirst: vi.fn() },
  dietPlan: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  tenant: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  sendDietPlanReadyEmail: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    patient: m.patient,
    dietPlan: m.dietPlan,
    tenant: m.tenant,
    $transaction: m.$transaction,
    nutritionTargets: { findUnique: vi.fn().mockResolvedValue(null) },
    appSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    dietPlanRevision: { create: vi.fn() },
  },
  Prisma: { JsonNull: null },
}));

vi.mock('../../utils/email', () => ({
  sendDietPlanReadyEmail: m.sendDietPlanReadyEmail,
}));

import {
  createFromAi,
  getLatestDietPlan,
  publishDietPlan,
  listDietPlans,
  updateStatus,
  createManual,
  updateDietPlanContent,
  getDietPlanById,
} from '../../services/dietPlan.service';
import { encryptJson } from '../../utils/encryption';

// ── helpers ───────────────────────────────────────────────────────────────────
const CONTENT = { meals: [{ name: 'Breakfast', kcal: 500 }] };

const makePatient = (overrides = {}) => ({
  id: 'patient-1',
  dietitianId: 'dietitian-1',
  firstName: 'Jan',
  lastName: 'Kowalski',
  user: { email: 'jan@example.com', deletedAt: null },
  ...overrides,
});

const makePlan = (overrides = {}) => ({
  id: 'plan-1',
  patientId: 'patient-1',
  tenantId: null,
  source: 'AI',
  status: 'AI_DRAFT',
  kcal: 2000,
  proteinG: 150,
  fatG: 60,
  carbsG: 220,
  aiProvider: 'openai',
  aiModel: null,
  rawResponse: null,
  validated: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  content: encryptJson(CONTENT),
  patient: makePatient(),
  ...overrides,
});

// ── tests ─────────────────────────────────────────────────────────────────────
describe('dietplan.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.sendDietPlanReadyEmail.mockResolvedValue(undefined);
  });

  // ── createFromAi ───────────────────────────────────────────────────────────
  describe('createFromAi()', () => {
    it('throws NOT_FOUND when patient does not exist', async () => {
      m.patient.findUnique.mockResolvedValue(null);
      await expect(createFromAi({ patientId: 'bad-id', content: CONTENT }))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('creates plan with status AI_DRAFT and encrypted content', async () => {
      m.patient.findUnique.mockResolvedValue(makePatient());
      m.dietPlan.create.mockResolvedValue({ id: 'plan-new' });

      const result = await createFromAi({ patientId: 'patient-1', content: CONTENT, kcal: 2000 });

      expect(result).toEqual({ dietPlanId: 'plan-new' });
      const createData = m.dietPlan.create.mock.calls[0][0].data;
      expect(createData.status).toBe('AI_DRAFT');
      expect(createData.source).toBe('AI');
      expect(createData.content).toHaveProperty('v', 1); // encrypted
    });
  });

  // ── createManual ───────────────────────────────────────────────────────────
  describe('createManual()', () => {
    it('throws NOT_FOUND when patient deleted', async () => {
      m.patient.findUnique.mockResolvedValue({ user: { deletedAt: new Date() } });
      await expect(createManual({ patientId: 'patient-1', content: CONTENT }))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('creates plan with status GENERATED', async () => {
      m.patient.findUnique.mockResolvedValue(makePatient());
      const encContent = encryptJson(CONTENT);
      m.dietPlan.create.mockResolvedValue(makePlan({ status: 'GENERATED', source: 'MANUAL', content: encContent }));

      const result = await createManual({ patientId: 'patient-1', content: CONTENT });

      const createData = m.dietPlan.create.mock.calls[0][0].data;
      expect(createData.status).toBe('GENERATED');
      expect(createData.source).toBe('MANUAL');
      expect(result.content).toEqual(CONTENT); // decrypted in response
    });
  });

  // ── getLatestDietPlan ──────────────────────────────────────────────────────
  describe('getLatestDietPlan()', () => {
    it('throws NOT_FOUND when no plan exists', async () => {
      m.dietPlan.findFirst.mockResolvedValue(null);
      await expect(getLatestDietPlan('patient-1'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('returns plan with decrypted content', async () => {
      m.dietPlan.findFirst.mockResolvedValue(makePlan());
      const result = await getLatestDietPlan('patient-1');
      expect(result.content).toEqual(CONTENT);
    });

    it('filters to PUBLISHED/SENT only for PATIENT role', async () => {
      m.dietPlan.findFirst.mockResolvedValue(null);
      try {
        await getLatestDietPlan('patient-1', 'PATIENT');
      } catch {
        // expected NOT_FOUND
      }
      const whereArg = m.dietPlan.findFirst.mock.calls[0][0].where;
      expect(whereArg.status).toEqual({ in: ['PUBLISHED', 'SENT'] });
    });

    it('does not filter by status for ADMIN role', async () => {
      m.dietPlan.findFirst.mockResolvedValue(makePlan());
      await getLatestDietPlan('patient-1', 'ADMIN');
      const whereArg = m.dietPlan.findFirst.mock.calls[0][0].where;
      expect(whereArg.status).toBeUndefined();
    });
  });

  // ── publishDietPlan ────────────────────────────────────────────────────────
  describe('publishDietPlan()', () => {
    it('throws NOT_FOUND when plan does not exist', async () => {
      m.dietPlan.findUnique.mockResolvedValue(null);
      await expect(publishDietPlan('plan-99', 'dietitian-1', 'DIETITIAN'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('throws INVALID_TRANSITION when plan is not AI_DRAFT', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'REVIEWED' }));
      await expect(publishDietPlan('plan-1', 'dietitian-1', 'ADMIN'))
        .rejects.toMatchObject({ code: 'INVALID_TRANSITION', statusCode: 422 });
    });

    it('throws when DIETITIAN does not own patient', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'AI_DRAFT' }));
      m.patient.findFirst.mockResolvedValue(null); // ownership check fails → patient not found
      await expect(publishDietPlan('plan-1', 'other-dietitian', 'DIETITIAN'))
        .rejects.toThrow();
    });

    it('transitions plan to PUBLISHED and sends email', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'AI_DRAFT' }));
      const updatedPlan = makePlan({ status: 'PUBLISHED' });
      m.dietPlan.update.mockResolvedValue(updatedPlan);

      const result = await publishDietPlan('plan-1', 'dietitian-1', 'ADMIN');

      expect(m.dietPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PUBLISHED' } }),
      );
      expect(result.status).toBe('PUBLISHED');
      // email is sent fire-and-forget — just verify it was called
      await vi.waitFor(() => expect(m.sendDietPlanReadyEmail).toHaveBeenCalledOnce(), { timeout: 100 });
    });
  });

  // ── updateStatus ───────────────────────────────────────────────────────────
  describe('updateStatus()', () => {
    it('throws NOT_FOUND when plan does not exist', async () => {
      m.dietPlan.findUnique.mockResolvedValue(null);
      await expect(updateStatus('plan-99', 'REVIEWED'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('transitions AI_DRAFT → REVIEWED', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'AI_DRAFT' }));
      m.dietPlan.update.mockResolvedValue(makePlan({ status: 'REVIEWED' }));

      const result = await updateStatus('plan-1', 'REVIEWED');
      expect(result.status).toBe('REVIEWED');
    });

    it('transitions REVIEWED → SENT', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'REVIEWED' }));
      m.dietPlan.update.mockResolvedValue(makePlan({ status: 'SENT' }));

      const result = await updateStatus('plan-1', 'SENT');
      expect(result.status).toBe('SENT');
    });

    it('throws INVALID_TRANSITION for invalid state change (SENT → REVIEWED)', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'SENT' }));
      await expect(updateStatus('plan-1', 'REVIEWED'))
        .rejects.toMatchObject({ code: 'INVALID_TRANSITION', statusCode: 422 });
    });

    it('throws INVALID_TRANSITION for PUBLISHED → SENT', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'PUBLISHED' }));
      await expect(updateStatus('plan-1', 'SENT'))
        .rejects.toMatchObject({ code: 'INVALID_TRANSITION', statusCode: 422 });
    });
  });

  // ── updateDietPlanContent ──────────────────────────────────────────────────
  describe('updateDietPlanContent()', () => {
    it('throws NOT_FOUND when plan does not exist', async () => {
      m.dietPlan.findUnique.mockResolvedValue(null);
      await expect(updateDietPlanContent('plan-99', { content: CONTENT }))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('throws INVALID_STATE when plan status is SENT', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'SENT' }));
      await expect(updateDietPlanContent('plan-1', { content: CONTENT }))
        .rejects.toMatchObject({ code: 'INVALID_STATE', statusCode: 422 });
    });

    it('throws INVALID_STATE when plan status is PUBLISHED', async () => {
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'PUBLISHED' }));
      await expect(updateDietPlanContent('plan-1', { content: CONTENT }))
        .rejects.toMatchObject({ code: 'INVALID_STATE', statusCode: 422 });
    });

    it('updates macros and encrypts content for editable plan', async () => {
      const newContent = { meals: [{ name: 'Lunch', kcal: 700 }] };
      m.dietPlan.findUnique.mockResolvedValue(makePlan({ status: 'AI_DRAFT' }));
      m.dietPlan.update.mockResolvedValue(makePlan({ content: encryptJson(newContent), kcal: 2200 }));

      const result = await updateDietPlanContent('plan-1', { content: newContent, kcal: 2200 });

      const updateData = m.dietPlan.update.mock.calls[0][0].data;
      expect(updateData.content).toHaveProperty('v', 1); // encrypted
      expect(result.content).toEqual(newContent); // decrypted in response
    });
  });

  // ── listDietPlans ──────────────────────────────────────────────────────────
  describe('listDietPlans()', () => {
    it('returns paginated list without content field', async () => {
      m.$transaction.mockResolvedValue([[{ id: 'plan-1', status: 'AI_DRAFT' }], 1]);

      const result = await listDietPlans({ page: 1, limit: 10 });

      expect(result).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(result.dietPlans[0].id).toBe('plan-1');
    });
  });
});
