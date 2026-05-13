import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as blogController from '../controllers/blog.controller';
import * as blogCategoryController from '../controllers/blogCategory.controller';
import { uploadBlogImage } from '../controllers/upload.controller';
import * as stripeAdminController from '../controllers/stripeAdmin.controller';
import * as accountingController from '../controllers/accounting.controller';
import * as featureFlagController from '../controllers/featureFlag.controller';
import { prisma } from '@db';
import { logAudit } from '../services/audit.service';

export const adminRouter = Router();

adminRouter.post('/users', adminController.createUser);
adminRouter.get('/users', adminController.listUsers);
adminRouter.get('/users/:id', adminController.getUserById);
adminRouter.delete('/users/:id', adminController.softDeleteUser);
adminRouter.patch('/users/:id/restore', adminController.restoreUser);
adminRouter.get('/stats', adminController.getStats);
adminRouter.get('/dashboard/action-items', adminController.getActionItems);
adminRouter.patch('/users/:id/role', adminController.changeUserRole);
adminRouter.post('/users/:id/verify-email', adminController.verifyUserEmail);
adminRouter.post('/users/:id/resend-verification', adminController.resendVerification);
adminRouter.patch('/users/:id/grant-access', adminController.grantAccess);
adminRouter.post('/users/:id/force-password-reset', adminController.forcePasswordReset);
adminRouter.patch('/users/bulk', adminController.bulkUserAction);
adminRouter.post('/users/:id/revoke-sessions', adminController.revokeUserSessions);

// 39.6.3: Unlock locked account
adminRouter.post('/users/:id/unlock', adminController.unlockAccount);

adminRouter.get('/audit-logs', adminController.listAuditLogs);
adminRouter.get('/audit-logs/stats', adminController.getAuditLogStats);
adminRouter.get('/audit-logs/export', adminController.exportAuditLogsCsv);

// PRE.10: frequent free-text inputs analytics

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

// AI Usage Telemetry (7.14.1)

// Feature Flags (7.14.2)
adminRouter.get('/feature-flags', featureFlagController.list);
adminRouter.post('/feature-flags', featureFlagController.create);
adminRouter.get('/feature-flags/:id', featureFlagController.getById);
adminRouter.patch('/feature-flags/:id', featureFlagController.update);
adminRouter.delete('/feature-flags/:id', featureFlagController.remove);

// App Settings (29.0)
adminRouter.get('/settings', adminController.getSettings);
adminRouter.patch('/settings', adminController.patchSettings);
adminRouter.get('/settings/scoring-weights', adminController.getScoringWeights);
adminRouter.patch('/settings/scoring-weights', adminController.patchScoringWeights);
adminRouter.delete('/settings/scoring-weights', adminController.resetScoringWeights);

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

// 70 — Accounting
adminRouter.get('/accounting/revenue', accountingController.getRevenue);
adminRouter.get('/accounting/transactions-csv', accountingController.getTransactionsCsv);
adminRouter.get('/accounting/costs', accountingController.getCosts);
adminRouter.get('/accounting/churn', accountingController.getChurn);
adminRouter.get('/accounting/invoices-export', accountingController.getInvoicesExport);
