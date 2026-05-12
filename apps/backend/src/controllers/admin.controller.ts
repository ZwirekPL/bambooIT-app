import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { passwordSchema } from '../utils/validation';
import * as adminService from '../services/admin.service';
import { logAudit, type AuditAction } from '../services/audit.service';
import { prisma } from '@db';
import { getAiUsageStats, listAiUsageLogs } from '../services/aiUsage.service';
// TODO(2b-cleanup): mealReminder.service dropped in 2c → triggerMealReminders handler commented below
// import { processMealReminders } from '../services/mealReminder.service';
import * as appSettings from '../services/appSettings.service';
// TODO(2b-cleanup): patient.service dropped in 2c → unlockPatientProfile handler commented below
// import * as patientService from '../services/patient.service';
import * as securityMonitoring from '../services/securityMonitoring.service';
import { adminUnlockAccount } from '../services/antiAbuse.service';
import * as deviceFingerprint from '../services/deviceFingerprint.service';
import * as banService from '../services/ban.service';
import { redis } from '../utils/redis';
import * as adminSubscription from '../services/adminSubscription.service';
import { forgotPassword } from '../services/auth.service';

const dietitianIdSchema = z.object({ id: z.string().cuid() });

const createDietitianSchema = z.object({
  email: z.string().email(),
  password: passwordSchema.optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const tenantIdSchema = z.object({ id: z.string().cuid() });

const listTenantsQuerySchema = paginationSchema.extend({
  search: z.string().min(1).max(100).optional(),
});

const updateTenantBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'DIETITIAN', 'PATIENT']).optional(),
  excludeRole: z.enum(['ADMIN', 'DIETITIAN', 'PATIENT']).optional(),
  hideDeleted: z.coerce.boolean().optional(),
  inactiveMonths: z.coerce.number().int().min(1).max(24).optional(),
  sortBy: z.enum(['email', 'createdAt', 'lastLoginAt', 'role']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  subscriptionStatus: z.string().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: passwordSchema.optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dietitianCode: z.string().min(1).max(20).optional(),
});

const userIdSchema = z.object({ id: z.string().cuid() });

const changeRoleSchema = z.object({
  role: z.enum(['ADMIN', 'DIETITIAN', 'PATIENT']),
});

const listAuditLogsQuerySchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  action: z.string().max(100).optional(),
  resourceType: z.string().max(100).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const exportAuditLogsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  action: z.string().max(100).optional(),
  resourceType: z.string().max(100).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const result = await adminService.listUsers(parsed.data);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listTenants(req: Request, res: Response, next: NextFunction) {
  const parsed = listTenantsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const result = await adminService.listTenants(parsed.data);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getTenantById(req: Request, res: Response, next: NextFunction) {
  const parsed = tenantIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid tenant id'));
  }

  try {
    const tenant = await adminService.getTenantById(parsed.data.id);
    return res.json({ ok: true, tenant });
  } catch (err) {
    next(err);
  }
}

export async function softDeleteTenant(req: Request, res: Response, next: NextFunction) {
  const parsed = tenantIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid tenant id'));
  }

  try {
    const tenant = await adminService.softDeleteTenant(parsed.data.id);
    logAudit({
      userId: req.user?.sub,
      action: 'DELETE_TENANT',
      resourceType: 'TENANT',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, tenant });
  } catch (err) {
    next(err);
  }
}

export async function restoreTenant(req: Request, res: Response, next: NextFunction) {
  const parsed = tenantIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid tenant id'));
  }

  try {
    const tenant = await adminService.restoreTenant(parsed.data.id);
    logAudit({
      userId: req.user?.sub,
      action: 'RESTORE_TENANT',
      resourceType: 'TENANT',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, tenant });
  } catch (err) {
    next(err);
  }
}

export async function updateTenant(req: Request, res: Response, next: NextFunction) {
  const idParsed = tenantIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid tenant id'));
  }

  const bodyParsed = updateTenantBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const tenant = await adminService.updateTenantById(idParsed.data.id, bodyParsed.data);
    return res.json({ ok: true, tenant });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await adminService.getStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
}

export async function getActionItems(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await adminService.getActionItems();
    return res.json({ ok: true, ...items });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map(i => ({
      field: i.path.join('.'),
      code: i.code,
      minimum: 'minimum' in i ? (i as unknown as { minimum: number }).minimum : undefined,
    }));
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
    });
  }

  try {
    const result = await adminService.createUser(parsed.data);
    logAudit({
      userId: req.user?.sub,
      action: 'CREATE_USER',
      resourceType: 'USER',
      resourceId: result.userId,
      ip: req.ip,
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createDietitian(req: Request, res: Response, next: NextFunction) {
  const parsed = createDietitianSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map(i => ({
      field: i.path.join('.'),
      code: i.code,
      minimum: 'minimum' in i ? (i as unknown as { minimum: number }).minimum : undefined,
    }));
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
    });
  }

  try {
    const result = await adminService.createDietitian(parsed.data);
    logAudit({
      userId: req.user?.sub,
      action: 'CREATE_DIETITIAN',
      resourceType: 'USER',
      resourceId: result.dietitianUserId,
      ip: req.ip,
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

const listDietitiansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().min(1).max(100).optional(),
  sortBy: z.enum(['email', 'createdAt', 'lastLoginAt', 'patientsCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  hideDeleted: z.coerce.boolean().optional(),
});

export async function listDietitians(req: Request, res: Response, next: NextFunction) {
  const parsed = listDietitiansQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const result = await adminService.listDietitians(parsed.data);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

const updateDietitianSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

export async function getDietitianPatients(req: Request, res: Response, next: NextFunction) {
  const parsed = dietitianIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  try {
    const result = await adminService.getDietitianPatients(parsed.data.id);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateDietitian(req: Request, res: Response, next: NextFunction) {
  const idParsed = dietitianIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  const bodyParsed = updateDietitianSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    const fields = bodyParsed.error.issues.map(i => ({
      field: i.path.join('.'),
      code: i.code,
    }));
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
    });
  }

  try {
    const result = await adminService.updateDietitian(idParsed.data.id, bodyParsed.data);
    logAudit({
      userId: req.user?.sub,
      action: 'UPDATE_DIETITIAN',
      resourceType: 'USER',
      resourceId: idParsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, dietitian: result });
  } catch (err) {
    next(err);
  }
}

export async function rotateDietitianCode(req: Request, res: Response, next: NextFunction) {
  const parsed = dietitianIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  try {
    const result = await adminService.rotateDietitianCode(parsed.data.id);
    logAudit({
      userId: req.user?.sub,
      action: 'ROTATE_DIETITIAN_CODE',
      resourceType: 'USER',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ── Dietitian toggle active (52.2) ────────────────────────────────────────

export async function toggleDietitianActive(req: Request, res: Response, next: NextFunction) {
  const parsed = dietitianIdSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));

  try {
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.id },
      select: { deletedAt: true, _count: { select: { patientsAsDietitian: true } } },
    });
    if (!user) return res.status(404).json(apiError('NOT_FOUND', 'User not found'));

    const isActive = !user.deletedAt;
    await prisma.user.update({
      where: { id: parsed.data.id },
      data: { deletedAt: isActive ? new Date() : null },
    });

    await logAudit({
      userId: req.user?.sub,
      action: isActive ? 'DELETE_USER' : 'RESTORE_USER',
      resourceType: 'USER',
      resourceId: parsed.data.id,
      ip: req.ip,
    });

    return res.json({ ok: true, active: !isActive, patientsAffected: user._count.patientsAsDietitian });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  const parsed = userIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  try {
    const user = await adminService.getUserById(parsed.data.id);
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

export async function softDeleteUser(req: Request, res: Response, next: NextFunction) {
  const parsed = userIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  if (parsed.data.id === req.user?.sub) {
    return res.status(403).json(apiError('FORBIDDEN', 'Cannot delete your own account'));
  }

  try {
    const user = await adminService.softDeleteUser(parsed.data.id);
    logAudit({
      userId: req.user?.sub,
      action: 'DELETE_USER',
      resourceType: 'USER',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

export async function restoreUser(req: Request, res: Response, next: NextFunction) {
  const parsed = userIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  try {
    const user = await adminService.restoreUser(parsed.data.id);
    logAudit({
      userId: req.user?.sub,
      action: 'RESTORE_USER',
      resourceType: 'USER',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  const parsed = listAuditLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const result = await adminService.listAuditLogs(parsed.data);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function exportAuditLogsCsv(req: Request, res: Response, next: NextFunction) {
  const parsed = exportAuditLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const csv = await adminService.exportAuditLogsCsv(parsed.data);
    const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await adminService.getAuditLogStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
}

export async function changeUserRole(req: Request, res: Response, next: NextFunction) {
  const idParsed = userIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  const bodyParsed = changeRoleSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid role value'));
  }

  if (idParsed.data.id === req.user?.sub) {
    return res.status(403).json(apiError('FORBIDDEN', 'Cannot change your own role'));
  }

  try {
    const user = await adminService.changeUserRole(idParsed.data.id, bodyParsed.data.role);
    logAudit({
      userId: req.user?.sub,
      action: 'CHANGE_USER_ROLE',
      resourceType: 'USER',
      resourceId: idParsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

// ─── Admin Email Verification (15.3) ─────────────────────────────────────────

export async function verifyUserEmail(req: Request, res: Response, next: NextFunction) {
  const parsed = userIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  try {
    const user = await adminService.verifyUserEmail(parsed.data.id);
    logAudit({
      userId: req.user?.sub,
      action: 'ADMIN_VERIFY_EMAIL',
      resourceType: 'USER',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  const parsed = userIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  try {
    const result = await adminService.resendVerificationEmail(parsed.data.id);
    logAudit({
      userId: req.user?.sub,
      action: 'ADMIN_RESEND_VERIFICATION',
      resourceType: 'USER',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── AI Usage Telemetry (7.14.1) ────────────────────────────────────────────

const aiUsageStatsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const aiUsageListSchema = paginationSchema.extend({
  patientId: z.string().cuid().optional(),
  source: z.string().optional(),
  success: z.enum(['true', 'false']).optional(),
});

export async function getAiUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const query = aiUsageStatsSchema.safeParse(req.query);
    if (!query.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
    const stats = await getAiUsageStats(query.data.days);
    return res.json(stats);
  } catch (err) {
    next(err);
  }
}

export async function listAiUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const query = aiUsageListSchema.safeParse(req.query);
    if (!query.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
    const result = await listAiUsageLogs({
      page: query.data.page,
      limit: query.data.limit,
      patientId: query.data.patientId,
      source: query.data.source,
      success: query.data.success !== undefined ? query.data.success === 'true' : undefined,
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

// TODO(2b-cleanup): mealReminder.service dropped in 2c
// export async function triggerMealReminders(req: Request, res: Response, next: NextFunction) {
//   try {
//     const sentCount = await processMealReminders();
//     return res.json({ ok: true, sentCount });
//   } catch (err) {
//     next(err);
//   }
// }

// PRE.10: GET /admin/frequent-inputs?field=dislikes&limit=20
export async function getFrequentInputs(req: Request, res: Response, next: NextFunction) {
  const schema = z.object({
    field: z.string().min(1).max(100),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query params'));
  }

  try {
    const results = await prisma.frequentInput.findMany({
      where: { field: parsed.data.field },
      orderBy: { count: 'desc' },
      take: parsed.data.limit,
      select: { value: true, count: true },
    });
    return res.json({ ok: true, field: parsed.data.field, results });
  } catch (err) {
    next(err);
  }
}

// ─── App Settings (29.0) ─────────────────────────────────────────────────────

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await appSettings.getAllSettings();
    return res.json({ ok: true, settings });
  } catch (err) {
    next(err);
  }
}

const patchSettingsSchema = z.record(z.string(), z.unknown()).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one setting is required' },
);

export async function patchSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = patchSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'));
    for (const [key, value] of Object.entries(parsed.data)) {
      await appSettings.setSetting(key, value);
    }
    const settings = await appSettings.getAllSettings();
    return res.json({ ok: true, settings });
  } catch (err) {
    next(err);
  }
}

// ─── Scoring Weights (76a) ───────────────────────────────────────────────────

const scoringWeightField = z.number().min(0).max(1);

const patchScoringWeightsSchema = z.object({
  nutritionFit: scoringWeightField.optional(),
  quality: scoringWeightField.optional(),
  patientRating: scoringWeightField.optional(),
  cuisine: scoringWeightField.optional(),
  season: scoringWeightField.optional(),
  diversity: scoringWeightField.optional(),
  cost: scoringWeightField.optional(),
  microFit: scoringWeightField.optional(),
  practicalFit: scoringWeightField.optional(),
  satietyProxy: scoringWeightField.optional(),
  interaction: scoringWeightField.optional(),
  compliance: scoringWeightField.optional(),
}).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one weight is required' },
).refine(
  (obj) => {
    // Merge with defaults and check sum is ~1.0
    const merged = { ...appSettings.DEFAULT_SCORING_WEIGHTS, ...obj };
    const sum = Object.values(merged).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1.0) < 0.02; // allow 2% tolerance for rounding
  },
  { message: 'Weights must sum to approximately 1.0 (±0.02)' },
);

export async function getScoringWeights(_req: Request, res: Response, next: NextFunction) {
  try {
    const weights = await appSettings.getScoringWeights();
    return res.json({ ok: true, weights, defaults: appSettings.DEFAULT_SCORING_WEIGHTS });
  } catch (err) {
    next(err);
  }
}

export async function patchScoringWeights(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = patchScoringWeightsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid weights'));
    }

    // Read current, merge, save
    const current = await appSettings.getSetting<Record<string, number>>(
      appSettings.SETTING_SCORING_WEIGHTS, {},
    );
    const updated = { ...current, ...parsed.data };
    await appSettings.setSetting(appSettings.SETTING_SCORING_WEIGHTS, updated);

    const weights = await appSettings.getScoringWeights();
    return res.json({ ok: true, weights });
  } catch (err) {
    next(err);
  }
}

export async function resetScoringWeights(_req: Request, res: Response, next: NextFunction) {
  try {
    await appSettings.setSetting(appSettings.SETTING_SCORING_WEIGHTS, {});
    return res.json({ ok: true, weights: appSettings.DEFAULT_SCORING_WEIGHTS, message: 'Reset to defaults' });
  } catch (err) {
    next(err);
  }
}

// ─── Grant Access (29.0.5) ───────────────────────────────────────────────────

const grantAccessSchema = z.object({
  grantedAccessUntil: z.string().datetime().nullable(),
});

export async function grantAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = userIdSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
    const bodyParsed = grantAccessSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', bodyParsed.error.issues[0]?.message ?? 'Invalid body'));

    const user = await prisma.user.update({
      where: { id: idParsed.data.id },
      data: { grantedAccessUntil: bodyParsed.data.grantedAccessUntil },
      select: { id: true, email: true, grantedAccessUntil: true },
    });

    return res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

// TODO(2b-cleanup): patient.service dropped in 2c
// // ─── 39.1.2: Unlock patient profile ─────────────────────────────────────────
//
// export async function unlockPatientProfile(req: Request, res: Response, next: NextFunction) {
//   try {
//     const idParsed = z.object({ id: z.string().cuid() }).safeParse(req.params);
//     if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
//
//     await patientService.unlockProfile(idParsed.data.id);
//     logAudit({
//       userId: req.user?.sub,
//       action: 'UNLOCK_PATIENT_PROFILE',
//       resourceType: 'PATIENT',
//       resourceId: idParsed.data.id,
//       ip: req.ip,
//     });
//     return res.json({ ok: true });
//   } catch (err) {
//     next(err);
//   }
// }

// ─── 39.6.3: Admin unlock locked account ────────────────────────────────────

export async function unlockAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = z.object({ id: z.string().cuid() }).safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

    await adminUnlockAccount(idParsed.data.id);
    logAudit({
      userId: req.user?.sub,
      action: 'UNLOCK_ACCOUNT',
      resourceType: 'USER',
      resourceId: idParsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── 39.7: Security Monitoring ──────────────────────────────────────────────

export async function getSecurityStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await securityMonitoring.getSecurityStats();
    return res.json({ ok: true, ...stats });
  } catch (err) {
    next(err);
  }
}

export async function getSecurityAlerts(_req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await securityMonitoring.getSecurityAlerts();
    return res.json({ ok: true, alerts });
  } catch (err) {
    next(err);
  }
}

const suspiciousActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function getSecurityTrends(req: Request, res: Response, next: NextFunction) {
  try {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400000);

    const [dailyCounts, topIps, topFingerprints] = await Promise.all([
      prisma.$queryRaw<Array<{ day: Date; action: string; count: bigint }>>`
        SELECT DATE_TRUNC('day', "createdAt") as day, action, COUNT(*) as count
        FROM "AuditLog"
        WHERE "createdAt" >= ${since}
          AND action IN ('LOGIN_FAILED', 'ACCOUNT_LOCKED', 'DEVICE_ABUSE', 'IP_ABUSE')
        GROUP BY day, action
        ORDER BY day ASC
      `,
      prisma.$queryRaw<Array<{ ip: string; count: bigint }>>`
        SELECT ip, COUNT(*) as count
        FROM "AuditLog"
        WHERE "createdAt" >= ${since} AND action = 'LOGIN_FAILED' AND ip IS NOT NULL
        GROUP BY ip
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.$queryRaw<Array<{ fingerprint: string; account_count: bigint }>>`
        SELECT fingerprint, COUNT(DISTINCT "userId") as account_count
        FROM "DeviceFingerprint"
        GROUP BY fingerprint
        HAVING COUNT(DISTINCT "userId") >= 3
        ORDER BY account_count DESC
        LIMIT 10
      `,
    ]);

    return res.json({
      ok: true,
      trends: {
        dailyCounts: dailyCounts.map((r) => ({ day: r.day, action: r.action, count: Number(r.count) })),
        topIps: topIps.map((r) => ({ ip: r.ip, count: Number(r.count) })),
        topFingerprints: topFingerprints.map((r) => ({ fingerprint: r.fingerprint, accountCount: Number(r.account_count) })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getRecentSuspiciousActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = suspiciousActivityQuerySchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : 20;
    const activities = await securityMonitoring.getRecentSuspiciousActivity(limit);
    return res.json({ ok: true, activities });
  } catch (err) {
    next(err);
  }
}

// ── 40.2: Device fingerprint investigation ────────────────────────────────────

export async function getSuspiciousDevices(_req: Request, res: Response, next: NextFunction) {
  try {
    // Find fingerprints shared by 3+ accounts
    const results = await prisma.$queryRaw<Array<{ fingerprint: string; account_count: bigint; last_seen: Date }>>`
      SELECT fingerprint, COUNT(DISTINCT "userId") as account_count, MAX("lastSeenAt") as last_seen
      FROM "DeviceFingerprint"
      GROUP BY fingerprint
      HAVING COUNT(DISTINCT "userId") >= 3
      ORDER BY account_count DESC
      LIMIT 50
    `;
    const devices = results.map((r) => ({
      fingerprint: r.fingerprint,
      accountCount: Number(r.account_count),
      lastSeen: r.last_seen,
    }));
    return res.json({ ok: true, devices });
  } catch (err) {
    next(err);
  }
}

export async function getUsersByFingerprintHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { fingerprint } = req.params;
    if (!fingerprint) return res.status(400).json(apiError('VALIDATION_ERROR', 'fingerprint required'));
    const users = await deviceFingerprint.getUsersByFingerprint(fingerprint);
    return res.json({ ok: true, users });
  } catch (err) {
    next(err);
  }
}

export async function getUserDevices(req: Request, res: Response, next: NextFunction) {
  const parsed = z.object({ id: z.string().cuid() }).safeParse(req.params);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user ID'));
  try {
    const devices = await deviceFingerprint.getUserFingerprints(parsed.data.id);
    return res.json({ ok: true, devices });
  } catch (err) {
    next(err);
  }
}

// ── 40.3: Security bans ───────────────────────────────────────────────────

const createBanSchema = z.object({
  type: z.enum(['IP', 'SUBNET', 'FINGERPRINT']),
  value: z.string().min(1).max(200),
  reason: z.string().min(1).max(1000),
  expiresAt: z.string().datetime().optional(),
});

export async function createSecurityBan(req: Request, res: Response, next: NextFunction) {
  const parsed = createBanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid body'));
  try {
    const ban = await banService.createBan({
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdById: req.user!.sub,
    });
    return res.status(201).json({ ok: true, ban });
  } catch (err) {
    next(err);
  }
}

export async function removeSecurityBan(req: Request, res: Response, next: NextFunction) {
  const parsed = z.object({ id: z.string().cuid() }).safeParse(req.params);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
  try {
    await banService.removeBan(parsed.data.id);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

const listBansSchema = z.object({
  type: z.enum(['IP', 'SUBNET', 'FINGERPRINT']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function listSecurityBans(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listBansSchema.safeParse(req.query);
    const params = parsed.success ? parsed.data : { page: 1, limit: 20 };
    const result = await banService.getActiveBans(params);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ── Admin: Consultations list (41.3) ──────────────────────────────────────────

const consultationsQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED']).optional(),
});

export async function listConsultations(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = consultationsQuerySchema.safeParse(req.query);
    const { page, limit, status } = parsed.success ? parsed.data : { page: 1, limit: 20, status: undefined };

    const where: Record<string, unknown> = { productType: 'CONSULTATION' };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          patient: {
            include: { user: { select: { email: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const consultations = orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      consultationPhone: o.consultationPhone,
      patientFirstName: o.patient.firstName,
      patientLastName: o.patient.lastName,
      patientEmail: o.patient.user.email,
    }));

    return res.json({ ok: true, consultations, total, page, limit });
  } catch (err) {
    next(err);
  }
}

const consultationStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED']),
});

export async function updateConsultationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = z.object({ id: z.string().cuid() }).safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

    const bodyParsed = consultationStatusSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid status'));

    const order = await prisma.order.findFirst({
      where: { id: idParsed.data.id, productType: 'CONSULTATION' },
    });
    if (!order) return res.status(404).json(apiError('NOT_FOUND', 'Consultation order not found'));

    const updated = await prisma.order.update({
      where: { id: idParsed.data.id },
      data: { status: bodyParsed.data.status },
    });

    return res.json({ ok: true, order: updated });
  } catch (err) {
    next(err);
  }
}

// ── Admin: Subscription stats & list (54.6) ──────────────────────────────────

export async function getSubscriptionStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await adminSubscription.getSubscriptionStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
}

const subscriptionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  productType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function listSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = subscriptionListSchema.safeParse(req.query);
    const params = parsed.success ? parsed.data : { page: 1, limit: 20 };
    const result = await adminSubscription.listSubscriptions(params);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ── Admin: Bulk user operations (53.6) ────────────────────────────────────

const bulkUsersSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(50),
  action: z.enum(['deactivate', 'restore', 'forcePasswordReset']),
});

export async function bulkUserAction(req: Request, res: Response, next: NextFunction) {
  const parsed = bulkUsersSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid body'));

  const { ids, action } = parsed.data;
  try {
    let affected = 0;
    if (action === 'deactivate') {
      const result = await prisma.user.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      affected = result.count;
    } else if (action === 'restore') {
      const result = await prisma.user.updateMany({
        where: { id: { in: ids }, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      affected = result.count;
    } else if (action === 'forcePasswordReset') {
      const users = await prisma.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { email: true },
      });
      for (const u of users) {
        await forgotPassword(u.email);
      }
      affected = users.length;
    }

    await logAudit({
      userId: req.user!.sub,
      action: 'BULK_USER_ACTION' as AuditAction,
      ip: req.ip ?? undefined,
      metadata: { bulkAction: action, userIds: ids, affected },
    });

    return res.json({ ok: true, affected });
  } catch (err) {
    next(err);
  }
}

// ── Admin: Force password reset (53.5) ────────────────────────────────────

export async function forcePasswordReset(req: Request, res: Response, next: NextFunction) {
  const idParsed = z.object({ id: z.string().cuid() }).safeParse(req.params);
  if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user ID'));

  try {
    const user = await prisma.user.findUnique({ where: { id: idParsed.data.id, deletedAt: null } });
    if (!user) return res.status(404).json(apiError('NOT_FOUND', 'User not found'));

    await forgotPassword(user.email);
    await logAudit({
      userId: req.user!.sub,
      action: 'ADMIN_FORCE_PASSWORD_RESET',
      resourceType: 'USER',
      resourceId: user.id,
      ip: req.ip ?? undefined,
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── Admin: Revoke all sessions (53.9) ─────────────────────────────────────

const JWT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days — matches JWT expiry

export async function revokeUserSessions(req: Request, res: Response, next: NextFunction) {
  const idParsed = z.object({ id: z.string().cuid() }).safeParse(req.params);
  if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user ID'));

  try {
    const user = await prisma.user.findUnique({ where: { id: idParsed.data.id } });
    if (!user) return res.status(404).json(apiError('NOT_FOUND', 'User not found'));

    // Set revocation timestamp — all tokens issued before this time are invalid
    const now = Math.floor(Date.now() / 1000);
    await redis.set(`blacklist:user:${user.id}`, String(now), 'EX', JWT_MAX_AGE_SECONDS);

    await logAudit({
      userId: req.user!.sub,
      action: 'REVOKE_USER_SESSIONS',
      resourceType: 'USER',
      resourceId: user.id,
      ip: req.ip ?? undefined,
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
