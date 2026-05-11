import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptJson, decryptJson } from '../utils/encryption';

// ─── types ────────────────────────────────────────────────────────────────────

export type RevisionReason = 'AI_GENERATED' | 'AUTO_ADJUST' | 'DIETITIAN_EDIT' | 'PUBLISHED' | 'CHECKIN_ADJUSTMENT' | 'SLOT_REPAIR';

// ─── create revision ──────────────────────────────────────────────────────────

/**
 * Records a snapshot of the current plan content as a new revision.
 * revisionNumber is auto-incremented (max existing + 1).
 */
export async function createRevision(
  dietPlanId: string,
  contentJson: Record<string, unknown>,
  reason: RevisionReason,
  createdBy?: string,
): Promise<void> {
  const last = await prisma.dietPlanRevision.findFirst({
    where: { dietPlanId },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  });

  const nextNumber = (last?.revisionNumber ?? 0) + 1;

  await prisma.dietPlanRevision.create({
    data: {
      dietPlanId,
      revisionNumber: nextNumber,
      createdBy: createdBy ?? null,
      reason,
      contentJson: encryptJson(contentJson) as Prisma.InputJsonObject,
    },
  });
}

// ─── list revisions ───────────────────────────────────────────────────────────

export async function listRevisions(dietPlanId: string, dietitianUserId?: string, role?: string) {
  const plan = await prisma.dietPlan.findUnique({
    where: { id: dietPlanId },
    select: { patientId: true },
  });

  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

  if (role === 'DIETITIAN' && dietitianUserId) {
    const patient = await prisma.patient.findFirst({
      where: { id: plan.patientId, dietitianId: dietitianUserId },
    });
    if (!patient) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  const revisions = await prisma.dietPlanRevision.findMany({
    where: { dietPlanId },
    orderBy: { revisionNumber: 'desc' },
    select: {
      id: true,
      revisionNumber: true,
      reason: true,
      createdBy: true,
      createdAt: true,
      // contentJson omitted from list — fetch individually if needed
    },
  });

  return revisions;
}

// ─── get single revision (decrypted) ─────────────────────────────────────────

export async function getRevision(
  revisionId: string,
  dietitianUserId?: string,
  role?: string,
) {
  const revision = await prisma.dietPlanRevision.findUnique({
    where: { id: revisionId },
    include: { dietPlan: { select: { patientId: true } } },
  });

  if (!revision) throw new AppError(404, 'NOT_FOUND', 'Revision not found');

  if (role === 'DIETITIAN' && dietitianUserId) {
    const patient = await prisma.patient.findFirst({
      where: { id: revision.dietPlan.patientId, dietitianId: dietitianUserId },
    });
    if (!patient) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  return {
    id: revision.id,
    dietPlanId: revision.dietPlanId,
    revisionNumber: revision.revisionNumber,
    reason: revision.reason,
    createdBy: revision.createdBy,
    createdAt: revision.createdAt,
    contentJson: decryptJson(revision.contentJson) as Record<string, unknown>,
  };
}
