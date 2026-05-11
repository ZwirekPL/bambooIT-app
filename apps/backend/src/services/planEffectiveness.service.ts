/**
 * Plan Effectiveness Score (PES) Service (79.4)
 *
 * PES = 0.35 × ComplianceRate + 0.25 × GoalProgress + 0.20 × PatientSatisfaction
 *     + 0.10 × Retention + 0.10 × MicroCoverage
 *
 * Each component is 0-100, final PES is 0-100.
 */

import { prisma, Prisma } from '@db';
import { decryptJson } from '../utils/encryption';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlanEffectivenessScore {
  planId: string;
  patientId: string;
  pes: number; // 0-100
  components: {
    complianceRate: number;
    goalProgress: number;
    patientSatisfaction: number;
    retention: number;
    microCoverage: number;
  };
  period: { from: string; to: string };
}

export interface RecipeEffectiveness {
  recipeId: string;
  title: string;
  avgRating: number;
  timesUsed: number;
  skipRate: number;
  pesContribution: number; // estimated impact on PES
}

// ─── PES Calculation ────────────────────────────────────────────────────────

function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

export async function computePlanEffectiveness(
  planId: string,
): Promise<PlanEffectivenessScore | null> {
  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      patientId: true,
      createdAt: true,
      policyMetadata: true,
    },
  });
  if (!plan) return null;

  const planDate = plan.createdAt;
  const now = new Date();
  const planDurationDays = Math.max(1, Math.ceil((now.getTime() - planDate.getTime()) / (1000 * 60 * 60 * 24)));
  const periodDays = Math.min(planDurationDays, 30); // cap at 30 days
  const periodFrom = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // ── 1. ComplianceRate (avg compliance from check-ins in period)
  const checkIns = await prisma.checkIn.findMany({
    where: {
      patientId: plan.patientId,
      createdAt: { gte: periodFrom },
      compliance: { not: null },
    },
    select: { compliance: true },
  });
  const complianceRate = checkIns.length > 0
    ? checkIns.reduce((sum, c) => sum + (c.compliance ?? 0), 0) / checkIns.length
    : 50; // default if no check-ins

  // ── 2. GoalProgress (weight stability / trend in right direction)
  let goalProgress = 50; // default — no goalWeight field yet, estimate from weight trend
  const weightCheckIns = await prisma.checkIn.findMany({
    where: { patientId: plan.patientId, weightKg: { not: null }, createdAt: { gte: periodFrom } },
    orderBy: { createdAt: 'asc' },
    select: { weightKg: true },
    take: 10,
  });
  if (weightCheckIns.length >= 2) {
    const first = toNum(weightCheckIns[0].weightKg);
    const last = toNum(weightCheckIns[weightCheckIns.length - 1].weightKg);
    // Assume losing weight is goal (most common) — stable or losing = good
    const diff = last - first;
    if (diff <= -1) goalProgress = 90;       // losing weight (>1kg)
    else if (diff <= 0) goalProgress = 70;   // stable
    else if (diff <= 1) goalProgress = 50;   // slight gain
    else goalProgress = 30;                   // gaining
  }

  // ── 3. PatientSatisfaction (avg recipe rating × 20)
  const ratings = await prisma.recipeRating.findMany({
    where: {
      patientId: plan.patientId,
      createdAt: { gte: periodFrom },
    },
    select: { rating: true },
  });
  const patientSatisfaction = ratings.length > 0
    ? Math.min(100, Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 20))
    : 50;

  // ── 4. Retention (distinct active days / period days)
  const activeDays = await prisma.checkIn.groupBy({
    by: ['createdAt'],
    where: {
      patientId: plan.patientId,
      createdAt: { gte: periodFrom },
    },
  });
  // Count distinct dates
  const uniqueDates = new Set(activeDays.map((d) => d.createdAt.toISOString().slice(0, 10)));
  const retention = Math.min(100, Math.round((uniqueDates.size / periodDays) * 100));

  // ── 5. MicroCoverage (from policyMetadata if available)
  let microCoverage = 50; // default
  const meta = plan.policyMetadata as Record<string, unknown> | null;
  if (meta?.planQuality) {
    const quality = meta.planQuality as { score?: number };
    if (quality.score != null) {
      microCoverage = Math.min(100, quality.score);
    }
  }

  // ── PES calculation
  const pes = Math.round(
    0.35 * complianceRate +
    0.25 * goalProgress +
    0.20 * patientSatisfaction +
    0.10 * retention +
    0.10 * microCoverage
  );

  return {
    planId,
    patientId: plan.patientId,
    pes: Math.min(100, Math.max(0, pes)),
    components: {
      complianceRate: Math.round(complianceRate),
      goalProgress: Math.round(goalProgress),
      patientSatisfaction: Math.round(patientSatisfaction),
      retention: Math.round(retention),
      microCoverage: Math.round(microCoverage),
    },
    period: {
      from: periodFrom.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    },
  };
}

// ─── Recipe Effectiveness ───────────────────────────────────────────────────

export async function getRecipeEffectiveness(
  dietitianId: string,
  limit = 20,
  sort: 'best' | 'worst' = 'best',
): Promise<RecipeEffectiveness[]> {
  // Get all recipes used in plans by this dietitian's patients
  const ratings = await prisma.recipeRating.groupBy({
    by: ['recipeId'],
    _avg: { rating: true },
    _count: true,
    orderBy: sort === 'best'
      ? { _avg: { rating: 'desc' } }
      : { _avg: { rating: 'asc' } },
    take: limit,
    having: { recipeId: { _count: { gte: 3 } } }, // at least 3 ratings
  });

  if (ratings.length === 0) return [];

  // Fetch recipe titles
  const recipeIds = ratings.map((r) => r.recipeId);
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: { id: true, title: true },
  });
  const titleMap = new Map(recipes.map((r) => [r.id, r.title]));

  return ratings.map((r) => ({
    recipeId: r.recipeId,
    title: titleMap.get(r.recipeId) ?? 'Unknown',
    avgRating: Math.round((r._avg.rating ?? 0) * 10) / 10,
    timesUsed: r._count,
    skipRate: 0, // would need compliance data per meal, simplified for now
    pesContribution: Math.round((r._avg.rating ?? 0) * 20), // rating × 20
  }));
}

// ─── Dietitian Analytics ────────────────────────────────────────────────────

export async function getDietitianAnalytics(dietitianId: string) {
  // Get all patients for this dietitian
  const patients = await prisma.patient.findMany({
    where: { dietitianId },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);

  if (patientIds.length === 0) {
    return { avgPes: 0, planCount: 0, patientCount: 0, pesScores: [] };
  }

  // Get latest plan per patient and compute PES
  const plans = await prisma.dietPlan.findMany({
    where: {
      patientId: { in: patientIds },
      status: { in: ['PUBLISHED', 'SENT', 'GENERATED', 'REVIEWED'] },
    },
    orderBy: { createdAt: 'desc' },
    distinct: ['patientId'],
    select: { id: true, patientId: true },
    take: 50,
  });

  const pesScores: PlanEffectivenessScore[] = [];
  for (const plan of plans) {
    const pes = await computePlanEffectiveness(plan.id);
    if (pes) pesScores.push(pes);
  }

  const avgPes = pesScores.length > 0
    ? Math.round(pesScores.reduce((sum, p) => sum + p.pes, 0) / pesScores.length)
    : 0;

  return {
    avgPes,
    planCount: plans.length,
    patientCount: patientIds.length,
    pesScores,
  };
}
