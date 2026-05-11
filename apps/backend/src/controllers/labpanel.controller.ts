import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as labPanelService from '../services/labpanel.service';

const patientIdParamSchema = z.object({ patientId: z.string().cuid() });
const panelIdParamSchema = z.object({ id: z.string().cuid() });

const createSchema = z.object({
  orderId: z.string().cuid().optional(),
  data: z.record(z.unknown()),
});

export async function createLabPanel(req: Request, res: Response, next: NextFunction) {
  const paramParsed = patientIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  const bodyParsed = createSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const result = await labPanelService.createLabPanel({
      patientId: paramParsed.data.patientId,
      ...bodyParsed.data,
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listLabPanels(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const panels = await labPanelService.listLabPanels(parsed.data.patientId);
    return res.json({ ok: true, panels });
  } catch (err) {
    next(err);
  }
}

export async function getLabPanel(req: Request, res: Response, next: NextFunction) {
  const parsed = panelIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid panel id'));
  }

  try {
    const panel = await labPanelService.getLabPanel(parsed.data.id);
    return res.json({ ok: true, panel });
  } catch (err) {
    next(err);
  }
}
