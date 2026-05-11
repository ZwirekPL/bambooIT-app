import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { isStripeConfigured, createCheckoutSession, createPortalSession } from './stripe.service';
import type { SubscriptionPlan } from '@prisma/client';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const DEFAULT_LOCALE = 'pl';
const BASE_URL = `${APP_URL}/${DEFAULT_LOCALE}`;

/** Resolves a Stripe price ID to a SubscriptionPlan. */
function planFromPriceId(priceId: string | null | undefined): SubscriptionPlan {
  if (!priceId) return 'PRO_MONTHLY';
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return 'PRO_YEARLY';
  return 'PRO_MONTHLY';
}

/** Returns the subscription for a dietitian user, creating a FREE one if none exists. */
export async function getMySubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.subscription.create({
    data: { userId, plan: 'FREE', status: 'TRIALING' },
  });
}

/** Creates a Stripe Checkout Session URL for upgrading to PRO. */
export async function createCheckout(userId: string, email: string, plan: 'PRO_MONTHLY' | 'PRO_YEARLY') {
  const priceId =
    plan === 'PRO_MONTHLY'
      ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
      : process.env.STRIPE_PRO_YEARLY_PRICE_ID;

  if (!priceId && isStripeConfigured()) {
    throw new AppError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe price ID is not configured');
  }

  const subscription = await getMySubscription(userId);

  const url = await createCheckoutSession({
    stripeCustomerId: subscription.stripeCustomerId ?? undefined,
    priceId: priceId ?? 'price_mock',
    successUrl: `${BASE_URL}/dietetyk/subskrypcja?checkout=success`,
    cancelUrl: `${BASE_URL}/dietetyk/subskrypcja?checkout=cancel`,
    customerEmail: email,
    metadata: { plan, userId },
  });

  return { url };
}

/** Returns a Stripe Customer Portal URL. */
export async function getPortal(userId: string) {
  const subscription = await getMySubscription(userId);

  if (!subscription.stripeCustomerId && isStripeConfigured()) {
    throw new AppError(400, 'NO_STRIPE_CUSTOMER', 'No Stripe customer found for this user');
  }

  const url = await createPortalSession({
    stripeCustomerId: subscription.stripeCustomerId ?? 'cus_mock',
    returnUrl: `${BASE_URL}/dietetyk/subskrypcja`,
  });

  return { url };
}

/** Handles a Stripe webhook event — updates the Subscription record accordingly. */
export async function handleCheckoutCompleted(session: {
  customer: string | null;
  subscription: string | null;
  customer_email: string | null;
  metadata?: Record<string, string> | null;
}) {
  if (!session.customer || !session.subscription) return;

  // Resolve plan from metadata (set during checkout) or default
  const plan: SubscriptionPlan = (session.metadata?.plan === 'PRO_YEARLY')
    ? 'PRO_YEARLY'
    : 'PRO_MONTHLY';

  // Find user by metadata userId, stripeCustomerId, or email (first-time checkout)
  let userId: string | undefined = session.metadata?.userId;

  if (!userId) {
    const existing = await prisma.subscription.findUnique({
      where: { stripeCustomerId: session.customer },
    });

    if (existing) {
      userId = existing.userId;
    } else if (session.customer_email) {
      const user = await prisma.user.findUnique({ where: { email: session.customer_email } });
      userId = user?.id;
    }
  }

  if (!userId) return;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      plan,
      status: 'ACTIVE',
    },
    update: {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      plan,
      status: 'ACTIVE',
    },
  });
}

export async function handleInvoicePaid(invoice: {
  subscription: string | null;
  lines?: { data: Array<{ price?: { id: string } | null; period?: { start: number; end: number } }> };
}) {
  if (!invoice.subscription) return;

  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: invoice.subscription },
  });
  if (!sub) return;

  const line = invoice.lines?.data?.[0];
  const priceId = line?.price?.id;
  const periodEnd = line?.period?.end
    ? new Date(line.period.end * 1000)
    : undefined;
  const periodStart = line?.period?.start
    ? new Date(line.period.start * 1000)
    : undefined;

  await prisma.subscription.update({
    where: { stripeSubscriptionId: invoice.subscription },
    data: {
      status: 'ACTIVE',
      plan: planFromPriceId(priceId),
      ...(priceId ? { stripePriceId: priceId } : {}),
      ...(periodStart ? { currentPeriodStart: periodStart } : {}),
      ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    },
  });
}

export async function handleSubscriptionDeleted(stripeSubscriptionId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: { status: 'CANCELED', cancelAtPeriodEnd: false },
  });
}

/** Handles customer.subscription.updated — syncs cancel_at_period_end and status changes. */
export async function handleSubscriptionUpdated(stripeSubscription: {
  id: string;
  cancel_at_period_end: boolean;
  status: string;
  items?: { data: Array<{ price?: { id: string } }> };
  current_period_start?: number;
  current_period_end?: number;
}) {
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });
  if (!sub) return;

  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  const statusMap: Record<string, string> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    trialing: 'TRIALING',
  };
  const mappedStatus = statusMap[stripeSubscription.status] ?? sub.status;

  await prisma.subscription.update({
    where: { stripeSubscriptionId: stripeSubscription.id },
    data: {
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      status: mappedStatus as typeof sub.status,
      plan: planFromPriceId(priceId),
      ...(priceId ? { stripePriceId: priceId } : {}),
      ...(stripeSubscription.current_period_start
        ? { currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000) }
        : {}),
      ...(stripeSubscription.current_period_end
        ? { currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000) }
        : {}),
    },
  });
}

/** Handles invoice.payment_failed — marks subscription as PAST_DUE. */
export async function handleInvoicePaymentFailed(invoice: {
  subscription: string | null;
}) {
  if (!invoice.subscription) return;

  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: invoice.subscription },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { stripeSubscriptionId: invoice.subscription },
    data: { status: 'PAST_DUE' },
  });
}
