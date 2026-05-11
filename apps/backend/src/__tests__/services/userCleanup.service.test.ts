import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  user: { findMany: vi.fn(), delete: vi.fn() },
  auditLog: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  tenant: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  patient: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  supplementPrescription: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  nutritionProtocol: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  logAudit: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    user: m.user,
    auditLog: m.auditLog,
    tenant: m.tenant,
    patient: m.patient,
    supplementPrescription: m.supplementPrescription,
    nutritionProtocol: m.nutritionProtocol,
    $transaction: async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
  },
}));

vi.mock('../../services/audit.service', () => ({
  logAudit: m.logAudit,
}));

const prismaMock = {
  user: m.user,
  auditLog: m.auditLog,
  tenant: m.tenant,
  patient: m.patient,
  supplementPrescription: m.supplementPrescription,
  nutritionProtocol: m.nutritionProtocol,
};

import {
  findExpiredSoftDeletedUsers,
  getRetentionDays,
  hardDeleteUser,
  runUserCleanupJob,
} from '../../services/userCleanup.service';

describe('getRetentionDays', () => {
  const ORIGINAL = process.env.RETENTION_DELETED_USER_DAYS;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.RETENTION_DELETED_USER_DAYS;
    else process.env.RETENTION_DELETED_USER_DAYS = ORIGINAL;
  });

  it('defaults to 30 when env var is missing', () => {
    delete process.env.RETENTION_DELETED_USER_DAYS;
    expect(getRetentionDays()).toBe(30);
  });

  it('parses valid integers from env', () => {
    process.env.RETENTION_DELETED_USER_DAYS = '90';
    expect(getRetentionDays()).toBe(90);
  });

  it('falls back to default on non-numeric env', () => {
    process.env.RETENTION_DELETED_USER_DAYS = 'banana';
    expect(getRetentionDays()).toBe(30);
  });

  it('falls back to default on zero/negative values', () => {
    process.env.RETENTION_DELETED_USER_DAYS = '0';
    expect(getRetentionDays()).toBe(30);
    process.env.RETENTION_DELETED_USER_DAYS = '-5';
    expect(getRetentionDays()).toBe(30);
  });
});

describe('findExpiredSoftDeletedUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RETENTION_DELETED_USER_DAYS;
  });

  it('queries with cutoff = now - retentionDays', async () => {
    m.user.findMany.mockResolvedValueOnce([]);
    const now = new Date('2026-04-17T00:00:00Z');
    await findExpiredSoftDeletedUsers(now);

    const arg = m.user.findMany.mock.calls[0][0];
    const cutoff = arg.where.deletedAt.lt as Date;
    const diffMs = now.getTime() - cutoff.getTime();
    expect(diffMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(arg.where.deletedAt.not).toBeNull();
  });

  it('returns what prisma returns', async () => {
    const rows = [{ id: 'u1', email: 'a@x', deletedAt: new Date(), role: 'PATIENT' }];
    m.user.findMany.mockResolvedValueOnce(rows);
    const result = await findExpiredSoftDeletedUsers(new Date());
    expect(result).toEqual(rows);
  });
});

describe('hardDeleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.user.delete.mockResolvedValue({ id: 'u1' });
  });

  it('nulls all FK references before deleting the User', async () => {
    await hardDeleteUser('u1');

    expect(m.auditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { userId: null },
    });
    expect(m.tenant.updateMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1' },
      data: { ownerId: null },
    });
    expect(m.patient.updateMany).toHaveBeenCalledWith({
      where: { dietitianId: 'u1' },
      data: { dietitianId: null },
    });
    expect(m.supplementPrescription.updateMany).toHaveBeenCalledWith({
      where: { dietitianId: 'u1' },
      data: { dietitianId: null },
    });
    expect(m.nutritionProtocol.updateMany).toHaveBeenCalledWith({
      where: { dietitianId: 'u1' },
      data: { dietitianId: null },
    });
    expect(m.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});

describe('runUserCleanupJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.user.delete.mockResolvedValue({ id: 'u1' });
  });

  it('returns empty report when nothing to delete', async () => {
    m.user.findMany.mockResolvedValueOnce([]);
    const report = await runUserCleanupJob();
    expect(report.totalFound).toBe(0);
    expect(report.deletedIds).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(m.user.delete).not.toHaveBeenCalled();
  });

  it('deletes each expired user and logs HARD_DELETE_EXPIRED_USER', async () => {
    m.user.findMany.mockResolvedValueOnce([
      { id: 'u1', email: 'a@x', deletedAt: new Date(), role: 'PATIENT' },
      { id: 'u2', email: 'b@x', deletedAt: new Date(), role: 'DIETITIAN' },
    ]);
    const report = await runUserCleanupJob();

    expect(report.totalFound).toBe(2);
    expect(report.deletedIds).toEqual(['u1', 'u2']);
    expect(m.user.delete).toHaveBeenCalledTimes(2);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HARD_DELETE_EXPIRED_USER',
        resourceType: 'USER',
        metadata: expect.objectContaining({
          totalFound: 2,
          deletedCount: 2,
          failedCount: 0,
        }),
      }),
    );
  });

  it('records failures without aborting the loop', async () => {
    m.user.findMany.mockResolvedValueOnce([
      { id: 'u1', email: 'a@x', deletedAt: new Date(), role: 'PATIENT' },
      { id: 'u2', email: 'b@x', deletedAt: new Date(), role: 'PATIENT' },
    ]);
    m.user.delete
      .mockRejectedValueOnce(new Error('FK violation'))
      .mockResolvedValueOnce({ id: 'u2' });

    const report = await runUserCleanupJob();

    expect(report.deletedIds).toEqual(['u2']);
    expect(report.failed).toEqual([
      { userId: 'u1', error: 'FK violation' },
    ]);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ deletedCount: 1, failedCount: 1 }),
      }),
    );
  });
});
