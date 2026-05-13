import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as subscriptionService from '../services/subscription.service';
import { logAudit } from '../services/audit.service';
import { isStripeConfigured } from '../services/stripe.service';

const checkoutSchema = z.object({
  plan: z.enum(['START', 'FIRMA', 'FIRMA_PLUS']),
});

export async function getMy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subscription = await subscriptionService.getMySubscription(req.user!.sub);
    res.json({ ok: true, subscription, stripeConfigured: isStripeConfigured() });
  } catch (err) {
    next(err);
  }
}

export async function createCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
    return;
  }

  try {
    const result = await subscriptionService.createCheckout(
      req.user!.sub,
      req.user!.email,
      parsed.data.plan,
    );
    logAudit({
      userId: req.user!.sub,
      action: 'SUBSCRIPTION_CHECKOUT_STARTED',
      resourceType: 'SUBSCRIPTION',
      ip: req.ip,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getPortal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await subscriptionService.getPortal(req.user!.sub);
    logAudit({
      userId: req.user!.sub,
      action: 'SUBSCRIPTION_PORTAL_ACCESSED',
      resourceType: 'SUBSCRIPTION',
      ip: req.ip,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}
