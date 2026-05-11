import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as blogController from '../controllers/blog.controller';
import * as blogCategoryController from '../controllers/blogCategory.controller';
import * as foodProductController from '../controllers/foodProduct.controller';
import * as recipeController from '../controllers/recipe.controller';
import * as mealController from '../controllers/meal.controller';
import * as templateController from '../controllers/template.controller';
import * as importController from '../controllers/import.controller';
import { uploadBlogImage } from '../controllers/upload.controller';
import * as stripeAdminController from '../controllers/stripeAdmin.controller';
import * as accountingController from '../controllers/accounting.controller';
import * as featureFlagController from '../controllers/featureFlag.controller';
import * as dietCacheController from '../controllers/dietCache.controller';
import * as clinicalRuleController from '../controllers/clinicalRule.controller';
import * as cleanProductController from '../controllers/cleanProduct.controller';
import * as protocolController from '../controllers/protocol.controller';
import * as protocolTriggerController from '../controllers/protocolTrigger.controller';
import * as aiCostController from '../controllers/aiCost.controller';
import { prisma } from '@db';
import { logAudit } from '../services/audit.service';
import { computeScraperStats } from '../services/scraperStats.service';
import { computeSolverStats } from '../services/solverStats.service';

export const adminRouter = Router();

adminRouter.post('/users', adminController.createUser);
adminRouter.get('/users', adminController.listUsers);
adminRouter.get('/users/:id', adminController.getUserById);
adminRouter.delete('/users/:id', adminController.softDeleteUser);
adminRouter.patch('/users/:id/restore', adminController.restoreUser);
adminRouter.get('/tenants', adminController.listTenants);
adminRouter.get('/tenants/:id', adminController.getTenantById);
adminRouter.patch('/tenants/:id', adminController.updateTenant);
adminRouter.delete('/tenants/:id', adminController.softDeleteTenant);
adminRouter.patch('/tenants/:id/restore', adminController.restoreTenant);
adminRouter.get('/stats', adminController.getStats);
adminRouter.get('/dashboard/action-items', adminController.getActionItems);
adminRouter.patch('/users/:id/role', adminController.changeUserRole);
adminRouter.post('/users/:id/verify-email', adminController.verifyUserEmail);
adminRouter.post('/users/:id/resend-verification', adminController.resendVerification);
adminRouter.patch('/users/:id/grant-access', adminController.grantAccess);
adminRouter.post('/users/:id/force-password-reset', adminController.forcePasswordReset);
adminRouter.patch('/users/bulk', adminController.bulkUserAction);
adminRouter.post('/users/:id/revoke-sessions', adminController.revokeUserSessions);

adminRouter.post('/dietitians', adminController.createDietitian);
adminRouter.get('/dietitians', adminController.listDietitians);
adminRouter.get('/dietitians/:id/patients', adminController.getDietitianPatients);
adminRouter.patch('/dietitians/:id', adminController.updateDietitian);
adminRouter.post('/dietitians/:id/rotate-code', adminController.rotateDietitianCode);
adminRouter.patch('/dietitians/:id/toggle-active', adminController.toggleDietitianActive);

// 39.1.2: Unlock patient profile
adminRouter.post('/patients/:id/unlock-profile', adminController.unlockPatientProfile);
// 39.6.3: Unlock locked account
adminRouter.post('/users/:id/unlock', adminController.unlockAccount);

adminRouter.get('/audit-logs', adminController.listAuditLogs);
adminRouter.get('/audit-logs/stats', adminController.getAuditLogStats);
adminRouter.get('/audit-logs/export', adminController.exportAuditLogsCsv);

// PRE.10: frequent free-text inputs analytics
adminRouter.get('/frequent-inputs', adminController.getFrequentInputs);

// Blog category management (7.12.2)
adminRouter.get('/blog/categories', blogCategoryController.adminListCategories);
adminRouter.post('/blog/categories', blogCategoryController.adminCreateCategory);
adminRouter.patch('/blog/categories/:id', blogCategoryController.adminUpdateCategory);
adminRouter.delete('/blog/categories/:id', blogCategoryController.adminDeleteCategory);

// Blog image upload
adminRouter.post('/blog/upload-image', uploadBlogImage);

// Blog post management
adminRouter.get('/posts/stats', blogController.adminGetPostStats);
adminRouter.get('/posts', blogController.adminListPosts);
adminRouter.post('/posts', blogController.adminCreatePost);
adminRouter.get('/posts/:id', blogController.adminGetPostById);
adminRouter.patch('/posts/:id', blogController.adminUpdatePost);
adminRouter.delete('/posts/:id', blogController.adminDeletePost);

// Food product management
adminRouter.get('/food-products/categories', foodProductController.listCategories);
adminRouter.get('/food-products/search', foodProductController.search);
adminRouter.get('/food-products', foodProductController.list);
adminRouter.post('/food-products', foodProductController.create);
adminRouter.get('/food-products/:id', foodProductController.getById);
adminRouter.patch('/food-products/:id', foodProductController.update);
adminRouter.patch('/food-products/:id/verify', foodProductController.verify);
adminRouter.delete('/food-products/:id', foodProductController.remove);
adminRouter.post('/food-products/:id/measures', foodProductController.addMeasure);
adminRouter.delete('/food-products/measures/:measureId', foodProductController.deleteMeasure);

// Recipe management
adminRouter.get('/recipes/search', recipeController.search);
adminRouter.get('/recipes', recipeController.list);
adminRouter.post('/recipes', recipeController.create);
adminRouter.patch('/recipes/bulk', recipeController.bulkUpdate);
adminRouter.post('/recipes/bulk-recompute-nutrition', importController.bulkRecomputeRecipeNutrition);
adminRouter.get('/recipes/data-quality-report', importController.recipeDataQualityReport);
adminRouter.post('/recipes/recompute-scores', recipeController.recomputeScores);
adminRouter.post('/recipes/find-duplicates', recipeController.findDuplicates);
adminRouter.post('/recipes/merge', recipeController.mergeRecipes);
adminRouter.get('/recipes/:id', recipeController.getById);
adminRouter.patch('/recipes/:id', recipeController.update);
adminRouter.delete('/recipes/:id', recipeController.remove);

// AI recipe review — list pending/approved
adminRouter.get('/recipes/ai-review', async (req, res, next) => {
  try {
    const filter = (req.query.filter as string) ?? 'all';
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { origin: 'ai_generated' };
    if (filter === 'pending') where.aiApproved = false;
    if (filter === 'approved') where.aiApproved = true;

    const [items, total, pending, approved] = await Promise.all([
      prisma.recipe.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, title: true, source: true, origin: true, aiApproved: true,
          category: true, mealType: true, qualityScore: true, isActive: true,
          verificationStatus: true, createdAt: true,
        },
      }),
      prisma.recipe.count({ where }),
      prisma.recipe.count({ where: { origin: 'ai_generated', aiApproved: false } }),
      prisma.recipe.count({ where: { origin: 'ai_generated', aiApproved: true } }),
    ]);

    return res.json({ ok: true, items, total, pending, approved, page, limit });
  } catch (err) { next(err); }
});

// AI recipe stats
adminRouter.get('/recipes/ai-stats', async (req, res, next) => {
  try {
    const [total, aiGenerated, aiApproved] = await Promise.all([
      prisma.recipe.count({ where: { isActive: true } }),
      prisma.recipe.count({ where: { origin: 'ai_generated' } }),
      prisma.recipe.count({ where: { origin: 'ai_generated', aiApproved: true } }),
    ]);
    return res.json({ ok: true, stats: {
      total,
      aiGenerated,
      aiApproved,
      aiPending: aiGenerated - aiApproved,
      humanCreated: total - aiGenerated,
    } });
  } catch (err) { next(err); }
});

// Approve AI recipe → move to trusted pool
adminRouter.post('/recipes/:id/approve-ai', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !/^c[a-z0-9]{24}$/i.test(id)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid recipe id' } });
    }
    const recipe = await prisma.recipe.findUnique({ where: { id }, select: { id: true, origin: true } });
    if (!recipe) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } });
    if (recipe.origin !== 'ai_generated') return res.status(422).json({ error: { code: 'NOT_AI', message: 'Recipe is not AI-generated' } });

    await prisma.recipe.update({
      where: { id },
      data: { aiApproved: true, source: 'manual', verificationStatus: 'MANUALLY_VERIFIED', isActive: true },
    });

    logAudit({ userId: req.user?.sub, action: 'UPDATE_RECIPE', resourceType: 'RECIPE', resourceId: id, metadata: { approvedFromAi: true } });

    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// Meal Library management (7.10.1)
adminRouter.get('/meals', mealController.list);
adminRouter.post('/meals', mealController.create);
adminRouter.get('/meals/candidates', mealController.candidates);
adminRouter.get('/meals/:id', mealController.getById);
adminRouter.patch('/meals/:id', mealController.update);
adminRouter.delete('/meals/:id', mealController.remove);

// Template Plans management (7.10.2 + 7.10.3)
adminRouter.get('/template-plans/match', templateController.match);
adminRouter.get('/template-plans', templateController.list);
adminRouter.post('/template-plans', templateController.create);
adminRouter.get('/template-plans/:id', templateController.getById);
adminRouter.patch('/template-plans/:id', templateController.update);
adminRouter.delete('/template-plans/:id', templateController.remove);
adminRouter.post('/template-plans/:id/meals', templateController.addMeal);
adminRouter.delete('/template-plans/meals/:slotId', templateController.removeMeal);

// Import & data pipeline
adminRouter.post('/import/usda', importController.triggerUsdaImport);
adminRouter.post('/import/compute-allergens', importController.triggerAllergenComputation);
adminRouter.post('/import/compute-diet-flags', importController.triggerDietFlagComputation);
adminRouter.post('/recipes/:id/recompute-nutrition', importController.recomputeRecipeNutrition);
adminRouter.get('/import-jobs', importController.listImportJobs);

// Data quality
adminRouter.get('/data-quality/issues', importController.listDataQualityIssues);
adminRouter.patch('/data-quality/issues/:id/resolve', importController.resolveDataQualityIssue);

// Manual review queue
adminRouter.get('/review-queue', importController.listReviewQueue);
adminRouter.patch('/review-queue/:id', importController.processReviewItem);

// AI Usage Telemetry (7.14.1)
adminRouter.get('/ai-usage/stats', adminController.getAiUsage);
adminRouter.get('/ai-usage', adminController.listAiUsage);

// Diet Template Cache (17.2)
adminRouter.get('/diet-cache/stats', dietCacheController.getStats);
adminRouter.get('/diet-cache/templates', dietCacheController.listTemplates);
adminRouter.patch('/diet-cache/templates/:id', dietCacheController.updateTemplate);
adminRouter.delete('/diet-cache/templates/:id', dietCacheController.removeTemplate);
adminRouter.post('/diet-cache/invalidate', dietCacheController.invalidateAll);

// Meal reminders trigger (19.2)
adminRouter.post('/trigger-meal-reminders', adminController.triggerMealReminders);

// Feature Flags (7.14.2)
adminRouter.get('/feature-flags', featureFlagController.list);
adminRouter.post('/feature-flags', featureFlagController.create);
adminRouter.get('/feature-flags/:id', featureFlagController.getById);
adminRouter.patch('/feature-flags/:id', featureFlagController.update);
adminRouter.delete('/feature-flags/:id', featureFlagController.remove);

// Clinical Rules (23.2)
adminRouter.get('/clinical-rules', clinicalRuleController.list);
adminRouter.post('/clinical-rules', clinicalRuleController.create);
adminRouter.patch('/clinical-rules/bulk', clinicalRuleController.bulk);
adminRouter.get('/clinical-rules/:id', clinicalRuleController.getById);
adminRouter.patch('/clinical-rules/:id', clinicalRuleController.update);
adminRouter.patch('/clinical-rules/:id/toggle', clinicalRuleController.toggleActive);
adminRouter.delete('/clinical-rules/:id', clinicalRuleController.remove);
adminRouter.get('/clinical-rules/:id/history', clinicalRuleController.getHistory);
adminRouter.post('/clinical-rules/:id/duplicate', clinicalRuleController.duplicate);
adminRouter.post('/clinical-rules/:id/restore/:historyId', clinicalRuleController.restore);

// Nutrition Protocols (28.6)
adminRouter.get('/protocols', protocolController.list);
adminRouter.post('/protocols', protocolController.create);
adminRouter.get('/protocols/:id', protocolController.getById);
adminRouter.patch('/protocols/:id', protocolController.update);
adminRouter.patch('/protocols/:id/toggle', protocolController.toggle);
adminRouter.get('/protocols/:id/dietitians', protocolController.listAssigned);
adminRouter.post('/protocols/:id/assign', protocolController.assign);
adminRouter.delete('/protocols/:id/assign/:dietitianId', protocolController.unassign);
adminRouter.post('/protocols/:id/duplicate', protocolController.duplicate);

// Protocol Triggers (30.6.1)
adminRouter.get('/protocol-triggers', protocolTriggerController.listTriggers);
adminRouter.post('/protocol-triggers', protocolTriggerController.createTrigger);
adminRouter.get('/protocol-triggers/:id', protocolTriggerController.getTrigger);
adminRouter.patch('/protocol-triggers/:id', protocolTriggerController.updateTrigger);
adminRouter.patch('/protocol-triggers/:id/toggle', protocolTriggerController.toggleTrigger);
adminRouter.delete('/protocol-triggers/:id', protocolTriggerController.deleteTrigger);

// Protocol Conflicts (30.6.2)
adminRouter.get('/protocol-conflicts', protocolTriggerController.listConflicts);
adminRouter.post('/protocol-conflicts', protocolTriggerController.createConflict);
adminRouter.get('/protocol-conflicts/:id', protocolTriggerController.getConflict);
adminRouter.patch('/protocol-conflicts/:id', protocolTriggerController.updateConflict);
adminRouter.patch('/protocol-conflicts/:id/toggle', protocolTriggerController.toggleConflict);
adminRouter.delete('/protocol-conflicts/:id', protocolTriggerController.deleteConflict);

// App Settings (29.0)
adminRouter.get('/settings', adminController.getSettings);
adminRouter.patch('/settings', adminController.patchSettings);
adminRouter.get('/settings/scoring-weights', adminController.getScoringWeights);
adminRouter.patch('/settings/scoring-weights', adminController.patchScoringWeights);
adminRouter.delete('/settings/scoring-weights', adminController.resetScoringWeights);

// Clean products management (25.E1)
adminRouter.get('/clean-products/search', cleanProductController.search);
adminRouter.get('/clean-products/categories', cleanProductController.getCategories);
adminRouter.get('/clean-products/stats', cleanProductController.getStats);
adminRouter.post('/clean-products/preview-nutrition', cleanProductController.previewNutrition);
adminRouter.post('/clean-products/bulk', cleanProductController.bulkAction);
adminRouter.get('/clean-products/duplicates', cleanProductController.findDuplicates);
adminRouter.post('/clean-products/merge', cleanProductController.mergeProducts);
adminRouter.get('/clean-products', cleanProductController.list);
adminRouter.post('/clean-products', cleanProductController.create);
adminRouter.get('/clean-products/:id', cleanProductController.getById);
adminRouter.get('/clean-products/:id/history', cleanProductController.getHistory);
adminRouter.patch('/clean-products/:id', cleanProductController.update);
adminRouter.delete('/clean-products/:id', cleanProductController.remove);

// AI Cost Tracking (33.9) — ADMIN only
adminRouter.get('/ai-costs', aiCostController.listAiCosts);
adminRouter.get('/ai-costs/:dietPlanId', aiCostController.getAiCostForPlan);

// 39.7: Security Monitoring — ADMIN only
adminRouter.get('/security/stats', adminController.getSecurityStats);
adminRouter.get('/security/trends', adminController.getSecurityTrends);
adminRouter.get('/security/alerts', adminController.getSecurityAlerts);
adminRouter.get('/security/recent', adminController.getRecentSuspiciousActivity);
adminRouter.get('/security/devices/suspicious', adminController.getSuspiciousDevices);
adminRouter.get('/security/devices/:fingerprint/users', adminController.getUsersByFingerprintHandler);
adminRouter.get('/security/users/:id/devices', adminController.getUserDevices);
adminRouter.get('/security/bans', adminController.listSecurityBans);
adminRouter.post('/security/bans', adminController.createSecurityBan);
adminRouter.delete('/security/bans/:id', adminController.removeSecurityBan);

// 41.3 — Consultations
adminRouter.get('/consultations', adminController.listConsultations);
adminRouter.patch('/consultations/:id/status', adminController.updateConsultationStatus);

// 69 — Stripe Admin
adminRouter.get('/stripe/dashboard', stripeAdminController.getDashboard);
adminRouter.get('/stripe/transactions', stripeAdminController.listTransactions);
adminRouter.post('/stripe/refund', stripeAdminController.createRefund);
adminRouter.get('/stripe/failed-payments', stripeAdminController.listFailedPayments);
adminRouter.get('/stripe/coupons', stripeAdminController.listCoupons);
adminRouter.post('/stripe/coupons', stripeAdminController.createCoupon);
adminRouter.delete('/stripe/coupons/:id', stripeAdminController.deleteCoupon);

// 54.6 — Subscriptions
adminRouter.get('/subscriptions/stats', adminController.getSubscriptionStats);
adminRouter.get('/subscriptions', adminController.listSubscriptions);

// S-12 — Scraper monitoring stats
adminRouter.get('/scraper-stats', async (_req, res, next) => {
  try {
    const stats = await computeScraperStats();
    res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
});

// Faza D Phase 2 prep — solver metrics aggregation for shadow rollout review.
// Query params: ?days=7 (default) & ?patientId=<cuid> (optional, narrows to one patient).
adminRouter.get('/solver-stats', async (req, res, next) => {
  try {
    const daysRaw = req.query.days;
    const patientIdRaw = req.query.patientId;
    const days = typeof daysRaw === 'string' && /^\d+$/.test(daysRaw)
      ? Math.min(Math.max(Number(daysRaw), 1), 90)   // clamp 1..90 days
      : 7;
    const patientId = typeof patientIdRaw === 'string' && patientIdRaw.length > 0
      ? patientIdRaw
      : undefined;
    const stats = await computeSolverStats({ days, patientId });
    res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
});

// 70 — Accounting
adminRouter.get('/accounting/revenue', accountingController.getRevenue);
adminRouter.get('/accounting/transactions-csv', accountingController.getTransactionsCsv);
adminRouter.get('/accounting/costs', accountingController.getCosts);
adminRouter.get('/accounting/churn', accountingController.getChurn);
adminRouter.get('/accounting/invoices-export', accountingController.getInvoicesExport);
