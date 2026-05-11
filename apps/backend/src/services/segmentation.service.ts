import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { AppError } from '../utils/errors';

// ─── types ────────────────────────────────────────────────────────────────────

export type SegmentGoal = 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN';
export type SegmentDietType = 'STANDARD' | 'VEGE' | 'VEGAN' | 'GLUTEN_FREE' | 'LACTOSE_FREE';

export interface UserSegment {
  patientId: string;
  goal: SegmentGoal;
  /** Kcal target rounded to nearest 100 (bucket). */
  kcalBucket: number;
  mealCount: number;
  dietType: SegmentDietType;
  allergies: string[];
  /** Deterministic cache/lookup key: GOAL:KCAL:MEAL_COUNT:DIET_TYPE */
  segmentKey: string;
}

// ─── normalizers ──────────────────────────────────────────────────────────────

function normalizeKcalBucket(kcal: number): number {
  return Math.round(kcal / 100) * 100;
}

function normalizeGoal(mainGoal: string): SegmentGoal {
  if (mainGoal === 'lose_weight') return 'WEIGHT_LOSS';
  if (mainGoal === 'gain_muscle') return 'MUSCLE_GAIN';
  return 'MAINTENANCE'; // maintain_weight | improve_health | other
}

/**
 * Map interview dietType + allergies to TemplatePlan DietType.
 * Priority order: VEGAN > VEGE > GLUTEN_FREE > LACTOSE_FREE > STANDARD
 */
function normalizeDietType(dietTypeAnswer: string, allergies: string[]): SegmentDietType {
  if (dietTypeAnswer === 'vegan') return 'VEGAN';
  if (dietTypeAnswer === 'vegetarian') return 'VEGE';
  if (allergies.includes('gluten')) return 'GLUTEN_FREE';
  if (allergies.includes('lactose')) return 'LACTOSE_FREE';
  return 'STANDARD';
}

function normalizeMealCount(mealsPerDay: unknown): number {
  const n = Number(mealsPerDay);
  if (!Number.isFinite(n) || n < 1) return 5; // default
  if (n <= 3) return 3;
  if (n === 4) return 4;
  return 5;
}

// ─── build key ────────────────────────────────────────────────────────────────

export function buildSegmentKey(
  goal: SegmentGoal,
  kcalBucket: number,
  mealCount: number,
  dietType: SegmentDietType,
): string {
  return `${goal}:${kcalBucket}:${mealCount}:${dietType}`;
}

// ─── segment user ─────────────────────────────────────────────────────────────

/**
 * Compute the segment for a patient.
 *
 * Requires:
 * - At least one interview (latest used for diet/allergy prefs)
 * - NutritionTargets (for targetKcal + goal)
 *
 * Throws 404 if patient not found.
 * Returns null if not enough data to segment (no interview or no targets).
 */
export async function segmentUser(patientId: string): Promise<UserSegment | null> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      nutritionTargets: true,
    },
  });

  if (!patient) throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  if (!patient.nutritionTargets) return null; // targets not yet computed

  const latestInterview = await prisma.interview.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    select: { answers: true },
  });

  if (!latestInterview) return null; // no interview yet

  const answers = decryptJson(latestInterview.answers) as Record<string, unknown>;

  const mainGoal = (answers.mainGoal as string) ?? '';
  const dietTypeAnswer = (answers.dietType as string) ?? '';
  const allergies = Array.isArray(answers.allergies)
    ? (answers.allergies as string[]).filter((a) => a !== 'none')
    : [];
  const mealsPerDay = answers.mealsPerDay;

  const goal = normalizeGoal(mainGoal);
  const kcalBucket = normalizeKcalBucket(patient.nutritionTargets.targetKcal);
  const mealCount = normalizeMealCount(mealsPerDay);
  const dietType = normalizeDietType(dietTypeAnswer, allergies);

  return {
    patientId,
    goal,
    kcalBucket,
    mealCount,
    dietType,
    allergies,
    segmentKey: buildSegmentKey(goal, kcalBucket, mealCount, dietType),
  };
}
