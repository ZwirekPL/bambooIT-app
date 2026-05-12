import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { sendOrderConfirmationEmail, sendSubscriptionCancelEmail } from '../utils/email';
import { getStripeClient } from './stripe.service';

export type ProductType =
  | 'FREE_7'
  | 'OPIEKA_MIESIECZNA'
  | 'OPIEKA_ROCZNA'
  | 'PLAN_2W'
  | 'PLAN_4W'
  | 'CONSULTATION'
  // Legacy values (backward compatibility with existing orders)
  | 'PREMIUM'
  | 'CONSULTATION_1W'
  | 'AI_2W'
  | 'AI_4W'
  | 'SUBSCRIPTION_1M'
  | 'CONSULTATION_2W'
  | 'CONSULTATION_4W';

/** Extends ProductType with checkout-only virtual types (not stored in DB). */
export type CheckoutProductType = ProductType | 'TRIAL' | 'TRIAL_YEARLY';

interface CreateOrderInput {
  companyId: string;
  productType: ProductType;
}

/**
 * Verify that a DIETITIAN owns the given company (company.dietitianId === userId).
 * ADMIN always passes. Throws 403 on mismatch.
 */
export async function assertCompanyOwnership(
  companyId: string,
  userId: string,
  role: string
): Promise<void> {
  if (role === 'ADMIN') return;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { dietitianId: true },
  });
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Company not found');
  }
  if (company.dietitianId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this company');
  }
}

export async function createOrder({ companyId, productType }: CreateOrderInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Company not found');
  }

  const order = await prisma.order.create({
    data: {
      companyId,
      productType,
      status: 'PENDING_PAYMENT',
    },
  });

  return order;
}

export async function listOrders(companyId: string) {
  return prisma.order.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createMyOrder(
  userId: string,
  data: { productType: ProductType }
) {
  const company = await prisma.company.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Company profile not found');
  }

  const order = await prisma.order.create({
    data: {
      companyId: company.id,
      productType: data.productType,
      // Dev mode: immediately mark as PAID so company can proceed to interview
      status: 'PAID',
    },
  });

  sendOrderConfirmationEmail(company.user.email, order).catch(() => {});

  return { order, companyId: company.id };
}

export async function confirmOrder(id: string) {
  const existing = await prisma.order.findFirst({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: 'PAID' },
  });

  const company = await prisma.company.findUnique({
    where: { id: updated.companyId },
    include: { user: { select: { email: true } } },
  });
  if (company) {
    sendOrderConfirmationEmail(company.user.email, updated).catch(() => {});
  }

  return updated;
}

export async function getOrder(id: string, companyId?: string) {
  const where: Prisma.OrderWhereInput = { id };
  if (companyId) where.companyId = companyId;

  const order = await prisma.order.findFirst({ where });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }

  return order;
}

/** Lists all orders for the currently authenticated company. */
export async function listMyOrders(userId: string) {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Company profile not found');
  }

  return prisma.order.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  });
}

/** Save phone number for a CONSULTATION order (41.2). */
export async function setConsultationPhone(
  orderId: string,
  userId: string,
  phone: string
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: { company: { select: { userId: true } } },
  });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  if (order.company.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own this order');
  }
  if (order.productType !== 'CONSULTATION') {
    throw new AppError(400, 'INVALID_ORDER_TYPE', 'This order is not a consultation');
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { consultationPhone: phone },
  });
}

/** Returns the Subscription record for a company (if any). */
export async function getMySubscription(userId: string) {
  return prisma.subscription.findUnique({ where: { userId } });
}

/** Cancel subscription at period end. */
export async function cancelMySubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) {
    throw new AppError(404, 'NOT_FOUND', 'Subscription not found');
  }
  if (sub.status === 'CANCELED') {
    throw new AppError(400, 'ALREADY_CANCELED', 'Subscription is already canceled');
  }
  if (sub.cancelAtPeriodEnd) {
    throw new AppError(400, 'ALREADY_CANCELING', 'Subscription is already set to cancel');
  }

  const stripe = getStripeClient();
  if (stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  const updated = await prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true },
    include: { user: { select: { email: true } } },
  });

  if (updated.currentPeriodEnd) {
    sendSubscriptionCancelEmail(
      updated.user.email,
      updated.currentPeriodEnd.toISOString(),
    ).catch(() => {});
  }

  return updated;
}

/** Resume a subscription that was set to cancel at period end. */
export async function resumeMySubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) {
    throw new AppError(404, 'NOT_FOUND', 'Subscription not found');
  }
  if (!sub.cancelAtPeriodEnd) {
    throw new AppError(400, 'NOT_CANCELING', 'Subscription is not set to cancel');
  }

  const stripe = getStripeClient();
  if (stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
  }

  return prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: false },
  });
}

const WITHDRAWAL_DAYS = 14;

/** Right of withdrawal (art. 27 ustawy o prawach konsumenta) — 14 days. */
export async function withdrawFromContract(userId: string) {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Company profile not found');
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WITHDRAWAL_DAYS);

  const recentOrder = await prisma.order.findFirst({
    where: {
      companyId: company.id,
      status: { in: ['PAID', 'ACTIVE'] },
      createdAt: { gte: cutoff },
      productType: { not: 'FREE_7' },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!recentOrder) {
    throw new AppError(400, 'WITHDRAWAL_EXPIRED', 'No eligible order within 14 days');
  }

  // TODO(5b-cleanup): DietPlan dropped in K5b. Rebuild "service delivered" check
  // for bambooIT (e.g. ticket resolved, hours consumed) in faza 4.
  // Art. 38 pkt 1 — block withdrawal if service was already delivered
  // const deliveredPlan = await prisma.dietPlan.findFirst({ ... });
  // if (deliveredPlan) {
  //   throw new AppError(400, 'SERVICE_DELIVERED', '...');
  // }

  await prisma.order.update({
    where: { id: recentOrder.id },
    data: { status: 'CANCELLED' },
  });

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub && sub.status !== 'CANCELED') {
    const stripe = getStripeClient();
    if (stripe && sub.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    }
    await prisma.subscription.update({
      where: { userId },
      data: { status: 'CANCELED', cancelAtPeriodEnd: false },
    });
  }

  return { orderId: recentOrder.id, productType: recentOrder.productType };
}

/** Checks if the company has an eligible order for 14-day withdrawal. */
export async function canWithdraw(userId: string): Promise<{
  eligible: boolean;
  orderId?: string;
  daysLeft?: number;
  serviceDelivered?: boolean;
}> {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) return { eligible: false };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WITHDRAWAL_DAYS);

  const recentOrder = await prisma.order.findFirst({
    where: {
      companyId: company.id,
      status: { in: ['PAID', 'ACTIVE'] },
      createdAt: { gte: cutoff },
      productType: { not: 'FREE_7' },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!recentOrder) return { eligible: false };

  // TODO(5b-cleanup): DietPlan dropped in K5b. Rebuild "service delivered" check in faza 4.
  // Art. 38 pkt 1 — if service was delivered (diet plan sent/published), withdrawal is lost.
  // const deliveredPlan = await prisma.dietPlan.findFirst({ ... });
  // if (deliveredPlan) return { eligible: false, serviceDelivered: true };

  const daysLeft = Math.ceil(
    (WITHDRAWAL_DAYS - (Date.now() - recentOrder.createdAt.getTime()) / 86400000)
  );

  return { eligible: true, orderId: recentOrder.id, daysLeft: Math.max(0, daysLeft) };
}

const PRICE_MAP: Record<string, number> = {
  OPIEKA_MIESIECZNA: 129,
  OPIEKA_ROCZNA: 1188,
  PLAN_2W: 129,
  PLAN_4W: 199,
  CONSULTATION: 399,
  FREE_7: 0,
};

/** Lists paid orders as invoices for the company. */
export async function listMyInvoices(userId: string) {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Company profile not found');
  }

  const orders = await prisma.order.findMany({
    where: { companyId: company.id, status: { in: ['PAID', 'ACTIVE', 'COMPLETED'] } },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    id: o.id,
    date: o.createdAt,
    productType: o.productType,
    amount: PRICE_MAP[o.productType] ?? 0,
    stripeInvoiceId: o.stripeInvoiceId,
  }));
}
