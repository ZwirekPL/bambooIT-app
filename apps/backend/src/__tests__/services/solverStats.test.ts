/**
 * Faza D Phase 2 prep — tests for solverStats.service.ts aggregation.
 *
 * Mocks `prisma.dietPlan.findMany` with controlled `policyMetadata.solverReport`
 * payloads and asserts the aggregator produces correct percentiles, status
 * histogram, compose-mode breakdown, and per-patient summary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vitest hoists `vi.mock` factories above top-level `const` declarations,
// so anything referenced inside must live in `vi.hoisted` to be available
// at hoist time. Without this we get "Cannot access ... before initialization".
const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: {
    dietPlan: {
      findMany: mockFindMany,
    },
  },
}));

import { computeSolverStats } from '../../services/solverStats.service';

interface ReportShape {
  status?: string;
  durationMs?: number;
  composeMeals?: boolean;
  composeSlotsCount?: number;
  multiItemSlotCount?: number;
  objectiveValue?: number;
  cuisineMatchCount?: number | null;
  cuisineMainTotal?: number | null;
}

function planRow(patientId: string, report: ReportShape | null) {
  return {
    patientId,
    policyMetadata: report ? { solverReport: report } : {},
  };
}

beforeEach(() => {
  mockFindMany.mockReset();
});

// ─── 1. Empty / no-data inputs ────────────────────────────────────────────

describe('computeSolverStats — empty / null payloads', () => {
  it('returns zero stats when no plans match', async () => {
    mockFindMany.mockResolvedValue([]);
    const stats = await computeSolverStats({ days: 7 });

    expect(stats.totalPlans).toBe(0);
    expect(stats.plansWithoutSolverReport).toBe(0);
    expect(stats.statusHistogram).toEqual({});
    expect(stats.durationMs.count).toBe(0);
    expect(stats.composeMode.activeCount).toBe(0);
    expect(stats.composeMode.activeRate).toBe(0);
  });

  it('counts plans without solverReport separately from plans with one', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { status: 'OPTIMAL', durationMs: 1000 }),
      planRow('p2', null),    // no solverReport
      planRow('p3', null),
    ]);
    const stats = await computeSolverStats();
    expect(stats.totalPlans).toBe(1);
    expect(stats.plansWithoutSolverReport).toBe(2);
  });
});

// ─── 2. Status histogram ──────────────────────────────────────────────────

describe('computeSolverStats — status histogram', () => {
  it('aggregates status counts uppercased', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { status: 'OPTIMAL', durationMs: 100 }),
      planRow('p1', { status: 'optimal', durationMs: 200 }),   // case-insensitive
      planRow('p2', { status: 'FEASIBLE', durationMs: 300 }),
      planRow('p2', { status: 'INFEASIBLE', durationMs: 50 }),
      planRow('p3', { status: 'TIMEOUT', durationMs: 30000 }),
    ]);
    const stats = await computeSolverStats();
    expect(stats.statusHistogram).toEqual({
      OPTIMAL: 2,
      FEASIBLE: 1,
      INFEASIBLE: 1,
      TIMEOUT: 1,
    });
  });

  it('falls back to UNKNOWN when status is missing', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { durationMs: 100 }),   // no status
    ]);
    const stats = await computeSolverStats();
    expect(stats.statusHistogram).toEqual({ UNKNOWN: 1 });
  });
});

// ─── 3. Duration percentiles ──────────────────────────────────────────────

describe('computeSolverStats — duration percentiles', () => {
  it('computes P50 / P95 / P99 across runs', async () => {
    // 100 evenly-spaced durations 0..9900ms
    const rows = Array.from({ length: 100 }, (_, i) => planRow('p1', {
      status: 'OPTIMAL',
      durationMs: i * 100,
    }));
    mockFindMany.mockResolvedValue(rows);
    const stats = await computeSolverStats();

    expect(stats.durationMs.count).toBe(100);
    expect(stats.durationMs.min).toBe(0);
    expect(stats.durationMs.max).toBe(9900);
    // P50 = ~4950, P95 = ~9405, P99 = ~9801 (linear interpolation)
    expect(stats.durationMs.p50).toBeGreaterThanOrEqual(4900);
    expect(stats.durationMs.p50).toBeLessThanOrEqual(5000);
    expect(stats.durationMs.p95).toBeGreaterThanOrEqual(9400);
    expect(stats.durationMs.p95).toBeLessThanOrEqual(9500);
    expect(stats.durationMs.p99).toBeGreaterThanOrEqual(9800);
  });

  it('skips invalid / missing durationMs values', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { status: 'OPTIMAL', durationMs: 100 }),
      planRow('p1', { status: 'OPTIMAL' }),    // missing
      planRow('p1', { status: 'OPTIMAL', durationMs: -50 }),    // invalid
      planRow('p1', { status: 'OPTIMAL', durationMs: 200 }),
    ]);
    const stats = await computeSolverStats();
    expect(stats.durationMs.count).toBe(2);
    expect(stats.durationMs.min).toBe(100);
    expect(stats.durationMs.max).toBe(200);
  });
});

// ─── 4. Compose-mode breakdown ────────────────────────────────────────────

describe('computeSolverStats — compose-mode breakdown', () => {
  it('counts compose-active runs + computes averages', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', {
        status: 'FEASIBLE', durationMs: 5000,
        composeMeals: true, composeSlotsCount: 2, multiItemSlotCount: 12,
      }),
      planRow('p1', {
        status: 'OPTIMAL', durationMs: 4000,
        composeMeals: true, composeSlotsCount: 2, multiItemSlotCount: 14,
      }),
      planRow('p2', {
        status: 'OPTIMAL', durationMs: 1000,
        composeMeals: false, composeSlotsCount: 0, multiItemSlotCount: 0,
      }),
    ]);
    const stats = await computeSolverStats();
    expect(stats.composeMode.activeCount).toBe(2);
    expect(stats.composeMode.activeRate).toBeCloseTo(2 / 3, 2);
    expect(stats.composeMode.avgComposeSlotsCount).toBe(2);
    expect(stats.composeMode.avgMultiItemSlotCount).toBe(13);   // (12+14)/2
    expect(stats.composeMode.failuresInComposeMode).toBe(0);
  });

  it('tallies failuresInComposeMode for INFEASIBLE / TIMEOUT / ERROR', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', {
        status: 'INFEASIBLE', durationMs: 100,
        composeMeals: true, composeSlotsCount: 2, multiItemSlotCount: 0,
      }),
      planRow('p1', {
        status: 'TIMEOUT', durationMs: 30000,
        composeMeals: true, composeSlotsCount: 2, multiItemSlotCount: 0,
      }),
      planRow('p1', {
        status: 'ERROR', durationMs: 50,
        composeMeals: true, composeSlotsCount: 2, multiItemSlotCount: 0,
      }),
      planRow('p1', {
        status: 'FEASIBLE', durationMs: 4000,
        composeMeals: true, composeSlotsCount: 2, multiItemSlotCount: 10,
      }),
    ]);
    const stats = await computeSolverStats();
    expect(stats.composeMode.activeCount).toBe(4);
    expect(stats.composeMode.failuresInComposeMode).toBe(3);
  });
});

// ─── 5. Per-patient summary ───────────────────────────────────────────────

describe('computeSolverStats — perPatient breakdown', () => {
  it('returns per-patient breakdown when patientId NOT supplied', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { status: 'OPTIMAL', durationMs: 1000, composeMeals: true }),
      planRow('p1', { status: 'FEASIBLE', durationMs: 5000, composeMeals: true }),
      planRow('p2', { status: 'OPTIMAL', durationMs: 800 }),
    ]);
    const stats = await computeSolverStats();

    expect(stats.perPatient).toBeDefined();
    expect(stats.perPatient).toHaveLength(2);
    const p1 = stats.perPatient!.find((x) => x.patientId === 'p1');
    expect(p1).toBeDefined();
    expect(p1!.plans).toBe(2);
    expect(p1!.composeRuns).toBe(2);
    expect(p1!.statusBreakdown).toEqual({ OPTIMAL: 1, FEASIBLE: 1 });
    expect(p1!.medianDurationMs).toBe(3000);   // (1000+5000)/2
  });

  it('omits perPatient when patientId is supplied (filtered query)', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { status: 'OPTIMAL', durationMs: 1000 }),
    ]);
    const stats = await computeSolverStats({ patientId: 'p1' });
    expect(stats.perPatient).toBeUndefined();
  });

  it('sorts perPatient by plan count descending', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p_low', { status: 'OPTIMAL', durationMs: 1000 }),
      planRow('p_high', { status: 'OPTIMAL', durationMs: 1000 }),
      planRow('p_high', { status: 'OPTIMAL', durationMs: 1000 }),
      planRow('p_high', { status: 'OPTIMAL', durationMs: 1000 }),
      planRow('p_mid', { status: 'OPTIMAL', durationMs: 1000 }),
      planRow('p_mid', { status: 'OPTIMAL', durationMs: 1000 }),
    ]);
    const stats = await computeSolverStats();
    expect(stats.perPatient!.map((x) => x.patientId)).toEqual(['p_high', 'p_mid', 'p_low']);
  });
});

// ─── 6. Window + filter ───────────────────────────────────────────────────

describe('computeSolverStats — window + patient filter', () => {
  it('passes days window into prisma `where` clause', async () => {
    mockFindMany.mockResolvedValue([]);
    await computeSolverStats({ days: 14 });
    const call = mockFindMany.mock.calls[0]?.[0];
    expect(call.where.createdAt.gte).toBeInstanceOf(Date);

    const expectedStart = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const actualStart = (call.where.createdAt.gte as Date).getTime();
    expect(Math.abs(actualStart - expectedStart)).toBeLessThan(1000);
  });

  it('passes patientId filter into prisma where clause when supplied', async () => {
    mockFindMany.mockResolvedValue([]);
    await computeSolverStats({ patientId: 'patient_xyz' });
    const call = mockFindMany.mock.calls[0]?.[0];
    expect(call.where.patientId).toBe('patient_xyz');
  });

  it('windowStart and windowEnd in response are valid ISO strings', async () => {
    mockFindMany.mockResolvedValue([]);
    const stats = await computeSolverStats({ days: 7 });
    expect(() => new Date(stats.windowStart).toISOString()).not.toThrow();
    expect(() => new Date(stats.windowEnd).toISOString()).not.toThrow();
    const start = new Date(stats.windowStart).getTime();
    const end = new Date(stats.windowEnd).getTime();
    expect(end - start).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(end - start).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
  });
});

// ─── 7. Cuisine coverage aggregation (Faza D D1 revisited) ────────────────

describe('computeSolverStats — cuisine coverage', () => {
  it('reports zero coverage when no plans had active cuisine prefs', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { status: 'OPTIMAL', durationMs: 100 }),
      planRow('p2', { status: 'FEASIBLE', durationMs: 200 }),
    ]);
    const stats = await computeSolverStats({ days: 7 });
    expect(stats.cuisine.plansEvaluated).toBe(0);
    expect(stats.cuisine.totalMatched).toBe(0);
    expect(stats.cuisine.totalMain).toBe(0);
    expect(stats.cuisine.coveragePercent).toBe(0);
    expect(stats.cuisine.plansBelowTarget).toBe(0);
    // Histogram still emitted with 5 zero bins so frontend doesn't crash on
    // missing fields.
    expect(stats.cuisine.coverageHistogram).toHaveLength(5);
    expect(stats.cuisine.coverageHistogram.every((b) => b.count === 0)).toBe(true);
  });

  it('aggregates matched / main / coverage correctly', async () => {
    mockFindMany.mockResolvedValue([
      // 7/7 matches → 100%
      planRow('p1', { status: 'OPTIMAL', cuisineMatchCount: 7, cuisineMainTotal: 7 }),
      // 4/7 matches → ~57% (below 60% target)
      planRow('p2', { status: 'OPTIMAL', cuisineMatchCount: 4, cuisineMainTotal: 7 }),
      // 6/7 matches → ~86%
      planRow('p3', { status: 'OPTIMAL', cuisineMatchCount: 6, cuisineMainTotal: 7 }),
      // No cuisine prefs (cuisineMainTotal=null) — should be excluded from
      // aggregate, but the plan still counts in totalPlans.
      planRow('p4', { status: 'OPTIMAL' }),
    ]);
    const stats = await computeSolverStats({ days: 7 });
    expect(stats.totalPlans).toBe(4);
    expect(stats.cuisine.plansEvaluated).toBe(3);
    expect(stats.cuisine.totalMatched).toBe(17);
    expect(stats.cuisine.totalMain).toBe(21);
    // 17/21 = 0.8095 → 81.0% (rounded to 1 decimal)
    expect(stats.cuisine.coveragePercent).toBeCloseTo(81.0, 1);
    expect(stats.cuisine.plansBelowTarget).toBe(1); // p2 only (4/7 = 57%)
  });

  it('builds coverage histogram in 20%-wide bins', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { cuisineMatchCount: 0, cuisineMainTotal: 5 }),  // 0% → bin 0
      planRow('p2', { cuisineMatchCount: 1, cuisineMainTotal: 5 }),  // 20% → bin 1
      planRow('p3', { cuisineMatchCount: 2, cuisineMainTotal: 5 }),  // 40% → bin 2
      planRow('p4', { cuisineMatchCount: 3, cuisineMainTotal: 5 }),  // 60% → bin 3
      planRow('p5', { cuisineMatchCount: 4, cuisineMainTotal: 5 }),  // 80% → bin 4
      planRow('p6', { cuisineMatchCount: 5, cuisineMainTotal: 5 }),  // 100% → bin 4 (clamped to last)
    ]);
    const stats = await computeSolverStats({ days: 7 });
    expect(stats.cuisine.coverageHistogram.map((b) => b.count)).toEqual([1, 1, 1, 1, 2]);
    expect(stats.cuisine.coverageHistogram[0]!.bin).toBe('0-20%');
    expect(stats.cuisine.coverageHistogram[4]!.bin).toBe('80-100%');
  });

  it('counts plansBelowTarget against the 60% soft target', async () => {
    mockFindMany.mockResolvedValue([
      planRow('p1', { cuisineMatchCount: 1, cuisineMainTotal: 5 }), // 20% — below
      planRow('p2', { cuisineMatchCount: 2, cuisineMainTotal: 5 }), // 40% — below
      planRow('p3', { cuisineMatchCount: 3, cuisineMainTotal: 5 }), // 60% — at target (NOT below)
      planRow('p4', { cuisineMatchCount: 4, cuisineMainTotal: 5 }), // 80% — above
    ]);
    const stats = await computeSolverStats({ days: 7 });
    expect(stats.cuisine.plansBelowTarget).toBe(2);
  });
});
