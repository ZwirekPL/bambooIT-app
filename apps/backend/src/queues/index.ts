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
  DIET_GENERATE: 'diet-generate',
  DIET_REPAIR: 'diet-repair',
  DIET_PARTIAL: 'diet-partial',
  MAINTENANCE: 'maintenance',
} as const;

// ─── Default job options per queue ───────────────────────────────────────────

export const JOB_OPTIONS: Record<string, JobsOptions> = {
  [QUEUE_NAMES.DIET_GENERATE]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
  [QUEUE_NAMES.DIET_REPAIR]: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
  [QUEUE_NAMES.DIET_PARTIAL]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
  [QUEUE_NAMES.MAINTENANCE]: {
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
};

// ─── Queues ──────────────────────────────────────────────────────────────────

export const dietGenerateQueue = new Queue(QUEUE_NAMES.DIET_GENERATE, {
  connection: redisConnection,
  defaultJobOptions: JOB_OPTIONS[QUEUE_NAMES.DIET_GENERATE],
});

export const dietRepairQueue = new Queue(QUEUE_NAMES.DIET_REPAIR, {
  connection: redisConnection,
  defaultJobOptions: JOB_OPTIONS[QUEUE_NAMES.DIET_REPAIR],
});

export const dietPartialQueue = new Queue(QUEUE_NAMES.DIET_PARTIAL, {
  connection: redisConnection,
  defaultJobOptions: JOB_OPTIONS[QUEUE_NAMES.DIET_PARTIAL],
});

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

  // Close workers first (stop processing)
  await Promise.allSettled(registeredWorkers.map((w) => w.close()));

  // Close queues
  await Promise.allSettled([
    dietGenerateQueue.close(),
    dietRepairQueue.close(),
    dietPartialQueue.close(),
    maintenanceQueue.close(),
  ]);

  console.log('[queues] All workers and queues closed.');
}
