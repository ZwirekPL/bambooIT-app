import { prisma } from '@db';
import { getCheckInTrends, type CheckInTrends } from './checkin-trends.service';
import { getNutritionTargets } from './nutrition.service';
import { sendWeeklySummaryEmail } from '../utils/email';
import { logAudit } from './audit.service';

// ── Types ──────────────────────────────────────────────────────

export interface WeeklySummaryData {
  patientId: string;
  patientName: string;
  email: string;
  trends: CheckInTrends;
  currentKcal: number | null;
  highlights: string[];
  tips: string[];
  adaptationApplied: boolean;
}

export interface WeeklySummaryResult {
  sent: boolean;
  patientId: string;
  reason?: string;
}

// ── Constants ──────────────────────────────────────────────────

const MIN_CHECKINS_FOR_SUMMARY = 1;

// ── Main function ──────────────────────────────────────────────

/**
 * Generates and sends a weekly summary email to a single patient.
 * Returns result indicating whether the email was sent.
 */
export async function sendWeeklySummary(patientId: string): Promise<WeeklySummaryResult> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, user: { deletedAt: null } },
    include: {
      user: { select: { email: true } },
    },
  });

  if (!patient) {
    return { sent: false, patientId, reason: 'Patient not found' };
  }

  const trends = await getCheckInTrends(patientId);

  if (trends.totalCheckIns < MIN_CHECKINS_FOR_SUMMARY) {
    return { sent: false, patientId, reason: 'No check-ins yet' };
  }

  const targets = await getNutritionTargets(patientId);

  // Check if there was a recent adaptation (revision with CHECKIN_ADJUSTMENT in last 7 days)
  const recentAdaptation = await prisma.dietPlanRevision.findFirst({
    where: {
      reason: 'CHECKIN_ADJUSTMENT',
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      dietPlan: { patientId },
    },
    orderBy: { createdAt: 'desc' },
  });

  const highlights = buildHighlights(trends, recentAdaptation !== null);
  const tips = buildTips(trends);

  const summaryData: WeeklySummaryData = {
    patientId,
    patientName: patient.firstName ?? '',
    email: patient.user.email,
    trends,
    currentKcal: targets?.targetKcal ?? null,
    highlights,
    tips,
    adaptationApplied: recentAdaptation !== null,
  };

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const checkinUrl = `${appUrl}/dashboard/check-in`;

  await sendWeeklySummaryEmail(summaryData.email, summaryData.patientName, {
    highlights,
    tips,
    checkinUrl,
    weightCurrent: trends.weightTrend.currentKg,
    weightChange: trends.weightTrend.totalChangeKg,
    weightDirection: trends.weightTrend.direction,
    currentKcal: summaryData.currentKcal,
    adaptationApplied: summaryData.adaptationApplied,
  });

  return { sent: true, patientId };
}

/**
 * Sends weekly summaries to all active patients who have at least 1 check-in.
 * Used for batch processing (e.g., cron job via n8n or manual admin trigger).
 */
export async function sendWeeklySummariesBatch(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
  results: WeeklySummaryResult[];
}> {
  const patients = await prisma.patient.findMany({
    where: {
      user: { deletedAt: null },
      checkIns: { some: {} },
    },
    select: { id: true },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const results: WeeklySummaryResult[] = [];

  for (const patient of patients) {
    try {
      const result = await sendWeeklySummary(patient.id);
      results.push(result);
      if (result.sent) sent++;
      else skipped++;
    } catch {
      errors++;
      results.push({ sent: false, patientId: patient.id, reason: 'Error sending email' });
    }
  }

  return { sent, skipped, errors, results };
}

// ── Highlight builders ──────────────────────────────────────────

function buildHighlights(trends: CheckInTrends, adaptationApplied: boolean): string[] {
  const highlights: string[] = [];

  // Weight trend
  if (trends.weightTrend.direction === 'losing' && trends.weightTrend.totalChangeKg !== null) {
    highlights.push(
      `Schudłeś/aś ${Math.abs(trends.weightTrend.totalChangeKg).toFixed(1)} kg od początku — tak trzymaj!`
    );
  } else if (trends.weightTrend.direction === 'gaining' && trends.weightTrend.totalChangeKg !== null) {
    highlights.push(
      `Twoja waga wzrosła o ${trends.weightTrend.totalChangeKg.toFixed(1)} kg. Sprawdź, czy plan jest odpowiedni.`
    );
  } else if (trends.weightTrend.direction === 'stable') {
    highlights.push('Twoja waga jest stabilna — dobra robota!');
  }

  // Plateau
  if (trends.plateau.isPlateauDetected) {
    highlights.push(
      `Wykryto plateau wagowe (${trends.plateau.plateauWeeks} tygodni). System może dostosować plan.`
    );
  }

  // Rapid loss
  if (trends.rapidLoss.isRapidLoss) {
    highlights.push(
      'Uwaga: tempo spadku wagi jest zbyt szybkie. Plan został skorygowany dla bezpieczeństwa.'
    );
  }

  // Adaptation
  if (adaptationApplied) {
    highlights.push('Twój plan został automatycznie dostosowany na podstawie Twoich check-inów.');
  }

  // Compliance
  if (trends.recentAverages.compliance !== null) {
    if (trends.recentAverages.compliance >= 80) {
      highlights.push(`Świetna zgodność z dietą (${trends.recentAverages.compliance}%)!`);
    } else if (trends.recentAverages.compliance < 50) {
      highlights.push(
        `Zgodność z dietą (${trends.recentAverages.compliance}%) — spróbuj trzymać się planu bardziej regularnie.`
      );
    }
  }

  return highlights.slice(0, 4); // max 4 highlights
}

function buildTips(trends: CheckInTrends): string[] {
  const tips: string[] = [];

  // Hunger-based tip
  if (trends.recentAverages.hunger !== null && trends.recentAverages.hunger >= 7) {
    tips.push('Głód jest wysoki — spróbuj dodać więcej warzyw i białka do posiłków dla lepszej sytości.');
  }

  // Energy-based tip
  if (trends.recentAverages.energy !== null && trends.recentAverages.energy <= 4) {
    tips.push('Masz niski poziom energii — zadbaj o regularność posiłków i odpowiednią ilość snu.');
  }

  // Sleep-based tip
  if (trends.recentAverages.sleep !== null && trends.recentAverages.sleep <= 4) {
    tips.push('Jakość snu wpływa na metabolizm — postaraj się o 7-8h snu dziennie.');
  }

  // Compliance tip
  if (trends.recentAverages.compliance !== null && trends.recentAverages.compliance < 60) {
    tips.push('Przygotuj posiłki z wyprzedzeniem (meal prep) — to pomoże trzymać się planu.');
  }

  // Default tip if nothing specific
  if (tips.length === 0) {
    tips.push('Pij minimum 2 litry wody dziennie i jedz regularnie co 3-4 godziny.');
  }

  return tips.slice(0, 3); // max 3 tips
}
