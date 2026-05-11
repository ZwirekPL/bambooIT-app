import { prisma } from '@db';
import { logAudit } from './audit.service';

/**
 * Purges AuditLog entries older than RETENTION_AUDIT_LOG_YEARS years
 * (RODO Phase 2.2). Runs as a BullMQ repeatable job — see
 * src/jobs/cleanupSoftDeleted.job.ts (maintenance worker handles both).
 *
 * Batching — deletes in chunks of BATCH_SIZE so long-running purges don't
 * hold locks on the AuditLog table. Stops when a batch returns 0.
 */

const DEFAULT_RETENTION_YEARS = 5;
const BATCH_SIZE = 1000;
const MAX_BATCHES = 1000; // safety: at most 1M rows per run

export function getAuditRetentionYears(): number {
  const raw = process.env.RETENTION_AUDIT_LOG_YEARS;
  if (!raw) return DEFAULT_RETENTION_YEARS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RETENTION_YEARS;
}

function cutoffDate(now: Date = new Date()): Date {
  const years = getAuditRetentionYears();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return cutoff;
}

export interface AuditPurgeReport {
  foundAt: Date;
  retentionYears: number;
  cutoff: Date;
  totalDeleted: number;
  batchesRun: number;
  hitBatchLimit: boolean;
}

/**
 * Deletes in chunks of BATCH_SIZE. Each iteration:
 *   1. Find up to BATCH_SIZE expired ids
 *   2. DELETE ... WHERE id IN (...)
 * Loops until an iteration finds 0 rows or MAX_BATCHES hit.
 */
export async function runAuditRetentionJob(now: Date = new Date()): Promise<AuditPurgeReport> {
  const foundAt = now;
  const retentionYears = getAuditRetentionYears();
  const cutoff = cutoffDate(now);

  let totalDeleted = 0;
  let batchesRun = 0;
  let hitBatchLimit = false;

  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = await prisma.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const result = await prisma.auditLog.deleteMany({
      where: { id: { in: batch.map((r) => r.id) } },
    });

    totalDeleted += result.count;
    batchesRun += 1;

    if (i === MAX_BATCHES - 1 && batch.length === BATCH_SIZE) {
      hitBatchLimit = true;
    }
  }

  logAudit({
    action: 'AUDIT_LOG_PURGED',
    resourceType: 'AUDIT_LOG',
    metadata: {
      retentionYears,
      cutoff: cutoff.toISOString(),
      totalDeleted,
      batchesRun,
      hitBatchLimit,
    },
  });

  return {
    foundAt,
    retentionYears,
    cutoff,
    totalDeleted,
    batchesRun,
    hitBatchLimit,
  };
}
