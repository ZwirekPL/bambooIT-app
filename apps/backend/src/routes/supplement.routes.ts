import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { apiError } from '../utils/errors';
import * as supplementService from '../services/supplement.service';

export const supplementRouter = Router();

const createSchema = z.object({
  nutrientKey: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  dose: z.string().min(1).max(50),
  unit: z.string().min(1).max(20),
  frequency: z.enum(['daily', 'twice_daily', 'three_times_daily', 'weekly', 'as_needed']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  dose: z.string().min(1).max(50).optional(),
  unit: z.string().min(1).max(20).optional(),
  frequency: z.enum(['daily', 'twice_daily', 'three_times_daily', 'weekly', 'as_needed']).optional(),
  endDate: z.string().datetime().nullish(),
  notes: z.string().max(1000).optional(),
  active: z.boolean().optional(),
});

// ── Patient: own active supplements ─────────────────────────────────────────

// GET /supplements — list own supplements
supplementRouter.get('/', requireAuth('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await supplementService.listSupplements(req.user!.patientId!);
    return res.json({ ok: true, supplements: items });
  } catch (err) {
    next(err);
  }
});

// GET /supplements/compliance — own compliance stats
supplementRouter.get('/compliance', requireAuth('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const compliance = await supplementService.getSupplementCompliance(req.user!.patientId!);
    return res.json({ ok: true, compliance });
  } catch (err) {
    next(err);
  }
});

// ── Dietitian: manage patient supplements ────────────────────────────────────

// POST /supplements/patient/:patientId — prescribe supplement
supplementRouter.post(
  '/patient/:patientId',
  requireAuth('ADMIN', 'DIETITIAN'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsedId = z.string().cuid().safeParse(req.params.patientId);
    if (!parsedId.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid'));

    try {
      const { startDate, endDate, ...rest } = parsed.data;
      const supp = await supplementService.createSupplement({
        patientId: parsedId.data,
        dietitianId: req.user!.sub,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        ...rest,
      });
      return res.status(201).json({ ok: true, supplement: supp });
    } catch (err) {
      next(err);
    }
  },
);

// GET /supplements/patient/:patientId — list patient supplements
supplementRouter.get(
  '/patient/:patientId',
  requireAuth('ADMIN', 'DIETITIAN'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsedId = z.string().cuid().safeParse(req.params.patientId);
    if (!parsedId.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));

    try {
      const items = await supplementService.listSupplements(parsedId.data);
      return res.json({ ok: true, supplements: items });
    } catch (err) {
      next(err);
    }
  },
);

// GET /supplements/patient/:patientId/compliance — patient compliance
supplementRouter.get(
  '/patient/:patientId/compliance',
  requireAuth('ADMIN', 'DIETITIAN'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsedId = z.string().cuid().safeParse(req.params.patientId);
    if (!parsedId.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));

    try {
      const compliance = await supplementService.getSupplementCompliance(parsedId.data);
      return res.json({ ok: true, compliance });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /supplements/:id — update (dietitian or admin)
supplementRouter.patch(
  '/:id',
  requireAuth('ADMIN', 'DIETITIAN'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsedId = z.string().cuid().safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid'));

    // Need patientId from body for ownership check
    const patientId = z.string().cuid().safeParse(req.body.patientId);
    if (!patientId.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'patientId required'));

    try {
      const { endDate, ...rest } = parsed.data;
      const supp = await supplementService.updateSupplement(parsedId.data, patientId.data, {
        ...rest,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      return res.json({ ok: true, supplement: supp });
    } catch (err) {
      next(err);
    }
  },
);
