import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks (available inside vi.mock factories) ────────────────────────
const m = vi.hoisted(() => ({
  // prisma tables
  user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  patient: { findUnique: vi.fn(), create: vi.fn() },
  dietitianProfile: { findUnique: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
  passwordResetToken: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  emailVerificationToken: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  // utilities
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerificationEmail: vi.fn(),
  logAudit: vi.fn(),
  redisSet: vi.fn(),
  bcryptCompare: vi.fn(),
  bcryptHash: vi.fn(),
}));

vi.mock('@db', () => {
  const referralCode = {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'ref-1', code: 'REF-TEST', userId: 'user-1' }),
    upsert: vi.fn().mockResolvedValue({ id: 'ref-1', code: 'REF-TEST', userId: 'user-1' }),
  };
  const deviceFingerprint = { findFirst: vi.fn().mockResolvedValue(null), upsert: vi.fn(), create: vi.fn() };
  const subscription = { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) };
  const userConsent = { createMany: vi.fn() };
  return {
    prisma: {
      user: m.user,
      patient: m.patient,
      dietitianProfile: m.dietitianProfile,
      passwordResetToken: m.passwordResetToken,
      emailVerificationToken: m.emailVerificationToken,
      appSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      referralCode,
      deviceFingerprint,
      subscription,
      userConsent,
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
        user: m.user, patient: m.patient, dietitianProfile: m.dietitianProfile,
        passwordResetToken: m.passwordResetToken, emailVerificationToken: m.emailVerificationToken,
        referralCode, subscription, userConsent, deviceFingerprint,
      })),
    },
    Prisma: {},
  };
});

vi.mock('../../utils/email', () => ({
  sendPasswordResetEmail: m.sendPasswordResetEmail,
  sendEmailVerificationEmail: m.sendEmailVerificationEmail,
}));

vi.mock('../../services/audit.service', () => ({ logAudit: m.logAudit }));

vi.mock('../../utils/redis', () => ({ redis: { set: m.redisSet, del: vi.fn(), get: vi.fn() } }));

vi.mock('bcryptjs', () => ({
  default: { compare: m.bcryptCompare, hash: m.bcryptHash },
}));

// ── imports (after mocks are in place) ───────────────────────────────────────
import {
  login,
  register,
  forgotPassword,
  resetPassword,
  verifyEmail,
  logout,
} from '../../services/auth.service';

// ── helpers ───────────────────────────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: 'hashed',
  role: 'PATIENT',
  emailVerified: new Date(),
  deletedAt: null,
  ...overrides,
});

// ── tests ─────────────────────────────────────────────────────────────────────
describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.sendPasswordResetEmail.mockResolvedValue(undefined);
    m.sendEmailVerificationEmail.mockResolvedValue(undefined);
  });

  // ── login ──────────────────────────────────────────────────────────────────
  describe('login()', () => {
    it('throws INVALID_CREDENTIALS when user not found', async () => {
      m.user.findFirst.mockResolvedValue(null);
      await expect(login('test@example.com', 'pass'))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
    });

    it('throws INVALID_CREDENTIALS when password is wrong', async () => {
      m.user.findFirst.mockResolvedValue(makeUser());
      m.bcryptCompare.mockResolvedValue(false);
      await expect(login('test@example.com', 'wrong'))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
    });

    it('throws EMAIL_NOT_VERIFIED when email not verified', async () => {
      m.user.findFirst.mockResolvedValue(makeUser({ emailVerified: null }));
      m.bcryptCompare.mockResolvedValue(true);
      await expect(login('test@example.com', 'pass'))
        .rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED', statusCode: 403 });
    });

    it('returns token and user on successful login', async () => {
      m.user.findFirst.mockResolvedValue(makeUser());
      m.bcryptCompare.mockResolvedValue(true);
      m.patient.findUnique.mockResolvedValue({ id: 'patient-1' });

      const result = await login('test@example.com', 'pass');

      expect(result.token).toBeDefined();
      expect(result.user).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        role: 'PATIENT',
        patientId: 'patient-1',
      });
    });

    it('returns patientId=null when no patient profile exists', async () => {
      m.user.findFirst.mockResolvedValue(makeUser({ role: 'ADMIN' }));
      m.bcryptCompare.mockResolvedValue(true);
      m.patient.findUnique.mockResolvedValue(null);

      const result = await login('admin@example.com', 'pass');
      expect(result.user.patientId).toBeNull();
    });
  });

  // ── register ───────────────────────────────────────────────────────────────
  describe('register()', () => {
    it('throws EMAIL_TAKEN when email already registered', async () => {
      m.user.findFirst.mockResolvedValue(makeUser());
      await expect(register('taken@example.com', 'pass'))
        .rejects.toMatchObject({ code: 'EMAIL_TAKEN', statusCode: 409 });
    });

    it('throws INVALID_DIETITIAN_CODE when code not found', async () => {
      m.user.findFirst.mockResolvedValue(null);
      m.dietitianProfile.findUnique.mockResolvedValue(null);
      await expect(register('new@example.com', 'pass', 'BADCODE'))
        .rejects.toMatchObject({ code: 'INVALID_DIETITIAN_CODE', statusCode: 400 });
    });

    it('creates user and patient on success', async () => {
      m.user.findFirst.mockResolvedValue(null);
      m.bcryptHash.mockResolvedValue('hashed-pw');
      m.user.create.mockResolvedValue({ id: 'user-new', email: 'new@example.com', role: 'PATIENT' });
      m.patient.create.mockResolvedValue({ id: 'patient-new' });
      m.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
      m.emailVerificationToken.create.mockResolvedValue({ id: 'tok-1' });

      const result = await register('new@example.com', 'pass', undefined, 'Jan', 'Kowalski');

      expect(result.user).toMatchObject({ id: 'user-new', email: 'new@example.com', role: 'PATIENT' });
      expect(m.patient.create).toHaveBeenCalledWith({
        data: { userId: 'user-new', dietitianId: null, firstName: 'Jan', lastName: 'Kowalski' },
      });
      expect(m.sendEmailVerificationEmail).toHaveBeenCalledOnce();
    });

    it('links dietitian when valid code provided', async () => {
      m.user.findFirst.mockResolvedValue(null);
      m.dietitianProfile.findFirst.mockResolvedValueOnce({ userId: 'dietitian-1' });
      m.bcryptHash.mockResolvedValue('hashed-pw');
      m.user.create.mockResolvedValue({ id: 'user-new', email: 'new@example.com', role: 'PATIENT' });
      m.patient.create.mockResolvedValue({ id: 'patient-new' });
      m.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
      m.emailVerificationToken.create.mockResolvedValue({ id: 'tok-1' });

      await register('new@example.com', 'pass', 'DIETCODE');

      expect(m.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ dietitianId: 'dietitian-1' }),
      });
    });

    it('invalidates old verification tokens before creating new one', async () => {
      m.user.findFirst.mockResolvedValue(null);
      m.bcryptHash.mockResolvedValue('hashed-pw');
      m.user.create.mockResolvedValue({ id: 'user-new', email: 'new@example.com', role: 'PATIENT' });
      m.patient.create.mockResolvedValue({ id: 'patient-new' });
      m.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
      m.emailVerificationToken.create.mockResolvedValue({ id: 'tok-new' });

      await register('new@example.com', 'pass');

      expect(m.emailVerificationToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-new', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────────────────
  describe('forgotPassword()', () => {
    it('returns silently when user does not exist (anti-enumeration)', async () => {
      m.user.findFirst.mockResolvedValue(null);
      await expect(forgotPassword('ghost@example.com')).resolves.toBeUndefined();
      expect(m.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('creates token and sends email when user exists', async () => {
      m.user.findFirst.mockResolvedValue(makeUser());
      m.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      m.passwordResetToken.create.mockResolvedValue({ id: 'tok-1' });

      await forgotPassword('test@example.com');

      expect(m.passwordResetToken.create).toHaveBeenCalledOnce();
      expect(m.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('/resetuj-haslo?token='),
      );
    });

    it('invalidates existing tokens before creating new one', async () => {
      m.user.findFirst.mockResolvedValue(makeUser());
      m.passwordResetToken.updateMany.mockResolvedValue({ count: 2 });
      m.passwordResetToken.create.mockResolvedValue({ id: 'tok-new' });

      await forgotPassword('test@example.com');

      expect(m.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────
  describe('resetPassword()', () => {
    it('throws INVALID_TOKEN when token not found or expired', async () => {
      m.passwordResetToken.findFirst.mockResolvedValue(null);
      await expect(resetPassword('badtoken', 'NewPassword123'))
        .rejects.toMatchObject({ code: 'INVALID_TOKEN', statusCode: 400 });
    });

    it('updates password hash on success', async () => {
      m.passwordResetToken.findFirst.mockResolvedValue({ userId: 'user-1' });
      m.bcryptHash.mockResolvedValue('new-hashed-pw');
      m.user.update.mockResolvedValue({});
      m.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      await resetPassword('validtoken', 'NewPassword123');

      expect(m.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-pw' },
      });
    });

    it('invalidates all reset tokens after password change', async () => {
      m.passwordResetToken.findFirst.mockResolvedValue({ userId: 'user-1' });
      m.bcryptHash.mockResolvedValue('new-hashed-pw');
      m.user.update.mockResolvedValue({});
      m.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      await resetPassword('validtoken', 'NewPassword123');

      expect(m.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('logs PASSWORD_RESET audit event', async () => {
      m.passwordResetToken.findFirst.mockResolvedValue({ userId: 'user-1' });
      m.bcryptHash.mockResolvedValue('new-hashed-pw');
      m.user.update.mockResolvedValue({});
      m.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      await resetPassword('validtoken', 'NewPassword123');

      expect(m.logAudit).toHaveBeenCalledWith({ userId: 'user-1', action: 'PASSWORD_RESET' });
    });
  });

  // ── verifyEmail ────────────────────────────────────────────────────────────
  describe('verifyEmail()', () => {
    it('throws INVALID_TOKEN when token not found or expired', async () => {
      m.emailVerificationToken.findFirst.mockResolvedValue(null);
      await expect(verifyEmail('badtoken'))
        .rejects.toMatchObject({ code: 'INVALID_TOKEN', statusCode: 400 });
    });

    it('sets emailVerified on success', async () => {
      m.emailVerificationToken.findFirst.mockResolvedValue({ userId: 'user-1' });
      m.user.update.mockResolvedValue({});
      m.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });

      await verifyEmail('validtoken');

      expect(m.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: expect.any(Date) },
      });
    });

    it('invalidates all verification tokens on success', async () => {
      m.emailVerificationToken.findFirst.mockResolvedValue({ userId: 'user-1' });
      m.user.update.mockResolvedValue({});
      m.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });

      await verifyEmail('validtoken');

      expect(m.emailVerificationToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('logs EMAIL_VERIFIED audit event', async () => {
      m.emailVerificationToken.findFirst.mockResolvedValue({ userId: 'user-1' });
      m.user.update.mockResolvedValue({});
      m.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });

      await verifyEmail('validtoken');

      expect(m.logAudit).toHaveBeenCalledWith({ userId: 'user-1', action: 'EMAIL_VERIFIED' });
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────
  describe('logout()', () => {
    it('blacklists token in Redis when token has exp', async () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { sub: 'user-1', email: 'x@x.com', role: 'PATIENT', exp: future },
        process.env.JWT_SECRET!,
      );
      m.redisSet.mockResolvedValue('OK');

      await logout(token, 'user-1');

      expect(m.redisSet).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:jwt:'),
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('logs LOGOUT audit event', async () => {
      m.redisSet.mockResolvedValue('OK');
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ sub: 'user-1', email: 'x@x.com', role: 'PATIENT' }, process.env.JWT_SECRET!);

      await logout(token, 'user-1');

      expect(m.logAudit).toHaveBeenCalledWith({ userId: 'user-1', action: 'LOGOUT' });
    });
  });
});
