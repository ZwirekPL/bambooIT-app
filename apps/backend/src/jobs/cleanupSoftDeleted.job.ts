import { Worker } from 'bullmq';
import {
  QUEUE_NAMES,
  maintenanceQueue,
  redisConnection,
  registerWorker,
} from '../queues';
import { runUserCleanupJob } from '../services/userCleanup.service';
import { runAuditRetentionJob } from '../services/auditRetention.service';
import { closeAndReportPreviousMonth } from '../services/serviceReport.service';
import { captureException } from '../utils/sentry';

export const CLEANUP_USER_JOB_NAME = 'cleanup-soft-deleted-users';
export const AUDIT_PURGE_JOB_NAME = 'purge-expired-audit-logs';
export const MONTHLY_REPORT_JOB_NAME = 'monthly-hours-report';

const USER_CLEANUP_SCHEDULER_ID = 'cleanup-soft-deleted-users-daily';
const AUDIT_PURGE_SCHEDULER_ID = 'purge-expired-audit-logs-weekly';
const MONTHLY_REPORT_SCHEDULER_ID = 'monthly-hours-report';

const USER_CLEANUP_DEFAULT_CRON = '0 3 * * *';   // daily 03:00
const AUDIT_PURGE_DEFAULT_CRON  = '0 4 * * 0';   // Sunday 04:00
const MONTHLY_REPORT_DEFAULT_CRON = '0 9 1 * *'; // 1st of month 09:00

const TIMEZONE = process.env.JOB_SCHEDULER_TZ ?? 'Europe/Warsaw';

/**
 * Daily 03:00 — hard-delete users soft-deleted more than 30 days ago.
 * Idempotent — calling twice updates the same scheduler.
 * Override via env: CLEANUP_SOFT_DELETED_CRON.
 */
export async function scheduleUserCleanup(): Promise<void> {
  const pattern = process.env.CLEANUP_SOFT_DELETED_CRON ?? USER_CLEANUP_DEFAULT_CRON;
  await maintenanceQueue.upsertJobScheduler(
    USER_CLEANUP_SCHEDULER_ID,
    { pattern, tz: TIMEZONE },
    { name: CLEANUP_USER_JOB_NAME, data: {} },
  );
  console.log(`[cron:cleanup-user] Scheduled "${pattern}" (${TIMEZONE})`);
}

/**
 * Weekly Sunday 04:00 — purge AuditLog entries older than retention window.
 * Override via env: AUDIT_LOG_PURGE_CRON.
 */
export async function scheduleAuditRetention(): Promise<void> {
  const pattern = process.env.AUDIT_LOG_PURGE_CRON ?? AUDIT_PURGE_DEFAULT_CRON;
  await maintenanceQueue.upsertJobScheduler(
    AUDIT_PURGE_SCHEDULER_ID,
    { pattern, tz: TIMEZONE },
    { name: AUDIT_PURGE_JOB_NAME, data: {} },
  );
  console.log(`[cron:audit-purge] Scheduled "${pattern}" (${TIMEZONE})`);
}

/**
 * Monthly 1st 09:00 — close the previous month's hours periods and email each
 * client their report. Override via env: MONTHLY_REPORT_CRON.
 */
export async function scheduleMonthlyReport(): Promise<void> {
  const pattern = process.env.MONTHLY_REPORT_CRON ?? MONTHLY_REPORT_DEFAULT_CRON;
  await maintenanceQueue.upsertJobScheduler(
    MONTHLY_REPORT_SCHEDULER_ID,
    { pattern, tz: TIMEZONE },
    { name: MONTHLY_REPORT_JOB_NAME, data: {} },
  );
  console.log(`[cron:monthly-report] Scheduled "${pattern}" (${TIMEZONE})`);
}

/**
 * Starts the maintenance worker. Dispatches by job.name to the correct handler.
 */
export function startMaintenanceWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.MAINTENANCE,
    async (job) => {
      if (job.name === CLEANUP_USER_JOB_NAME) {
        const report = await runUserCleanupJob();
        console.log(
          `[cron:cleanup-user] run complete — found=${report.totalFound}, deleted=${report.deletedIds.length}, failed=${report.failed.length}`,
        );
        if (report.failed.length > 0) {
          console.error('[cron:cleanup-user] failures:', report.failed);
        }
        return report;
      }

      if (job.name === AUDIT_PURGE_JOB_NAME) {
        const report = await runAuditRetentionJob();
        console.log(
          `[cron:audit-purge] run complete — deleted=${report.totalDeleted}, batches=${report.batchesRun}, cutoff=${report.cutoff.toISOString()}`,
        );
        if (report.hitBatchLimit) {
          console.warn('[cron:audit-purge] batch limit hit — more rows pending, next run will continue');
        }
        return report;
      }

      if (job.name === MONTHLY_REPORT_JOB_NAME) {
        const report = await closeAndReportPreviousMonth();
        console.log(
          `[cron:monthly-report] run complete — periods=${report.periods}, closed=${report.closed}, sent=${report.sent}, failed=${report.failed} (${report.month}/${report.year})`,
        );
        return report;
      }

      console.warn(`[worker:maintenance] Unknown job name: ${job.name}`);
      return null;
    },
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker:maintenance] Job ${job?.id ?? '?'} (${job?.name ?? '?'}) failed:`, err);
    captureException(err, { jobName: job?.name, jobId: job?.id });
  });

  registerWorker(worker);
  console.log('[worker:maintenance] Maintenance worker started');
  return worker;
}
