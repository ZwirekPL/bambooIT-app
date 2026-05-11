import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { logAudit } from '../services/audit.service';
import * as stripeAdmin from '../services/stripeAdmin.service';

export async function getDashboard(_req: Request, res: Response, next: NextFunction) {
  try {
    const dashboard = await stripeAdmin.getDashboard();
    return res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
}

const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startingAfter: z.string().optional(),
  status: z.enum(['succeeded', 'failed', 'pending', 'refunded']).optional(),
  dateFrom: z.coerce.number().int().optional(),
  dateTo: z.coerce.number().int().optional(),
});

export async function listTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = transactionsQuerySchema.safeParse(req.query);
    const params = parsed.success ? parsed.data : { limit: 20 };
    const result = await stripeAdmin.listTransactions(params);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

const refundSchema = z.object({
  paymentIntentId: z.string().min(1),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

export async function createRefund(req: Request, res: Response, next: NextFunction) {
  const parsed = refundSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid refund data'));
  }

  try {
    const refund = await stripeAdmin.createRefund(parsed.data);

    logAudit({
      userId: req.user?.sub,
      action: 'STRIPE_REFUND',
      resourceType: 'ORDER',
      resourceId: parsed.data.paymentIntentId,
    });

    return res.json({ ok: true, refund });
  } catch (err) {
    next(err);
  }
}

export async function listFailedPayments(_req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await stripeAdmin.listFailedPayments();
    return res.json({ ok: true, payments });
  } catch (err) {
    next(err);
  }
}

export async function listCoupons(_req: Request, res: Response, next: NextFunction) {
  try {
    const coupons = await stripeAdmin.listCoupons();
    return res.json({ ok: true, coupons });
  } catch (err) {
    next(err);
  }
}

const createCouponSchema = z.object({
  name: z.string().min(1).max(100),
  percentOff: z.number().min(1).max(100).optional(),
  amountOff: z.number().positive().optional(),
  duration: z.enum(['once', 'repeating', 'forever']),
  durationInMonths: z.number().int().min(1).max(36).optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  redeemBy: z.number().int().optional(),
});

export async function createCoupon(req: Request, res: Response, next: NextFunction) {
  const parsed = createCouponSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid coupon data'));
  }

  try {
    const coupon = await stripeAdmin.createCoupon(parsed.data);
    return res.status(201).json({ ok: true, coupon });
  } catch (err) {
    next(err);
  }
}

export async function deleteCoupon(req: Request, res: Response, next: NextFunction) {
  const id = req.params.id;
  if (!id) return res.status(400).json(apiError('VALIDATION_ERROR', 'Missing coupon id'));

  try {
    await stripeAdmin.deleteCoupon(id);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
