import { prisma, Prisma } from '@db';

export interface SubscriptionStatsResult {
  mrr: number;
  activeSubscriptions: { total: number; start: number; firma: number; firmaPlus: number };
  trials: { active: number; expired: number };
  churnRate: number;
}

// bambooIT subscription prices (PLN/month, per D-007)
const SUB_PRICE: Record<string, number> = { START: 390, FIRMA: 690, FIRMA_PLUS: 1190 };

export async function getSubscriptionStats(): Promise<SubscriptionStatsResult> {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    startActive,
    firmaActive,
    firmaPlusActive,
    trialing,
    trialExpired,
    cancelledLast30,
  ] = await prisma.$transaction([
    prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'START' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'FIRMA' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'FIRMA_PLUS' } }),
    prisma.subscription.count({ where: { status: 'TRIALING' } }),
    prisma.subscription.count({
      where: {
        status: 'CANCELED',
        currentPeriodEnd: { lt: now },
      },
    }),
    prisma.subscription.count({
      where: {
        status: 'CANCELED',
        updatedAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const totalActive = startActive + firmaActive + firmaPlusActive;
  const mrr =
    startActive * SUB_PRICE.START +
    firmaActive * SUB_PRICE.FIRMA +
    firmaPlusActive * SUB_PRICE.FIRMA_PLUS;
  const churnRate = totalActive + cancelledLast30 > 0
    ? Math.round((cancelledLast30 / (totalActive + cancelledLast30)) * 100 * 10) / 10
    : 0;

  return {
    mrr,
    activeSubscriptions: { total: totalActive, start: startActive, firma: firmaActive, firmaPlus: firmaPlusActive },
    trials: { active: trialing, expired: trialExpired },
    churnRate,
  };
}

export interface SubscriptionListParams {
  page: number;
  limit: number;
  status?: string;
  productType?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface MappedItem {
  id: string;
  type: 'subscription' | 'order';
  userEmail: string;
  userName: string | null;
  productType: string;
  status: string;
  amount: number;
  createdAt: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
}

export async function listSubscriptions(params: SubscriptionListParams) {
  return listSubscriptionsOnly(params);
}

/** Fetch subscriptions (with optional plan filter) */
async function listSubscriptionsOnly(params: SubscriptionListParams & { plan?: string }) {
  const { page, limit, status, plan, productType, dateFrom, dateTo } = params;

  const subWhere: Prisma.SubscriptionWhereInput = {};
  const planFilter = plan ?? productType;
  if (planFilter) subWhere.plan = planFilter as Prisma.EnumSubscriptionPlanFilter;
  if (status) subWhere.status = status as Prisma.EnumSubscriptionStatusFilter;
  applyDateFilter(subWhere as Record<string, unknown>, dateFrom, dateTo);

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where: subWhere,
      include: { user: { select: { id: true, email: true, company: { select: { contactFirstName: true, contactLastName: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscription.count({ where: subWhere }),
  ]);

  return { items: subscriptions.map(mapSubscription), total, page, limit };
}

// ── Helpers ──
// K8: bambooIT MVP has only subscription Orders (no one-off plans/consultations).
// SUB_PRICE constant defined at module top (used by getSubscriptionStats).

function mapSubscription(s: {
  id: string;
  plan: string;
  status: string;
  createdAt: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  user: { email: string; company: { contactFirstName: string | null; contactLastName: string | null } | null };
}): MappedItem {
  return {
    id: s.id,
    type: 'subscription',
    userEmail: s.user.email,
    userName: [s.user.company?.contactFirstName, s.user.company?.contactLastName].filter(Boolean).join(' ') || null,
    productType: s.plan,
    status: s.status,
    amount: SUB_PRICE[s.plan] ?? 0,
    createdAt: s.createdAt,
    currentPeriodEnd: s.currentPeriodEnd,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    stripeSubscriptionId: s.stripeSubscriptionId,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyDateFilter(where: Record<string, any>, dateFrom?: string, dateTo?: string) {
  if (dateFrom) {
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter || {}), gte: new Date(dateFrom) };
  }
  if (dateTo) {
    const existing = (where.createdAt as Prisma.DateTimeFilter) || {};
    where.createdAt = { ...existing, lte: new Date(dateTo) };
  }
}
