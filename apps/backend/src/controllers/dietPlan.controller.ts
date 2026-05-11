import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as dietPlanService from '../services/dietPlan.service';
import { runGenerationPipeline } from '../services/planPipeline.service';
import { enqueuePartialRegeneration as triggerPartialRegeneration } from '../services/aiGeneration.service';
import { listRevisions, getRevision } from '../services/revision.service';
import { logAudit } from '../services/audit.service';
import { enqueueDayRegeneration, undoDayRegeneration, getDayRegenStatus } from '../services/dayRegeneration.service';
import { repairSlot } from '../services/slotRepair.service';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache';
import { generateDietPlanPdf } from '../pdf';
import { resolveEffectiveMealName } from '../pdf/content-parser';
import { generateCalendar } from '../services/calendar.service';
import { analyzePlanMicronutrients } from '../services/micronutrientAnalysis.service';
import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { redis } from '../utils/redis';
import { loadPatientMealDistribution, computeMealDistribution } from '../services/mealDistribution.service';
import { findCandidates } from '../services/recipeCandidate.service';

const DIET_PLAN_TTL = 60;

// ─── shared schemas ───────────────────────────────────────────────────────────

const createFromAiSchema = z.object({
  patientId: z.string().cuid(),
  tenantId: z.string().optional(),
  kcal: z.number().int().positive().optional(),
  proteinG: z.number().int().nonnegative().optional(),
  fatG: z.number().int().nonnegative().optional(),
  carbsG: z.number().int().nonnegative().optional(),
  content: z.record(z.unknown()),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
  rawResponse: z.record(z.unknown()).optional(),
});

const patientIdSchema = z.object({ patientId: z.string().cuid() });
const planIdSchema = z.object({ id: z.string().cuid() });

// ─── existing handlers ────────────────────────────────────────────────────────

export async function createFromAi(req: Request, res: Response, next: NextFunction) {
  const parsed = createFromAiSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const result = await dietPlanService.createFromAi(parsed.data);
    await cacheDel(`cache:diet-plan:latest:${parsed.data.patientId}`);
    logAudit({ userId: req.user?.sub, action: 'GENERATE_PLAN', resourceType: 'DIET_PLAN', resourceId: result.dietPlanId, ip: req.ip });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getLatest(req: Request, res: Response, next: NextFunction) {
  const role = req.user!.role;

  // PATIENT always sees only their own plan — ignore URL param
  let patientId: string;
  if (role === 'PATIENT') {
    if (!req.user!.patientId) {
      return res.status(404).json(apiError('NOT_FOUND', 'Patient profile not found'));
    }
    patientId = req.user!.patientId;
  } else {
    const parsed = patientIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
    }
    patientId = parsed.data.patientId;
  }

  const cacheKey = `cache:diet-plan:latest:${patientId}:${role}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ ok: true, dietPlan: cached });
    }

    const dietPlan = await dietPlanService.getLatestDietPlan(patientId, role);
    await cacheSet(cacheKey, dietPlan, DIET_PLAN_TTL);
    logAudit({ userId: req.user?.sub, action: 'VIEW_PLAN', resourceType: 'DIET_PLAN', resourceId: dietPlan?.id, ip: req.ip });
    return res.json({ ok: true, dietPlan });
  } catch (err) {
    next(err);
  }
}

// ─── 2.2 management handlers ──────────────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  patientId: z.string().cuid().optional(),
  status: z.enum(['AI_DRAFT', 'GENERATED', 'REVIEWED', 'SENT', 'PUBLISHED']).optional(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    // PATIENT can only see their own plans
    const effectivePatientId =
      req.user?.role === 'PATIENT' ? req.user.patientId : parsed.data.patientId;

    // PATIENT without a patientId in token — return empty
    if (req.user?.role === 'PATIENT' && !effectivePatientId) {
      return res.json({ ok: true, dietPlans: [], total: 0, page: parsed.data.page, limit: parsed.data.limit });
    }

    const result = await dietPlanService.listDietPlans({
      ...parsed.data,
      patientId: effectivePatientId,
      dietitianUserId: req.user?.sub,
      role: req.user?.role,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

const updateStatusSchema = z.object({
  status: z.enum(['REVIEWED', 'SENT']),
});

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  const idParsed = planIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const bodyParsed = updateStatusSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid status value'));
  }

  try {
    const plan = await dietPlanService.updateStatus(
      idParsed.data.id,
      bodyParsed.data.status,
      req.user?.sub,
      req.user?.role
    );
    await cacheDel(`cache:diet-plan:latest:${plan.patientId}`);
    const action = bodyParsed.data.status === 'REVIEWED' ? 'APPROVE_PLAN' : 'SEND_PLAN';
    logAudit({ userId: req.user?.sub, action, resourceType: 'DIET_PLAN', resourceId: idParsed.data.id, ip: req.ip });
    return res.json({ ok: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function publishPlan(req: Request, res: Response, next: NextFunction) {
  const parsed = planIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    const plan = await dietPlanService.publishDietPlan(parsed.data.id, req.user!.sub, req.user!.role);
    await cacheDel(`cache:diet-plan:latest:${plan.patientId}`);
    logAudit({ userId: req.user?.sub, action: 'PUBLISH_PLAN', resourceType: 'DIET_PLAN', resourceId: parsed.data.id, ip: req.ip });
    return res.json({ ok: true, plan });
  } catch (err) {
    next(err);
  }
}

const createManualSchema = z.object({
  kcal: z.number().int().positive().optional(),
  proteinG: z.number().int().nonnegative().optional(),
  fatG: z.number().int().nonnegative().optional(),
  carbsG: z.number().int().nonnegative().optional(),
  content: z.record(z.unknown()),
});

export async function createManual(req: Request, res: Response, next: NextFunction) {
  const idParsed = patientIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  const bodyParsed = createManualSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const plan = await dietPlanService.createManual({
      patientId: idParsed.data.patientId,
      ...bodyParsed.data,
    });
    await cacheDel(`cache:diet-plan:latest:${idParsed.data.patientId}`);
    logAudit({ userId: req.user?.sub, action: 'CREATE_MANUAL_PLAN', resourceType: 'DIET_PLAN', resourceId: plan.id, ip: req.ip });
    return res.status(201).json({ ok: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function exportPlan(req: Request, res: Response, next: NextFunction) {
  const parsed = planIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    // 39.5: Rate limit PDF exports (5/week per patient)
    if (req.user?.role === 'PATIENT' && req.user?.patientId) {
      const rateLimitKey = `pdf-export:${req.user.patientId}`;
      const count = await redis.incr(rateLimitKey);
      if (count === 1) {
        await redis.expire(rateLimitKey, 7 * 24 * 60 * 60); // 1 week
      }
      if (count > 5) {
        return res.status(429).json(apiError('PDF_LIMIT_EXCEEDED', 'Maximum 5 PDF exports per week. Try again next week.'));
      }
    }

    const plan = await dietPlanService.exportDietPlan(
      parsed.data.id,
      req.user?.sub,
      req.user?.role,
      req.user?.patientId,
    );
    logAudit({ userId: req.user?.sub, action: 'EXPORT_PLAN', resourceType: 'DIET_PLAN', resourceId: parsed.data.id, ip: req.ip });

    // 38.10 + 39.5.1: Fetch patient for micronutrient analysis + watermark
    let micronutrients = null;
    let watermarkText: string | null = null;
    try {
      const patient = await prisma.patient.findUnique({
        where: { id: plan.patientId ?? '' },
        select: { sex: true, birthYear: true, birthDate: true, user: { select: { email: true } } },
      });

      // 39.5.1: Watermark
      watermarkText = patient?.user?.email ?? null;

      // 38.10: Micronutrient analysis
      let age: number | null = null;
      if (patient?.birthDate) {
        age = Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      } else if (patient?.birthYear) {
        age = new Date().getFullYear() - patient.birthYear;
      }

      const report = await analyzePlanMicronutrients(
        plan.content as Record<string, unknown>,
        patient?.sex ?? null,
        age,
      );
      micronutrients = {
        overallScore: report.overallScore,
        analyzedDays: report.analyzedDays,
        assessments: report.assessments,
        supplementRecommendations: report.supplementRecommendations,
      };
    } catch {
      // Non-critical: PDF will be generated without micronutrient page
    }

    const doc = await generateDietPlanPdf({ ...plan, micronutrients, watermarkText });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="plan-diety-${parsed.data.id}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    next(err);
  }
}

// ─── export as .ics calendar ─────────────────────────────────────────────────

export async function exportCalendar(req: Request, res: Response, next: NextFunction) {
  const parsed = planIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;

  try {
    const icsContent = await generateCalendar(
      parsed.data.id,
      req.user?.sub,
      req.user?.role,
      req.user?.patientId,
      startDate,
    );

    logAudit({
      userId: req.user?.sub,
      action: 'EXPORT_PLAN',
      resourceType: 'DIET_PLAN',
      resourceId: parsed.data.id,
      ip: req.ip,
      metadata: { format: 'ics' },
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="plan-diety-${parsed.data.id}.ics"`);
    return res.send(icsContent);
  } catch (err) {
    next(err);
  }
}

// ─── get plan status (lightweight, no content decryption) ─────────────────────

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  const parsed = planIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Nieprawidłowe ID planu'));
  }

  try {
    const plan = await prisma.dietPlan.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        status: true,
        aiModel: true,
        createdAt: true,
        kcal: true,
      },
    });
    if (!plan) {
      return res.status(404).json(apiError('NOT_FOUND', 'Plan nie został znaleziony'));
    }

    // Compute generation phase based on aiModel
    let phase: string = 'generating';
    if (plan.aiModel?.includes('partial')) phase = 'completing';
    else if (plan.aiModel?.includes('repair')) phase = 'repairing';
    else if (plan.status === 'GENERATED' || plan.status === 'MANUAL_REVIEW_REQUIRED') phase = 'done';
    else if (plan.status === 'GENERATION_FAILED') phase = 'failed';

    const elapsedMs = Date.now() - new Date(plan.createdAt).getTime();

    return res.json({
      ok: true,
      id: plan.id,
      status: plan.status,
      phase,
      elapsedMs,
    });
  } catch (err) {
    next(err);
  }
}

// ─── get single plan (decrypted) ──────────────────────────────────────────────

export async function getById(req: Request, res: Response, next: NextFunction) {
  const parsed = planIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    const plan = await dietPlanService.getDietPlanById(parsed.data.id, req.user?.sub, req.user?.role);
    logAudit({ userId: req.user?.sub, action: 'VIEW_PLAN', resourceType: 'DIET_PLAN', resourceId: parsed.data.id, ip: req.ip });
    return res.json({ ok: true, plan });
  } catch (err) {
    next(err);
  }
}

// ─── trigger generation pipeline ─────────────────────────────────────────────

export async function triggerGenerate(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const result = await runGenerationPipeline(parsed.data.patientId);
    if (!result) {
      return res.status(422).json(
        apiError('PIPELINE_SKIPPED', 'Patient profile is incomplete — cannot generate plan'),
      );
    }
    await cacheDel(`cache:diet-plan:latest:${parsed.data.patientId}`);
    logAudit({
      userId: req.user?.sub,
      action: 'GENERATE_PLAN',
      resourceType: 'DIET_PLAN',
      resourceId: result.dietPlanId,
      ip: req.ip,
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── update content / macros ──────────────────────────────────────────────────

const updateContentSchema = z.object({
  kcal: z.number().int().positive().optional(),
  proteinG: z.number().int().nonnegative().optional(),
  fatG: z.number().int().nonnegative().optional(),
  carbsG: z.number().int().nonnegative().optional(),
  content: z.record(z.unknown()),
});

export async function updateContent(req: Request, res: Response, next: NextFunction) {
  const idParsed = planIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const bodyParsed = updateContentSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const plan = await dietPlanService.updateDietPlanContent(
      idParsed.data.id,
      bodyParsed.data,
      req.user?.sub,
      req.user?.role
    );
    await cacheDel(`cache:diet-plan:latest:${plan.patientId}`);
    logAudit({ userId: req.user?.sub, action: 'EDIT_PLAN', resourceType: 'DIET_PLAN', resourceId: idParsed.data.id, ip: req.ip });
    return res.json({ ok: true, plan });
  } catch (err) {
    next(err);
  }
}

// ─── revisions ────────────────────────────────────────────────────────────────

const revisionIdSchema = z.object({ revisionId: z.string().cuid() });

export async function getRevisions(req: Request, res: Response, next: NextFunction) {
  const parsed = planIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    const revisions = await listRevisions(parsed.data.id, req.user?.sub, req.user?.role);
    return res.json({ ok: true, revisions });
  } catch (err) {
    next(err);
  }
}

export async function getRevisionById(req: Request, res: Response, next: NextFunction) {
  const parsed = revisionIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid revision id'));
  }

  try {
    const revision = await getRevision(parsed.data.revisionId, req.user?.sub, req.user?.role);
    return res.json({ ok: true, revision });
  } catch (err) {
    next(err);
  }
}

// ─── partial regeneration (32.2.7) ──────────────────────────────────────────

const partialRegenerateSchema = z.object({
  days: z.array(z.string()).optional(),
  meals: z.array(z.object({ day: z.string(), meal: z.string() })).optional(),
}).refine(
  data => (data.days && data.days.length > 0) || (data.meals && data.meals.length > 0),
  { message: 'Must specify at least one day or meal to regenerate' },
);

export async function regeneratePartial(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = planIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const bodyParsed = partialRegenerateSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', bodyParsed.error.issues[0]?.message ?? 'Invalid body'));
  }

  try {
    const result = await triggerPartialRegeneration(paramsParsed.data.id, bodyParsed.data);

    logAudit({
      action: 'REGENERATE_PARTIAL',
      userId: req.user?.sub,
      resourceType: 'DIET_PLAN',
      resourceId: paramsParsed.data.id,
      metadata: { days: bodyParsed.data.days, meals: bodyParsed.data.meals, triggered: result.triggered },
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** GET /diet-plans/today — returns today's meals from the active plan for the authenticated patient. */
export async function getTodayMeals(req: Request, res: Response, next: NextFunction) {
  const patientId = req.user?.patientId;
  if (!patientId) {
    return res.json({ ok: true, today: null });
  }

  try {
    const plan = await dietPlanService.getLatestPublished(patientId);
    if (!plan || !plan.content) {
      return res.json({ ok: true, today: null });
    }

    const content = typeof plan.content === 'string' ? JSON.parse(plan.content) : plan.content;
    const days: Array<{ dayName?: string; day?: string; meals?: unknown[] }> = content.days ?? content.plan?.days ?? [];

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const polishDayNames = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
    const todayIndex = new Date().getDay();
    const todayEn = dayNames[todayIndex];
    const todayPl = polishDayNames[todayIndex];

    const todayData = days.find((d) => {
      const name = (d.dayName ?? d.day ?? '').toLowerCase();
      return name.includes(todayEn) || name.includes(todayPl);
    }) ?? days[todayIndex % Math.max(days.length, 1)] ?? null;

    if (!todayData) {
      return res.json({ ok: true, today: null });
    }

    return res.json({
      ok: true,
      today: {
        dayName: todayData.dayName ?? todayData.day ?? todayPl,
        meals: todayData.meals ?? [],
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Patient day regeneration ─────────────────────────────────────────────────

const dayRegenSchema = z.object({
  dayName: z.string().min(1),
  reason: z.enum(['DONT_LIKE', 'TOO_COMPLEX', 'NO_INGREDIENTS']),
  keepSimilar: z.boolean().default(false),
});

/** POST /diet-plans/:id/regen-day — patient requests single day regeneration */
export async function regenDay(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = planIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const bodyParsed = dayRegenSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', bodyParsed.error.issues[0]?.message ?? 'Invalid body'));
  }

  try {
    const result = await enqueueDayRegeneration({
      planId: paramsParsed.data.id,
      dayName: bodyParsed.data.dayName,
      reason: bodyParsed.data.reason,
      keepSimilar: bodyParsed.data.keepSimilar,
      userId: req.user!.sub,
      patientId: req.user!.patientId!,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /diet-plans/:id/regen-day/undo — undo last day regeneration */
export async function regenDayUndo(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = planIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const regenIdSchema = z.object({ regenId: z.string().cuid() });
  const bodyParsed = regenIdSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid regenId'));
  }

  try {
    const result = await undoDayRegeneration(
      bodyParsed.data.regenId,
      req.user!.sub,
      req.user!.patientId!,
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** GET /diet-plans/:id/quality — plan quality score and soft validations (Faza 74) */
export async function getPlanQuality(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = planIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    const plan = await prisma.dietPlan.findUnique({
      where: { id: paramsParsed.data.id },
      select: { policyMetadata: true },
    });

    if (!plan) {
      return res.status(404).json(apiError('NOT_FOUND', 'Plan not found'));
    }

    const meta = (plan.policyMetadata as Record<string, unknown>) ?? {};
    const planQuality = meta.planQuality ?? null;

    return res.json({ ok: true, planQuality });
  } catch (err) {
    next(err);
  }
}

/** GET /diet-plans/:id/decisions — slot decision audit trail for dietitian (Faza 72) */
export async function getSlotDecisions(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = planIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    const plan = await prisma.dietPlan.findUnique({
      where: { id: paramsParsed.data.id },
      select: { policyMetadata: true },
    });

    if (!plan) {
      return res.status(404).json(apiError('NOT_FOUND', 'Plan not found'));
    }

    const meta = (plan.policyMetadata as Record<string, unknown>) ?? {};
    const slotDecisions = meta.slotDecisions ?? [];
    const inputHash = meta.inputHash ?? null;
    const generationMethod = meta.generationMethod ?? null;
    const coverageReport = meta.coverageReport ?? null;

    return res.json({
      ok: true,
      slotDecisions,
      inputHash,
      generationMethod,
      coverageReport,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /diet-plans/:id/swap-suggestions — proactive swap suggestions for weak slots (76b)
 *
 * Returns slots with low score (<65) or LOW confidence, along with top-3 runners-up
 * and contextual suggestions from softValidations.
 */
export async function getSwapSuggestions(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = planIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    const plan = await prisma.dietPlan.findUnique({
      where: { id: paramsParsed.data.id },
      select: { patientId: true, content: true, policyMetadata: true },
    });

    if (!plan) {
      return res.status(404).json(apiError('NOT_FOUND', 'Plan not found'));
    }

    const content = decryptJson(plan.content) as { days: Array<{ day: string; meals: Array<{ name: string; items: Array<{ kcal?: number; protein?: number; fat?: number; carbs?: number }> }> }> };
    const meta = (plan.policyMetadata as Record<string, unknown>) ?? {};
    const slotDecisions = (meta.slotDecisions ?? []) as Array<{
      dayIndex: number;
      slotIndex: number;
      dayName: string;
      mealType: string;
      candidatesCount: number;
      chosen: { recipeId: string; title: string; totalScore: number; adjustedScore: number; scores: Record<string, number> } | null;
      runnersUp: Array<{ recipeId: string; title: string; totalScore: number; adjustedScore: number; rejectionReason: string }>;
      confidence: string;
      rulesApplied: string[];
    }>;

    // Load meal distribution to know slot targets (for live re-scoring)
    const distInput = await loadPatientMealDistribution(plan.patientId);
    const distribution = computeMealDistribution(distInput);
    const currentMonth = new Date().getMonth() + 1;

    const WEAK_SCORE_THRESHOLD = 65;
    const SCORE_LABELS: Record<string, string> = {
      nutritionFit: 'dopasowanie makro',
      quality: 'jakość przepisu',
      patientRating: 'ocena pacjenta',
      cuisine: 'kuchnia',
      season: 'sezonowość',
      diversity: 'różnorodność',
      cost: 'koszt',
      microFit: 'mikroskładniki',
      practicalFit: 'czas gotowania',
      satietyProxy: 'sytość',
      interaction: 'interakcje składników',
      compliance: 'adherencja',
    };

    // Build suggestions: analyze every slot against current plan content
    const suggestions: Array<{
      dayIndex: number; slotIndex: number; dayName: string; mealType: string;
      currentRecipe: { recipeId: string; title: string; adjustedScore: number };
      confidence: string; reasons: string[];
      alternatives: Array<{ recipeId: string; title: string; adjustedScore: number; rejectionReason: string; scoreDiff: number }>;
    }> = [];

    for (const sd of slotDecisions) {
      if (!sd.chosen) continue;

      const day = content.days[sd.dayIndex];
      const meal = day?.meals?.[sd.slotIndex];
      if (!day || !meal) continue;

      // Check if plan content matches slotDecision (detect manual edits).
      // BUG-2: meal.name is often a generic meal-type ("Śniadanie") while the real dish
      // name lives in items[0].name — resolve the effective display name before comparing.
      const firstItem = meal.items?.[0];
      const firstItemName = firstItem && typeof firstItem === 'object' && 'name' in firstItem
        ? String((firstItem as { name?: unknown }).name ?? '')
        : '';
      const effectiveMealName = resolveEffectiveMealName(meal.name, firstItemName);
      const contentTitle = effectiveMealName.toLowerCase();
      const decisionTitle = sd.chosen.title?.trim().toLowerCase() ?? '';
      const wasManuallyEdited = contentTitle !== decisionTitle && contentTitle !== '';

      let adjustedScore = sd.chosen.adjustedScore;
      let confidence = sd.confidence;
      let scores = sd.chosen.scores;
      const reasons: string[] = [];

      if (wasManuallyEdited) {
        // Content was edited outside repair — mark as needing re-analysis
        adjustedScore = 0;
        confidence = 'LOW';
        scores = {};
        reasons.push(`Posiłek zmieniony ręcznie (teraz: "${effectiveMealName}")`);
        reasons.push('Wymagana ponowna analiza — kliknij Napraw');
      } else {
        // Use existing scores but validate
        if (adjustedScore < WEAK_SCORE_THRESHOLD) {
          reasons.push(`Niski wynik ogólny: ${Math.round(adjustedScore)}/100`);
        }
        if (confidence === 'LOW') {
          reasons.push('Mała różnica między wybranym a alternatywami');
        }

        // Identify weak sub-scores
        const weakAreas = Object.entries(scores)
          .filter(([, v]) => v < 50)
          .sort(([, a], [, b]) => a - b)
          .slice(0, 3);
        for (const [name, value] of weakAreas) {
          reasons.push(`Słaby: ${SCORE_LABELS[name] ?? name} (${Math.round(value)}/100)`);
        }
      }

      // Filter: only include weak or manually-edited slots
      if (adjustedScore >= WEAK_SCORE_THRESHOLD && confidence !== 'LOW' && !wasManuallyEdited) {
        continue;
      }

      // Fetch live alternatives from candidate pool
      const slotTarget = distribution.slots[sd.slotIndex];
      let liveAlternatives: Array<{ recipeId: string; title: string; adjustedScore: number; rejectionReason: string; scoreDiff: number }> = [];

      if (slotTarget) {
        try {
          const candidates = await findCandidates({
            mealType: slotTarget.mealType,
            targetKcal: slotTarget.targetKcal,
            targetProteinG: slotTarget.targetProteinG,
            targetFatG: slotTarget.targetFatG,
            targetCarbsG: slotTarget.targetCarbsG,
            season: currentMonth,
            limit: 10,
          });

          // Exclude current recipe, take top 3
          liveAlternatives = candidates
            .filter((c) => c.recipeId !== sd.chosen!.recipeId)
            .slice(0, 3)
            .map((c) => ({
              recipeId: c.recipeId,
              title: c.title,
              adjustedScore: Math.round(c.totalScore),
              rejectionReason: '',
              scoreDiff: Math.round(c.totalScore - adjustedScore),
            }));
        } catch {
          // Use stored runnersUp as fallback
          liveAlternatives = sd.runnersUp.map((ru) => ({
            recipeId: ru.recipeId,
            title: ru.title,
            adjustedScore: Math.round(ru.adjustedScore),
            rejectionReason: ru.rejectionReason,
            scoreDiff: Math.round(ru.adjustedScore - adjustedScore),
          }));
        }
      } else {
        // Fallback to stored runnersUp
        liveAlternatives = sd.runnersUp.map((ru) => ({
          recipeId: ru.recipeId,
          title: ru.title,
          adjustedScore: Math.round(ru.adjustedScore),
          rejectionReason: ru.rejectionReason,
          scoreDiff: Math.round(ru.adjustedScore - adjustedScore),
        }));
      }

      suggestions.push({
        dayIndex: sd.dayIndex,
        slotIndex: sd.slotIndex,
        dayName: sd.dayName,
        mealType: sd.mealType,
        currentRecipe: {
          recipeId: sd.chosen.recipeId,
          title: wasManuallyEdited ? effectiveMealName : sd.chosen.title,
          adjustedScore: Math.round(adjustedScore),
        },
        confidence,
        reasons,
        alternatives: liveAlternatives,
      });
    }

    // Sort by score ascending (worst first)
    suggestions.sort((a, b) => a.currentRecipe.adjustedScore - b.currentRecipe.adjustedScore);

    // Soft validation warnings
    const planQuality = meta.planQuality as { softValidations?: Array<{ rule: string; message: string; value: number; threshold: number }> } | undefined;
    const softWarnings = planQuality?.softValidations
      ?.filter((sv) => sv.value < sv.threshold || sv.value > sv.threshold)
      .map((sv) => sv.message) ?? [];

    return res.json({
      ok: true,
      totalSlots: slotDecisions.length,
      weakSlots: suggestions.length,
      suggestions,
      softWarnings,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /diet-plans/:id/repair-slot — one-click slot repair via solver (Faza 79)
 *
 * Freezes all other slots, re-runs OR-Tools solver to find optimal replacement
 * for the specified slot. Optionally accepts a targetRecipeId for direct swap.
 */
const repairSlotSchema = z.object({
  dayIndex: z.number().int().min(0).max(13),
  slotIndex: z.number().int().min(0).max(9),
  targetRecipeId: z.string().cuid().optional(),
});

export async function repairSlotEndpoint(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = planIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const bodyParsed = repairSlotSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const result = await repairSlot({
      planId: paramsParsed.data.id,
      dayIndex: bodyParsed.data.dayIndex,
      slotIndex: bodyParsed.data.slotIndex,
      targetRecipeId: bodyParsed.data.targetRecipeId,
      dietitianUserId: req.user?.sub,
    });

    // Invalidate plan cache
    const plan = await prisma.dietPlan.findUnique({
      where: { id: paramsParsed.data.id },
      select: { patientId: true },
    });
    if (plan) await cacheDel(`cache:diet-plan:latest:${plan.patientId}`);

    logAudit({
      userId: req.user?.sub,
      action: 'REPAIR_SLOT',
      resourceType: 'DIET_PLAN',
      resourceId: paramsParsed.data.id,
      ip: req.ip,
      metadata: { dayIndex: bodyParsed.data.dayIndex, slotIndex: bodyParsed.data.slotIndex },
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /diet-plans/compare?planA=:id&planB=:id — side-by-side comparison (76c)
 */
const compareSchema = z.object({
  planA: z.string().cuid(),
  planB: z.string().cuid(),
});

interface DayMetrics {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  mealCount: number;
}

function extractPlanMetrics(content: Record<string, unknown>) {
  const days = (content.days ?? []) as Array<{ day: string; meals: Array<{ name: string; items: Array<{ kcal: number; protein: number; fat: number; carbs: number }> }> }>;
  const dailyMetrics: DayMetrics[] = [];
  let totalMeals = 0;
  const recipeNames = new Set<string>();

  for (const day of days) {
    let dayKcal = 0, dayP = 0, dayF = 0, dayC = 0;
    for (const meal of day.meals ?? []) {
      recipeNames.add(meal.name);
      totalMeals++;
      for (const item of meal.items ?? []) {
        dayKcal += item.kcal ?? 0;
        dayP += item.protein ?? 0;
        dayF += item.fat ?? 0;
        dayC += item.carbs ?? 0;
      }
    }
    dailyMetrics.push({ kcal: Math.round(dayKcal), proteinG: Math.round(dayP), fatG: Math.round(dayF), carbsG: Math.round(dayC), mealCount: (day.meals ?? []).length });
  }

  const avgKcal = dailyMetrics.length > 0 ? Math.round(dailyMetrics.reduce((s, d) => s + d.kcal, 0) / dailyMetrics.length) : 0;
  const avgProtein = dailyMetrics.length > 0 ? Math.round(dailyMetrics.reduce((s, d) => s + d.proteinG, 0) / dailyMetrics.length) : 0;
  const avgFat = dailyMetrics.length > 0 ? Math.round(dailyMetrics.reduce((s, d) => s + d.fatG, 0) / dailyMetrics.length) : 0;
  const avgCarbs = dailyMetrics.length > 0 ? Math.round(dailyMetrics.reduce((s, d) => s + d.carbsG, 0) / dailyMetrics.length) : 0;

  return {
    days: dailyMetrics.length,
    totalMeals,
    uniqueRecipes: recipeNames.size,
    diversityScore: totalMeals > 0 ? Math.round((recipeNames.size / totalMeals) * 100) / 100 : 0,
    avgKcal,
    avgProtein,
    avgFat,
    avgCarbs,
    dailyMetrics,
  };
}

function extractQualityMetrics(meta: Record<string, unknown>) {
  const quality = meta.planQuality as { grade?: string; score?: number; softValidations?: unknown[] } | undefined;
  const coverage = meta.coverageReport as {
    filledFromDbPct?: number;
    avgFitScore?: number;
    avgTotalScore?: number;
    diversityScore?: number;
    uniqueIngredients?: number;
    totalIngredientUses?: number;
    shoppingEfficiencyScore?: number;
  } | undefined;
  return {
    grade: quality?.grade ?? null,
    qualityScore: quality?.score ?? null,
    softViolations: quality?.softValidations?.length ?? 0,
    coveragePct: coverage?.filledFromDbPct ?? null,
    avgFitScore: coverage?.avgFitScore ? Math.round(coverage.avgFitScore) : null,
    avgTotalScore: coverage?.avgTotalScore ? Math.round(coverage.avgTotalScore) : null,
    diversityScore: coverage?.diversityScore ?? null,
    uniqueIngredients: coverage?.uniqueIngredients ?? null,
    totalIngredientUses: coverage?.totalIngredientUses ?? null,
    shoppingEfficiencyScore: coverage?.shoppingEfficiencyScore ?? null,
  };
}

export async function comparePlans(req: Request, res: Response, next: NextFunction) {
  const parsed = compareSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Both planA and planB (cuid) are required'));
  }

  try {
    const userId = req.user!.sub;
    const role = req.user!.role;

    const [planA, planB] = await Promise.all([
      dietPlanService.getDietPlanById(parsed.data.planA, userId, role),
      dietPlanService.getDietPlanById(parsed.data.planB, userId, role),
    ]);

    const metricsA = extractPlanMetrics(planA.content);
    const metricsB = extractPlanMetrics(planB.content);
    const metaA = (planA.policyMetadata as Record<string, unknown>) ?? {};
    const metaB = (planB.policyMetadata as Record<string, unknown>) ?? {};
    const qualityA = extractQualityMetrics(metaA);
    const qualityB = extractQualityMetrics(metaB);

    // Find common and unique recipes
    const namesA = new Set((planA.content.days as Array<{ meals: Array<{ name: string }> }>)?.flatMap(d => d.meals?.map(m => m.name) ?? []) ?? []);
    const namesB = new Set((planB.content.days as Array<{ meals: Array<{ name: string }> }>)?.flatMap(d => d.meals?.map(m => m.name) ?? []) ?? []);
    const commonRecipes = [...namesA].filter(n => namesB.has(n));
    const onlyInA = [...namesA].filter(n => !namesB.has(n));
    const onlyInB = [...namesB].filter(n => !namesA.has(n));

    return res.json({
      ok: true,
      planA: {
        id: planA.id,
        status: planA.status,
        source: planA.source,
        createdAt: planA.createdAt,
        generationMethod: metaA.generationMethod ?? null,
        metrics: metricsA,
        quality: qualityA,
      },
      planB: {
        id: planB.id,
        status: planB.status,
        source: planB.source,
        createdAt: planB.createdAt,
        generationMethod: metaB.generationMethod ?? null,
        metrics: metricsB,
        quality: qualityB,
      },
      diff: {
        kcalDiff: metricsB.avgKcal - metricsA.avgKcal,
        proteinDiff: metricsB.avgProtein - metricsA.avgProtein,
        fatDiff: metricsB.avgFat - metricsA.avgFat,
        carbsDiff: metricsB.avgCarbs - metricsA.avgCarbs,
        diversityDiff: Math.round((metricsB.diversityScore - metricsA.diversityScore) * 100) / 100,
        commonRecipes: commonRecipes.length,
        onlyInA: onlyInA.length,
        onlyInB: onlyInB.length,
        recipeOverlap: commonRecipes,
        uniqueToA: onlyInA.slice(0, 10),
        uniqueToB: onlyInB.slice(0, 10),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /diet-plans/:id/regen-day/status — get regen status and remaining count */
export async function regenDayStatus(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = planIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    const status = await getDayRegenStatus(paramsParsed.data.id, req.user!.patientId!);
    return res.json({ ok: true, ...status });
  } catch (err) {
    next(err);
  }
}
