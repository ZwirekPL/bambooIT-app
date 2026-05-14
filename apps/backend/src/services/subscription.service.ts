import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { isStripeConfigured, createCheckoutSession, createPortalSession } from './stripe.service';
import { sendSubscriptionWelcomeEmail, sendPaymentFailedEmail } from '../utils/email';
import { logAudit } from './audit.service';
import * as Sentry from '@sentry/node';
import type { SubscriptionPlan } from '@prisma/client';

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  START: 'Pakiet Start',
  FIRMA: 'Pakiet Firma',
  FIRMA_PLUS: 'Pakiet Firma Plus',
};

const PLAN_PRICES_NET: Record<SubscriptionPlan, number> = {
  START: 390,
  FIRMA: 690,
  FIRMA_PLUS: 1190,
};

// "First invoice" detection window — if invoice period starts within
// FIRST_INVOICE_WINDOW_MS of Subscription.createdAt, treat it as the
// inaugural invoice and send the welcome email.
const FIRST_INVOICE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function notifyWelcomeIfFirstInvoice(
  subscriptionId: string,
  periodStart: Date | undefined,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: { select: { email: true } } },
  });
  if (!sub || !sub.user?.email) return;

  const start = periodStart ?? sub.currentPeriodStart;
  if (!start) return;

  const elapsed = Math.abs(start.getTime() - sub.createdAt.getTime());
  if (elapsed > FIRST_INVOICE_WINDOW_MS) return;

  const locale = 'pl';
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  try {
    await sendSubscriptionWelcomeEmail(sub.user.email, {
      productLabel: PLAN_LABELS[sub.plan],
      amountPerMonth: PLAN_PRICES_NET[sub.plan],
      panelUrl: `${appUrl}/${locale}/panel/subskrypcja`,
      remoteHelpUrl: `${appUrl}/${locale}/pomoc-zdalna`,
    });
  } catch (err) {
    console.error('[subscription] welcome email failed:', err);
    Sentry.captureException(err, { tags: { stripeSubscriptionId: subscriptionId } });
  }
}

async function notifyPaymentFailed(subscriptionId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: { select: { email: true } } },
  });
  if (!sub || !sub.user?.email || !sub.stripeCustomerId) return;

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  try {
    const portal = await createPortalSession({
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl: `${appUrl}/pl/panel/subskrypcja`,
    });
    await sendPaymentFailedEmail(sub.user.email, {
      productLabel: PLAN_LABELS[sub.plan],
      portalUrl: portal,
    });
  } catch (err) {
    console.error('[subscription] payment-failed email failed:', err);
    Sentry.captureException(err, { tags: { stripeSubscriptionId: subscriptionId } });
  }
}

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const DEFAULT_LOCALE = 'pl';
const BASE_URL = `${APP_URL}/${DEFAULT_LOCALE}`;

// TODO(K8-deploy): On production deployment, Subscription rows with
// plan IN ('FREE', 'PRO_MONTHLY', 'PRO_YEARLY') will be force-cast
// to 'START' by migration USING clause. This is acceptable in dev
// (0 rows) but production requires pre-migration data mapping:
//
// -- Map diet-era plans to bambooIT tiers (business decision per user):
// UPDATE "Subscription" SET plan = 'START'
//   WHERE plan IN ('FREE', 'PRO_MONTHLY');
// UPDATE "Subscription" SET plan = 'FIRMA'
//   WHERE plan = 'PRO_YEARLY';  -- or 'FIRMA_PLUS' per business decision
//
// -- Alternative for fresh bambooIT prod (no diet-era data migration):
// DELETE FROM "Subscription";  -- nuclear option, drop all diet
//   -- subscriptions before migration
//
// Similar consideration for Order.productType — 0 rows w dev
// trivially passes; prod-future requires UPDATE/DELETE.
//
// Currently dev DB has 0 users + 0 subscriptions — zero impact
// for K8 commit.
// bambooIT not deployed to prod yet — these steps become relevant
// when prod first launches with real users.

/** Resolves a Stripe price ID to a SubscriptionPlan. Throws on unknown price. */
function planFromPriceId(priceId: string | null | undefined): SubscriptionPlan {
  if (priceId === process.env.STRIPE_PRICE_START) return 'START';
  if (priceId === process.env.STRIPE_PRICE_FIRMA) return 'FIRMA';
  if (priceId === process.env.STRIPE_PRICE_FIRMA_PLUS) return 'FIRMA_PLUS';
  throw new Error(`Unknown Stripe price ID: ${priceId}`);
}

/** Returns the subscription for a user (placeholder START plan if none exists). */
export async function getMySubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;

  // Placeholder Subscription created before Stripe webhook fires.
  // Plan = 'START' as transient default until real plan resolved via webhook.
  return prisma.subscription.create({
    data: { userId, plan: 'START', status: 'TRIALING' },
  });
}

/** Creates a Stripe Checkout Session URL for selected package. */
export async function createCheckout(userId: string, email: string, plan: 'START' | 'FIRMA' | 'FIRMA_PLUS') {
  const priceEnvMap: Record<typeof plan, string | undefined> = {
    START: process.env.STRIPE_PRICE_START,
    FIRMA: process.env.STRIPE_PRICE_FIRMA,
    FIRMA_PLUS: process.env.STRIPE_PRICE_FIRMA_PLUS,
  };
  const priceId = priceEnvMap[plan];

  if (!priceId && isStripeConfigured()) {
    throw new AppError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe price ID is not configured');
  }

  const subscription = await getMySubscription(userId);

  const url = await createCheckoutSession({
    stripeCustomerId: subscription.stripeCustomerId ?? undefined,
    priceId: priceId ?? 'price_mock',
    successUrl: `${BASE_URL}/panel/subskrypcja?checkout=success`,
    cancelUrl: `${BASE_URL}/panel/subskrypcja?checkout=cancel`,
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
    returnUrl: `${BASE_URL}/panel/subskrypcja`,
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

  // Resolve plan from metadata (set during checkout)
  const metadataPlan = session.metadata?.plan;
  const plan: SubscriptionPlan =
    metadataPlan === 'FIRMA_PLUS' ? 'FIRMA_PLUS' :
    metadataPlan === 'FIRMA' ? 'FIRMA' :
    'START';

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

  // Lead → Subscription conversion tracking (BE-1 ↔ BE-2 loop close).
  // If this user originally came in via /audyt or /kontakt form, mark
  // all of their leads (matched by email) as CONVERTED. Audit log entry
  // per converted lead so we can attribute "first touch source" later.
  await markLeadsConvertedForUser(userId).catch((err) => {
    console.error('[subscription] lead conversion tracking failed:', err);
    // Non-blocking — subscription is created, conversion attribution is
    // best-effort and can be re-run manually if needed.
  });
}

async function markLeadsConvertedForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return;

  const eligible = await prisma.lead.findMany({
    where: {
      email: user.email,
      status: { notIn: ['CONVERTED', 'REJECTED'] },
    },
    select: { id: true, status: true, type: true, source: true },
  });

  if (eligible.length === 0) return;

  await prisma.lead.updateMany({
    where: { id: { in: eligible.map((l) => l.id) } },
    data: { status: 'CONVERTED' },
  });

  for (const lead of eligible) {
    logAudit({
      userId,
      action: 'LEAD_STATUS_UPDATED',
      resourceType: 'LEAD',
      resourceId: lead.id,
      metadata: {
        from: lead.status,
        to: 'CONVERTED',
        trigger: 'stripe_checkout_completed',
        leadType: lead.type,
        source: lead.source,
      },
    });
  }
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

  // Send welcome email on the inaugural invoice only. Detection: period
  // start within 1h of Subscription.createdAt. Subsequent renewals skip.
  await notifyWelcomeIfFirstInvoice(invoice.subscription, periodStart);
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

  await notifyPaymentFailed(invoice.subscription);
}
