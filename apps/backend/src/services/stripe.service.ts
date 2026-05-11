import Stripe from 'stripe';

// Stripe client is initialized only when STRIPE_SECRET_KEY is present.
// Without it the service operates in "mock mode" — all methods return
// placeholder URLs so the rest of the app can be developed and tested
// without a Stripe account.
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  : null;

export function isStripeConfigured(): boolean {
  return stripe !== null;
}

/** Returns the raw Stripe client (or null in mock mode). */
export function getStripeClient(): Stripe | null {
  return stripe;
}

/** Creates a Stripe Checkout Session and returns the redirect URL. */
export async function createCheckoutSession(params: {
  stripeCustomerId?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  mode?: 'subscription' | 'payment';
  discountPercent?: number;
  trialPeriodDays?: number;
}): Promise<string> {
  if (!stripe) {
    const separator = params.successUrl.includes('?') ? '&' : '?';
    return `${params.successUrl}${separator}mock=checkout`;
  }

  // Create an inline coupon for referral discount if provided
  let discounts: { coupon: string }[] | undefined;
  if (params.discountPercent && params.discountPercent > 0) {
    const coupon = await stripe.coupons.create({
      percent_off: params.discountPercent,
      duration: 'once',
      name: `Referral ${params.discountPercent}% off`,
    });
    discounts = [{ coupon: coupon.id }];
  }

  const session = await stripe.checkout.sessions.create({
    mode: params.mode ?? 'subscription',
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    ...(params.metadata ? { metadata: params.metadata } : {}),
    ...(discounts ? { discounts } : {}),
    ...(params.trialPeriodDays
      ? {
          subscription_data: {
            trial_period_days: params.trialPeriodDays,
          },
          payment_method_collection: 'always' as const,
        }
      : {}),
    ...(params.stripeCustomerId
      ? { customer: params.stripeCustomerId }
      : params.customerEmail
        ? { customer_email: params.customerEmail }
        : {}),
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return session.url;
}

/** Creates a Stripe Customer Portal session and returns the redirect URL. */
export async function createPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<string> {
  if (!stripe) {
    return `${params.returnUrl}?mock=portal`;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });

  return session.url;
}

/**
 * Retrieves the payment method (with card fingerprint) from a checkout session.
 * For subscriptions with trials, Stripe uses a SetupIntent to collect the card.
 */
export async function retrieveSetupIntentPaymentMethod(
  session: Stripe.Checkout.Session,
): Promise<Stripe.PaymentMethod | null> {
  if (!stripe) return null;

  // For trial subscriptions, the card is collected via setup_intent
  const setupIntentId =
    typeof session.setup_intent === 'string'
      ? session.setup_intent
      : (session.setup_intent as Stripe.SetupIntent | null)?.id ?? null;

  if (setupIntentId) {
    const si = await stripe.setupIntents.retrieve(setupIntentId, {
      expand: ['payment_method'],
    });
    if (si.payment_method && typeof si.payment_method !== 'string') {
      return si.payment_method;
    }
  }

  // Fallback: try payment_intent (for non-trial subscriptions)
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method'],
    });
    if (pi.payment_method && typeof pi.payment_method !== 'string') {
      return pi.payment_method;
    }
  }

  return null;
}

/** Verifies a Stripe webhook signature and returns the event. */
export function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
