import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as checkinService from '../services/checkin.service';
import { getCheckInTrends } from '../services/checkin-trends.service';
import { evaluateAdaptation } from '../services/checkin-adaptation.service';
import { sendWeeklySummary, sendWeeklySummariesBatch } from '../services/weekly-summary.service';
import { getProgress } from '../services/progress.service';
import { logAudit } from '../services/audit.service';

const createSchema = z.object({
  weightKg: z.number().min(10).max(500).optional(),
  compliance: z.number().int().min(0).max(100).optional(),
  hunger: z.number().int().min(1).max(10).optional(),
  energy: z.number().int().min(1).max(10).optional(),
  sleep: z.number().int().min(1).max(10).optional(),
  activity: z.number().int().min(1).max(10).optional(),
  mood: z.number().int().min(1).max(5).optional(), // 62.3
  waistCm: z.number().min(20).max(300).optional(), // 62.4
  hipsCm: z.number().min(20).max(300).optional(),
  thighCm: z.number().min(20).max(300).optional(),
  chestCm: z.number().min(20).max(300).optional(),
  notes: z.string().max(2000).optional(),
  // 79.2: GI/digestion fields
  digestion: z.number().int().min(1).max(10).optional(),
  bloating: z.boolean().optional(),
  stoolBristol: z.number().int().min(1).max(7).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid check-in data'));
  }

  const patientId = req.user?.patientId;
  if (!patientId) {
    return res.status(403).json(apiError('FORBIDDEN', 'Only patients can submit check-ins'));
  }

  try {
    const checkIn = await checkinService.createCheckIn({
      patientId,
      ...parsed.data,
    });

    logAudit({
      userId: req.user?.sub,
      action: 'CREATE_CHECKIN',
      resourceType: 'CHECKIN',
      resourceId: checkIn.id,
      ip: req.ip,
    });

    // Fire-and-forget: evaluate if plan adaptation is needed
    evaluateAdaptation(patientId)
      .then((result) => {
        if (result.adapted) {
          logAudit({
            userId: req.user?.sub,
            action: 'CHECKIN_ADAPTATION',
            resourceType: 'DIET_PLAN',
            resourceId: result.dietPlanId ?? undefined,
            ip: req.ip,
          });
        }
      })
      .catch(() => {
        // Adaptation failure should not affect check-in response
      });

    return res.status(201).json({ ok: true, checkIn });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  const patientId = req.user?.patientId;
  if (!patientId) {
    return res.status(403).json(apiError('FORBIDDEN', 'Only patients can view check-ins'));
  }

  try {
    const result = await checkinService.listCheckIns(patientId, parsed.data.limit, parsed.data.page);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function latest(req: Request, res: Response, next: NextFunction) {
  const patientId = req.user?.patientId;
  if (!patientId) {
    return res.status(403).json(apiError('FORBIDDEN', 'Only patients can view check-ins'));
  }

  try {
    const checkIn = await checkinService.getLatestCheckIn(patientId);
    return res.json({ ok: true, checkIn });
  } catch (err) {
    next(err);
  }
}

export async function trends(req: Request, res: Response, next: NextFunction) {
  const patientId = req.user?.patientId;
  if (!patientId) {
    return res.status(403).json(apiError('FORBIDDEN', 'Only patients can view trends'));
  }

  try {
    const data = await getCheckInTrends(patientId);
    return res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function trendsByPatient(req: Request, res: Response, next: NextFunction) {
  const patientIdParam = z.string().cuid().safeParse(req.params.patientId);
  if (!patientIdParam.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const data = await getCheckInTrends(patientIdParam.data);
    return res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function triggerAdaptation(req: Request, res: Response, next: NextFunction) {
  const patientIdParam = z.string().cuid().safeParse(req.params.patientId);
  if (!patientIdParam.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const result = await evaluateAdaptation(patientIdParam.data);

    if (result.adapted) {
      logAudit({
        userId: req.user?.sub,
        action: 'CHECKIN_ADAPTATION',
        resourceType: 'DIET_PLAN',
        resourceId: result.dietPlanId ?? undefined,
        ip: req.ip,
      });
    }

    return res.json({ ok: true, adaptation: result });
  } catch (err) {
    next(err);
  }
}

export async function listByPatient(req: Request, res: Response, next: NextFunction) {
  const patientIdParam = z.string().cuid().safeParse(req.params.patientId);
  if (!patientIdParam.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const result = await checkinService.listCheckIns(patientIdParam.data, parsed.data.limit, parsed.data.page);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function sendSummary(req: Request, res: Response, next: NextFunction) {
  const patientIdParam = z.string().cuid().safeParse(req.params.patientId);
  if (!patientIdParam.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const result = await sendWeeklySummary(patientIdParam.data);

    if (result.sent) {
      logAudit({
        userId: req.user?.sub,
        action: 'SEND_WEEKLY_SUMMARY',
        resourceType: 'PATIENT',
        resourceId: patientIdParam.data,
        ip: req.ip,
      });
    }

    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function sendSummaryBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await sendWeeklySummariesBatch();

    logAudit({
      userId: req.user?.sub,
      action: 'SEND_WEEKLY_SUMMARY_BATCH',
      resourceType: 'PATIENT',
      ip: req.ip,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function progress(req: Request, res: Response, next: NextFunction) {
  const patientId = req.user?.patientId;
  if (!patientId) {
    return res.status(403).json(apiError('FORBIDDEN', 'Only patients can view progress'));
  }

  try {
    const data = await getProgress(patientId);
    return res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function progressByPatient(req: Request, res: Response, next: NextFunction) {
  const patientIdParam = z.string().cuid().safeParse(req.params.patientId);
  if (!patientIdParam.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const data = await getProgress(patientIdParam.data);
    return res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}
