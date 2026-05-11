import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@db';
import * as foodProductController from '../controllers/foodProduct.controller';
import * as recipeController from '../controllers/recipe.controller';
import * as dietitianReportController from '../controllers/dietitianReport.controller';
import * as cleanProductController from '../controllers/cleanProduct.controller';
import * as protocolController from '../controllers/protocol.controller';
import * as dietToolkitController from '../controllers/dietToolkit.controller';
import { sendPatientInvitationEmail } from '../utils/email';
import { logAudit } from '../services/audit.service';
import { decryptJson } from '../utils/encryption';
import { getScoringWeights, DEFAULT_SCORING_WEIGHTS } from '../services/appSettings.service';
import {
  GREY_LIST_WINDOW_MIN,
  GREY_LIST_WINDOW_MAX,
  DEFAULT_GREY_LIST_WINDOW,
  getGreyListWindow,
} from '../services/dietitianSettings.service';
import { getInteractionSummary } from '../services/medicationInteraction.service';
import {
  computePlanEffectiveness,
  getRecipeEffectiveness,
  getDietitianAnalytics,
} from '../services/planEffectiveness.service';

export const dietitianRouter = Router();

// Food products — DIETITIAN can list, search, create, update (no delete, no verify)
dietitianRouter.get('/food-products/categories', foodProductController.listCategories);
dietitianRouter.get('/food-products/search', foodProductController.search);
dietitianRouter.get('/food-products', foodProductController.list);
dietitianRouter.get('/food-products/:id', foodProductController.getById);
dietitianRouter.post('/food-products', foodProductController.create);
dietitianRouter.patch('/food-products/:id', foodProductController.update);
dietitianRouter.post('/food-products/:id/measures', foodProductController.addMeasure);

// Recipes — DIETITIAN can list, search, create, update (no delete)
dietitianRouter.get('/recipes/search', recipeController.search);
dietitianRouter.get('/recipes', recipeController.list);
dietitianRouter.get('/recipes/:id', recipeController.getById);
dietitianRouter.post('/recipes', recipeController.create);
dietitianRouter.patch('/recipes/:id', recipeController.update);

// Clean products — DIETITIAN can search, list, get, create MANUAL (no delete, no verify)
dietitianRouter.get('/clean-products/search', cleanProductController.search);
dietitianRouter.get('/clean-products', cleanProductController.list);
dietitianRouter.get('/clean-products/:id', cleanProductController.getById);
dietitianRouter.post('/clean-products', cleanProductController.dietitianCreate);
dietitianRouter.patch('/clean-products/:id', cleanProductController.dietitianUpdate);
dietitianRouter.delete('/clean-products/:id', cleanProductController.dietitianDelete);

// Preview nutrition for recipe builder
dietitianRouter.post('/clean-products/preview-nutrition', cleanProductController.previewNutrition);

// Monthly report
dietitianRouter.get('/report', dietitianReportController.getReport);
dietitianRouter.get('/report/export', dietitianReportController.exportPdf);

// Nutrition Protocols (28.7)
dietitianRouter.get('/protocol', protocolController.listMy);
dietitianRouter.patch('/protocol/active', protocolController.setActive);

// Invite patient via email
dietitianRouter.post('/invite-patient', async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email address' } });
  }

  try {
    const dietitianId = req.user!.sub;

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existingUser) {
      return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'This email is already registered' } });
    }

    // Get dietitian profile
    const profile = await prisma.dietitianProfile.findUnique({
      where: { userId: dietitianId },
      select: { code: true, firstName: true, lastName: true },
    });
    if (!profile) {
      return res.status(404).json({ error: { code: 'NO_PROFILE', message: 'Dietitian profile not found' } });
    }

    const dietitianName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Twój dietetyk';
    const baseUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const registerUrl = `${baseUrl}/pl/rejestracja?code=${encodeURIComponent(profile.code)}`;

    await sendPatientInvitationEmail(parsed.data.email, registerUrl, dietitianName, profile.code);

    logAudit({
      userId: dietitianId,
      action: 'INVITE_PATIENT',
      resourceType: 'PATIENT',
      metadata: { invitedEmail: parsed.data.email },
      ip: req.ip,
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Scoring weights override (76a)
dietitianRouter.get('/scoring-weights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.dietitianProfile.findUnique({
      where: { userId: req.user!.sub },
      select: { scoringWeightsOverride: true },
    });
    const effective = await getScoringWeights(
      profile?.scoringWeightsOverride as Record<string, number> | null,
    );
    return res.json({
      ok: true,
      override: profile?.scoringWeightsOverride ?? null,
      effective,
      defaults: DEFAULT_SCORING_WEIGHTS,
    });
  } catch (err) {
    next(err);
  }
});

dietitianRouter.patch('/scoring-weights', async (req: Request, res: Response, next: NextFunction) => {
  const weightField = z.number().min(0).max(1);
  const schema = z.object({
    nutritionFit: weightField.optional(),
    quality: weightField.optional(),
    patientRating: weightField.optional(),
    cuisine: weightField.optional(),
    season: weightField.optional(),
    diversity: weightField.optional(),
    cost: weightField.optional(),
    microFit: weightField.optional(),
    practicalFit: weightField.optional(),
    satietyProxy: weightField.optional(),
    interaction: weightField.optional(),
    compliance: weightField.optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid' } });
  }

  try {
    const profile = await prisma.dietitianProfile.findUnique({
      where: { userId: req.user!.sub },
      select: { id: true, scoringWeightsOverride: true },
    });
    if (!profile) {
      return res.status(404).json({ error: { code: 'NO_PROFILE', message: 'Dietitian profile not found' } });
    }

    const current = (profile.scoringWeightsOverride as Record<string, number> | null) ?? {};
    const updated = { ...current, ...parsed.data };

    await prisma.dietitianProfile.update({
      where: { id: profile.id },
      data: { scoringWeightsOverride: updated },
    });

    const effective = await getScoringWeights(updated);
    return res.json({ ok: true, override: updated, effective });
  } catch (err) {
    next(err);
  }
});

dietitianRouter.delete('/scoring-weights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.dietitianProfile.update({
      where: { userId: req.user!.sub },
      data: { scoringWeightsOverride: Prisma.JsonNull },
    });
    const effective = await getScoringWeights();
    return res.json({ ok: true, override: null, effective, defaults: DEFAULT_SCORING_WEIGHTS });
  } catch (err) {
    next(err);
  }
});

// Z1: Grey-list window (regeneration diversity)
// Mirrors the scoring-weights pattern. Per-dietitian value, falls back to
// the global AppSettings `grey_list_window` and finally to default 1.
dietitianRouter.get('/grey-list-window', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.dietitianProfile.findUnique({
      where: { userId: req.user!.sub },
      select: { greyListWindow: true },
    });
    const effective = await getGreyListWindow(req.user!.sub);
    return res.json({
      ok: true,
      override: profile?.greyListWindow ?? null,
      effective,
      default: DEFAULT_GREY_LIST_WINDOW,
      min: GREY_LIST_WINDOW_MIN,
      max: GREY_LIST_WINDOW_MAX,
    });
  } catch (err) {
    next(err);
  }
});

dietitianRouter.patch('/grey-list-window', async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({
    greyListWindow: z.number().int().min(GREY_LIST_WINDOW_MIN).max(GREY_LIST_WINDOW_MAX),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid' },
    });
  }

  try {
    const profile = await prisma.dietitianProfile.findUnique({
      where: { userId: req.user!.sub },
      select: { id: true },
    });
    if (!profile) {
      return res.status(404).json({ error: { code: 'NO_PROFILE', message: 'Dietitian profile not found' } });
    }

    await prisma.dietitianProfile.update({
      where: { id: profile.id },
      data: { greyListWindow: parsed.data.greyListWindow },
    });

    const effective = await getGreyListWindow(req.user!.sub);
    return res.json({
      ok: true,
      override: parsed.data.greyListWindow,
      effective,
      default: DEFAULT_GREY_LIST_WINDOW,
      min: GREY_LIST_WINDOW_MIN,
      max: GREY_LIST_WINDOW_MAX,
    });
  } catch (err) {
    next(err);
  }
});

// Diet toolkit — aggregated patient data for plan review
dietitianRouter.get('/patients/:patientId/diet-toolkit', dietToolkitController.getToolkit);

// Nutrition targets for a patient (DD.1.1)
dietitianRouter.get('/patients/:patientId/nutrition-targets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dietitianId = req.user!.sub;
    const { patientId } = req.params;

    // Verify dietitian has access to this patient
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, dietitianId },
      select: { id: true },
    });
    if (!patient) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } });

    const targets = await prisma.nutritionTargets.findUnique({
      where: { patientId },
    });
    if (!targets) return res.status(404).json({ error: { code: 'NO_TARGETS', message: 'No nutrition targets' } });

    return res.json({ ok: true, targets });
  } catch (err) {
    next(err);
  }
});

// 60.1 — Action items for dietitian dashboard
dietitianRouter.get('/dashboard/action-items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dietitianId = req.user!.sub;

    const [plansAwaitingReview, patientsWithoutPlan, redFlagPlans] = await Promise.all([
      prisma.dietPlan.count({
        where: {
          status: 'GENERATED',
          patient: { dietitianId },
        },
      }),
      prisma.patient.count({
        where: {
          dietitianId,
          dietPlans: { none: {} },
        },
      }),
      prisma.dietPlan.count({
        where: {
          status: 'MANUAL_REVIEW_REQUIRED',
          patient: { dietitianId },
        },
      }),
    ]);

    return res.json({
      ok: true,
      actionItems: {
        plansAwaitingReview,
        patientsWithoutPlan,
        redFlagPlans,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── 79.5: Medication interactions ────────────────────────────────────────────

dietitianRouter.get('/patients/:patientId/medication-interactions', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = z.string().cuid().safeParse(req.params.patientId);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid patient id' } });

  try {
    // Load patient's medications from latest Interview (medicalFlags OR answers)
    const interview = await prisma.interview.findFirst({
      where: { patientId: parsed.data },
      orderBy: { createdAt: 'desc' },
      select: { medicalFlags: true, answers: true },
    });

    let medications: string[] = [];

    // Try medicalFlags first
    if (interview?.medicalFlags) {
      const flags = decryptJson(interview.medicalFlags) as Record<string, unknown>;
      const meds = flags.medications ?? flags.leki ?? flags.currentMedications ?? [];
      if (Array.isArray(meds)) {
        medications = meds.map((m: unknown) => typeof m === 'string' ? m : String(m));
      } else if (typeof meds === 'string') {
        medications = meds.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }

    // Fallback: read from answers.medications (interview form saves here)
    if (medications.length === 0 && interview?.answers) {
      const answers = decryptJson(interview.answers) as Record<string, unknown>;
      const meds = answers.medications ?? [];
      if (Array.isArray(meds)) {
        medications = meds
          .map((m: unknown) => typeof m === 'string' ? m : String(m))
          .filter((m) => m !== 'none');
      } else if (typeof meds === 'string') {
        medications = meds.split(',').map((s: string) => s.trim()).filter((s) => s && s !== 'none');
      }
    }

    const summary = getInteractionSummary(medications);

    return res.json({
      ok: true,
      patientMedications: medications,
      ...summary,
    });
  } catch (err) {
    next(err);
  }
});

// ── 79.4: Plan Effectiveness Analytics ──────────────────────────────────────

dietitianRouter.get('/analytics/effectiveness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getDietitianAnalytics(req.user!.sub);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

dietitianRouter.get('/analytics/plan-effectiveness/:planId', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = z.string().cuid().safeParse(req.params.planId);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid plan id' } });
  try {
    const result = await computePlanEffectiveness(parsed.data);
    if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

dietitianRouter.get('/analytics/recipe-effectiveness', async (req: Request, res: Response, next: NextFunction) => {
  const sort = (req.query.sort === 'worst' ? 'worst' : 'best') as 'best' | 'worst';
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  try {
    const recipes = await getRecipeEffectiveness(req.user!.sub, limit, sort);
    return res.json({ ok: true, recipes });
  } catch (err) {
    next(err);
  }
});
