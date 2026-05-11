import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as checkinController from '../controllers/checkin.controller';
import { requireAuth } from '../middleware/auth';
import { analyzeGiCorrelations } from '../services/giCorrelation.service';

export const checkinRouter = Router();

// Patient endpoints — own check-ins
checkinRouter.post('/', checkinController.create);
checkinRouter.get('/', checkinController.list);
checkinRouter.get('/latest', checkinController.latest);
checkinRouter.get('/trends', checkinController.trends);
checkinRouter.get('/progress', checkinController.progress);

// Dietitian/Admin endpoint — view patient check-ins
checkinRouter.get(
  '/patient/:patientId',
  requireAuth('ADMIN', 'DIETITIAN'),
  checkinController.listByPatient
);
checkinRouter.get(
  '/patient/:patientId/trends',
  requireAuth('ADMIN', 'DIETITIAN'),
  checkinController.trendsByPatient
);
checkinRouter.get(
  '/patient/:patientId/progress',
  requireAuth('ADMIN', 'DIETITIAN'),
  checkinController.progressByPatient
);

// 79.2: GI correlation analysis
checkinRouter.get(
  '/patient/:patientId/gi-analysis',
  requireAuth('ADMIN', 'DIETITIAN'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = z.string().cuid().safeParse(req.params.patientId);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid patient id' } });
    try {
      const result = await analyzeGiCorrelations(parsed.data);
      return res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// Manual adaptation trigger — dietitian/admin can force evaluation
checkinRouter.post(
  '/patient/:patientId/adapt',
  requireAuth('ADMIN', 'DIETITIAN'),
  checkinController.triggerAdaptation
);

// Weekly summary — send to single patient or all patients
checkinRouter.post(
  '/patient/:patientId/summary',
  requireAuth('ADMIN', 'DIETITIAN'),
  checkinController.sendSummary
);
checkinRouter.post(
  '/summary/batch',
  requireAuth('ADMIN'),
  checkinController.sendSummaryBatch
);
