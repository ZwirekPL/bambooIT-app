import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as checkoutService from '../services/checkout.service';
import { logAudit } from '../services/audit.service';

const createSessionSchema = z.object({
  productType: z.enum(['TRIAL', 'START', 'FIRMA', 'FIRMA_PLUS']),
  referralCode: z.string().max(20).optional(),
});

export async function createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
    return;
  }

  try {
    const result = await checkoutService.createSession(
      req.user!.sub,
      req.user!.email,
      parsed.data.productType,
      parsed.data.referralCode,
    );

    logAudit({
      userId: req.user!.sub,
      action: 'CHECKOUT_STARTED',
      resourceType: 'ORDER',
      resourceId: result.orderId,
      ip: req.ip,
    });

    res.json({ ok: true, url: result.url });
  } catch (err) {
    next(err);
  }
}
