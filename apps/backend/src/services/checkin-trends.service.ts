import { prisma } from '@db';
import { Decimal } from '@prisma/client/runtime/library';

// ── Types ──────────────────────────────────────────────────────────

export interface WeightTrend {
  direction: 'losing' | 'gaining' | 'stable' | 'insufficient_data';
  weeklyRateKg: number | null; // avg kg change per week
  totalChangeKg: number | null;
  currentKg: number | null;
  startKg: number | null;
  dataPoints: number;
}

export interface PlateauInfo {
  isPlateauDetected: boolean;
  plateauWeeks: number; // how many consecutive weeks weight stayed within ±0.3 kg
}

export interface RapidLossAlert {
  isRapidLoss: boolean;
  weeklyLossKg: number | null; // actual loss per week (positive = losing)
  threshold: number; // max safe loss kg/week (1.0)
}

export interface MetricAverages {
  compliance: number | null;
  hunger: number | null;
  energy: number | null;
  sleep: number | null;
  activity: number | null;
}

export interface WeightDataPoint {
  date: string; // ISO date
  weightKg: number;
}

export interface CheckInTrends {
  weightTrend: WeightTrend;
  plateau: PlateauInfo;
  rapidLoss: RapidLossAlert;
  averages: MetricAverages;
  recentAverages: MetricAverages; // last 4 check-ins
  weightHistory: WeightDataPoint[];
  totalCheckIns: number;
}

// ── Constants ──────────────────────────────────────────────────────

const PLATEAU_THRESHOLD_KG = 0.3; // weight change within ±0.3 kg = plateau
const PLATEAU_MIN_WEEKS = 3; // need 3+ consecutive stable weeks
const RAPID_LOSS_THRESHOLD_KG_PER_WEEK = 1.0; // >1 kg/week = too fast
const STABLE_THRESHOLD_KG_PER_WEEK = 0.15; // <0.15 kg/week = stable

// ── Helpers ────────────────────────────────────────────────────────

function decimalToNumber(d: Decimal | null | undefined): number | null {
  if (d == null) return null;
  return Number(d);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function computeMetricAverages(
  checkIns: Array<{
    compliance: number | null;
    hunger: number | null;
    energy: number | null;
    sleep: number | null;
    activity: number | null;
  }>
): MetricAverages {
  return {
    compliance: avg(checkIns.filter((c) => c.compliance != null).map((c) => c.compliance!)),
    hunger: avg(checkIns.filter((c) => c.hunger != null).map((c) => c.hunger!)),
    energy: avg(checkIns.filter((c) => c.energy != null).map((c) => c.energy!)),
    sleep: avg(checkIns.filter((c) => c.sleep != null).map((c) => c.sleep!)),
    activity: avg(checkIns.filter((c) => c.activity != null).map((c) => c.activity!)),
  };
}

// ── Main function ──────────────────────────────────────────────────

export async function getCheckInTrends(patientId: string): Promise<CheckInTrends> {
  const checkIns = await prisma.checkIn.findMany({
    where: { patientId },
    orderBy: { createdAt: 'asc' },
    take: 52, // max 1 year of weekly check-ins
  });

  const totalCheckIns = checkIns.length;

  // Weight data points (only check-ins with weight)
  const weightEntries = checkIns
    .filter((c) => c.weightKg != null)
    .map((c) => ({
      date: c.createdAt.toISOString().split('T')[0],
      weightKg: decimalToNumber(c.weightKg)!,
      createdAt: c.createdAt,
    }));

  // ── Weight trend ─────────────────────────────────────────────

  let weightTrend: WeightTrend;

  if (weightEntries.length < 2) {
    weightTrend = {
      direction: 'insufficient_data',
      weeklyRateKg: null,
      totalChangeKg: null,
      currentKg: weightEntries.length === 1 ? weightEntries[0].weightKg : null,
      startKg: weightEntries.length === 1 ? weightEntries[0].weightKg : null,
      dataPoints: weightEntries.length,
    };
  } else {
    const first = weightEntries[0];
    const last = weightEntries[weightEntries.length - 1];
    const totalChangeKg = Math.round((last.weightKg - first.weightKg) * 100) / 100;
    const diffMs = last.createdAt.getTime() - first.createdAt.getTime();
    const diffWeeks = Math.max(diffMs / (7 * 24 * 60 * 60 * 1000), 1);
    const weeklyRateKg = Math.round((totalChangeKg / diffWeeks) * 100) / 100;

    let direction: WeightTrend['direction'];
    if (Math.abs(weeklyRateKg) < STABLE_THRESHOLD_KG_PER_WEEK) {
      direction = 'stable';
    } else if (weeklyRateKg < 0) {
      direction = 'losing';
    } else {
      direction = 'gaining';
    }

    weightTrend = {
      direction,
      weeklyRateKg,
      totalChangeKg,
      currentKg: last.weightKg,
      startKg: first.weightKg,
      dataPoints: weightEntries.length,
    };
  }

  // ── Plateau detection ────────────────────────────────────────

  let plateau: PlateauInfo = { isPlateauDetected: false, plateauWeeks: 0 };

  if (weightEntries.length >= PLATEAU_MIN_WEEKS) {
    // Check from most recent backwards
    let consecutiveStable = 0;
    const latest = weightEntries[weightEntries.length - 1].weightKg;

    for (let i = weightEntries.length - 2; i >= 0; i--) {
      if (Math.abs(weightEntries[i].weightKg - latest) <= PLATEAU_THRESHOLD_KG) {
        consecutiveStable++;
      } else {
        break;
      }
    }

    // +1 because we count from latest which is also a data point
    const plateauWeeks = consecutiveStable + 1;

    if (plateauWeeks >= PLATEAU_MIN_WEEKS) {
      plateau = { isPlateauDetected: true, plateauWeeks };
    }
  }

  // ── Rapid loss alert ─────────────────────────────────────────

  let rapidLoss: RapidLossAlert = {
    isRapidLoss: false,
    weeklyLossKg: null,
    threshold: RAPID_LOSS_THRESHOLD_KG_PER_WEEK,
  };

  // Use last 4 weeks of data for recent rate
  if (weightEntries.length >= 2) {
    const recentWeights = weightEntries.slice(-4);
    const firstRecent = recentWeights[0];
    const lastRecent = recentWeights[recentWeights.length - 1];
    const changKg = firstRecent.weightKg - lastRecent.weightKg; // positive = losing
    const diffMs = lastRecent.createdAt.getTime() - firstRecent.createdAt.getTime();
    const diffWeeks = Math.max(diffMs / (7 * 24 * 60 * 60 * 1000), 1);
    const weeklyLossKg = Math.round((changKg / diffWeeks) * 100) / 100;

    rapidLoss = {
      isRapidLoss: weeklyLossKg > RAPID_LOSS_THRESHOLD_KG_PER_WEEK,
      weeklyLossKg,
      threshold: RAPID_LOSS_THRESHOLD_KG_PER_WEEK,
    };
  }

  // ── Metric averages ──────────────────────────────────────────

  const averages = computeMetricAverages(checkIns);
  const recentCheckIns = checkIns.slice(-4);
  const recentAverages = computeMetricAverages(recentCheckIns);

  // ── Weight history for chart ─────────────────────────────────

  const weightHistory: WeightDataPoint[] = weightEntries.map((w) => ({
    date: w.date,
    weightKg: w.weightKg,
  }));

  return {
    weightTrend,
    plateau,
    rapidLoss,
    averages,
    recentAverages,
    weightHistory,
    totalCheckIns,
  };
}
