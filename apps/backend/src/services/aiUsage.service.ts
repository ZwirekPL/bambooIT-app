import { prisma, Prisma } from '@db';

// ─── Step Timer ──────────────────────────────────────────────────────────────

export interface StepTiming {
  step: string;
  durationMs: number;
}

export class PipelineTimer {
  private readonly start: number;
  private stepStart: number;
  private readonly timings: StepTiming[] = [];

  constructor() {
    this.start = Date.now();
    this.stepStart = this.start;
  }

  /** Mark end of a step, returns duration in ms */
  mark(stepName: string): number {
    const now = Date.now();
    const duration = now - this.stepStart;
    this.timings.push({ step: stepName, durationMs: duration });
    this.stepStart = now;
    return duration;
  }

  get totalMs(): number {
    return Date.now() - this.start;
  }

  get steps(): StepTiming[] {
    return [...this.timings];
  }
}

// ─── Log creation ────────────────────────────────────────────────────────────

export interface AiUsageInput {
  patientId: string;
  dietPlanId?: string;
  triggeredAt: Date;
  durationMs: number;
  source?: string;
  cached: boolean;
  n8nTriggered: boolean;
  aiTriggered?: boolean;
  blocked: boolean;
  validationStatus?: string;
  autoAdjusted: boolean;
  policyRulesCount: number;
  redFlagsCount: number;
  redFlagSeverity?: string;
  stepTimings: StepTiming[];
  error?: string;
  success: boolean;
  aiProvider?: string;
  aiModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
}

/** Fire-and-forget: logs AI usage without blocking the pipeline */
export function logAiUsage(input: AiUsageInput): void {
  prisma.aiUsageLog.create({
    data: {
      patientId: input.patientId,
      dietPlanId: input.dietPlanId,
      triggeredAt: input.triggeredAt,
      completedAt: new Date(),
      durationMs: input.durationMs,
      source: input.source,
      cached: input.cached,
      n8nTriggered: input.n8nTriggered,
      blocked: input.blocked,
      validationStatus: input.validationStatus,
      autoAdjusted: input.autoAdjusted,
      policyRulesCount: input.policyRulesCount,
      redFlagsCount: input.redFlagsCount,
      redFlagSeverity: input.redFlagSeverity,
      stepTimings: input.stepTimings as unknown as Prisma.InputJsonValue,
      error: input.error,
      success: input.success,
      aiProvider: input.aiProvider,
      aiModel: input.aiModel,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      estimatedCostUsd: input.estimatedCostUsd,
    },
  }).catch((err) => {
    console.error('[aiUsage] Failed to log usage:', err instanceof Error ? err.message : err);
  });
}

// ─── Admin queries ───────────────────────────────────────────────────────────

export interface AiUsageStats {
  totalGenerations: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
  cachedCount: number;
  n8nTriggeredCount: number;
  blockedCount: number;
  bySource: Record<string, number>;
  byValidationStatus: Record<string, number>;
}

export async function getAiUsageStats(days = 30): Promise<AiUsageStats> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await prisma.aiUsageLog.findMany({
    where: { triggeredAt: { gte: since } },
    select: {
      success: true,
      durationMs: true,
      cached: true,
      n8nTriggered: true,
      blocked: true,
      source: true,
      validationStatus: true,
    },
  });

  const totalGenerations = logs.length;
  const successCount = logs.filter(l => l.success).length;
  const errorCount = totalGenerations - successCount;
  const durations = logs.filter(l => l.durationMs != null).map(l => l.durationMs!);
  const avgDurationMs = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  const cachedCount = logs.filter(l => l.cached).length;
  const n8nTriggeredCount = logs.filter(l => l.n8nTriggered).length;
  const blockedCount = logs.filter(l => l.blocked).length;

  const bySource: Record<string, number> = {};
  for (const l of logs) {
    const key = l.source ?? 'unknown';
    bySource[key] = (bySource[key] ?? 0) + 1;
  }

  const byValidationStatus: Record<string, number> = {};
  for (const l of logs) {
    const key = l.validationStatus ?? 'unknown';
    byValidationStatus[key] = (byValidationStatus[key] ?? 0) + 1;
  }

  return {
    totalGenerations,
    successCount,
    errorCount,
    avgDurationMs,
    cachedCount,
    n8nTriggeredCount,
    blockedCount,
    bySource,
    byValidationStatus,
  };
}

export async function listAiUsageLogs(opts: {
  page?: number;
  limit?: number;
  patientId?: string;
  source?: string;
  success?: boolean;
}) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.AiUsageLogWhereInput = {};
  if (opts.patientId) where.patientId = opts.patientId;
  if (opts.source) where.source = opts.source;
  if (opts.success !== undefined) where.success = opts.success;

  const [logs, total] = await Promise.all([
    prisma.aiUsageLog.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
      skip,
      take: limit,
      include: {
        patient: {
          select: { firstName: true, lastName: true, userId: true },
        },
      },
    }),
    prisma.aiUsageLog.count({ where }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}
