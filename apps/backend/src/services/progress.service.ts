import { prisma } from '@db';
import { Decimal } from '@prisma/client/runtime/library';

// ── Types ──────────────────────────────────────────────────────────

export interface ProgressData {
  startWeightKg: number | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  totalChangeKg: number | null;
  progressPercent: number | null; // 0–100, how close to goal
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  label: string; // translation key
  achieved: boolean;
  achievedAt: string | null; // ISO date
  params?: Record<string, string | number>; // for i18n interpolation
}

// ── Helpers ─────────────────────────────────────────────────────────

function dec(d: Decimal | null | undefined): number | null {
  return d == null ? null : Number(d);
}

// ── Main function ───────────────────────────────────────────────────

export async function getProgress(patientId: string): Promise<ProgressData> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { weightKg: true },
  });

  // Read goalWeightKg from the latest interview answers (moved from Patient model to interview)
  const latestInterview = await prisma.interview.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    select: { answers: true },
  });

  const checkIns = await prisma.checkIn.findMany({
    where: { patientId },
    orderBy: { createdAt: 'asc' },
    select: { weightKg: true, createdAt: true },
  });

  const weightEntries = checkIns
    .filter((c) => c.weightKg != null)
    .map((c) => ({
      weightKg: Number(c.weightKg),
      date: c.createdAt,
    }));

  // Start weight: first check-in OR patient profile weight
  const startWeightKg =
    weightEntries.length > 0 ? weightEntries[0].weightKg : dec(patient?.weightKg);

  // Current weight: latest check-in OR patient profile weight
  const currentWeightKg =
    weightEntries.length > 0
      ? weightEntries[weightEntries.length - 1].weightKg
      : dec(patient?.weightKg);

  const answers = latestInterview?.answers as Record<string, unknown> | null;
  const rawGoal = answers?.targetWeightKg;
  const goalWeightKg = typeof rawGoal === 'number' ? rawGoal : null;

  // Total change from start
  const totalChangeKg =
    startWeightKg != null && currentWeightKg != null
      ? Math.round((currentWeightKg - startWeightKg) * 100) / 100
      : null;

  // Progress percent towards goal
  let progressPercent: number | null = null;
  if (startWeightKg != null && currentWeightKg != null && goalWeightKg != null) {
    const totalToLose = startWeightKg - goalWeightKg;
    if (totalToLose !== 0) {
      const lost = startWeightKg - currentWeightKg;
      progressPercent = Math.min(
        100,
        Math.max(0, Math.round((lost / totalToLose) * 100))
      );
    } else {
      progressPercent = 100; // already at goal
    }
  }

  // ── Milestones ──────────────────────────────────────────────────

  const milestones: Milestone[] = [];

  // 1. First check-in completed
  const firstCheckIn = checkIns.length > 0;
  milestones.push({
    id: 'first_checkin',
    label: 'firstCheckIn',
    achieved: firstCheckIn,
    achievedAt: firstCheckIn ? checkIns[0].createdAt.toISOString() : null,
  });

  // 2. First week completed (7+ days of check-ins)
  const firstWeek =
    weightEntries.length >= 2 &&
    weightEntries[weightEntries.length - 1].date.getTime() -
      weightEntries[0].date.getTime() >=
      6 * 24 * 60 * 60 * 1000;
  milestones.push({
    id: 'first_week',
    label: 'firstWeek',
    achieved: firstWeek,
    achievedAt: firstWeek ? findDateAtDayOffset(weightEntries, 6) : null,
  });

  // 3. First month completed (28+ days)
  const firstMonth =
    weightEntries.length >= 4 &&
    weightEntries[weightEntries.length - 1].date.getTime() -
      weightEntries[0].date.getTime() >=
      27 * 24 * 60 * 60 * 1000;
  milestones.push({
    id: 'first_month',
    label: 'firstMonth',
    achieved: firstMonth,
    achievedAt: firstMonth ? findDateAtDayOffset(weightEntries, 27) : null,
  });

  // 4. Weight milestones: 1kg, 2kg, 5kg, 10kg lost
  if (startWeightKg != null && goalWeightKg != null) {
    const isLossGoal = goalWeightKg < startWeightKg;
    const kgMilestones = [1, 2, 5, 10];

    for (const kg of kgMilestones) {
      const achievedEntry = isLossGoal
        ? weightEntries.find((e) => startWeightKg - e.weightKg >= kg)
        : weightEntries.find((e) => e.weightKg - startWeightKg >= kg);

      milestones.push({
        id: `kg_${kg}`,
        label: isLossGoal ? 'kgLost' : 'kgGained',
        achieved: !!achievedEntry,
        achievedAt: achievedEntry ? achievedEntry.date.toISOString() : null,
        params: { kg },
      });
    }
  }

  // 5. Goal reached
  if (goalWeightKg != null && currentWeightKg != null && startWeightKg != null) {
    const goalReached =
      goalWeightKg < startWeightKg
        ? currentWeightKg <= goalWeightKg
        : currentWeightKg >= goalWeightKg;
    const achievedEntry = goalReached
      ? weightEntries.find((e) =>
          goalWeightKg < startWeightKg
            ? e.weightKg <= goalWeightKg
            : e.weightKg >= goalWeightKg
        )
      : null;

    milestones.push({
      id: 'goal_reached',
      label: 'goalReached',
      achieved: goalReached,
      achievedAt: achievedEntry ? achievedEntry.date.toISOString() : null,
    });
  }

  // 6. 5 check-ins completed
  const fiveCheckins = checkIns.length >= 5;
  milestones.push({
    id: 'five_checkins',
    label: 'fiveCheckIns',
    achieved: fiveCheckins,
    achievedAt: fiveCheckins ? checkIns[4].createdAt.toISOString() : null,
  });

  // 7. 10 check-ins completed
  const tenCheckins = checkIns.length >= 10;
  milestones.push({
    id: 'ten_checkins',
    label: 'tenCheckIns',
    achieved: tenCheckins,
    achievedAt: tenCheckins ? checkIns[9].createdAt.toISOString() : null,
  });

  return {
    startWeightKg,
    currentWeightKg,
    goalWeightKg,
    totalChangeKg,
    progressPercent,
    milestones,
  };
}

function findDateAtDayOffset(
  entries: Array<{ date: Date }>,
  minDays: number
): string | null {
  if (entries.length === 0) return null;
  const start = entries[0].date.getTime();
  const threshold = start + minDays * 24 * 60 * 60 * 1000;
  const found = entries.find((e) => e.date.getTime() >= threshold);
  return found ? found.date.toISOString() : entries[entries.length - 1].date.toISOString();
}
