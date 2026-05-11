import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { analyzePlanMicronutrients } from './micronutrientAnalysis.service';

// ── Types ──────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'moderate' | 'info';
export type AlertType = 'plans_awaiting_review' | 'red_flag_plans' | 'dropout_risk' | 'rapid_weight_loss' | 'micronutrient_deficiency';

export interface DietitianAlert {
  type: AlertType;
  severity: AlertSeverity;
  count: number;
  patients: Array<{
    patientId: string;
    firstName: string | null;
    lastName: string | null;
    detail?: string;
  }>;
}

interface AlertsOptions {
  dietitianUserId: string;
  role: string;
}

// ── Constants ──────────────────────────────────────────────────────

const DROPOUT_RISK_DAYS = 10;
const RAPID_LOSS_KG_PER_WEEK = 1.5;

// ── Main function ──────────────────────────────────────────────────

export async function getDietitianAlerts({ dietitianUserId, role }: AlertsOptions): Promise<DietitianAlert[]> {
  const dietitianFilter = role === 'DIETITIAN'
    ? { patient: { dietitianId: dietitianUserId, user: { deletedAt: null } } }
    : { patient: { user: { deletedAt: null } } };

  const patientFilter = role === 'DIETITIAN'
    ? { dietitianId: dietitianUserId, user: { deletedAt: null } }
    : { user: { deletedAt: null } };

  const alerts: DietitianAlert[] = [];

  // Run all queries in parallel
  const [reviewPlans, redFlagPlans, allPatients] = await Promise.all([
    // 20.1.1 Plans awaiting review (GENERATED status)
    prisma.dietPlan.findMany({
      where: { ...dietitianFilter, status: 'GENERATED' },
      select: {
        id: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),

    // 20.1.4 Plans with red flags (MANUAL_REVIEW_REQUIRED)
    prisma.dietPlan.findMany({
      where: { ...dietitianFilter, status: 'MANUAL_REVIEW_REQUIRED' },
      select: {
        id: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),

    // For dropout risk + rapid loss: get all patients with their latest check-in
    prisma.patient.findMany({
      where: patientFilter,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 5, // last 5 check-ins for rapid loss calc
          select: { weightKg: true, createdAt: true },
        },
      },
    }),
  ]);

  // 20.1.1 Plans awaiting review
  if (reviewPlans.length > 0) {
    const uniquePatients = dedupePatients(reviewPlans.map((p) => p.patient));
    alerts.push({
      type: 'plans_awaiting_review',
      severity: 'info',
      count: reviewPlans.length,
      patients: uniquePatients.map((p) => ({
        patientId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
      })),
    });
  }

  // 20.1.4 Red flag plans
  if (redFlagPlans.length > 0) {
    const uniquePatients = dedupePatients(redFlagPlans.map((p) => p.patient));
    alerts.push({
      type: 'red_flag_plans',
      severity: 'high',
      count: redFlagPlans.length,
      patients: uniquePatients.map((p) => ({
        patientId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
      })),
    });
  }

  // 20.1.2 Dropout risk — no check-in for DROPOUT_RISK_DAYS days
  const now = new Date();
  const dropoutThreshold = new Date(now.getTime() - DROPOUT_RISK_DAYS * 24 * 60 * 60 * 1000);

  const dropoutPatients = allPatients.filter((patient) => {
    if (patient.checkIns.length === 0) return false; // never checked in — not dropout, just new
    const lastCheckIn = patient.checkIns[0].createdAt;
    return lastCheckIn < dropoutThreshold;
  });

  if (dropoutPatients.length > 0) {
    alerts.push({
      type: 'dropout_risk',
      severity: 'moderate',
      count: dropoutPatients.length,
      patients: dropoutPatients.map((p) => {
        const daysSince = Math.floor(
          (now.getTime() - p.checkIns[0].createdAt.getTime()) / (24 * 60 * 60 * 1000)
        );
        return {
          patientId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          detail: `${daysSince}d`,
        };
      }),
    });
  }

  // 20.1.3 Rapid weight loss — >1.5 kg/week over last check-ins
  const rapidLossPatients: Array<{
    patientId: string;
    firstName: string | null;
    lastName: string | null;
    weeklyLossKg: number;
  }> = [];

  for (const patient of allPatients) {
    const weights = patient.checkIns
      .filter((c) => c.weightKg != null)
      .map((c) => ({ kg: Number(c.weightKg), date: c.createdAt }));

    if (weights.length < 2) continue;

    // weights are sorted desc (newest first)
    const newest = weights[0];
    const oldest = weights[weights.length - 1];
    const diffKg = Number(oldest.kg) - Number(newest.kg); // positive = losing
    const diffMs = newest.date.getTime() - oldest.date.getTime();
    const diffWeeks = Math.max(diffMs / (7 * 24 * 60 * 60 * 1000), 1);
    const weeklyLossKg = Math.round((diffKg / diffWeeks) * 100) / 100;

    if (weeklyLossKg > RAPID_LOSS_KG_PER_WEEK) {
      rapidLossPatients.push({
        patientId: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        weeklyLossKg,
      });
    }
  }

  if (rapidLossPatients.length > 0) {
    alerts.push({
      type: 'rapid_weight_loss',
      severity: 'high',
      count: rapidLossPatients.length,
      patients: rapidLossPatients.map((p) => ({
        patientId: p.patientId,
        firstName: p.firstName,
        lastName: p.lastName,
        detail: `${p.weeklyLossKg} kg/tydz.`,
      })),
    });
  }

  // 38.8: Micronutrient deficiency alerts — check latest published plans
  try {
    const latestPlans = await prisma.dietPlan.findMany({
      where: {
        ...dietitianFilter,
        status: { in: ['PUBLISHED', 'SENT'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      distinct: ['patientId'],
      select: {
        id: true,
        content: true,
        patientId: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            sex: true,
            birthYear: true,
            birthDate: true,
          },
        },
      },
    });

    const deficientPatients: Array<{
      patientId: string;
      firstName: string | null;
      lastName: string | null;
      deficiencyCount: number;
    }> = [];

    for (const plan of latestPlans) {
      try {
        const content = decryptJson(plan.content) as Record<string, unknown>;

        let age: number | null = null;
        if (plan.patient?.birthDate) {
          age = Math.floor((Date.now() - new Date(plan.patient.birthDate as unknown as string).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        } else if (plan.patient?.birthYear) {
          age = new Date().getFullYear() - plan.patient.birthYear;
        }

        const report = await analyzePlanMicronutrients(
          content as Record<string, unknown>,
          plan.patient?.sex ?? null,
          age,
        );

        if (report.deficiencies.length >= 3) {
          deficientPatients.push({
            patientId: plan.patient.id,
            firstName: plan.patient.firstName,
            lastName: plan.patient.lastName,
            deficiencyCount: report.deficiencies.length,
          });
        }
      } catch {
        // Skip plans with decryption errors
      }
    }

    if (deficientPatients.length > 0) {
      alerts.push({
        type: 'micronutrient_deficiency',
        severity: 'moderate',
        count: deficientPatients.length,
        patients: deficientPatients.map((p) => ({
          patientId: p.patientId,
          firstName: p.firstName,
          lastName: p.lastName,
          detail: `${p.deficiencyCount} niedoborów`,
        })),
      });
    }
  } catch {
    // Non-critical: skip if micronutrient analysis fails
  }

  // Sort: critical first, then high, moderate, info
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, moderate: 2, info: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ── Helpers ────────────────────────────────────────────────────────

function dedupePatients(patients: Array<{ id: string; firstName: string | null; lastName: string | null }>) {
  const seen = new Set<string>();
  return patients.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
