import { prisma, Prisma } from '@db';

export interface SubscriptionStatsResult {
  mrr: number;
  activeSubscriptions: { total: number; monthly: number; yearly: number };
  trials: { active: number; expired: number };
  oneTime: { plan2w: number; plan4w: number; consultation: number };
  churnRate: number;
}

export async function getSubscriptionStats(): Promise<SubscriptionStatsResult> {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    monthlyActive,
    yearlyActive,
    trialing,
    trialExpired,
    plan2w,
    plan4w,
    consultation,
    cancelledLast30,
  ] = await prisma.$transaction([
    prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'PRO_MONTHLY' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'PRO_YEARLY' } }),
    prisma.subscription.count({ where: { status: 'TRIALING' } }),
    prisma.subscription.count({
      where: {
        status: 'CANCELED',
        plan: { not: 'FREE' },
        currentPeriodEnd: { lt: now },
      },
    }),
    prisma.order.count({ where: { productType: 'PLAN_2W', status: { in: ['PAID', 'ACTIVE', 'COMPLETED'] } } }),
    prisma.order.count({ where: { productType: 'PLAN_4W', status: { in: ['PAID', 'ACTIVE', 'COMPLETED'] } } }),
    prisma.order.count({ where: { productType: 'CONSULTATION', status: { in: ['PAID', 'ACTIVE', 'COMPLETED'] } } }),
    prisma.subscription.count({
      where: {
        status: 'CANCELED',
        plan: { not: 'FREE' },
        updatedAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const totalActive = monthlyActive + yearlyActive;
  // MRR: monthly * 129 + yearly * 99
  const mrr = monthlyActive * 129 + yearlyActive * 99;
  const churnRate = totalActive + cancelledLast30 > 0
    ? Math.round((cancelledLast30 / (totalActive + cancelledLast30)) * 100 * 10) / 10
    : 0;

  return {
    mrr,
    activeSubscriptions: { total: totalActive, monthly: monthlyActive, yearly: yearlyActive },
    trials: { active: trialing, expired: trialExpired },
    oneTime: { plan2w, plan4w, consultation },
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

const ORDER_PRODUCT_TYPES = ['PLAN_2W', 'PLAN_4W', 'CONSULTATION'];
const SUB_ONLY_STATUSES = ['TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE'];
const ORDER_ONLY_STATUSES = ['PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED'];

export async function listSubscriptions(params: SubscriptionListParams) {
  const { page, limit, status, productType, dateFrom, dateTo } = params;

  // If filtering by an order-only productType, return only orders
  if (productType && ORDER_PRODUCT_TYPES.includes(productType)) {
    return listOrders(params);
  }

  // If filtering by a subscription plan type, return only subscriptions
  if (productType) {
    return listSubscriptionsOnly({ ...params, plan: productType });
  }

  // No productType filter — merge subscriptions + orders
  return listAll(params);
}

/** Fetch only subscriptions (with optional plan filter) */
async function listSubscriptionsOnly(params: SubscriptionListParams & { plan?: string }) {
  const { page, limit, status, plan, dateFrom, dateTo } = params;

  const subWhere: Prisma.SubscriptionWhereInput = status === 'TRIALING' ? {} : { plan: { not: 'FREE' } };
  if (plan) subWhere.plan = plan as Prisma.EnumSubscriptionPlanFilter;
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

/** Fetch only orders */
async function listOrders(params: SubscriptionListParams) {
  const { page, limit, productType, status, dateFrom, dateTo } = params;

  const where: Prisma.OrderWhereInput = {};
  if (productType) where.productType = productType as Prisma.EnumProductTypeFilter;
  else where.productType = { in: ['PLAN_2W', 'PLAN_4W', 'CONSULTATION'] };

  // For order-specific statuses
  if (status) {
    (where as Record<string, unknown>).status = status;
  } else {
    where.status = { in: ['PAID', 'ACTIVE', 'COMPLETED'] };
  }

  applyDateFilter(where as Record<string, unknown>, dateFrom, dateTo);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { company: { select: { contactFirstName: true, contactLastName: true, user: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { items: orders.map(mapOrder), total, page, limit };
}

/** Fetch both subscriptions and orders, merge and sort by date */
async function listAll(params: SubscriptionListParams) {
  const { page, limit, status, dateFrom, dateTo } = params;

  const skipOrders = status ? SUB_ONLY_STATUSES.includes(status) : false;
  const skipSubs = status ? ORDER_ONLY_STATUSES.includes(status) : false;

  // Build subscription query
  let subItems: MappedItem[] = [];
  let subTotal = 0;
  if (!skipSubs) {
    const subWhere: Prisma.SubscriptionWhereInput = status === 'TRIALING' ? {} : { plan: { not: 'FREE' } };
    if (status) subWhere.status = status as Prisma.EnumSubscriptionStatusFilter;
    applyDateFilter(subWhere as Record<string, unknown>, dateFrom, dateTo);

    const [subscriptions, count] = await Promise.all([
      prisma.subscription.findMany({
        where: subWhere,
        include: { user: { select: { id: true, email: true, company: { select: { contactFirstName: true, contactLastName: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where: subWhere }),
    ]);
    subItems = subscriptions.map(mapSubscription);
    subTotal = count;
  }

  // Build order query
  let orderItems: MappedItem[] = [];
  let orderTotal = 0;
  if (!skipOrders) {
    const orderWhere: Prisma.OrderWhereInput = {
      productType: { in: ['PLAN_2W', 'PLAN_4W', 'CONSULTATION'] },
    };
    if (status) {
      (orderWhere as Record<string, unknown>).status = status;
    } else {
      orderWhere.status = { in: ['PAID', 'ACTIVE', 'COMPLETED'] };
    }
    applyDateFilter(orderWhere as Record<string, unknown>, dateFrom, dateTo);

    const [orders, count] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        include: { company: { select: { contactFirstName: true, contactLastName: true, user: { select: { email: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where: orderWhere }),
    ]);
    orderItems = orders.map(mapOrder);
    orderTotal = count;
  }

  const allItems = [...subItems, ...orderItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = subTotal + orderTotal;
  const paged = allItems.slice((page - 1) * limit, page * limit);

  return { items: paged, total, page, limit };
}

// ── Helpers ──

const SUB_PRICE: Record<string, number> = { PRO_YEARLY: 99, PRO_MONTHLY: 129 };
const ORDER_PRICE: Record<string, number> = { PLAN_2W: 129, PLAN_4W: 199, CONSULTATION: 399 };

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

function mapOrder(o: {
  id: string;
  productType: string;
  status: string;
  createdAt: Date;
  company: { contactFirstName: string | null; contactLastName: string | null; user: { email: string } };
}): MappedItem {
  return {
    id: o.id,
    type: 'order',
    userEmail: o.company.user.email,
    userName: [o.company.contactFirstName, o.company.contactLastName].filter(Boolean).join(' ') || null,
    productType: o.productType,
    status: o.status,
    amount: ORDER_PRICE[o.productType] ?? 0,
    createdAt: o.createdAt,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: null,
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
