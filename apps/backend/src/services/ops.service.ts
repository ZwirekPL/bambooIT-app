import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

/**
 * Operational core — hours ledger for the IT-support subscription.
 *
 * The product is *time*: each tier includes N hours/month (ServicePackage).
 * Admins log work (TimeEntry); a monthly ServicePeriod rolls it up with
 * carryover of unused minutes (capped) and overage billing past the package.
 * All hour math is done in MINUTES for precision; hours are display-only.
 *
 * Source of "which package" is Company.servicePlan (set by admin on
 * activation) — decoupled from Stripe/Subscription rework per PLAN_ops_core.md.
 */

type Plan = 'START' | 'FIRMA' | 'FIRMA_PLUS';

// ─── Service packages (config / source of truth) ──────────────────────────

export async function listServicePackages() {
  return prisma.servicePackage.findMany({ orderBy: { hoursIncluded: 'asc' } });
}

async function getPackageOrThrow(plan: Plan) {
  const pkg = await prisma.servicePackage.findUnique({ where: { plan } });
  if (!pkg) {
    throw new AppError(500, 'PACKAGE_NOT_CONFIGURED', `ServicePackage ${plan} is not seeded`);
  }
  return pkg;
}

// ─── Service plan (activate a client) ─────────────────────────────────────

export async function setServicePlan(
  companyId: string,
  plan: Plan | null,
  serviceSince: Date | null,
) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, 'NOT_FOUND', 'Company not found');
  return prisma.company.update({
    where: { id: companyId },
    data: { servicePlan: plan, serviceSince },
  });
}

// ─── Period math (minute precision) ───────────────────────────────────────

function periodKey(date: Date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** True if (ay,am) is strictly before (by,bm). */
function isBefore(ay: number, am: number, by: number, bm: number) {
  return ay < by || (ay === by && am < bm);
}

function computeRollup(
  hoursIncluded: number,
  carryoverInMinutes: number,
  consumedMinutes: number,
  overageRatePerHour: Prisma.Decimal,
  capMinutes: number,
) {
  const availableMinutes = hoursIncluded * 60 + carryoverInMinutes;
  let overageMinutes = 0;
  let carryoverOutMinutes = 0;
  if (consumedMinutes <= availableMinutes) {
    carryoverOutMinutes = Math.min(availableMinutes - consumedMinutes, capMinutes);
  } else {
    overageMinutes = consumedMinutes - availableMinutes;
  }
  const overageHours = overageMinutes / 60;
  const overageAmountNet = overageHours * Number(overageRatePerHour);
  return {
    availableMinutes,
    carryoverOutMinutes,
    overageHours: overageHours.toFixed(2),
    overageAmountNet: overageAmountNet.toFixed(2),
  };
}

async function sumBillableMinutes(periodId: string) {
  const agg = await prisma.timeEntry.aggregate({
    where: { periodId, billable: true },
    _sum: { minutes: true },
  });
  return agg._sum.minutes ?? 0;
}

/** carryoverOut of the most recent period strictly before (year,month). */
async function priorCarryoverMinutes(companyId: string, year: number, month: number) {
  const prior = await prisma.servicePeriod.findFirst({
    where: {
      companyId,
      OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  return prior?.carryoverOutMinutes ?? 0;
}

async function getOrCreatePeriod(companyId: string, date: Date) {
  const { year, month } = periodKey(date);
  const existing = await prisma.servicePeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
  if (existing) return existing;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, 'NOT_FOUND', 'Company not found');
  if (!company.servicePlan) {
    throw new AppError(
      400,
      'NO_SERVICE_PLAN',
      'Company has no active service plan — set it before logging time',
    );
  }

  const pkg = await getPackageOrThrow(company.servicePlan);
  const carryoverInMinutes = await priorCarryoverMinutes(companyId, year, month);
  return prisma.servicePeriod.create({
    data: {
      companyId,
      year,
      month,
      plan: company.servicePlan,
      hoursIncluded: pkg.hoursIncluded,
      overageRatePerHour: pkg.overageRatePerHour,
      carryoverInMinutes,
    },
  });
}

/**
 * Recompute every period from (fromYear,fromMonth) forward, threading
 * carryover through the chain. Run after any TimeEntry mutation so a change
 * in a past month propagates its carryover into later months.
 */
async function recalcChain(companyId: string, fromYear: number, fromMonth: number) {
  const periods = await prisma.servicePeriod.findMany({
    where: {
      companyId,
      OR: [{ year: { gt: fromYear } }, { year: fromYear, month: { gte: fromMonth } }],
    },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  let carryIn = await priorCarryoverMinutes(companyId, fromYear, fromMonth);
  for (const period of periods) {
    const consumed = await sumBillableMinutes(period.id);
    const pkg = await prisma.servicePackage.findUnique({ where: { plan: period.plan } });
    const capMinutes = (pkg?.carryoverCapHours ?? 0) * 60;
    const r = computeRollup(
      period.hoursIncluded,
      carryIn,
      consumed,
      period.overageRatePerHour,
      capMinutes,
    );
    await prisma.servicePeriod.update({
      where: { id: period.id },
      data: {
        carryoverInMinutes: carryIn,
        consumedMinutes: consumed,
        carryoverOutMinutes: r.carryoverOutMinutes,
        overageHours: r.overageHours,
        overageAmountNet: r.overageAmountNet,
      },
    });
    carryIn = r.carryoverOutMinutes;
  }
}

// ─── Time entries (admin) ─────────────────────────────────────────────────

interface TimeEntryInput {
  date: Date;
  minutes: number;
  description: string;
  billable: boolean;
}

export async function addTimeEntry(
  companyId: string,
  input: TimeEntryInput,
  createdById: string,
) {
  const period = await getOrCreatePeriod(companyId, input.date);
  const entry = await prisma.timeEntry.create({
    data: {
      companyId,
      periodId: period.id,
      date: input.date,
      minutes: input.minutes,
      description: input.description,
      billable: input.billable,
      createdById,
    },
  });
  await recalcChain(companyId, period.year, period.month);
  return entry;
}

export async function updateTimeEntry(
  id: string,
  patch: Partial<TimeEntryInput>,
) {
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Time entry not found');

  const oldKey = periodKey(existing.date);
  const newDate = patch.date ?? existing.date;
  const newKey = periodKey(newDate);

  let periodId = existing.periodId;
  const monthChanged = oldKey.year !== newKey.year || oldKey.month !== newKey.month;
  if (monthChanged) {
    const newPeriod = await getOrCreatePeriod(existing.companyId, newDate);
    periodId = newPeriod.id;
  }

  const entry = await prisma.timeEntry.update({
    where: { id },
    data: {
      date: patch.date ?? undefined,
      minutes: patch.minutes ?? undefined,
      description: patch.description ?? undefined,
      billable: patch.billable ?? undefined,
      periodId,
    },
  });

  // Recalc from the earliest affected month.
  const start = isBefore(oldKey.year, oldKey.month, newKey.year, newKey.month) ? oldKey : newKey;
  await recalcChain(existing.companyId, start.year, start.month);
  return entry;
}

export async function deleteTimeEntry(id: string) {
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Time entry not found');
  await prisma.timeEntry.delete({ where: { id } });
  const { year, month } = periodKey(existing.date);
  await recalcChain(existing.companyId, year, month);
  return existing;
}

export async function listTimeEntries(companyId: string, year: number, month: number) {
  const period = await prisma.servicePeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
  if (!period) return [];
  return prisma.timeEntry.findMany({
    where: { periodId: period.id },
    orderBy: { date: 'desc' },
    include: { createdBy: { select: { email: true } } },
  });
}

// ─── Periods / settlement (admin) ─────────────────────────────────────────

export async function listPeriods(companyId: string) {
  const periods = await prisma.servicePeriod.findMany({
    where: { companyId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  return periods.map((p) => ({
    ...p,
    availableMinutes: p.hoursIncluded * 60 + p.carryoverInMinutes,
  }));
}

export async function settlePeriod(id: string) {
  const period = await prisma.servicePeriod.findUnique({ where: { id } });
  if (!period) throw new AppError(404, 'NOT_FOUND', 'Service period not found');
  return prisma.servicePeriod.update({
    where: { id },
    data: { status: 'SETTLED', settledAt: new Date() },
  });
}

// ─── Hours view (admin per-client + client self) ──────────────────────────

export async function getHoursView(companyId: string, year: number, month: number) {
  const period = await prisma.servicePeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    include: { timeEntries: { orderBy: { date: 'desc' } } },
  });

  if (period) {
    return {
      year,
      month,
      plan: period.plan,
      hoursIncluded: period.hoursIncluded,
      carryoverInMinutes: period.carryoverInMinutes,
      consumedMinutes: period.consumedMinutes,
      availableMinutes: period.hoursIncluded * 60 + period.carryoverInMinutes,
      overageHours: period.overageHours,
      overageAmountNet: period.overageAmountNet,
      overageRatePerHour: period.overageRatePerHour,
      status: period.status,
      entries: period.timeEntries,
    };
  }

  // No period yet (no time logged this month) — synthesize from the plan so
  // the client still sees "0 of N h used".
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company?.servicePlan) return null;
  const pkg = await getPackageOrThrow(company.servicePlan);
  const carryoverInMinutes = await priorCarryoverMinutes(companyId, year, month);
  return {
    year,
    month,
    plan: company.servicePlan,
    hoursIncluded: pkg.hoursIncluded,
    carryoverInMinutes,
    consumedMinutes: 0,
    availableMinutes: pkg.hoursIncluded * 60 + carryoverInMinutes,
    overageHours: '0.00',
    overageAmountNet: '0.00',
    overageRatePerHour: pkg.overageRatePerHour,
    status: 'OPEN' as const,
    entries: [],
  };
}

// ─── Onboarding checklist (admin) ─────────────────────────────────────────

const ONBOARDING_STEPS = [
  'accessCollected',
  'remoteToolReady',
  'monitoringSet',
  'backupSet',
  'docsCreated',
] as const;
type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export async function getOnboarding(companyId: string) {
  return prisma.companyOnboarding.upsert({
    where: { companyId },
    update: {},
    create: { companyId },
  });
}

export async function updateOnboarding(
  companyId: string,
  patch: Partial<Record<OnboardingStep, boolean>> & { completed?: boolean; notes?: string },
) {
  const data: {
    accessCollected?: Date | null;
    remoteToolReady?: Date | null;
    monitoringSet?: Date | null;
    backupSet?: Date | null;
    docsCreated?: Date | null;
    completedAt?: Date | null;
    notes?: string;
  } = {};
  for (const step of ONBOARDING_STEPS) {
    if (step in patch && patch[step] !== undefined) {
      data[step] = patch[step] ? new Date() : null;
    }
  }
  if ('completed' in patch && patch.completed !== undefined) {
    data.completedAt = patch.completed ? new Date() : null;
  }
  if (patch.notes !== undefined) data.notes = patch.notes;

  return prisma.companyOnboarding.upsert({
    where: { companyId },
    update: data,
    create: { companyId, ...data },
  });
}

// ─── Clients list (admin dashboard) ───────────────────────────────────────

export async function listClients() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  // All client companies (active and not) so admins can activate a fresh
  // client by setting their plan. Inactive ones simply have servicePlan=null.
  const companies = await prisma.company.findMany({
    include: {
      onboarding: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const currentPeriods = await prisma.servicePeriod.findMany({
    where: { year, month, companyId: { in: companies.map((c) => c.id) } },
  });
  const byCompany = new Map(currentPeriods.map((p) => [p.companyId, p]));

  return companies.map((c) => {
    const p = byCompany.get(c.id);
    return {
      id: c.id,
      companyName: c.companyName,
      contactName: [c.contactFirstName, c.contactLastName].filter(Boolean).join(' '),
      email: c.user.email,
      servicePlan: c.servicePlan,
      serviceSince: c.serviceSince,
      onboardingComplete: Boolean(c.onboarding?.completedAt),
      currentMonth: p
        ? {
            consumedMinutes: p.consumedMinutes,
            availableMinutes: p.hoursIncluded * 60 + p.carryoverInMinutes,
            overageHours: p.overageHours,
            status: p.status,
          }
        : null,
    };
  });
}

// ─── Helper: resolve a client's own company ───────────────────────────────

export async function getCompanyIdForUser(userId: string) {
  const company = await prisma.company.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!company) throw new AppError(404, 'NO_COMPANY', 'No company linked to this account');
  return company.id;
}
