/**
 * Faza D Phase 2 prep — solver metrics aggregation for /admin/solver-stats.
 *
 * Reads `DietPlan.policyMetadata.solverReport` (written by `planPipeline`
 * when `dbDietMode === 'DB_SOLVER'`) and produces per-window aggregations
 * suitable for shadow-rollout daily review:
 *   * solver duration percentiles (P50 / P95 / P99)
 *   * status histogram (OPTIMAL / FEASIBLE / INFEASIBLE / TIMEOUT / ERROR)
 *   * compose-mode rate + average multi-item slot count when active
 *   * per-patient breakdown (optional filter)
 *
 * Source-of-truth shape (mirrors planPipeline.service.ts:solverMeta):
 *   {
 *     status: string,
 *     objectiveValue: number,
 *     variables: number,
 *     constraints: number,
 *     durationMs: number,
 *     composeMeals: boolean,
 *     composeSlotsCount: number,
 *     multiItemSlotCount: number,
 *     cuisineMatchCount: number | null,
 *     cuisineMainTotal: number | null,
 *   }
 */

import { prisma } from '@db';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SolverStatsRequest {
  /** Window size in days from "now" backwards. Default 7. */
  days?: number;
  /** Optional patient filter — useful for shadow rollout review. */
  patientId?: string;
}

export interface SolverStatsResponse {
  /** Window covered (Date strings, ISO 8601). */
  windowStart: string;
  windowEnd: string;
  /** Total plans WITH solverReport in policyMetadata. */
  totalPlans: number;
  /** Plans WITHOUT solverReport (likely greedy fallback or pre-DB-solver). */
  plansWithoutSolverReport: number;
  /** Status histogram. Keys are normalized solver statuses. */
  statusHistogram: Record<string, number>;
  /** Solver duration in ms — percentiles across all plans with solverReport. */
  durationMs: {
    count: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  /** Compose-mode breakdown. */
  composeMode: {
    /** Count of plans run with composeMeals=true. */
    activeCount: number;
    /** Share of active runs vs total plans (0..1). */
    activeRate: number;
    /** Average # of compose slots when active. */
    avgComposeSlotsCount: number;
    /** Average # of multi-item slots when compose active (== how many slots actually emitted ≥2 items). */
    avgMultiItemSlotCount: number;
    /** Count of compose-active runs that ended INFEASIBLE / TIMEOUT / ERROR. */
    failuresInComposeMode: number;
  };
  /**
   * Cuisine soft-constraint coverage (Faza D D1 revisited). Aggregated only
   * over plans where SC22 was active (cuisineMainTotal > 0 — i.e. patient
   * cuisinePreferences are not empty / "any"). When no plans had active
   * cuisine prefs, all fields are 0 and `plansEvaluated` reports it.
   */
  cuisine: {
    /** Plans with cuisine_target_pct active (cuisineMainTotal > 0). */
    plansEvaluated: number;
    /** Σ cuisineMatchCount across evaluated plans. */
    totalMatched: number;
    /** Σ cuisineMainTotal across evaluated plans. */
    totalMain: number;
    /** Aggregated coverage % across all matched/main slots (0..100). */
    coveragePercent: number;
    /** Plans whose individual coverage fell below 60% target. */
    plansBelowTarget: number;
    /**
     * Histogram of per-plan coverage ratios in 20%-wide bins. Useful to spot
     * a long tail of "almost zero match" plans even when the aggregate looks
     * fine. Keys map to the lower bound (e.g. "0-20%").
     */
    coverageHistogram: Array<{ bin: string; count: number }>;
  };
  /** Per-patient summary — only present when patientId NOT supplied. */
  perPatient?: Array<{
    patientId: string;
    plans: number;
    composeRuns: number;
    statusBreakdown: Record<string, number>;
    medianDurationMs: number;
  }>;
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface SolverReportShape {
  status?: string;
  objectiveValue?: number;
  variables?: number;
  constraints?: number;
  durationMs?: number;
  composeMeals?: boolean;
  composeSlotsCount?: number;
  multiItemSlotCount?: number;
  cuisineMatchCount?: number | null;
  cuisineMainTotal?: number | null;
}

interface PlanRow {
  patientId: string;
  policyMetadata: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractSolverReport(plan: PlanRow): SolverReportShape | null {
  const meta = plan.policyMetadata;
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  const report = m.solverReport;
  if (!report || typeof report !== 'object') return null;
  return report as SolverReportShape;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

// ─── Main aggregation ────────────────────────────────────────────────────────

export async function computeSolverStats(
  req: SolverStatsRequest = {},
): Promise<SolverStatsResponse> {
  const days = req.days ?? 7;
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);

  const where: { createdAt: { gte: Date }; patientId?: string } = {
    createdAt: { gte: windowStart },
  };
  if (req.patientId) where.patientId = req.patientId;

  const plans = await prisma.dietPlan.findMany({
    where,
    select: { patientId: true, policyMetadata: true },
    orderBy: { createdAt: 'desc' },
  });

  const reportsWithPatient: Array<{ patientId: string; report: SolverReportShape }> = [];
  let plansWithoutSolverReport = 0;
  for (const plan of plans) {
    const report = extractSolverReport(plan);
    if (!report) {
      plansWithoutSolverReport++;
      continue;
    }
    reportsWithPatient.push({ patientId: plan.patientId, report });
  }

  const reports = reportsWithPatient.map((r) => r.report);

  // ── Status histogram ──────────────────────────────────────────────────
  const statusHistogram: Record<string, number> = {};
  for (const r of reports) {
    const status = (r.status ?? 'UNKNOWN').toString().toUpperCase();
    statusHistogram[status] = (statusHistogram[status] ?? 0) + 1;
  }

  // ── Duration percentiles ─────────────────────────────────────────────
  const durations = reports
    .map((r) => r.durationMs)
    .filter((d): d is number => typeof d === 'number' && d >= 0)
    .sort((a, b) => a - b);

  const durationMs = {
    count: durations.length,
    p50: Math.round(percentile(durations, 50)),
    p95: Math.round(percentile(durations, 95)),
    p99: Math.round(percentile(durations, 99)),
    min: durations[0] ?? 0,
    max: durations[durations.length - 1] ?? 0,
  };

  // ── Compose-mode breakdown ───────────────────────────────────────────
  const composeReports = reports.filter((r) => r.composeMeals === true);
  const failureStatuses = new Set(['INFEASIBLE', 'TIMEOUT', 'ERROR']);
  const failuresInComposeMode = composeReports.filter((r) =>
    failureStatuses.has((r.status ?? '').toUpperCase()),
  ).length;
  const sumComposeSlots = composeReports.reduce(
    (s, r) => s + (r.composeSlotsCount ?? 0),
    0,
  );
  const sumMultiItemSlots = composeReports.reduce(
    (s, r) => s + (r.multiItemSlotCount ?? 0),
    0,
  );

  const composeMode = {
    activeCount: composeReports.length,
    activeRate: reports.length > 0
      ? Math.round((composeReports.length / reports.length) * 1000) / 1000
      : 0,
    avgComposeSlotsCount: composeReports.length > 0
      ? Math.round((sumComposeSlots / composeReports.length) * 100) / 100
      : 0,
    avgMultiItemSlotCount: composeReports.length > 0
      ? Math.round((sumMultiItemSlots / composeReports.length) * 100) / 100
      : 0,
    failuresInComposeMode,
  };

  // ── Cuisine coverage (Faza D D1 revisited) ───────────────────────────
  // Only plans where SC22 was active count toward the aggregate. Below-
  // target threshold mirrors the solver's CUISINE_TARGET_PCT=0.6 in
  // weekSolver.service.ts so dashboard alerts line up with the constraint.
  const CUISINE_TARGET_RATIO = 0.6;
  const CUISINE_BIN_WIDTH = 0.2;
  const cuisineReports = reports.filter(
    (r) => typeof r.cuisineMainTotal === 'number' && r.cuisineMainTotal > 0,
  );
  const totalMatched = cuisineReports.reduce(
    (s, r) => s + (r.cuisineMatchCount ?? 0),
    0,
  );
  const totalMain = cuisineReports.reduce(
    (s, r) => s + (r.cuisineMainTotal ?? 0),
    0,
  );
  const plansBelowTarget = cuisineReports.filter((r) => {
    const m = r.cuisineMainTotal ?? 0;
    if (m <= 0) return false;
    return ((r.cuisineMatchCount ?? 0) / m) < CUISINE_TARGET_RATIO;
  }).length;
  // 5 bins: 0-20, 20-40, 40-60, 60-80, 80-100 (%).
  // Compute the bin index in integer percent space so 0.6/0.2 doesn't fall
  // into bin 2 due to IEEE 754 (0.6 / 0.2 === 2.9999999999999996).
  const histogramBuckets = [0, 0, 0, 0, 0];
  for (const r of cuisineReports) {
    const pctInt = Math.round(((r.cuisineMatchCount ?? 0) / (r.cuisineMainTotal ?? 1)) * 100);
    const idx = Math.min(Math.floor(pctInt / 20), histogramBuckets.length - 1);
    histogramBuckets[idx]! += 1;
  }
  const coverageHistogram = histogramBuckets.map((count, i) => ({
    bin: `${i * 20}-${(i + 1) * 20}%`,
    count,
  }));
  const cuisine = {
    plansEvaluated: cuisineReports.length,
    totalMatched,
    totalMain,
    coveragePercent: totalMain > 0
      ? Math.round((totalMatched / totalMain) * 1000) / 10
      : 0,
    plansBelowTarget,
    coverageHistogram,
  };

  // ── Per-patient summary (only when not filtering by patientId) ────────
  let perPatient: SolverStatsResponse['perPatient'];
  if (!req.patientId) {
    const byPatient = new Map<string, { reports: SolverReportShape[] }>();
    for (const { patientId, report } of reportsWithPatient) {
      const entry = byPatient.get(patientId) ?? { reports: [] };
      entry.reports.push(report);
      byPatient.set(patientId, entry);
    }
    perPatient = Array.from(byPatient.entries()).map(([patientId, { reports: rs }]) => {
      const statusBreakdown: Record<string, number> = {};
      for (const r of rs) {
        const status = (r.status ?? 'UNKNOWN').toString().toUpperCase();
        statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1;
      }
      const patientDurations = rs
        .map((r) => r.durationMs)
        .filter((d): d is number => typeof d === 'number' && d >= 0)
        .sort((a, b) => a - b);
      return {
        patientId,
        plans: rs.length,
        composeRuns: rs.filter((r) => r.composeMeals === true).length,
        statusBreakdown,
        medianDurationMs: Math.round(percentile(patientDurations, 50)),
      };
    }).sort((a, b) => b.plans - a.plans);
  }

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalPlans: reports.length,
    plansWithoutSolverReport,
    statusHistogram,
    durationMs,
    composeMode,
    cuisine,
    perPatient,
  };
}
