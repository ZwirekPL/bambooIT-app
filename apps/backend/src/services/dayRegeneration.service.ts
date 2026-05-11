/**
 * Patient day regeneration service.
 * Allows patients to regenerate a single day of their plan with auto-validation.
 * No dietitian approval required — validated by policy engine + smart scaling.
 */

import { prisma, Prisma } from '@db';
import type { DayRegenReason } from '@db';
import { decryptJson, encryptJson } from '../utils/encryption';
import { AppError } from '../utils/errors';
import { logAudit } from './audit.service';
import { dietPartialQueue } from '../queues';
import type { PlanContent } from './planValidation.service';
import { segmentUser } from './segmentation.service';
import { buildPatientContext as buildPatientPolicyContext, evaluatePolicies } from '../policies/policy-engine';
import type { PolicyResult } from '../policies/types';
import { getPersonalizedProducts } from './productSelection.service';
import { getCanonicalNamesGrouped } from './productNameStandardization.service';
import { getHighlyRatedRecipeNames } from './rating.service';
import type { PatientDayRegenInput } from './promptBuilder.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DayRegenRequest {
  planId: string;
  dayName: string;
  reason: DayRegenReason;
  keepSimilar: boolean;
  userId: string; // for audit
  patientId: string;
}

export interface DayRegenResult {
  triggered: boolean;
  message: string;
  regenId?: string;
  remaining?: number;
}

// ─── Enqueue day regeneration ───────────────────────────────────────────────

export async function enqueueDayRegeneration(req: DayRegenRequest): Promise<DayRegenResult> {
  const { planId, dayName, reason, keepSimilar, userId, patientId } = req;

  // 1. Fetch plan with patient + nutrition targets
  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    include: {
      patient: {
        include: {
          nutritionTargets: true,
          interviews: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      dayRegens: {
        where: { status: 'PENDING' },
        select: { id: true },
      },
    },
  });

  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Plan not found');

  // 2. Verify plan belongs to patient
  if (plan.patientId !== patientId) {
    throw new AppError(403, 'FORBIDDEN', 'Plan does not belong to this patient');
  }

  // 3. Verify plan status allows regeneration
  const allowedStatuses = ['GENERATED', 'REVIEWED', 'PUBLISHED', 'SENT'];
  if (!allowedStatuses.includes(plan.status)) {
    throw new AppError(400, 'INVALID_STATUS', `Cannot regenerate plan in status ${plan.status}`);
  }

  // 4. Check lock — no concurrent regeneration
  if (plan.dayRegens.length > 0) {
    throw new AppError(409, 'REGEN_IN_PROGRESS', 'A day regeneration is already in progress for this plan');
  }

  // 5. Check limit
  if (plan.dayRegenLimit <= 0) {
    throw new AppError(403, 'REGEN_LIMIT_REACHED', 'Day regeneration limit reached for this plan');
  }

  // 6. Decrypt content and find the day
  const content = decryptJson(plan.content) as PlanContent;
  if (!content?.days?.length) {
    throw new AppError(400, 'EMPTY_CONTENT', 'Plan has no content');
  }

  const originalDay = content.days.find((d) => d.day === dayName);
  if (!originalDay) {
    throw new AppError(400, 'INVALID_DAY', `Day "${dayName}" not found in plan`);
  }

  // 7. Create DayRegeneration record (acts as lock + undo snapshot)
  const regen = await prisma.dayRegeneration.create({
    data: {
      dietPlanId: planId,
      dayName,
      reason,
      keepSimilar,
      originalDay: originalDay as unknown as Prisma.InputJsonValue,
      status: 'PENDING',
    },
  });

  // 8. Collect full generation context
  const jobData = await buildRegenJobData(plan, content, originalDay, regen.id, req);

  // 9. Enqueue BullMQ job
  await dietPartialQueue.add('patient-day-regen', {
    ...jobData,
    regenId: regen.id,
    dietPlanId: planId,
  });

  // 10. Audit
  logAudit({
    userId,
    action: 'PATIENT_DAY_REGEN_REQUESTED',
    resourceType: 'DIET_PLAN',
    resourceId: planId,
    metadata: { regenId: regen.id, dayName, reason, keepSimilar, remaining: plan.dayRegenLimit - 1 },
  });

  return {
    triggered: true,
    message: 'Day regeneration enqueued',
    regenId: regen.id,
    remaining: plan.dayRegenLimit - 1,
  };
}

// ─── Build full job data with generation context ────────────────────────────

async function buildRegenJobData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan: any,
  content: PlanContent,
  originalDay: PlanContent['days'][number],
  regenId: string,
  req: DayRegenRequest,
): Promise<PatientDayRegenInput & { regenId: string; dietPlanId: string }> {
  const { dayName, reason, keepSimilar, patientId } = req;

  // Segment + patient context
  const segment = await segmentUser(patientId);
  if (!segment) throw new AppError(500, 'SEGMENTATION_FAILED', 'Could not segment patient');

  const patientCtx = await buildPatientPolicyContext(patientId);

  // Policy evaluation
  const emptyPolicy: PolicyResult = {
    appliedRules: [], targetModifications: [], mealDistributions: [],
    nutrientLimits: [], excludeFlags: [], preferFlags: [],
    excludeKeywords: [], clinicalNotes: [], supplements: [], conflicts: [],
  };
  const policyResult: PolicyResult = patientCtx
    ? evaluatePolicies([], patientCtx)
    : emptyPolicy;

  // Override with plan's stored policy metadata if available
  const policyMeta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};
  const excludeKeywords = (policyMeta.excludeKeywords as string[]) ?? policyResult.excludeKeywords;
  const clinicalNotesRaw = (policyMeta.clinicalNotes as string[]) ?? policyResult.clinicalNotes.map((n: { note: string }) => n.note);

  // Nutrition targets
  const targets = plan.patient?.nutritionTargets;
  const nutritionTargets = {
    kcal: targets?.targetKcal ?? plan.kcal ?? 0,
    proteinG: Number(targets?.targetProteinG ?? plan.proteinG ?? 0),
    fatG: Number(targets?.targetFatG ?? plan.fatG ?? 0),
    carbsG: Number(targets?.targetCarbsG ?? plan.carbsG ?? 0),
  };

  // Patient profile
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { sex: true, heightCm: true, weightKg: true, birthYear: true, birthDate: true },
  });

  let ageYears: number | null = null;
  if (patient?.birthDate) {
    ageYears = Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  } else if (patient?.birthYear) {
    ageYears = new Date().getFullYear() - patient.birthYear;
  }

  // Personalized products
  let canonicalProductsGrouped: Record<string, string[]> = {};
  let healthProducts: Array<{ name: string; reason: string; category: string }> | undefined;
  let dislikedProducts: string[] | undefined;
  try {
    const personalizedProducts = await getPersonalizedProducts({
      patientId,
      policyResult,
      preferences: {
        dietType: segment.dietType,
        allergies: segment.allergies,
        preferredFoods: patientCtx?.preferredFoods,
        dislikedFoods: patientCtx?.dislikedFoods,
        budget: patientCtx?.budget,
      },
    });
    canonicalProductsGrouped = personalizedProducts.categories;
    if (personalizedProducts.health?.length) {
      healthProducts = personalizedProducts.health.map((h) => ({ name: h.name, reason: h.reason, category: h.category }));
    }
    if (personalizedProducts.disliked?.length) {
      dislikedProducts = personalizedProducts.disliked;
    }
  } catch {
    // Fallback to basic product list
    canonicalProductsGrouped = await getCanonicalNamesGrouped({
      dietType: segment.dietType,
      allergies: segment.allergies,
      excludeKeywords,
    }).catch(() => ({} as Record<string, string[]>));
  }

  // Highly rated recipes
  let highlyRatedRecipeNames: string[] | undefined;
  try {
    const names = await getHighlyRatedRecipeNames();
    if (names.length > 0) highlyRatedRecipeNames = names;
  } catch {
    // Optional
  }

  return {
    regenId,
    dietPlanId: plan.id,
    dayName,
    reason,
    keepSimilar,
    currentContent: content,
    originalDay,
    nutritionTargets,
    segment: {
      goal: segment.goal,
      mealCount: segment.mealCount,
      dietType: segment.dietType,
      allergies: segment.allergies,
    },
    anonymizedProfile: {
      sex: patient?.sex ?? null,
      heightCm: patient?.heightCm ? Number(patient.heightCm) : null,
      weightKg: patient?.weightKg ? Number(patient.weightKg) : null,
      ageYears,
      goal: patientCtx?.goal ?? null,
    },
    policyContext: {
      excludeKeywords,
      clinicalNotes: clinicalNotesRaw,
      nutrientLimits: (policyResult.nutrientLimits ?? []).map((l) => ({
        nutrient: l.nutrient,
        scope: l.scope,
        min: l.min,
        max: l.max,
      })),
      appliedRuleNames: (policyResult.appliedRules ?? []).map((r) => r.ruleName),
    },
    preferences: {
      mealsPerDay: segment.mealCount,
      dietType: segment.dietType,
      preferredFoods: patientCtx?.preferredFoods,
      dislikedFoods: patientCtx?.dislikedFoods,
      cookingTime: patientCtx?.cookingTime,
      budget: patientCtx?.budget,
      intolerances: patientCtx?.intolerances,
    },
    canonicalProductsGrouped: Object.keys(canonicalProductsGrouped).length > 0 ? canonicalProductsGrouped : undefined,
    highlyRatedRecipeNames,
    healthProducts,
    dislikedProducts,
  };
}

// ─── Undo day regeneration ──────────────────────────────────────────────────

export async function undoDayRegeneration(
  regenId: string,
  userId: string,
  patientId: string,
): Promise<{ success: boolean; message: string }> {
  const regen = await prisma.dayRegeneration.findUnique({
    where: { id: regenId },
    include: { dietPlan: { select: { id: true, patientId: true, content: true, dayRegenLimit: true } } },
  });

  if (!regen) throw new AppError(404, 'NOT_FOUND', 'Regeneration record not found');
  if (regen.dietPlan.patientId !== patientId) {
    throw new AppError(403, 'FORBIDDEN', 'Not your plan');
  }
  if (regen.status !== 'SUCCESS') {
    throw new AppError(400, 'INVALID_STATUS', 'Can only undo successful regenerations');
  }

  // Restore original day
  const content = decryptJson(regen.dietPlan.content) as PlanContent;
  const dayIndex = content.days.findIndex((d) => d.day === regen.dayName);
  if (dayIndex === -1) {
    throw new AppError(500, 'DAY_NOT_FOUND', 'Day not found in current plan');
  }

  content.days[dayIndex] = regen.originalDay as unknown as PlanContent['days'][number];

  // Update plan + restore limit
  await prisma.$transaction([
    prisma.dietPlan.update({
      where: { id: regen.dietPlan.id },
      data: {
        content: encryptJson(content as unknown as Record<string, unknown>) as unknown as Prisma.InputJsonValue,
        dayRegenLimit: regen.dietPlan.dayRegenLimit + 1,
      },
    }),
    prisma.dayRegeneration.delete({ where: { id: regenId } }),
  ]);

  logAudit({
    userId,
    action: 'PATIENT_DAY_REGEN_UNDONE',
    resourceType: 'DIET_PLAN',
    resourceId: regen.dietPlan.id,
    metadata: { regenId, dayName: regen.dayName, newRemaining: regen.dietPlan.dayRegenLimit + 1 },
  });

  return { success: true, message: 'Day restored to original' };
}

// ─── Get regen status for a plan ────────────────────────────────────────────

export async function getDayRegenStatus(planId: string, patientId: string) {
  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    select: {
      patientId: true,
      dayRegenLimit: true,
      dayRegens: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, dayName: true, reason: true, status: true, createdAt: true },
      },
    },
  });

  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Plan not found');
  if (plan.patientId !== patientId) throw new AppError(403, 'FORBIDDEN', 'Not your plan');

  return {
    remaining: plan.dayRegenLimit,
    regens: plan.dayRegens,
    inProgress: plan.dayRegens.some((r) => r.status === 'PENDING'),
  };
}
