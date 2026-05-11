import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as dietToolkitService from '../services/dietToolkit.service';
import { logAudit } from '../services/audit.service';

const patientIdSchema = z.object({ patientId: z.string().cuid() });

export async function getToolkit(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const result = await dietToolkitService.getDietToolkit(
      parsed.data.patientId,
      req.user!.sub,
      req.user!.role
    );

    logAudit({
      userId: req.user?.sub,
      action: 'VIEW_DIET_TOOLKIT',
      resourceType: 'PATIENT',
      resourceId: parsed.data.patientId,
      ip: req.ip,
    });

    return res.json({ ok: true, toolkit: result });
  } catch (err) {
    next(err);
  }
}
