import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as notifService from '../services/notificationPreferences.service';

const updateSchema = z
  .object({
    emailReminders: z.boolean(),
    timezone: z.string().min(1).max(50),
  })
  .partial();

export async function getNotificationPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const prefs = await notifService.getPreferences(req.user!.sub);
    return res.json({ ok: true, preferences: prefs });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferences(req: Request, res: Response, next: NextFunction) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  }

  try {
    const prefs = await notifService.updatePreferences(req.user!.sub, parsed.data);
    return res.json({ ok: true, preferences: prefs });
  } catch (err) {
    next(err);
  }
}
