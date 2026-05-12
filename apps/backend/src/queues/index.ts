import { Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq';

// ─── Redis connection (reuse from docker-compose, port 6379) ─────────────────

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
  };
}

export const redisConnection: ConnectionOptions = parseRedisUrl(REDIS_URL);

// ─── Queue names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  MAINTENANCE: 'maintenance',
} as const;

// ─── Default job options per queue ───────────────────────────────────────────

export const JOB_OPTIONS: Record<string, JobsOptions> = {
  [QUEUE_NAMES.MAINTENANCE]: {
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
};

// ─── Queues ──────────────────────────────────────────────────────────────────

/** Maintenance queue — cron-like repeatable jobs: user cleanup, audit retention, etc. */
export const maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
  connection: redisConnection,
  defaultJobOptions: JOB_OPTIONS[QUEUE_NAMES.MAINTENANCE],
});

// ─── Worker registry (for graceful shutdown) ─────────────────────────────────

const registeredWorkers: Worker[] = [];

export function registerWorker(worker: Worker): void {
  registeredWorkers.push(worker);
}

export async function shutdownQueues(): Promise<void> {
  console.log('[queues] Graceful shutdown: closing workers and queues...');

  await Promise.allSettled(registeredWorkers.map((w) => w.close()));
  await maintenanceQueue.close();

  console.log('[queues] All workers and queues closed.');
}
