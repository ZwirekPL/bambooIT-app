import Stripe from 'stripe';
import { prisma } from '@db';
import { getVatConfig, getSetting, SETTING_STRIPE_FEE_PERCENT, SETTING_STRIPE_FEE_FIXED_PLN, SETTING_USD_TO_PLN_RATE } from './appSettings.service';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  : null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthRange(month: string): { gte: number; lte: number } {
  const [year, m] = month.split('-').map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 0, 23, 59, 59);
  return { gte: Math.floor(start.getTime() / 1000), lte: Math.floor(end.getTime() / 1000) };
}

// ── 70.2 Revenue Report ──────────────────────────────────────────────────────

interface RevenueRow {
  productType: string;
  count: number;
  brutto: number;
  netto: number | null;
  vat: number | null;
}

export interface RevenueReport {
  month: string;
  vatEnabled: boolean;
  vatRate: number;
  rows: RevenueRow[];
  totalBrutto: number;
  totalNetto: number | null;
  totalVat: number | null;
  previousMonthBrutto: number;
  changePercent: number | null;
}

export async function getRevenueReport(month: string): Promise<RevenueReport> {
  const { vatEnabled, vatRate } = await getVatConfig();
  const range = getMonthRange(month);

  // Get charges from Stripe
  const charges = stripe
    ? await fetchAllCharges({ created: range, status: 'succeeded' })
    : [];

  // Group by metadata.productType (if available) or description
  const byProduct = new Map<string, { count: number; amount: number }>();
  for (const c of charges) {
    const pt = c.metadata?.productType || c.description || 'OTHER';
    const existing = byProduct.get(pt) || { count: 0, amount: 0 };
    existing.count++;
    existing.amount += c.amount;
    byProduct.set(pt, existing);
  }

  const rows: RevenueRow[] = Array.from(byProduct.entries()).map(([productType, { count, amount }]) => {
    const brutto = amount / 100;
    if (vatEnabled) {
      const netto = brutto / (1 + vatRate / 100);
      return { productType, count, brutto, netto: Math.round(netto * 100) / 100, vat: Math.round((brutto - netto) * 100) / 100 };
    }
    return { productType, count, brutto, netto: null, vat: null };
  });

  const totalBrutto = rows.reduce((s, r) => s + r.brutto, 0);
  const totalNetto = vatEnabled ? rows.reduce((s, r) => s + (r.netto ?? 0), 0) : null;
  const totalVat = vatEnabled ? rows.reduce((s, r) => s + (r.vat ?? 0), 0) : null;

  // Previous month for comparison
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevRange = getMonthRange(prevMonth);
  const prevCharges = stripe ? await fetchAllCharges({ created: prevRange, status: 'succeeded' }) : [];
  const previousMonthBrutto = prevCharges.reduce((s, c) => s + c.amount, 0) / 100;
  const changePercent = previousMonthBrutto > 0 ? Math.round(((totalBrutto - previousMonthBrutto) / previousMonthBrutto) * 1000) / 10 : null;

  return { month, vatEnabled, vatRate, rows, totalBrutto, totalNetto, totalVat, previousMonthBrutto, changePercent };
}

// ── 70.4 CSV Export ──────────────────────────────────────────────────────────

export async function getTransactionsCsv(month: string): Promise<string> {
  const { vatEnabled, vatRate } = await getVatConfig();
  const range = getMonthRange(month);

  const charges = stripe ? await fetchAllCharges({ created: range }) : [];

  const BOM = '\uFEFF';
  const headers = ['Data', 'Email klienta', 'Produkt', 'Kwota brutto (PLN)', 'Status'];
  if (vatEnabled) {
    headers.push('Kwota netto (PLN)', 'VAT (PLN)');
  }

  const rows = charges.map((c) => {
    const brutto = c.amount / 100;
    const cols = [
      new Date(c.created * 1000).toISOString().slice(0, 19).replace('T', ' '),
      c.billing_details?.email || '',
      c.metadata?.productType || c.description || '',
      brutto.toFixed(2),
      c.status,
    ];
    if (vatEnabled) {
      const netto = brutto / (1 + vatRate / 100);
      cols.push(netto.toFixed(2), (brutto - netto).toFixed(2));
    }
    return cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  return BOM + headers.join(',') + '\n' + rows.join('\n');
}

// ── 70.5 Cost Report ─────────────────────────────────────────────────────────

export interface CostReport {
  month: string;
  revenue: number;
  aiCosts: number;
  stripeFees: number;
  netProfit: number;
  aiCostsPercent: number;
  stripeFeesPercent: number;
  marginPercent: number;
}

export async function getCostReport(month: string): Promise<CostReport> {
  const range = getMonthRange(month);
  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0, 23, 59, 59);

  // Revenue from Stripe
  const charges = stripe ? await fetchAllCharges({ created: range, status: 'succeeded' }) : [];
  const revenue = charges.reduce((s, c) => s + c.amount, 0) / 100;
  const txCount = charges.length;

  // AI costs from AiCostLog (using AiUsageLog model name from DB)
  const aiLogs = await prisma.aiUsageLog.findMany({
    where: { triggeredAt: { gte: monthStart, lte: monthEnd } },
    select: { estimatedCostUsd: true },
  });
  const usdRate = await getSetting<number>(SETTING_USD_TO_PLN_RATE, 4.0);
  const aiCostsUsd = aiLogs.reduce((s, l) => s + Number(l.estimatedCostUsd ?? 0), 0);
  const aiCosts = Math.round(aiCostsUsd * usdRate * 100) / 100;

  // Stripe fees
  const feePercent = await getSetting<number>(SETTING_STRIPE_FEE_PERCENT, 1.4);
  const feeFixed = await getSetting<number>(SETTING_STRIPE_FEE_FIXED_PLN, 0.25);
  const stripeFees = Math.round((revenue * feePercent / 100 + txCount * feeFixed) * 100) / 100;

  const netProfit = Math.round((revenue - aiCosts - stripeFees) * 100) / 100;

  return {
    month,
    revenue,
    aiCosts,
    stripeFees,
    netProfit,
    aiCostsPercent: revenue > 0 ? Math.round(aiCosts / revenue * 1000) / 10 : 0,
    stripeFeesPercent: revenue > 0 ? Math.round(stripeFees / revenue * 1000) / 10 : 0,
    marginPercent: revenue > 0 ? Math.round(netProfit / revenue * 1000) / 10 : 0,
  };
}

// ── 70.6 Churn Report ────────────────────────────────────────────────────────

export interface ChurnReport {
  month: string;
  activeStart: number;
  newSubscriptions: number;
  cancelled: number;
  activeEnd: number;
  churnRate: number;
  retentionRate: number;
  netChange: number;
}

export async function getChurnReport(month: string): Promise<ChurnReport> {
  if (!stripe) {
    return { month, activeStart: 0, newSubscriptions: 0, cancelled: 0, activeEnd: 0, churnRate: 0, retentionRate: 100, netChange: 0 };
  }

  const range = getMonthRange(month);

  // Active at start of month
  const allSubs = await stripe.subscriptions.list({ limit: 100, status: 'all' });

  const activeStart = allSubs.data.filter((s) =>
    s.created < range.gte && (s.status === 'active' || s.status === 'trialing' || (s.canceled_at && s.canceled_at >= range.gte))
  ).length;

  const newSubscriptions = allSubs.data.filter((s) =>
    s.created >= range.gte && s.created <= range.lte
  ).length;

  const cancelled = allSubs.data.filter((s) =>
    s.canceled_at && s.canceled_at >= range.gte && s.canceled_at <= range.lte
  ).length;

  const activeEnd = activeStart + newSubscriptions - cancelled;
  const churnRate = activeStart > 0 ? Math.round(cancelled / activeStart * 1000) / 10 : 0;
  const retentionRate = Math.round((100 - churnRate) * 10) / 10;

  return { month, activeStart, newSubscriptions, cancelled, activeEnd, churnRate, retentionRate, netChange: newSubscriptions - cancelled };
}

// ── 70.3 Invoice Export (ZIP) ────────────────────────────────────────────────

export async function getInvoicesForMonth(month: string): Promise<Array<{ url: string; filename: string }>> {
  if (!stripe) return [];

  const range = getMonthRange(month);
  const invoices = await stripe.invoices.list({
    created: { gte: range.gte, lte: range.lte },
    limit: 100,
    status: 'paid',
  });

  return invoices.data
    .filter((inv) => inv.invoice_pdf)
    .map((inv) => ({
      url: inv.invoice_pdf!,
      filename: `faktura-${new Date((inv.created ?? 0) * 1000).toISOString().slice(0, 10)}-${inv.customer_email || 'unknown'}-${inv.number || inv.id}.pdf`,
    }));
}

// ── Stripe helpers ───────────────────────────────────────────────────────────

async function fetchAllCharges(params: { created: { gte: number; lte: number }; status?: string }): Promise<Stripe.Charge[]> {
  if (!stripe) return [];

  const all: Stripe.Charge[] = [];
  let startingAfter: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const listParams: Stripe.ChargeListParams = {
      created: params.created,
      limit: 100,
    };
    if (startingAfter) listParams.starting_after = startingAfter;

    const batch = await stripe.charges.list(listParams);
    const filtered = params.status ? batch.data.filter((c) => c.status === params.status) : batch.data;
    all.push(...filtered);

    if (!batch.has_more) break;
    startingAfter = batch.data[batch.data.length - 1]?.id;
  }

  return all;
}
