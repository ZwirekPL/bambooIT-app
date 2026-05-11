import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auditLog: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  logAudit: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: { auditLog: m.auditLog },
}));

vi.mock('../../services/audit.service', () => ({
  logAudit: m.logAudit,
}));

import {
  getAuditRetentionYears,
  runAuditRetentionJob,
} from '../../services/auditRetention.service';

describe('getAuditRetentionYears', () => {
  const ORIGINAL = process.env.RETENTION_AUDIT_LOG_YEARS;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.RETENTION_AUDIT_LOG_YEARS;
    else process.env.RETENTION_AUDIT_LOG_YEARS = ORIGINAL;
  });

  it('defaults to 5 years', () => {
    delete process.env.RETENTION_AUDIT_LOG_YEARS;
    expect(getAuditRetentionYears()).toBe(5);
  });

  it('reads integer from env', () => {
    process.env.RETENTION_AUDIT_LOG_YEARS = '7';
    expect(getAuditRetentionYears()).toBe(7);
  });

  it('falls back to default on non-numeric', () => {
    process.env.RETENTION_AUDIT_LOG_YEARS = 'foo';
    expect(getAuditRetentionYears()).toBe(5);
  });

  it('falls back to default on zero/negative', () => {
    process.env.RETENTION_AUDIT_LOG_YEARS = '0';
    expect(getAuditRetentionYears()).toBe(5);
    process.env.RETENTION_AUDIT_LOG_YEARS = '-1';
    expect(getAuditRetentionYears()).toBe(5);
  });
});

describe('runAuditRetentionJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RETENTION_AUDIT_LOG_YEARS;
  });

  it('does nothing when no expired rows', async () => {
    m.auditLog.findMany.mockResolvedValueOnce([]);
    const report = await runAuditRetentionJob();
    expect(report.totalDeleted).toBe(0);
    expect(report.batchesRun).toBe(0);
    expect(m.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it('uses cutoff = now - retentionYears', async () => {
    process.env.RETENTION_AUDIT_LOG_YEARS = '3';
    m.auditLog.findMany.mockResolvedValueOnce([]);
    const now = new Date('2026-04-17T00:00:00Z');
    await runAuditRetentionJob(now);

    const arg = m.auditLog.findMany.mock.calls[0][0];
    const cutoff = arg.where.createdAt.lt as Date;
    expect(cutoff.getUTCFullYear()).toBe(2023);
    expect(cutoff.getUTCMonth()).toBe(3); // April
    expect(cutoff.getUTCDate()).toBe(17);
  });

  it('batches: runs until findMany returns empty', async () => {
    const batch1 = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    const batch2 = Array.from({ length: 500 }, (_, i) => ({ id: `b${i}` }));
    m.auditLog.findMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([]);
    m.auditLog.deleteMany
      .mockResolvedValueOnce({ count: 1000 })
      .mockResolvedValueOnce({ count: 500 });

    const report = await runAuditRetentionJob();
    expect(report.totalDeleted).toBe(1500);
    expect(report.batchesRun).toBe(2);
    expect(report.hitBatchLimit).toBe(false);
  });

  it('logs AUDIT_LOG_PURGED with counts', async () => {
    m.auditLog.findMany
      .mockResolvedValueOnce([{ id: 'x1' }, { id: 'x2' }])
      .mockResolvedValueOnce([]);
    m.auditLog.deleteMany.mockResolvedValueOnce({ count: 2 });

    await runAuditRetentionJob();

    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUDIT_LOG_PURGED',
        resourceType: 'AUDIT_LOG',
        metadata: expect.objectContaining({
          totalDeleted: 2,
          batchesRun: 1,
          retentionYears: 5,
        }),
      }),
    );
  });
});
