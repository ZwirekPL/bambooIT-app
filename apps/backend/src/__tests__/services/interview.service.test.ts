import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  patient: { findUnique: vi.fn(), findFirst: vi.fn() },
  interview: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@db', () => ({
  prisma: {
    patient: m.patient,
    interview: m.interview,
  },
  Prisma: {},
}));

import { createInterview, listInterviewsByPatient, getLatestInterview } from '../../services/interview.service';
import { encryptJson } from '../../utils/encryption';

// ── helpers ───────────────────────────────────────────────────────────────────
const ANSWERS = { q1: 'yes', q2: 'no', nested: { a: 1 } };

const makePatient = (overrides = {}) => ({
  id: 'patient-1',
  userId: 'user-1',
  sex: 'MALE',
  birthYear: 1990,
  birthDate: null,
  heightCm: 180,
  weightKg: 75,
  goal: 'lose weight',
  ...overrides,
});

const makeInterview = (overrides = {}) => ({
  id: 'interview-1',
  patientId: 'patient-1',
  type: 'CORE',
  answers: encryptJson(ANSWERS),
  medicalFlags: null,
  profileSnapshot: null,
  orderId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ── tests ─────────────────────────────────────────────────────────────────────
describe('interview.service', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── createInterview ────────────────────────────────────────────────────────
  describe('createInterview()', () => {
    it('throws NOT_FOUND when no patient for userId', async () => {
      m.patient.findUnique.mockResolvedValue(null);
      await expect(createInterview({ userId: 'user-99', answers: ANSWERS }))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('creates interview with encrypted answers', async () => {
      m.patient.findUnique.mockResolvedValue(makePatient());
      m.interview.create.mockResolvedValue({ id: 'interview-new', patientId: 'patient-1' });

      const result = await createInterview({ userId: 'user-1', answers: ANSWERS });

      expect(result).toEqual({ patientId: 'patient-1', interviewId: 'interview-new' });
      const createCall = m.interview.create.mock.calls[0][0].data;
      // answers must be an encrypted object (has v, iv, tag, data), not raw
      expect(createCall.answers).toHaveProperty('v', 1);
      expect(createCall.answers).toHaveProperty('iv');
      expect(createCall.answers).not.toMatchObject(ANSWERS);
    });

    it('captures profileSnapshot at creation time', async () => {
      m.patient.findUnique.mockResolvedValue(makePatient({ heightCm: 180, weightKg: 75 }));
      m.interview.create.mockResolvedValue({ id: 'interview-new', patientId: 'patient-1' });

      await createInterview({ userId: 'user-1', answers: ANSWERS });

      const snapshot = m.interview.create.mock.calls[0][0].data.profileSnapshot;
      expect(snapshot).toMatchObject({ sex: 'MALE', heightCm: 180, weightKg: 75 });
    });

    it('encrypts medicalFlags when provided', async () => {
      const flags = { flag1: true };
      m.patient.findUnique.mockResolvedValue(makePatient());
      m.interview.create.mockResolvedValue({ id: 'interview-new', patientId: 'patient-1' });

      await createInterview({ userId: 'user-1', answers: ANSWERS, medicalFlags: flags });

      const createData = m.interview.create.mock.calls[0][0].data;
      expect(createData.medicalFlags).toHaveProperty('v', 1);
    });
  });

  // ── listInterviewsByPatient ────────────────────────────────────────────────
  describe('listInterviewsByPatient()', () => {
    it('throws FORBIDDEN when DIETITIAN does not own patient', async () => {
      m.patient.findFirst.mockResolvedValue(null); // no match with dietitianId
      await expect(listInterviewsByPatient('patient-1', 'dietitian-2', 'DIETITIAN'))
        .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    });

    it('returns interview list for DIETITIAN who owns patient', async () => {
      m.patient.findFirst.mockResolvedValue({ id: 'patient-1', dietitianId: 'dietitian-1' });
      m.interview.findMany.mockResolvedValue([
        { id: 'i-1', type: 'CORE', createdAt: new Date(), patientId: 'patient-1' },
      ]);

      const result = await listInterviewsByPatient('patient-1', 'dietitian-1', 'DIETITIAN');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('i-1');
    });

    it('skips ownership check for ADMIN role', async () => {
      m.interview.findMany.mockResolvedValue([]);

      await listInterviewsByPatient('patient-1', 'admin-1', 'ADMIN');

      expect(m.patient.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── getLatestInterview ─────────────────────────────────────────────────────
  describe('getLatestInterview()', () => {
    it('throws FORBIDDEN when PATIENT requests another patients interview', async () => {
      m.patient.findUnique.mockResolvedValue({ id: 'patient-other' }); // different patient id
      await expect(getLatestInterview('patient-1', 'user-other', 'PATIENT'))
        .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    });

    it('throws FORBIDDEN when DIETITIAN does not own patient', async () => {
      m.patient.findFirst.mockResolvedValue(null);
      await expect(getLatestInterview('patient-1', 'dietitian-2', 'DIETITIAN'))
        .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    });

    it('throws NOT_FOUND when no interview exists', async () => {
      m.patient.findFirst.mockResolvedValue({ id: 'patient-1', dietitianId: 'dietitian-1' }); // dietitian owns patient
      m.interview.findFirst.mockResolvedValue(null);
      await expect(getLatestInterview('patient-1', 'dietitian-1', 'DIETITIAN'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('returns interview with decrypted answers', async () => {
      const encAnswers = encryptJson(ANSWERS);
      m.patient.findFirst.mockResolvedValue({ id: 'patient-1', dietitianId: 'dietitian-1' });
      m.interview.findFirst.mockResolvedValue(makeInterview({ answers: encAnswers }));

      const result = await getLatestInterview('patient-1', 'dietitian-1', 'DIETITIAN');

      expect(result.answers).toEqual(ANSWERS);
    });

    it('allows PATIENT to access their own interview', async () => {
      const encAnswers = encryptJson(ANSWERS);
      m.patient.findUnique.mockResolvedValue({ id: 'patient-1', userId: 'user-1' });
      m.interview.findFirst.mockResolvedValue(makeInterview({ answers: encAnswers }));

      const result = await getLatestInterview('patient-1', 'user-1', 'PATIENT');

      expect(result.answers).toEqual(ANSWERS);
    });

    it('decrypts medicalFlags when present', async () => {
      const flags = { highBP: true };
      m.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
      m.interview.findFirst.mockResolvedValue(
        makeInterview({ answers: encryptJson(ANSWERS), medicalFlags: encryptJson(flags) }),
      );

      const result = await getLatestInterview('patient-1', 'admin-1', 'ADMIN');
      expect(result.medicalFlags).toEqual(flags);
    });
  });
});
