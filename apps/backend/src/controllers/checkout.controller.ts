import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as checkoutService from '../services/checkout.service';
import { logAudit } from '../services/audit.service';

// TRIAL flow stays in service code (dormant per PLAN_BE-2.md Q5/B) but is
// no longer exposed via this endpoint — bambooIT MVP doesn't promote free
// trial. Re-enable by adding 'TRIAL' back to the enum below + adding a CTA.
const createSessionSchema = z.object({
  productType: z.enum(['START', 'FIRMA', 'FIRMA_PLUS']),
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
