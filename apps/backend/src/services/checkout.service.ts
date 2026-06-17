import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { isStripeConfigured, createCheckoutSession as stripeCheckout } from './stripe.service';
import type { ProductType, CheckoutProductType } from './order.service';
import { hasUserUsedTrial } from './trialFingerprint.service';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const DEFAULT_LOCALE = 'pl';
const BASE_URL = `${APP_URL}/${DEFAULT_LOCALE}`;

const TRIAL_PERIOD_DAYS = 7;

/** Maps product types to Stripe price env variable names. */
const PRICE_ENV_MAP: Partial<Record<CheckoutProductType, string>> = {
  TRIAL: 'STRIPE_PRICE_START', // Trial uses START price (with Stripe trial period)
  START: 'STRIPE_PRICE_START',
  FIRMA: 'STRIPE_PRICE_FIRMA',
  FIRMA_PLUS: 'STRIPE_PRICE_FIRMA_PLUS',
};

/**
 * Creates a Stripe Checkout session for a company subscription order.
 */
export async function createSession(
  userId: string,
  email: string,
  productType: CheckoutProductType,
) {
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

  // TRIAL is a checkout-only virtual type — map to START for DB persistence.
  // Stripe handles trial period via subscription config (trialPeriodDays).
  const dbProductType: ProductType = productType === 'TRIAL' ? 'START' : productType;

  // In mock mode (no Stripe), mark order as PAID immediately since no webhook will fire
  const mockMode = !isStripeConfigured();

  // Trial abuse check + order creation in a transaction to prevent TOCTOU race
  if (productType === 'TRIAL') {
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

  const mode = 'subscription';

  const url = await stripeCheckout({
    priceId: priceId ?? 'price_mock',
    successUrl: `${BASE_URL}/zamowienie/sukces?product=${productType}&order=${order.id}`,
    cancelUrl: `${BASE_URL}/zamowienie/anulowano?product=${productType}`,
    customerEmail: email,
    metadata: { productType, userId, orderId: order.id },
    mode,
    trialPeriodDays: productType === 'TRIAL' ? TRIAL_PERIOD_DAYS : undefined,
  });

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

  // K8: CONSULTATION product dropped (bambooIT MVP only subscription tiers).
  // Order-specific post-payment side effects (audit log, notifications)
  // rebuild w fazie 4 per package needs.
}
