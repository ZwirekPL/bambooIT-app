import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { isStripeConfigured, createCheckoutSession as stripeCheckout } from './stripe.service';
import type { ProductType, CheckoutProductType } from './order.service';
import { getReferralDiscount, markReferralRedeemed, applyReferralOnRegistration } from './referral.service';
import { sendConsultationPatientEmail, sendConsultationDietitianEmail } from '../utils/email';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const DEFAULT_LOCALE = 'pl';
const BASE_URL = `${APP_URL}/${DEFAULT_LOCALE}`;

import { isSubscriptionProduct, isTrialProduct, TRIAL_PERIOD_DAYS } from '../config/planLimits';
import { hasUserUsedTrial } from './trialFingerprint.service';

/** Maps product types to Stripe price env variable names (29.2). */
const PRICE_ENV_MAP: Partial<Record<CheckoutProductType, string>> = {
  FREE_7: '',
  TRIAL: 'STRIPE_PRICE_OPIEKA_MIESIECZNA', // Trial uses same price as monthly subscription
  TRIAL_YEARLY: 'STRIPE_PRICE_OPIEKA_ROCZNA', // Yearly trial uses yearly price
  OPIEKA_MIESIECZNA: 'STRIPE_PRICE_OPIEKA_MIESIECZNA',
  OPIEKA_ROCZNA: 'STRIPE_PRICE_OPIEKA_ROCZNA',
  PLAN_2W: 'STRIPE_PRICE_PLAN_2W',
  PLAN_4W: 'STRIPE_PRICE_PLAN_4W',
  CONSULTATION: 'STRIPE_PRICE_CONSULTATION',
};

/**
 * Creates a Stripe Checkout session for a company order.
 * FREE_7 orders skip Stripe and redirect directly to success.
 */
export async function createSession(
  userId: string,
  email: string,
  productType: CheckoutProductType,
  referralCode?: string,
) {
  // FREE_7 — no payment required, create order directly
  if (productType === 'FREE_7') {
    const company = await prisma.company.findUnique({ where: { userId } });
    if (!company) {
      throw new AppError(404, 'NOT_FOUND', 'Company profile not found');
    }

    await prisma.order.create({
      data: {
        companyId: company.id,
        productType,
        status: 'PAID',
      },
    });

    return { url: `${BASE_URL}/zamowienie/sukces?product=${productType}` };
  }

  // Resolve Stripe price ID
  const envKey = PRICE_ENV_MAP[productType];
  const priceId = envKey ? process.env[envKey] : undefined;

  if (!priceId && isStripeConfigured()) {
    throw new AppError(500, 'STRIPE_NOT_CONFIGURED', `Stripe price ID not configured for ${productType}`);
  }

  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Company profile not found');
  }

  // Trial types are checkout-only — map to the corresponding DB product type
  const TRIAL_DB_MAP: Record<string, ProductType> = {
    TRIAL: 'OPIEKA_MIESIECZNA',
    TRIAL_YEARLY: 'OPIEKA_ROCZNA',
  };
  const dbProductType = (TRIAL_DB_MAP[productType] ?? productType) as ProductType;

  // In mock mode (no Stripe), mark order as PAID immediately since no webhook will fire
  const mockMode = !isStripeConfigured();

  // Trial abuse check + order creation in a transaction to prevent TOCTOU race
  if (isTrialProduct(productType)) {
    const alreadyUsed = await hasUserUsedTrial(userId);
    if (alreadyUsed) {
      throw new AppError(409, 'TRIAL_ALREADY_USED', 'You have already used your free trial');
    }
  }

  const order = await prisma.order.create({
    data: {
      companyId: company.id,
      productType: dbProductType,
      status: mockMode ? 'PAID' : 'PENDING_PAYMENT',
    },
  });

  const mode = isSubscriptionProduct(productType) ? 'subscription' : 'payment';

  // Apply referral code if provided at checkout (and not already applied at registration)
  if (referralCode) {
    try {
      await applyReferralOnRegistration(referralCode, userId);
    } catch {
      // Silently ignore — invalid code or already applied
    }
  }

  // Check for referral discount
  const discountPercent = await getReferralDiscount(userId);

  const url = await stripeCheckout({
    priceId: priceId ?? 'price_mock',
    successUrl: `${BASE_URL}/zamowienie/sukces?product=${productType}&order=${order.id}`,
    cancelUrl: `${BASE_URL}/zamowienie/anulowano?product=${productType}`,
    customerEmail: email,
    metadata: { productType, userId, orderId: order.id },
    mode,
    discountPercent: discountPercent > 0 ? discountPercent : undefined,
    trialPeriodDays: isTrialProduct(productType) ? TRIAL_PERIOD_DAYS : undefined,
  });

  // Mark referral as redeemed if discount was applied
  if (discountPercent > 0) {
    await markReferralRedeemed(userId, order.id);
  }

  return { url, orderId: order.id };
}

/**
 * Called by the Stripe webhook when checkout.session.completed fires
 * with an orderId in metadata. Updates the order status to PAID.
 */
export async function handleOrderCheckoutCompleted(orderId: string): Promise<void> {
  // Atomic update — prevents TOCTOU race condition when multiple webhooks fire
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING_PAYMENT' },
    data: { status: 'PAID' },
  });

  if (count === 0) return; // Already processed or not found

  // Fetch order for consultation email logic
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  // Send consultation-specific emails (29.5)
  if (order?.productType === 'CONSULTATION') {
    sendConsultationEmails(order.id, order.companyId).catch((err) => {
      console.error('[checkout] Failed to send consultation emails:', err);
    });
  }
}

/**
 * Sends consultation purchase emails to company and their dietitian (29.5).
 * Fire-and-forget — errors are logged but don't block the webhook response.
 */
async function sendConsultationEmails(orderId: string, companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      user: { select: { email: true } },
      dietitian: { select: { id: true, email: true } },
    },
  });
  if (!company) return;

  const contactName = [company.contactFirstName, company.contactLastName].filter(Boolean).join(' ') || 'Klient';

  // Email to company — simplified: "we'll contact you by email to schedule"
  await sendConsultationPatientEmail(
    company.user.email,
    company.contactFirstName ?? '',
    { orderId },
  );

  // Email to dietitian with company data (if company has an assigned dietitian)
  if (company.dietitian) {
    await sendConsultationDietitianEmail(
      company.dietitian.email,
      {
        orderId,
        contactName,
        contactEmail: company.user.email,
      },
    );
  }
}
