import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma } from '@db';
import { apiError } from '../utils/errors';
import * as orderService from '../services/order.service';
import { isStripeConfigured, createPortalSession } from '../services/stripe.service';
import { checkAccess } from '../services/paywall.service';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  : null;

const patientIdParamSchema = z.object({ patientId: z.string().cuid() });
const orderIdParamSchema = z.object({ id: z.string().cuid() });

const createSchema = z.object({
  productType: z.enum([
    'FREE_7',
    'OPIEKA_MIESIECZNA',
    'OPIEKA_ROCZNA',
    'PLAN_2W',
    'PLAN_4W',
    'CONSULTATION',
  ]),
});

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  const paramParsed = patientIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  const bodyParsed = createSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const userId = req.user!.sub;
    const role = req.user!.role;
    await orderService.assertPatientOwnership(paramParsed.data.patientId, userId, role);

    const order = await orderService.createOrder({
      patientId: paramParsed.data.patientId,
      ...bodyParsed.data,
    });
    return res.status(201).json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

export async function createMyOrder(req: Request, res: Response, next: NextFunction) {
  const bodyParsed = createSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const result = await orderService.createMyOrder(userId, bodyParsed.data);
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function confirmOrder(req: Request, res: Response, next: NextFunction) {
  // Only ADMIN can confirm orders
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json(apiError('FORBIDDEN', 'Only admins can confirm orders'));
  }

  const parsed = orderIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid order id'));
  }

  try {
    const order = await orderService.confirmOrder(parsed.data.id);
    return res.json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

export async function listOrders(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const userId = req.user!.sub;
    const role = req.user!.role;
    await orderService.assertPatientOwnership(parsed.data.patientId, userId, role);

    const orders = await orderService.listOrders(parsed.data.patientId);
    return res.json({ ok: true, orders });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  const parsed = orderIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid order id'));
  }

  try {
    const order = await orderService.getOrder(parsed.data.id);

    // DIETITIAN can only see orders of their own patients
    const userId = req.user!.sub;
    const role = req.user!.role;
    await orderService.assertPatientOwnership(order.patientId, userId, role);

    return res.json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

/** GET /orders/my — patient lists their own orders + subscription info. */
export async function listMyOrders(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const orders = await orderService.listMyOrders(userId);
    const subscription = await orderService.getMySubscription(userId);

    // 61.1: Include usage limits
    const access = await checkAccess(userId);
    const limits = access.planLimits && access.weeklyUsage ? {
      dietsPerWeek: access.planLimits.maxDietsPerWeek,
      dietsUsedThisWeek: access.weeklyUsage.dietsGenerated,
      dietsRemaining: Math.max(0, access.planLimits.maxDietsPerWeek - access.weeklyUsage.dietsGenerated),
      swapsPerWeek: access.planLimits.maxSwapsPerWeek,
      swapsUsedThisWeek: access.weeklyUsage.swapsUsed,
      swapsRemaining: Math.max(0, access.planLimits.maxSwapsPerWeek - access.weeklyUsage.swapsUsed),
    } : null;

    return res.json({
      ok: true,
      orders,
      subscription,
      limits,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (err) {
    next(err);
  }
}

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const DEFAULT_LOCALE = 'pl';
const BASE_URL = `${APP_URL}/${DEFAULT_LOCALE}`;

/** GET /orders/my/portal — Stripe Customer Portal for patient subscription. */
export async function getMyPortal(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const subscription = await orderService.getMySubscription(userId);

    if (!subscription?.stripeCustomerId && isStripeConfigured()) {
      return res.status(400).json(apiError('NO_STRIPE_CUSTOMER', 'No Stripe customer found'));
    }

    const url = await createPortalSession({
      stripeCustomerId: subscription?.stripeCustomerId ?? 'cus_mock',
      returnUrl: `${BASE_URL}/dashboard/subskrypcja`,
    });

    return res.json({ ok: true, url });
  } catch (err) {
    next(err);
  }
}

/** PATCH /orders/:id/consultation-phone — patient saves phone after purchasing consultation. */
const consultationPhoneSchema = z.object({
  phone: z
    .string()
    .regex(/^(\+48)?\d{9}$/, 'Invalid Polish phone number (9 digits, optionally prefixed with +48)'),
});

export async function setConsultationPhone(req: Request, res: Response, next: NextFunction) {
  const paramParsed = orderIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid order id'));
  }

  const bodyParsed = consultationPhoneSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid phone number'));
  }

  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    await orderService.setConsultationPhone(paramParsed.data.id, userId, bodyParsed.data.phone);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** POST /orders/my/cancel-subscription — patient cancels at period end. */
export async function cancelMySubscription(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const subscription = await orderService.cancelMySubscription(userId);
    return res.json({ ok: true, subscription });
  } catch (err) {
    next(err);
  }
}

/** POST /orders/my/resume-subscription — patient resumes a pending cancellation. */
export async function resumeMySubscription(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const subscription = await orderService.resumeMySubscription(userId);
    return res.json({ ok: true, subscription });
  } catch (err) {
    next(err);
  }
}

/** GET /orders/my/invoices — patient lists their invoices. */
export async function listMyInvoices(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const invoices = await orderService.listMyInvoices(userId);
    return res.json({ ok: true, invoices });
  } catch (err) {
    next(err);
  }
}

/** POST /orders/my/withdraw — 14-day right of withdrawal. */
export async function withdrawFromContract(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const result = await orderService.withdrawFromContract(userId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** GET /orders/my/can-withdraw — check if 14-day withdrawal is available. */
export async function canWithdraw(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const result = await orderService.canWithdraw(userId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** GET /orders/:id/invoice — returns Stripe invoice PDF URL (61.3). */
export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  const parsed = orderIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid order id'));

  const userId = req.user?.sub;
  if (!userId) return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));

  try {
    const order = await orderService.getOrder(parsed.data.id);

    // Ownership check: PATIENT can only see own orders
    if (req.user?.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId }, select: { id: true } });
      if (!patient || order.patientId !== patient.id) {
        return res.status(403).json(apiError('FORBIDDEN', 'Not your order'));
      }
    }

    if (!order.stripeInvoiceId) {
      return res.status(404).json(apiError('NOT_FOUND', 'No invoice for this order'));
    }

    if (!stripe) {
      return res.json({ ok: true, invoiceUrl: null });
    }

    const invoice = await stripe.invoices.retrieve(order.stripeInvoiceId);
    return res.json({ ok: true, invoiceUrl: invoice.invoice_pdf });
  } catch (err) {
    next(err);
  }
}
