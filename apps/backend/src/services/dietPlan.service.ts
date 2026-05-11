import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptJson, decryptJson } from '../utils/encryption';
import { sendDietPlanReadyEmail } from '../utils/email';
import { getNutritionTargets } from './nutrition.service';
import { validatePlan } from './planValidation.service';
import { createRevision } from './revision.service';

// ─── types ────────────────────────────────────────────────────────────────────

interface CreateFromAiInput {
  patientId: string;
  tenantId?: string;
  kcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  content: Record<string, unknown>;
  aiProvider?: string;
  aiModel?: string;
  rawResponse?: Record<string, unknown>;
}

// ─── patient ownership guard ──────────────────────────────────────────────────

/**
 * Read access: all dietitians can view any patient's plans (for review).
 * Write access: only own patients or unassigned patients.
 */
async function assertDietitianCanAccessPatient(
  dietitianUserId: string,
  patientId: string,
  mode: 'read' | 'write' = 'read',
) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId },
    select: { dietitianId: true },
  });
  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }
  // Read access: all dietitians can view (for review / unassigned patients)
  if (mode === 'read') return;
  // Write access: own patients and unassigned patients only
  if (patient.dietitianId !== null && patient.dietitianId !== dietitianUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
}

// ─── from-ai ─────────────────────────────────────────────────────────────────

export async function createFromAi(input: CreateFromAiInput) {
  const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }

  // Fall back to NutritionTargets if caller did not supply macros
  let { kcal, proteinG, fatG, carbsG } = input;
  if (!kcal || !proteinG || !fatG || !carbsG) {
    const targets = await getNutritionTargets(input.patientId);
    if (targets) {
      kcal      = kcal      ?? targets.targetKcal;
      proteinG  = proteinG  ?? targets.targetProteinG;
      fatG      = fatG      ?? targets.targetFatG;
      carbsG    = carbsG    ?? targets.targetCarbsG;
    }
  }

  const dietPlan = await prisma.dietPlan.create({
    data: {
      patientId: input.patientId,
      tenantId: input.tenantId ?? null,
      source: 'AI',
      status: 'AI_DRAFT',
      kcal,
      proteinG,
      fatG,
      carbsG,
      content: encryptJson(input.content),
      aiProvider: input.aiProvider ?? 'openai',
      aiModel: input.aiModel,
      rawResponse: (input.rawResponse as Prisma.InputJsonObject | undefined) ?? Prisma.JsonNull,
    },
  });

  // Fire-and-forget: run validation immediately after plan creation
  validatePlan(dietPlan.id).catch(() => {});

  return { dietPlanId: dietPlan.id };
}

// ─── get latest (patient-aware) ───────────────────────────────────────────────

export async function getLatestDietPlan(patientId: string, role?: string) {
  const where: Prisma.DietPlanWhereInput = { patientId };
  if (role === 'PATIENT') {
    where.status = { in: ['PUBLISHED', 'SENT'] };
  }

  const dietPlan = await prisma.dietPlan.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (!dietPlan) {
    throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
  }

  return {
    ...dietPlan,
    content: decryptJson(dietPlan.content) as Record<string, unknown>,
  };
}

/** Returns the latest PUBLISHED/SENT plan for a patient (or null if none). Used by today's meals. */
export async function getLatestPublished(patientId: string) {
  const plan = await prisma.dietPlan.findFirst({
    where: { patientId, status: { in: ['PUBLISHED', 'SENT'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!plan) return null;
  return {
    ...plan,
    content: decryptJson(plan.content) as Record<string, unknown>,
  };
}

// ─── publish ──────────────────────────────────────────────────────────────────

export async function publishDietPlan(id: string, dietitianUserId: string, role: string) {
  const plan = await prisma.dietPlan.findUnique({ where: { id } });
  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
  }

  if (role === 'DIETITIAN') {
    await assertDietitianCanAccessPatient(dietitianUserId, plan.patientId, 'write');
  }

  if (plan.status !== 'AI_DRAFT') {
    throw new AppError(422, 'INVALID_TRANSITION', `Cannot publish a plan in status ${plan.status}`);
  }

  const updated = await prisma.dietPlan.update({
    where: { id },
    data: { status: 'PUBLISHED' },
    include: { patient: { include: { user: { select: { email: true } } } } },
  });

  // Record PUBLISHED revision
  createRevision(id, decryptJson(updated.content) as Record<string, unknown>, 'PUBLISHED', dietitianUserId).catch(() => {});

  const planUrl = `${process.env.APP_URL}/dashboard/plan`;
  sendDietPlanReadyEmail(
    updated.patient.user.email,
    updated.patient.firstName ?? '',
    planUrl,
  ).catch(() => {});

  return {
    ...updated,
    content: decryptJson(updated.content) as Record<string, unknown>,
  };
}

// ─── 2.2 management endpoints ────────────────────────────────────────────────

export interface ListDietPlansOptions {
  page: number;
  limit: number;
  patientId?: string;
  status?: 'GENERATED' | 'REVIEWED' | 'SENT' | 'AI_DRAFT' | 'PUBLISHED';
  dietitianUserId?: string;
  role?: string;
}

const patientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  user: { select: { email: true } },
} satisfies Prisma.PatientSelect;

export async function listDietPlans({ page, limit, patientId, status, dietitianUserId, role }: ListDietPlansOptions) {
  const skip = (page - 1) * limit;

  const where: Prisma.DietPlanWhereInput = {
    ...(patientId ? { patientId } : {}),
    ...(status ? { status } : {}),
    ...(role === 'DIETITIAN' && dietitianUserId
      ? { patient: { OR: [{ dietitianId: dietitianUserId }, { dietitianId: null }] } }
      : {}),
    // PATIENT can only see published/sent plans
    ...(role === 'PATIENT' && !status
      ? { status: { in: ['PUBLISHED', 'SENT'] } }
      : {}),
  };

  const [dietPlans, total] = await prisma.$transaction([
    prisma.dietPlan.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        patientId: true,
        tenantId: true,
        source: true,
        status: true,
        kcal: true,
        proteinG: true,
        fatG: true,
        carbsG: true,
        aiProvider: true,
        aiModel: true,
        validated: true,
        createdAt: true,
        patient: { select: patientSelect },
        // content intentionally omitted from list (decrypt on demand)
      },
    }),
    prisma.dietPlan.count({ where }),
  ]);

  return { dietPlans, total, page, limit };
}

export async function getDietPlan(id: string, dietitianUserId?: string, role?: string, accessMode: 'read' | 'write' = 'read') {
  const plan = await prisma.dietPlan.findUnique({
    where: { id },
    include: { patient: { select: patientSelect } },
  });

  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
  }

  if (role === 'DIETITIAN' && dietitianUserId) {
    await assertDietitianCanAccessPatient(dietitianUserId, plan.patientId, accessMode);
  }

  // PATIENT can only view their own PUBLISHED/SENT plans
  if (role === 'PATIENT' && dietitianUserId) {
    const patient = await prisma.patient.findUnique({ where: { userId: dietitianUserId }, select: { id: true } });
    if (!patient || patient.id !== plan.patientId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
    if (!['PUBLISHED', 'SENT'].includes(plan.status)) {
      throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
    }
  }

  return plan;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  AI_DRAFT: ['REVIEWED'],
  GENERATED: ['REVIEWED'],
  MANUAL_REVIEW_REQUIRED: ['REVIEWED'],
  REVIEWED: ['SENT'],
  SENT: [],
  PUBLISHED: [],
};

export async function updateStatus(
  id: string,
  newStatus: 'REVIEWED' | 'SENT',
  dietitianUserId?: string,
  role?: string
) {
  const plan = await getDietPlan(id, dietitianUserId, role, 'write');

  if (!STATUS_TRANSITIONS[plan.status]?.includes(newStatus)) {
    throw new AppError(
      422,
      'INVALID_TRANSITION',
      `Cannot transition from ${plan.status} to ${newStatus}`
    );
  }

  const updated = await prisma.dietPlan.update({
    where: { id },
    data: { status: newStatus },
    include: { patient: { select: patientSelect } },
  });

  if (newStatus === 'SENT') {
    const planUrl = `${process.env.APP_URL}/dashboard/plan`;
    sendDietPlanReadyEmail(
      updated.patient.user.email,
      updated.patient.firstName ?? '',
      planUrl,
    ).catch(() => {});
  }

  return {
    ...updated,
    content: decryptJson(updated.content) as Record<string, unknown>,
  };
}

interface CreateManualInput {
  patientId: string;
  tenantId?: string;
  kcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  content: Record<string, unknown>;
}

export async function createManual(input: CreateManualInput) {
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    include: { user: { select: { deletedAt: true } } },
  });

  if (!patient || patient.user.deletedAt !== null) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }

  const dietPlan = await prisma.dietPlan.create({
    data: {
      patientId: input.patientId,
      tenantId: input.tenantId ?? null,
      source: 'MANUAL',
      status: 'GENERATED',
      kcal: input.kcal,
      proteinG: input.proteinG,
      fatG: input.fatG,
      carbsG: input.carbsG,
      content: encryptJson(input.content),
    },
    include: { patient: { select: patientSelect } },
  });

  return {
    ...dietPlan,
    content: decryptJson(dietPlan.content) as Record<string, unknown>,
  };
}

export async function exportDietPlan(
  id: string,
  userId?: string,
  role?: string,
  userPatientId?: string,
) {
  let tenantId: string | null = null;

  if (role === 'PATIENT') {
    if (!userPatientId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
    const plan = await prisma.dietPlan.findFirst({
      where: { id, patientId: userPatientId, status: { in: ['PUBLISHED', 'SENT'] } },
    });
    if (!plan) throw new AppError(404, 'NOT_FOUND', 'Plan not found or not available');
    tenantId = plan.tenantId;
    const tenant = tenantId
      ? await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, logoUrl: true } })
      : null;
    return {
      ...plan,
      content: decryptJson(plan.content) as Record<string, unknown>,
      rawResponse: undefined,
      tenant: tenant ?? null,
    };
  }

  const plan = await getDietPlan(id, userId, role);
  tenantId = plan.tenantId;
  const tenant = tenantId
    ? await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, logoUrl: true } })
    : null;
  return {
    ...plan,
    content: decryptJson(plan.content) as Record<string, unknown>,
    rawResponse: undefined,
    tenant: tenant ?? null,
  };
}

// ─── get single (decrypted) ────────────────────────────────────────────────────

export async function getDietPlanById(id: string, dietitianUserId?: string, role?: string) {
  const plan = await getDietPlan(id, dietitianUserId, role);

  // 32.2.3: Extract aiProcessingReport and filter sensitive data from policyMetadata
  const rawMeta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};
  const aiProcessingReport = rawMeta.aiProcessingReport ?? null;

  // Remove bulky/internal fields from policyMetadata sent to frontend
  const { repairAttempts: _ra, protocolSnapshot: _ps, aiProcessingReport: _apr, ...safePolicyMeta } = rawMeta;

  return {
    ...plan,
    content: decryptJson(plan.content) as Record<string, unknown>,
    policyMetadata: safePolicyMeta,
    aiProcessingReport,
  };
}

// ─── update content / macros ──────────────────────────────────────────────────

interface UpdateContentInput {
  kcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  content: Record<string, unknown>;
}

export async function updateDietPlanContent(
  id: string,
  input: UpdateContentInput,
  dietitianUserId?: string,
  role?: string
) {
  const plan = await getDietPlan(id, dietitianUserId, role, 'write');

  if (['SENT', 'PUBLISHED'].includes(plan.status)) {
    throw new AppError(422, 'INVALID_STATE', `Cannot edit a plan in status ${plan.status}`);
  }

  const updated = await prisma.dietPlan.update({
    where: { id },
    data: {
      kcal: input.kcal,
      proteinG: input.proteinG,
      fatG: input.fatG,
      carbsG: input.carbsG,
      content: encryptJson(input.content),
    },
    include: { patient: { select: patientSelect } },
  });

  // Record DIETITIAN_EDIT revision
  createRevision(id, input.content, 'DIETITIAN_EDIT', dietitianUserId).catch(() => {});

  // Re-validate after content edit
  validatePlan(id).catch(() => {});

  return {
    ...updated,
    content: decryptJson(updated.content) as Record<string, unknown>,
  };
}
