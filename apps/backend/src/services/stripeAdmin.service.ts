import Stripe from 'stripe';
import { cacheGet, cacheSet } from '../utils/cache';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  : null;

const CACHE_TTL = 300; // 5 minutes

// ── 69.1 Dashboard ───────────────────────────────────────────────────────────

export interface StripeDashboard {
  balanceAvailable: number;
  balancePending: number;
  mrr: number;
  todayTransactions: number;
  todayRevenue: number;
  failedPayments7d: number;
  currency: string;
}

export async function getDashboard(): Promise<StripeDashboard> {
  const cached = await cacheGet<StripeDashboard>('stripe:dashboard');
  if (cached) return cached;

  if (!stripe) {
    return { balanceAvailable: 0, balancePending: 0, mrr: 0, todayTransactions: 0, todayRevenue: 0, failedPayments7d: 0, currency: 'pln' };
  }

  const [balance, subscriptions, todayCharges, failedCharges] = await Promise.all([
    stripe.balance.retrieve(),
    stripe.subscriptions.list({ status: 'active', limit: 100 }),
    stripe.charges.list({
      created: { gte: Math.floor(new Date().setHours(0, 0, 0, 0) / 1000) },
      limit: 100,
    }),
    stripe.charges.list({
      created: { gte: Math.floor(Date.now() / 1000) - 7 * 86400 },
      limit: 100,
    }),
  ]);

  const currency = 'pln';
  const balAvail = balance.available.find((b) => b.currency === currency);
  const balPend = balance.pending.find((b) => b.currency === currency);

  // MRR: sum of monthly amounts from active subscriptions
  let mrr = 0;
  for (const sub of subscriptions.data) {
    for (const item of sub.items.data) {
      const amount = item.price?.unit_amount ?? 0;
      const interval = item.price?.recurring?.interval;
      if (interval === 'month') mrr += amount;
      else if (interval === 'year') mrr += Math.round(amount / 12);
    }
  }

  const succeeded = todayCharges.data.filter((c) => c.status === 'succeeded');
  const failed7d = failedCharges.data.filter((c) => c.status === 'failed');

  const result: StripeDashboard = {
    balanceAvailable: (balAvail?.amount ?? 0) / 100,
    balancePending: (balPend?.amount ?? 0) / 100,
    mrr: mrr / 100,
    todayTransactions: succeeded.length,
    todayRevenue: succeeded.reduce((sum, c) => sum + c.amount, 0) / 100,
    failedPayments7d: failed7d.length,
    currency,
  };

  await cacheSet('stripe:dashboard', result, CACHE_TTL);
  return result;
}

// ── 69.2 Transactions ────────────────────────────────────────────────────────

export interface StripeTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  customerEmail: string | null;
  description: string | null;
  paymentIntentId: string | null;
  refunded: boolean;
  refundedAmount: number;
}

export async function listTransactions(params: {
  limit: number;
  startingAfter?: string;
  status?: string;
  dateFrom?: number;
  dateTo?: number;
}): Promise<{ transactions: StripeTransaction[]; hasMore: boolean }> {
  if (!stripe) {
    return { transactions: [], hasMore: false };
  }

  const listParams: Stripe.ChargeListParams = {
    limit: params.limit,
  };
  if (params.startingAfter) listParams.starting_after = params.startingAfter;
  if (params.dateFrom || params.dateTo) {
    listParams.created = {};
    if (params.dateFrom) listParams.created.gte = params.dateFrom;
    if (params.dateTo) listParams.created.lte = params.dateTo;
  }

  const charges = await stripe.charges.list(listParams);

  let data = charges.data;
  if (params.status) {
    data = data.filter((c) => c.status === params.status);
  }

  const transactions: StripeTransaction[] = data.map((c) => ({
    id: c.id,
    amount: c.amount / 100,
    currency: c.currency,
    status: c.refunded ? 'refunded' : c.status,
    created: new Date(c.created * 1000).toISOString(),
    customerEmail: typeof c.billing_details?.email === 'string' ? c.billing_details.email : null,
    description: c.description,
    paymentIntentId: typeof c.payment_intent === 'string' ? c.payment_intent : null,
    refunded: c.refunded,
    refundedAmount: c.amount_refunded / 100,
  }));

  return { transactions, hasMore: charges.has_more };
}

// ── 69.3 Refund ──────────────────────────────────────────────────────────────

export async function createRefund(params: {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
}): Promise<{ id: string; amount: number; status: string }> {
  if (!stripe) {
    return { id: 'mock_refund', amount: 0, status: 'succeeded' };
  }

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: params.paymentIntentId,
  };
  if (params.amount) refundParams.amount = Math.round(params.amount * 100);
  if (params.reason) {
    refundParams.reason = params.reason as Stripe.RefundCreateParams.Reason;
  }

  const refund = await stripe.refunds.create(refundParams);
  return {
    id: refund.id,
    amount: (refund.amount ?? 0) / 100,
    status: refund.status ?? 'unknown',
  };
}

// ── 69.4 Failed Payments ─────────────────────────────────────────────────────

export interface FailedPayment {
  id: string;
  amount: number;
  currency: string;
  created: string;
  customerEmail: string | null;
  failureMessage: string | null;
  daysPastDue: number;
}

export async function listFailedPayments(): Promise<FailedPayment[]> {
  if (!stripe) return [];

  const charges = await stripe.charges.list({
    created: { gte: Math.floor(Date.now() / 1000) - 30 * 86400 },
    limit: 100,
  });

  const now = Date.now();
  return charges.data
    .filter((c) => c.status === 'failed')
    .map((c) => ({
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency,
      created: new Date(c.created * 1000).toISOString(),
      customerEmail: typeof c.billing_details?.email === 'string' ? c.billing_details.email : null,
      failureMessage: c.failure_message,
      daysPastDue: Math.floor((now - c.created * 1000) / 86400000),
    }));
}

// ── 69.5 Coupons ─────────────────────────────────────────────────────────────

export interface StripeCoupon {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  redeemBy: string | null;
  valid: boolean;
}

export async function listCoupons(): Promise<StripeCoupon[]> {
  if (!stripe) return [];

  const coupons = await stripe.coupons.list({ limit: 100 });
  return coupons.data.map((c) => ({
    id: c.id,
    name: c.name,
    percentOff: c.percent_off,
    amountOff: c.amount_off ? c.amount_off / 100 : null,
    currency: c.currency,
    duration: c.duration,
    durationInMonths: c.duration_in_months,
    maxRedemptions: c.max_redemptions,
    timesRedeemed: c.times_redeemed,
    redeemBy: c.redeem_by ? new Date(c.redeem_by * 1000).toISOString() : null,
    valid: c.valid,
  }));
}

export async function createCoupon(params: {
  name: string;
  percentOff?: number;
  amountOff?: number;
  duration: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  maxRedemptions?: number;
  redeemBy?: number;
}): Promise<StripeCoupon> {
  if (!stripe) {
    return { id: 'mock', name: params.name, percentOff: params.percentOff ?? null, amountOff: params.amountOff ?? null, currency: 'pln', duration: params.duration, durationInMonths: null, maxRedemptions: null, timesRedeemed: 0, redeemBy: null, valid: true };
  }

  const couponParams: Stripe.CouponCreateParams = {
    name: params.name,
    duration: params.duration,
  };
  if (params.percentOff) couponParams.percent_off = params.percentOff;
  if (params.amountOff) {
    couponParams.amount_off = Math.round(params.amountOff * 100);
    couponParams.currency = 'pln';
  }
  if (params.durationInMonths) couponParams.duration_in_months = params.durationInMonths;
  if (params.maxRedemptions) couponParams.max_redemptions = params.maxRedemptions;
  if (params.redeemBy) couponParams.redeem_by = params.redeemBy;

  const c = await stripe.coupons.create(couponParams);
  return {
    id: c.id,
    name: c.name,
    percentOff: c.percent_off,
    amountOff: c.amount_off ? c.amount_off / 100 : null,
    currency: c.currency,
    duration: c.duration,
    durationInMonths: c.duration_in_months,
    maxRedemptions: c.max_redemptions,
    timesRedeemed: c.times_redeemed,
    redeemBy: c.redeem_by ? new Date(c.redeem_by * 1000).toISOString() : null,
    valid: c.valid,
  };
}

export async function deleteCoupon(id: string): Promise<void> {
  if (!stripe) return;
  await stripe.coupons.del(id);
}
