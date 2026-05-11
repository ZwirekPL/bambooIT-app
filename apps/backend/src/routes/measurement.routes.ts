import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { apiError } from '../utils/errors';
import * as measurementService from '../services/bodyMeasurement.service';

export const measurementRouter = Router();

const createSchema = z.object({
  date: z.string().datetime().optional(),
  waistCm: z.number().min(40).max(200).optional(),
  hipCm: z.number().min(50).max(200).optional(),
  chestCm: z.number().min(50).max(200).optional(),
  thighCm: z.number().min(20).max(100).optional(),
  armCm: z.number().min(15).max(60).optional(),
  bodyFatPct: z.number().min(3).max(60).optional(),
  notes: z.string().max(500).optional(),
});

// Patient: create own measurement
measurementRouter.post('/', requireAuth('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid'));

  try {
    const { date: dateStr, ...rest } = parsed.data;
    const m = await measurementService.createMeasurement({
      patientId: req.user!.patientId!,
      date: dateStr ? new Date(dateStr) : undefined,
      ...rest,
    });
    return res.status(201).json({ ok: true, measurement: m });
  } catch (err) {
    next(err);
  }
});

// Patient: list own measurements
measurementRouter.get('/', requireAuth('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  try {
    const result = await measurementService.listMeasurements(req.user!.patientId!, page);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Patient: own trends + WHR
measurementRouter.get('/trends', requireAuth('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await measurementService.getMeasurementTrends(req.user!.patientId!);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Patient: delete own measurement
measurementRouter.delete('/:id', requireAuth('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  const parsed = z.string().cuid().safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    await measurementService.deleteMeasurement(parsed.data, req.user!.patientId!);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Dietitian/Admin: view patient measurements
measurementRouter.get(
  '/patient/:patientId',
  requireAuth('ADMIN', 'DIETITIAN'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = z.string().cuid().safeParse(req.params.patientId);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    try {
      const result = await measurementService.listMeasurements(parsed.data, page);
      return res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// Dietitian/Admin: patient trends + WHR
measurementRouter.get(
  '/patient/:patientId/trends',
  requireAuth('ADMIN', 'DIETITIAN'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = z.string().cuid().safeParse(req.params.patientId);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
    try {
      const result = await measurementService.getMeasurementTrends(parsed.data);
      return res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);
