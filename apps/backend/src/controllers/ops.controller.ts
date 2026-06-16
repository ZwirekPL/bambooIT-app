import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as opsService from '../services/ops.service';
import { sendPeriodReport } from '../services/serviceReport.service';
import { logAudit } from '../services/audit.service';

const PLAN = z.enum(['START', 'FIRMA', 'FIRMA_PLUS']);

const companyIdParam = z.object({ companyId: z.string().cuid() });
const idParam = z.object({ id: z.string().cuid() });

// Period selector: ?year=YYYY&month=M (defaults to current month).
const periodQuery = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const timeEntryBody = z.object({
  date: z.string().datetime(),
  minutes: z.number().int().min(1).max(1440),
  description: z.string().min(1).max(2000),
  billable: z.boolean().optional().default(true),
});

const timeEntryPatchBody = z.object({
  date: z.string().datetime().optional(),
  minutes: z.number().int().min(1).max(1440).optional(),
  description: z.string().min(1).max(2000).optional(),
  billable: z.boolean().optional(),
});

const servicePlanBody = z.object({
  plan: PLAN.nullable(),
  serviceSince: z.string().datetime().nullable().optional(),
});

const onboardingBody = z.object({
  accessCollected: z.boolean().optional(),
  remoteToolReady: z.boolean().optional(),
  monitoringSet: z.boolean().optional(),
  backupSet: z.boolean().optional(),
  docsCreated: z.boolean().optional(),
  completed: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
});

function resolvePeriod(q: z.infer<typeof periodQuery>) {
  const now = new Date();
  return {
    year: q.year ?? now.getUTCFullYear(),
    month: q.month ?? now.getUTCMonth() + 1,
  };
}

// ─── Packages ─────────────────────────────────────────────────────────────

export async function listPackages(_req: Request, res: Response, next: NextFunction) {
  try {
    const packages = await opsService.listServicePackages();
    return res.json({ ok: true, packages });
  } catch (err) {
    next(err);
  }
}

// ─── Clients ──────────────────────────────────────────────────────────────

export async function listClients(_req: Request, res: Response, next: NextFunction) {
  try {
    const clients = await opsService.listClients();
    return res.json({ ok: true, clients });
  } catch (err) {
    next(err);
  }
}

export async function setServicePlan(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  const body = servicePlanBody.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid service plan payload'));

  try {
    const company = await opsService.setServicePlan(
      params.data.companyId,
      body.data.plan,
      body.data.serviceSince ? new Date(body.data.serviceSince) : body.data.plan ? new Date() : null,
    );
    logAudit({
      userId: req.user!.sub,
      action: 'SERVICE_PLAN_SET',
      resourceType: 'COMPANY',
      resourceId: company.id,
      ip: req.ip,
      metadata: { plan: body.data.plan },
    });
    return res.json({ ok: true, company });
  } catch (err) {
    next(err);
  }
}

// ─── Time entries ─────────────────────────────────────────────────────────

export async function listTimeEntries(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  const query = periodQuery.safeParse(req.query);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));
  if (!query.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid period'));

  try {
    const { year, month } = resolvePeriod(query.data);
    const entries = await opsService.listTimeEntries(params.data.companyId, year, month);
    return res.json({ ok: true, entries });
  } catch (err) {
    next(err);
  }
}

export async function addTimeEntry(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  const body = timeEntryBody.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid time entry payload'));

  try {
    const entry = await opsService.addTimeEntry(
      params.data.companyId,
      { ...body.data, date: new Date(body.data.date) },
      req.user!.sub,
    );
    logAudit({
      userId: req.user!.sub,
      action: 'TIME_ENTRY_ADDED',
      resourceType: 'TIME_ENTRY',
      resourceId: entry.id,
      ip: req.ip,
      metadata: { companyId: params.data.companyId, minutes: entry.minutes },
    });
    return res.status(201).json({ ok: true, entry });
  } catch (err) {
    next(err);
  }
}

export async function updateTimeEntry(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  const body = timeEntryPatchBody.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patch payload'));

  try {
    const entry = await opsService.updateTimeEntry(params.data.id, {
      ...body.data,
      date: body.data.date ? new Date(body.data.date) : undefined,
    });
    logAudit({
      userId: req.user!.sub,
      action: 'TIME_ENTRY_UPDATED',
      resourceType: 'TIME_ENTRY',
      resourceId: entry.id,
      ip: req.ip,
    });
    return res.json({ ok: true, entry });
  } catch (err) {
    next(err);
  }
}

export async function deleteTimeEntry(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    const entry = await opsService.deleteTimeEntry(params.data.id);
    logAudit({
      userId: req.user!.sub,
      action: 'TIME_ENTRY_DELETED',
      resourceType: 'TIME_ENTRY',
      resourceId: entry.id,
      ip: req.ip,
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Periods ──────────────────────────────────────────────────────────────

export async function listPeriods(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));

  try {
    const periods = await opsService.listPeriods(params.data.companyId);
    return res.json({ ok: true, periods });
  } catch (err) {
    next(err);
  }
}

export async function settlePeriod(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    const period = await opsService.settlePeriod(params.data.id);
    logAudit({
      userId: req.user!.sub,
      action: 'SERVICE_PERIOD_SETTLED',
      resourceType: 'SERVICE_PERIOD',
      resourceId: period.id,
      ip: req.ip,
      metadata: { overageAmountNet: String(period.overageAmountNet) },
    });
    return res.json({ ok: true, period });
  } catch (err) {
    next(err);
  }
}

export async function sendReport(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    const period = await sendPeriodReport(params.data.id);
    logAudit({
      userId: req.user!.sub,
      action: 'SERVICE_PERIOD_REPORT_SENT',
      resourceType: 'SERVICE_PERIOD',
      resourceId: period.id,
      ip: req.ip,
      metadata: { year: period.year, month: period.month },
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Onboarding ───────────────────────────────────────────────────────────

export async function getOnboarding(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));

  try {
    const onboarding = await opsService.getOnboarding(params.data.companyId);
    return res.json({ ok: true, onboarding });
  } catch (err) {
    next(err);
  }
}

export async function updateOnboarding(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  const body = onboardingBody.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid onboarding payload'));

  try {
    const onboarding = await opsService.updateOnboarding(params.data.companyId, body.data);
    logAudit({
      userId: req.user!.sub,
      action: 'ONBOARDING_UPDATED',
      resourceType: 'COMPANY',
      resourceId: params.data.companyId,
      ip: req.ip,
    });
    return res.json({ ok: true, onboarding });
  } catch (err) {
    next(err);
  }
}

// ─── Access vault (admin) ─────────────────────────────────────────────────

const accessEntryBody = z.object({
  kind: z.enum(['REMOTE', 'SYSTEM', 'NETWORK', 'OTHER']),
  label: z.string().min(1).max(120),
  identifier: z.string().max(500).nullable().optional(),
  secret: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
const accessEntryPatch = accessEntryBody.partial();

export async function listAccessEntries(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));
  try {
    const entries = await opsService.listAccessEntries(params.data.companyId);
    return res.json({ ok: true, entries });
  } catch (err) {
    next(err);
  }
}

export async function addAccessEntry(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  const body = accessEntryBody.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid access entry'));
  try {
    const entry = await opsService.createAccessEntry(params.data.companyId, body.data);
    logAudit({
      userId: req.user!.sub,
      action: 'ACCESS_ENTRY_ADDED',
      resourceType: 'ACCESS_ENTRY',
      resourceId: entry.id,
      ip: req.ip,
      metadata: { companyId: params.data.companyId, label: entry.label },
    });
    return res.status(201).json({ ok: true, entry });
  } catch (err) {
    next(err);
  }
}

export async function updateAccessEntry(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  const body = accessEntryPatch.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patch'));
  try {
    const entry = await opsService.updateAccessEntry(params.data.id, body.data);
    logAudit({
      userId: req.user!.sub,
      action: 'ACCESS_ENTRY_UPDATED',
      resourceType: 'ACCESS_ENTRY',
      resourceId: entry.id,
      ip: req.ip,
    });
    return res.json({ ok: true, entry });
  } catch (err) {
    next(err);
  }
}

export async function deleteAccessEntry(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  try {
    const entry = await opsService.deleteAccessEntry(params.data.id);
    logAudit({
      userId: req.user!.sub,
      action: 'ACCESS_ENTRY_DELETED',
      resourceType: 'ACCESS_ENTRY',
      resourceId: entry.id,
      ip: req.ip,
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Per-client hours (admin) ─────────────────────────────────────────────

export async function getClientHours(req: Request, res: Response, next: NextFunction) {
  const params = companyIdParam.safeParse(req.params);
  const query = periodQuery.safeParse(req.query);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid company id'));
  if (!query.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid period'));

  try {
    const { year, month } = resolvePeriod(query.data);
    const hours = await opsService.getHoursView(params.data.companyId, year, month);
    return res.json({ ok: true, hours });
  } catch (err) {
    next(err);
  }
}

// ─── My hours (client, read-only) ─────────────────────────────────────────

export async function getMyHours(req: Request, res: Response, next: NextFunction) {
  const query = periodQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid period'));

  try {
    const companyId = await opsService.getCompanyIdForUser(req.user!.sub);
    const { year, month } = resolvePeriod(query.data);
    const hours = await opsService.getHoursView(companyId, year, month);
    return res.json({ ok: true, hours });
  } catch (err) {
    next(err);
  }
}
