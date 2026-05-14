import { prisma } from '@db';
import { logAudit } from './audit.service';

/**
 * Hard-deletes User records that were soft-deleted more than
 * RETENTION_DELETED_USER_DAYS days ago (RODO Phase 2.1).
 *
 * Runs as a BullMQ repeatable job — see src/jobs/cleanupSoftDeleted.job.ts.
 *
/**
 * FK handling — only AuditLog.userId needs explicit nullification
 * (must stay nullable for accountability after user hard-delete).
 * All other User-referencing relations are handled by schema-level
 * onDelete: Cascade or SetNull.
 */

const DEFAULT_RETENTION_DAYS = 30;

export function getRetentionDays(): number {
  const raw = process.env.RETENTION_DELETED_USER_DAYS;
  if (!raw) return DEFAULT_RETENTION_DAYS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RETENTION_DAYS;
}

export async function findExpiredSoftDeletedUsers(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - getRetentionDays() * 24 * 60 * 60 * 1000);
  return prisma.user.findMany({
    where: {
      deletedAt: { not: null, lt: cutoff },
    },
    select: { id: true, email: true, deletedAt: true, role: true },
  });
}

/**
 * Hard-delete a single User. Nulls FK references first so Postgres does not
 * reject the delete. All writes happen in one transaction — partial state is
 * impossible.
 *
 * Also deletes Lead rows matching this user's email — Lead has no FK to User
 * (anonymous at submission), but it carries the same person's PII. RODO
 * Art. 17 right to erasure covers it.
 */
export async function hardDeleteUser(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } });
    if (user) {
      await tx.lead.deleteMany({ where: { email: user.email } });
    }
    await tx.user.delete({ where: { id: userId } });
  });
}

export interface CleanupReport {
  foundAt: Date;
  retentionDays: number;
  totalFound: number;
  deletedIds: string[];
  failed: { userId: string; error: string }[];
}

export async function runUserCleanupJob(): Promise<CleanupReport> {
  const foundAt = new Date();
  const retentionDays = getRetentionDays();
  const candidates = await findExpiredSoftDeletedUsers(foundAt);

  const deletedIds: string[] = [];
  const failed: { userId: string; error: string }[] = [];

  for (const candidate of candidates) {
    try {
      await hardDeleteUser(candidate.id);
      deletedIds.push(candidate.id);
    } catch (err) {
      failed.push({
        userId: candidate.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const report: CleanupReport = {
    foundAt,
    retentionDays,
    totalFound: candidates.length,
    deletedIds,
    failed,
  };

  // Audit log — userId stays null because the job is system-initiated.
  logAudit({
    action: 'HARD_DELETE_EXPIRED_USER',
    resourceType: 'USER',
    metadata: {
      retentionDays,
      totalFound: candidates.length,
      deletedCount: deletedIds.length,
      failedCount: failed.length,
    },
  });

  return report;
}
