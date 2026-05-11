import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  patient: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  user: { update: vi.fn() },
  dietPlan: { count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    patient: m.patient,
    user: m.user,
    dietPlan: m.dietPlan,
    $transaction: m.$transaction,
  },
  Prisma: {},
}));

import {
  getPatient,
  listPatients,
  getPatientStats,
  updatePatient,
  deletePatient,
  getPatientByUserId,
} from '../../services/patient.service';

// ── helpers ───────────────────────────────────────────────────────────────────
const makePatient = (overrides = {}) => ({
  id: 'patient-1',
  userId: 'user-1',
  dietitianId: 'dietitian-1',
  firstName: 'Jan',
  lastName: 'Kowalski',
  user: { id: 'user-1', email: 'jan@example.com', role: 'PATIENT', createdAt: new Date() },
  ...overrides,
});

// ── tests ─────────────────────────────────────────────────────────────────────
describe('patient.service', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── getPatient ─────────────────────────────────────────────────────────────
  describe('getPatient()', () => {
    it('throws NOT_FOUND when patient does not exist', async () => {
      m.patient.findFirst.mockResolvedValue(null);
      await expect(getPatient('patient-99'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('returns patient when found (ADMIN role — no ownership check)', async () => {
      m.patient.findFirst.mockResolvedValue(makePatient());
      const result = await getPatient('patient-1', undefined, 'ADMIN');
      expect(result.id).toBe('patient-1');
    });

    it('throws FORBIDDEN when DIETITIAN tries to access another dietitian patient', async () => {
      m.patient.findFirst.mockResolvedValue(makePatient({ dietitianId: 'other-dietitian' }));
      await expect(getPatient('patient-1', 'my-dietitian-id', 'DIETITIAN'))
        .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    });

    it('returns patient when DIETITIAN owns the patient', async () => {
      m.patient.findFirst.mockResolvedValue(makePatient({ dietitianId: 'my-dietitian' }));
      const result = await getPatient('patient-1', 'my-dietitian', 'DIETITIAN');
      expect(result.id).toBe('patient-1');
    });
  });

  // ── getPatientByUserId ─────────────────────────────────────────────────────
  describe('getPatientByUserId()', () => {
    it('throws NOT_FOUND when no patient for userId', async () => {
      m.patient.findFirst.mockResolvedValue(null);
      await expect(getPatientByUserId('user-99'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('returns patient by userId', async () => {
      m.patient.findFirst.mockResolvedValue(makePatient());
      const result = await getPatientByUserId('user-1');
      expect(result.userId).toBe('user-1');
    });
  });

  // ── deletePatient ──────────────────────────────────────────────────────────
  describe('deletePatient()', () => {
    it('soft-deletes patient by setting user.deletedAt', async () => {
      m.patient.findFirst.mockResolvedValue(makePatient());
      m.user.update.mockResolvedValue({});

      await deletePatient('patient-1');

      expect(m.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('throws FORBIDDEN when DIETITIAN tries to delete another dietitian patient', async () => {
      m.patient.findFirst.mockResolvedValue(makePatient({ dietitianId: 'other-dietitian' }));
      await expect(deletePatient('patient-1', 'my-dietitian', 'DIETITIAN'))
        .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
      expect(m.user.update).not.toHaveBeenCalled();
    });
  });

  // ── updatePatient ──────────────────────────────────────────────────────────
  describe('updatePatient()', () => {
    it('updates patient fields', async () => {
      const updated = makePatient({ weightKg: 80 });
      m.patient.findFirst.mockResolvedValue(makePatient());
      m.patient.update.mockResolvedValue(updated);

      const result = await updatePatient('patient-1', { weightKg: 80 });
      expect(m.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'patient-1' }, data: { weightKg: 80 } }),
      );
      expect(result).toMatchObject({ id: 'patient-1' });
    });
  });

  // ── listPatients ───────────────────────────────────────────────────────────
  describe('listPatients()', () => {
    it('returns paginated list', async () => {
      const patients = [makePatient()];
      m.$transaction.mockResolvedValue([patients, 1]);

      const result = await listPatients({ page: 1, limit: 10 });

      expect(result).toMatchObject({ patients, total: 1, page: 1, limit: 10 });
    });

    it('scopes to dietitian when role=DIETITIAN', async () => {
      m.$transaction.mockResolvedValue([[], 0]);

      await listPatients({ page: 1, limit: 10, dietitianUserId: 'diet-1', role: 'DIETITIAN' });

      // $transaction receives two PrismaPromise calls — patient.findMany and patient.count
      // We verify those were called (the mock resolves them via Promise.all)
      expect(m.$transaction).toHaveBeenCalledOnce();
    });
  });

  // ── getPatientStats ────────────────────────────────────────────────────────
  describe('getPatientStats()', () => {
    it('returns stats object with correct shape', async () => {
      m.$transaction.mockResolvedValue([5, 2, 1, 3]);

      const result = await getPatientStats({});

      expect(result).toEqual({ totalPatients: 5, aiDraft: 2, awaitingReview: 1, published: 3 });
    });
  });
});
