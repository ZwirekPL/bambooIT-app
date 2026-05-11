import { prisma } from '@db';
import { AppError } from '../utils/errors';
import {
  calculateBMR,
  calculateTDEEHybrid,
  calculateTargetKcalV2,
  calculateMacros,
  normalizeActivityLevel,
  normalizeDietGoal,
  type Sex,
  type DeficitBreakdown,
} from '../utils/nutrition';
import { decryptJson } from '../utils/encryption';

// ─── helpers ──────────────────────────────────────────────────────────────────

function computeAge(birthDate: Date | null, birthYear: number | null): number | null {
  if (birthDate) {
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  if (birthYear) {
    return new Date().getFullYear() - birthYear;
  }
  return null;
}

// ─── sex normalization ────────────────────────────────────────────────────────

const MALE_VALUES = new Set(['male', 'm', 'mężczyzna', 'mezczyzna', 'man', 'mężczyzny']);
const FEMALE_VALUES = new Set(['female', 'f', 'k', 'kobieta', 'woman', 'kobiety']);

function normalizeSex(raw: string | null | undefined): Sex | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (MALE_VALUES.has(lower)) return 'male';
  if (FEMALE_VALUES.has(lower)) return 'female';
  return null;
}

// ─── compute + upsert ─────────────────────────────────────────────────────────

/**
 * Computes BMR → TDEE → targetKcal → macros for a patient and saves/updates
 * the NutritionTargets record. Returns null if the patient profile lacks
 * required fields (weight, height, sex, age).
 *
 * Supports hybrid TDEE calculation when activityTypes, workoutsPerWeek and
 * workoutDurationMin are provided (PRE.6-8).
 */
export async function computeAndSaveNutritionTargets(
  patientId: string,
  activityLevelRaw: string,
  mainGoalRaw: string,
  activityTypes?: string[],
  workoutsPerWeek?: number,
  workoutDurationMin?: number,
  workType?: string,
) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      weightKg: true,
      heightCm: true,
      sex: true,
      birthYear: true,
      birthDate: true,
    },
  });

  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }

  const weightKg = patient.weightKg ? Number(patient.weightKg) : null;
  const heightCm = patient.heightCm;
  const sexNormalized = normalizeSex(patient.sex);
  const ageYears = computeAge(patient.birthDate, patient.birthYear);

  // Bail out if required anthropometric data is missing
  if (!weightKg || !heightCm || !ageYears || !sexNormalized) {
    return null;
  }

  let activityLevel = normalizeActivityLevel(activityLevelRaw);
  const goal = normalizeDietGoal(mainGoalRaw);

  // 31.1.2 — Read targetWeightKg, timeline, workType from latest interview
  let targetWeightKg: number | undefined;
  let timeline: string | undefined;
  let deficitBreakdown: DeficitBreakdown | null = null;

  const latestInterview = await prisma.interview.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    select: { answers: true },
  });

  if (latestInterview) {
    const answers = decryptJson(latestInterview.answers) as Record<string, unknown>;
    if (answers.targetWeightKg != null) {
      targetWeightKg = Number(answers.targetWeightKg);
      if (isNaN(targetWeightKg)) targetWeightKg = undefined;
    }
    if (typeof answers.timeline === 'string' && answers.timeline.length > 0) {
      timeline = answers.timeline;
    }
    // Use workType from interview if not provided as parameter
    if (!workType && typeof answers.workType === 'string') {
      workType = answers.workType;
    }
  }

  // Correct activity level when work type indicates higher NEAT expenditure
  // Physical work adds ~300-500 kcal/d NEAT that self-reported "sedentary" misses
  if (workType === 'physical' && activityLevel === 'sedentary') {
    activityLevel = 'light';
  } else if (workType === 'physical' && activityLevel === 'light') {
    activityLevel = 'moderate';
  }

  const bmr = calculateBMR(sexNormalized, weightKg, heightCm, ageYears);
  const tdeeResult = calculateTDEEHybrid(
    bmr,
    weightKg,
    activityLevel,
    activityTypes ?? [],
    workoutsPerWeek ?? 0,
    workoutDurationMin ?? 0,
  );
  const tdee = tdeeResult.kcal;

  const { targetKcal, deficitBreakdown: db } = calculateTargetKcalV2(
    tdee, goal, weightKg, targetWeightKg, timeline,
  );
  deficitBreakdown = db;

  const { proteinG, fatG, carbsG } = calculateMacros(targetKcal, weightKg, goal);

  const breakdownData = {
    ...tdeeResult.breakdown,
    deficitBreakdown: deficitBreakdown ?? undefined,
  } as unknown as import('@db').Prisma.InputJsonValue;

  const targets = await prisma.nutritionTargets.upsert({
    where: { patientId },
    create: {
      patientId,
      bmr,
      tdee,
      targetKcal,
      targetProteinG: proteinG,
      targetFatG: fatG,
      targetCarbsG: carbsG,
      activityLevel,
      goal,
      ageYears,
      weightKg: patient.weightKg,
      heightCm,
      breakdown: breakdownData,
    },
    update: {
      bmr,
      tdee,
      targetKcal,
      targetProteinG: proteinG,
      targetFatG: fatG,
      targetCarbsG: carbsG,
      activityLevel,
      goal,
      ageYears,
      weightKg: patient.weightKg,
      heightCm,
      breakdown: breakdownData,
    },
  });

  return targets;
}

// ─── read ──────────────────────────────────────────────────────────────────────

export async function getNutritionTargets(patientId: string) {
  return prisma.nutritionTargets.findUnique({ where: { patientId } });
}
