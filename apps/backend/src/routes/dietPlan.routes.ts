import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@db';
import { requireAuth } from '../middleware/auth';
import { pdfExportLimiter } from '../middleware/rateLimiters';
import { apiError } from '../utils/errors';
import * as dietPlanController from '../controllers/dietPlan.controller';
import * as planValidationController from '../controllers/planValidation.controller';
import * as mealSwapController from '../controllers/mealSwap.controller';
import * as micronutrientController from '../controllers/micronutrient.controller';
import { estimatePlanCost } from '../services/dietCost.service';
import { generateMealPrepPlan } from '../services/mealPrep.service';
import { decryptJson } from '../utils/encryption';

export const dietPlanRouter = Router();

// Patient: today's meals from active plan
dietPlanRouter.get('/today', requireAuth('PATIENT'), dietPlanController.getTodayMeals);

// any authenticated — PATIENT sees own plan (from JWT), others use :patientId
dietPlanRouter.get('/latest/:patientId', requireAuth(), dietPlanController.getLatest);

// 76c — Plan comparison (must be before /:id routes)
dietPlanRouter.get('/compare', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.comparePlans);

// ADMIN or DIETITIAN only
dietPlanRouter.post('/generate/:patientId', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.triggerGenerate);
dietPlanRouter.post('/from-ai', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.createFromAi);
dietPlanRouter.get('/', requireAuth(), dietPlanController.list);
dietPlanRouter.patch('/:id/status', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.updateStatus);
dietPlanRouter.patch('/:id/publish', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.publishPlan);
dietPlanRouter.post('/:patientId/manual', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.createManual);
dietPlanRouter.get('/:id/status', requireAuth(), dietPlanController.getStatus);
dietPlanRouter.get('/:id/export', requireAuth(), pdfExportLimiter, dietPlanController.exportPlan);
dietPlanRouter.get('/:id/calendar', requireAuth(), dietPlanController.exportCalendar);
dietPlanRouter.get('/:id', requireAuth(), dietPlanController.getById);
dietPlanRouter.patch('/:id/content', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.updateContent);

// 7.11 — Revision history
dietPlanRouter.get('/:id/revisions', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.getRevisions);
dietPlanRouter.get('/revisions/:revisionId', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.getRevisionById);

// 32.2.7 — Partial regeneration
dietPlanRouter.post('/:id/regenerate-partial', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.regeneratePartial);

// 7.9 — Plan validation
dietPlanRouter.post('/:id/validate', requireAuth('ADMIN', 'DIETITIAN'), planValidationController.runValidation);
dietPlanRouter.post('/:id/auto-adjust', requireAuth('ADMIN', 'DIETITIAN'), planValidationController.runAutoAdjust);
dietPlanRouter.get('/:id/shopping-list', requireAuth(), planValidationController.getShoppingList);
dietPlanRouter.get('/:id/shopping-list/pdf', requireAuth(), pdfExportLimiter, planValidationController.getShoppingListPdf);
dietPlanRouter.get('/:id/shopping-list/checks', requireAuth('PATIENT'), planValidationController.getShoppingListChecks);
dietPlanRouter.put('/:id/shopping-list/checks', requireAuth('PATIENT'), planValidationController.putShoppingListChecks);

// Patient day regeneration
dietPlanRouter.post('/:id/regen-day', requireAuth('PATIENT'), dietPlanController.regenDay);
dietPlanRouter.post('/:id/regen-day/undo', requireAuth('PATIENT'), dietPlanController.regenDayUndo);
dietPlanRouter.get('/:id/regen-day/status', requireAuth('PATIENT'), dietPlanController.regenDayStatus);

// 18.1 — Meal swaps (patient only)
dietPlanRouter.post('/:id/swap', requireAuth('PATIENT'), mealSwapController.requestSwap);
dietPlanRouter.patch('/:id/swap/:swapId/confirm', requireAuth('PATIENT'), mealSwapController.confirmSwap);
dietPlanRouter.get('/:id/swaps', requireAuth(), mealSwapController.listSwaps);

// 72.5 — Slot decision audit trail (reason codes)
dietPlanRouter.get('/:id/decisions', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.getSlotDecisions);

// 76b — Proactive swap suggestions for weak slots
dietPlanRouter.get('/:id/swap-suggestions', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.getSwapSuggestions);

// 79 — One-click slot repair via solver
dietPlanRouter.post('/:id/repair-slot', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.repairSlotEndpoint);

// 74 — Plan quality score and soft validations
dietPlanRouter.get('/:id/quality', requireAuth('ADMIN', 'DIETITIAN'), dietPlanController.getPlanQuality);

// 38.11 — Micronutrient analysis
dietPlanRouter.get('/:id/micronutrients', requireAuth(), micronutrientController.analyzePlan);
dietPlanRouter.get('/:id/micronutrients/suggestions', requireAuth('ADMIN', 'DIETITIAN'), micronutrientController.getSuggestions);

// Cost estimate for a diet plan
dietPlanRouter.get('/:id/cost-estimate', requireAuth(), async (req, res, next) => {
  try {
    const parsed = z.string().cuid().safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
    const estimate = await estimatePlanCost(parsed.data);
    return res.json({ ok: true, estimate });
  } catch (err) { next(err); }
});

// Meal prep planner
dietPlanRouter.get('/:id/meal-prep', requireAuth(), async (req, res, next) => {
  try {
    const parsed = z.string().cuid().safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
    const mealPrep = await generateMealPrepPlan(parsed.data);
    return res.json({ ok: true, mealPrep });
  } catch (err) { next(err); }
});

// 82.6: GI report — glycemic index summary from plan content
dietPlanRouter.get('/:id/gi-report', requireAuth(), async (req, res, next) => {
  try {
    const parsed = z.string().cuid().safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));

    const plan = await prisma.dietPlan.findUnique({
      where: { id: parsed.data },
      select: { content: true },
    });
    if (!plan) return res.status(404).json(apiError('NOT_FOUND', 'Plan not found'));

    const content = decryptJson(plan.content) as { days?: Array<{ meals?: Array<{ glycemicIndex?: number; items?: Array<{ carbs?: number }> }> }> };
    if (!content?.days) return res.json({ ok: true, giReport: null });

    const dailyStats = content.days.map((day, i) => {
      const meals = day.meals ?? [];
      const giValues = meals.map((m) => m.glycemicIndex).filter((gi): gi is number => gi != null && gi > 0);
      const avgGi = giValues.length > 0 ? Math.round(giValues.reduce((a, b) => a + b, 0) / giValues.length) : null;

      // GL = sum of (GI/100 * carbsG) per meal
      let dailyGL = 0;
      for (const meal of meals) {
        const gi = meal.glycemicIndex;
        const carbs = meal.items?.reduce((s, item) => s + (item.carbs ?? 0), 0) ?? 0;
        if (gi && gi > 0 && carbs > 0) dailyGL += (gi / 100) * carbs;
      }

      const highGiCount = giValues.filter((gi) => gi > 70).length;
      return { day: i, avgGi, dailyGL: Math.round(dailyGL), highGiCount, totalMeals: meals.length };
    });

    const allGis = dailyStats.flatMap((d) => d.avgGi != null ? [d.avgGi] : []);
    const weekAvgGi = allGis.length > 0 ? Math.round(allGis.reduce((a, b) => a + b, 0) / allGis.length) : null;
    const weekAvgGL = Math.round(dailyStats.reduce((s, d) => s + d.dailyGL, 0) / dailyStats.length);
    const totalHighGi = dailyStats.reduce((s, d) => s + d.highGiCount, 0);

    return res.json({
      ok: true,
      giReport: {
        weekAvgGi,
        weekAvgGL,
        totalHighGiMeals: totalHighGi,
        daily: dailyStats,
      },
    });
  } catch (err) { next(err); }
});
