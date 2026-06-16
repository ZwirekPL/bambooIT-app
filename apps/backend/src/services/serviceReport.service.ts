import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { sendMonthlyHoursReportEmail, type MonthlyReportEntry } from '../utils/email';
import { captureException } from '../utils/sentry';

/**
 * OPS-5 — monthly hours report.
 *
 * sendPeriodReport: render + email one period's summary, stamp reportSentAt.
 * closeAndReportPreviousMonth: cron entry — finalize last month's periods
 * (OPEN → SETTLED when no overage, → TO_SETTLE when overage awaits invoice)
 * and email each client their report. Idempotent via reportSentAt.
 */

type PeriodWithRelations = Awaited<ReturnType<typeof loadPeriod>>;

function loadPeriod(periodId: string) {
  return prisma.servicePeriod.findUnique({
    where: { id: periodId },
    include: {
      company: { include: { user: { select: { email: true } } } },
      timeEntries: { orderBy: { date: 'asc' } },
    },
  });
}

async function emailReport(period: NonNullable<PeriodWithRelations>): Promise<void> {
  const entries: MonthlyReportEntry[] = period.timeEntries.map((e) => ({
    date: e.date.toISOString().slice(0, 10),
    minutes: e.minutes,
    description: e.description,
    billable: e.billable,
  }));

  await sendMonthlyHoursReportEmail(period.company.user.email, {
    year: period.year,
    month: period.month,
    consumedMinutes: period.consumedMinutes,
    availableMinutes: period.hoursIncluded * 60 + period.carryoverInMinutes,
    carryoverInMinutes: period.carryoverInMinutes,
    overageHours: String(period.overageHours),
    overageAmountNet: String(period.overageAmountNet),
    entries,
  });

  await prisma.servicePeriod.update({
    where: { id: period.id },
    data: { reportSentAt: new Date() },
  });
}

/** Ad-hoc: send (or resend) the report for one period. Throws on send failure. */
export async function sendPeriodReport(periodId: string) {
  const period = await loadPeriod(periodId);
  if (!period) throw new AppError(404, 'NOT_FOUND', 'Service period not found');
  await emailReport(period);
  return period;
}

/**
 * Cron: close the previous calendar month for all companies and email reports.
 * Per-period failures are caught + reported to Sentry so one bad email can't
 * abort the whole run.
 */
export async function closeAndReportPreviousMonth() {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // getUTCMonth() is 0-based → this is the *previous* month (1-12)
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const periods = await prisma.servicePeriod.findMany({
    where: { year, month },
    include: {
      company: { include: { user: { select: { email: true } } } },
      timeEntries: { orderBy: { date: 'asc' } },
    },
  });

  let closed = 0;
  let sent = 0;
  let failed = 0;

  for (const period of periods) {
    // Finalize OPEN periods; never touch manually-settled ones.
    if (period.status === 'OPEN') {
      const hasOverage = Number(period.overageAmountNet) > 0;
      await prisma.servicePeriod.update({
        where: { id: period.id },
        data: {
          status: hasOverage ? 'TO_SETTLE' : 'SETTLED',
          settledAt: hasOverage ? null : new Date(),
        },
      });
      closed++;
    }

    if (!period.reportSentAt) {
      try {
        await emailReport(period);
        sent++;
      } catch (err) {
        failed++;
        captureException(err as Error, { job: 'monthly-report', periodId: period.id });
      }
    }
  }

  return { year, month, periods: periods.length, closed, sent, failed };
}
