import { prisma } from '@db';
import { Decimal } from '@prisma/client/runtime/library';
import { decryptJson } from '../utils/encryption';

// ── Types ──────────────────────────────────────────────────────────

export interface MonthlyReport {
  month: string; // YYYY-MM
  dietitianId: string;
  patients: {
    total: number;
    newThisMonth: number;
  };
  plans: {
    generated: number;
    reviewed: number;
    published: number;
    manualReviewRequired: number;
  };
  compliance: {
    averagePercent: number | null; // 0-100
    checkInsCount: number;
    patientsWithCheckIns: number;
  };
  goalProgress: {
    patientsWithGoal: number;
    patientsReachedGoal: number;
  };
  patientSummaries: PatientSummary[];
}

export interface PatientSummary {
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  weightChangeKg: number | null;
  avgCompliance: number | null;
  checkInsCount: number;
  planCount: number;
  latestPlanStatus: string | null;
}

function dec(d: Decimal | null | undefined): number | null {
  return d == null ? null : Number(d);
}

// ── Main ───────────────────────────────────────────────────────────

export async function getMonthlyReport(
  dietitianUserId: string,
  month: string // YYYY-MM
): Promise<MonthlyReport> {
  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 1);

  // All patients for this dietitian
  const allPatients = await prisma.patient.findMany({
    where: { dietitianId: dietitianUserId, user: { deletedAt: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      weightKg: true,
      createdAt: true,
    },
  });

  const patientIds = allPatients.map((p) => p.id);
  const newThisMonth = allPatients.filter(
    (p) => p.createdAt >= startDate && p.createdAt < endDate
  ).length;

  // Diet plans created this month
  const plans = await prisma.dietPlan.findMany({
    where: {
      patientId: { in: patientIds },
      createdAt: { gte: startDate, lt: endDate },
    },
    select: { patientId: true, status: true },
  });

  const planStats = {
    generated: plans.filter((p) => p.status === 'GENERATED').length,
    reviewed: plans.filter((p) => p.status === 'REVIEWED').length,
    published: plans.filter((p) => p.status === 'PUBLISHED' || p.status === 'SENT').length,
    manualReviewRequired: plans.filter((p) => p.status === 'MANUAL_REVIEW_REQUIRED').length,
  };

  // Check-ins this month
  const checkIns = await prisma.checkIn.findMany({
    where: {
      patientId: { in: patientIds },
      createdAt: { gte: startDate, lt: endDate },
    },
    select: { patientId: true, compliance: true, weightKg: true },
  });

  const complianceValues = checkIns
    .filter((c) => c.compliance != null)
    .map((c) => c.compliance!);
  const averageCompliance =
    complianceValues.length > 0
      ? Math.round(complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length)
      : null;
  const patientsWithCheckIns = new Set(checkIns.map((c) => c.patientId)).size;

  // Goal progress — extract goalWeightKg from interview answers (58.1)
  let patientsReachedGoal = 0;
  let patientsWithGoal = 0;

  const latestInterviews = await prisma.interview.findMany({
    where: { patientId: { in: patientIds } },
    orderBy: { createdAt: 'desc' },
    distinct: ['patientId'],
    select: { patientId: true, answers: true },
  });

  const goalWeightMap = new Map<string, number>();
  for (const interview of latestInterviews) {
    try {
      const answers = decryptJson(interview.answers) as Record<string, unknown>;
      const target = Number(answers.targetWeightKg);
      if (target && target > 0) {
        goalWeightMap.set(interview.patientId, target);
      }
    } catch { /* skip if decryption fails */ }
  }

  // Calculate goal progress (58.2)
  for (const patient of allPatients) {
    const goalW = goalWeightMap.get(patient.id);
    if (!goalW) continue;
    patientsWithGoal++;

    const latestW = checkIns
      .filter((c) => c.patientId === patient.id && c.weightKg != null)
      .pop();
    const currentW = latestW ? Number(latestW.weightKg) : dec(patient.weightKg);
    if (currentW == null) continue;

    // Reached goal: within ±2kg
    if (Math.abs(currentW - goalW) <= 2) {
      patientsReachedGoal++;
    }
  }

  // Per-patient summaries
  const latestPlans = await prisma.dietPlan.findMany({
    where: { patientId: { in: patientIds } },
    orderBy: { createdAt: 'desc' },
    distinct: ['patientId'],
    select: { patientId: true, status: true },
  });
  const latestPlanMap = new Map(latestPlans.map((p) => [p.patientId, p.status]));

  const patientSummaries: PatientSummary[] = allPatients.map((patient) => {
    const patientCheckIns = checkIns.filter((c) => c.patientId === patient.id);
    const patientPlans = plans.filter((p) => p.patientId === patient.id);

    const compValues = patientCheckIns
      .filter((c) => c.compliance != null)
      .map((c) => c.compliance!);
    const avgComp =
      compValues.length > 0
        ? Math.round(compValues.reduce((a, b) => a + b, 0) / compValues.length)
        : null;

    const weightCheckIns = patientCheckIns.filter((c) => c.weightKg != null);
    let weightChangeKg: number | null = null;
    if (weightCheckIns.length >= 2) {
      const first = Number(weightCheckIns[0].weightKg);
      const last = Number(weightCheckIns[weightCheckIns.length - 1].weightKg);
      weightChangeKg = Math.round((last - first) * 100) / 100;
    }

    const latestW = weightCheckIns.length > 0
      ? Number(weightCheckIns[weightCheckIns.length - 1].weightKg)
      : dec(patient.weightKg);

    return {
      patientId: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      currentWeightKg: latestW,
      goalWeightKg: goalWeightMap.get(patient.id) ?? null,
      weightChangeKg,
      avgCompliance: avgComp,
      checkInsCount: patientCheckIns.length,
      planCount: patientPlans.length,
      latestPlanStatus: latestPlanMap.get(patient.id) ?? null,
    };
  });

  return {
    month,
    dietitianId: dietitianUserId,
    patients: { total: allPatients.length, newThisMonth },
    plans: planStats,
    compliance: {
      averagePercent: averageCompliance,
      checkInsCount: checkIns.length,
      patientsWithCheckIns,
    },
    goalProgress: { patientsWithGoal, patientsReachedGoal },
    patientSummaries,
  };
}
