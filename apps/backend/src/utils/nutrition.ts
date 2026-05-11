// ─── Types ────────────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female';

/** Activity level values from InterviewForm Step 2 */
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

/** Main goal values from InterviewForm Step 1 */
export type DietGoal =
  | 'lose_weight'
  | 'gain_muscle'
  | 'maintain_weight'
  | 'improve_health'
  | 'other';

export type TDEEMethod = 'PAL_ONLY' | 'PAL_PLUS_EXERCISE';

export interface TDEEBreakdown {
  bmr: number;
  method: TDEEMethod;
  palMultiplier: number;
  palKcal: number;
  exerciseKcalPerDay: number;
  totalTdee: number;
  activityTypes?: string[];
  workoutsPerWeek?: number;
  workoutDurationMin?: number;
}

export interface TDEEResult {
  kcal: number;
  method: TDEEMethod;
  breakdown: TDEEBreakdown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Full PAL multipliers (no separate exercise accounting) */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Reduced PAL multipliers for NEAT (Non-Exercise Activity Thermogenesis) only.
 * Used when exercise energy expenditure is accounted separately via MET.
 */
const PAL_NEAT: Record<ActivityLevel, number> = {
  sedentary: 1.20,
  light: 1.28,
  moderate: 1.40,
  active: 1.50,
  very_active: 1.60,
};

/**
 * MET values per activity type (kcal/kg/hour equivalent).
 * Halved from standard literature values to avoid over-estimating exercise
 * expenditure which was causing overly aggressive caloric deficits.
 */
const MET_VALUES: Record<string, number> = {
  walking: 1.75,
  running: 4.5,
  gym: 2.25,
  cycling: 3.5,
  swimming: 3.5,
  yoga: 1.5,
  ball_sports: 4.5,
  cycling_recreational: 2.25,
  crossfit: 6.5,
  calisthenics: 3.0,
  zumba: 4.0,
  football: 5.0,
  basketball: 4.5,
  volleyball: 3.0,
  tennis: 4.0,
  squash: 5.5,
  martial_arts: 5.0,
  other: 2.5,
};

const VALID_ACTIVITY_LEVELS = new Set<ActivityLevel>([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);

const VALID_GOALS = new Set<DietGoal>([
  'lose_weight',
  'gain_muscle',
  'maintain_weight',
  'improve_health',
  'other',
]);

// ─── Normalizers ──────────────────────────────────────────────────────────────

export function normalizeActivityLevel(value: string): ActivityLevel {
  if (VALID_ACTIVITY_LEVELS.has(value as ActivityLevel)) {
    return value as ActivityLevel;
  }
  return 'sedentary';
}

export function normalizeDietGoal(value: string): DietGoal {
  if (VALID_GOALS.has(value as DietGoal)) {
    return value as DietGoal;
  }
  return 'maintain_weight';
}

// ─── Calculators ──────────────────────────────────────────────────────────────

/**
 * BMR using Mifflin-St Jeor equation.
 * Male:   10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
 * Female: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
 */
export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  let bmr = sex === 'male' ? base + 5 : base - 161;

  // #6: Age-related sarcopenia correction (Mifflin-St Jeor validated for 19-65)
  // Beyond 65, progressive muscle loss reduces BMR by ~5-15%
  if (ageYears >= 76) {
    bmr *= 0.87;  // 76+: ~13% reduction
  } else if (ageYears >= 66) {
    bmr *= 0.93;  // 66-75: ~7% reduction
  }

  return Math.round(bmr);
}

/**
 * TDEE = BMR × Physical Activity Level multiplier (legacy, PAL_ONLY).
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  return Math.round(bmr * multiplier);
}

/**
 * Hybrid TDEE calculator.
 * - Without exercise data: TDEE = BMR × PAL_full (PAL_ONLY method)
 * - With exercise data: TDEE = BMR × PAL_NEAT + ExEE (PAL_PLUS_EXERCISE method)
 *   ExEE = Σ(MET × weightKg × durationH × sessionsPerWeek) / 7
 */
export function calculateTDEEHybrid(
  bmr: number,
  weightKg: number,
  activityLevel: ActivityLevel,
  activityTypes: string[] = [],
  workoutsPerWeek = 0,
  workoutDurationMin = 0,
): TDEEResult {
  const hasExercise =
    activityTypes.length > 0 && workoutsPerWeek > 0 && workoutDurationMin > 0;

  if (!hasExercise) {
    const palMultiplier = ACTIVITY_MULTIPLIERS[activityLevel];
    const palKcal = Math.round(bmr * palMultiplier);
    return {
      kcal: palKcal,
      method: 'PAL_ONLY',
      breakdown: {
        bmr,
        method: 'PAL_ONLY',
        palMultiplier,
        palKcal,
        exerciseKcalPerDay: 0,
        totalTdee: palKcal,
        activityTypes,
        workoutsPerWeek,
        workoutDurationMin,
      },
    };
  }

  const palMultiplier = PAL_NEAT[activityLevel];
  const palKcal = Math.round(bmr * palMultiplier);
  const durationH = workoutDurationMin / 60;

  // Average MET across all selected activity types
  const avgMet =
    activityTypes.reduce((sum, t) => sum + (MET_VALUES[t] ?? MET_VALUES.other), 0) /
    activityTypes.length;

  // ExEE per day = MET × weightKg × hours × sessions_per_week / 7
  const exerciseKcalPerDay = Math.round((avgMet * weightKg * durationH * workoutsPerWeek) / 7);
  const totalTdee = palKcal + exerciseKcalPerDay;

  return {
    kcal: totalTdee,
    method: 'PAL_PLUS_EXERCISE',
    breakdown: {
      bmr,
      method: 'PAL_PLUS_EXERCISE',
      palMultiplier,
      palKcal,
      exerciseKcalPerDay,
      totalTdee,
      activityTypes,
      workoutsPerWeek,
      workoutDurationMin,
    },
  };
}

/**
 * Target kcal based on goal (legacy — flat 20% deficit).
 *   lose_weight   → −20% deficit  (×0.80)
 *   gain_muscle   → +10% surplus  (×1.10)
 *   everything else → maintenance (×1.00)
 */
export function calculateTargetKcal(tdee: number, goal: DietGoal): number {
  if (goal === 'lose_weight') return Math.round(tdee * 0.8);
  if (goal === 'gain_muscle') return Math.round(tdee * 1.1);
  return tdee;
}

// ─── Dynamic Deficit Calculator (31.1) ──────────────────────────────────────

/** Timeline values from InterviewForm → weeks mapping */
const TIMELINE_WEEKS: Record<string, number | null> = {
  '1_month': 4,
  '3_months': 12,
  '6_months': 26,
  'no_deadline': null,
};

export interface DeficitBreakdown {
  /** Applied deficit in kcal/d */
  appliedDeficit: number;
  /** Ideal deficit based on weight diff + timeline (may be outside 400-500 range) */
  idealDeficit: number;
  /** Estimated weeks to reach target at applied deficit */
  estimatedWeeksToGoal: number | null;
  /** Whether the user's selected timeline is realistic at safe deficit */
  timelineRealistic: boolean;
  /** Human-readable note (Polish) when timeline is unrealistic */
  note: string | null;
}

/**
 * Dynamic target kcal for weight loss (31.1).
 *
 * Physics: 1 kg fat ≈ 7700 kcal.
 * idealDeficit = (weightDiff × 7700) / (timelineWeeks × 7)
 * Clamped to [400, 500] kcal/d for safety.
 *
 * Falls back to legacy calculateTargetKcal for non-lose_weight goals
 * or when targetWeightKg/timeline is missing.
 */
export function calculateTargetKcalV2(
  tdee: number,
  goal: DietGoal,
  currentWeightKg: number,
  targetWeightKg?: number,
  timeline?: string,
): { targetKcal: number; deficitBreakdown: DeficitBreakdown | null } {
  // Non-reduction goals — no deficit logic
  if (goal !== 'lose_weight') {
    return { targetKcal: calculateTargetKcal(tdee, goal), deficitBreakdown: null };
  }

  // Missing data — fall back to flat 20%
  if (!targetWeightKg || !timeline) {
    return { targetKcal: calculateTargetKcal(tdee, goal), deficitBreakdown: null };
  }

  const weightDiff = currentWeightKg - targetWeightKg;

  // Target weight >= current — no reduction needed, use maintenance
  if (weightDiff <= 0) {
    return { targetKcal: tdee, deficitBreakdown: null };
  }

  const MIN_DEFICIT = 300;
  const MAX_DEFICIT = 500;
  const MAX_DEFICIT_PCT = 0.20; // never cut more than 20% of TDEE
  const MIN_TARGET_KCAL = 1200; // absolute floor (WHO recommendation)
  const KCAL_PER_KG = 7700;

  const timelineWeeks = TIMELINE_WEEKS[timeline] ?? null;

  let idealDeficit: number;
  if (timelineWeeks != null && timelineWeeks > 0) {
    idealDeficit = Math.round((weightDiff * KCAL_PER_KG) / (timelineWeeks * 7));
  } else {
    // no_deadline → use moderate 400 kcal/d
    idealDeficit = 400;
  }

  // Cap deficit: between MIN/MAX and never more than 25% of TDEE
  const maxDeficitByPct = Math.round(tdee * MAX_DEFICIT_PCT);
  const effectiveMaxDeficit = Math.min(MAX_DEFICIT, maxDeficitByPct);
  const appliedDeficit = Math.max(MIN_DEFICIT, Math.min(effectiveMaxDeficit, idealDeficit));
  const targetKcal = Math.round(Math.max(tdee - appliedDeficit, MIN_TARGET_KCAL));

  // Estimate weeks at applied deficit
  const estimatedWeeksToGoal = Math.round((weightDiff * KCAL_PER_KG) / (appliedDeficit * 7));

  const timelineRealistic = timelineWeeks == null || estimatedWeeksToGoal <= timelineWeeks;
  const note = !timelineRealistic && timelineWeeks != null
    ? `Bezpieczne tempo redukcji wymaga ~${estimatedWeeksToGoal} tyg. zamiast wybranych ${timelineWeeks} tyg.`
    : null;

  return {
    targetKcal,
    deficitBreakdown: {
      appliedDeficit,
      idealDeficit,
      estimatedWeeksToGoal,
      timelineRealistic,
      note,
    },
  };
}

/**
 * Macro split:
 *   Protein:  2.0 g/kg (lose_weight), 2.2 g/kg (gain_muscle), 1.8 g/kg (other)
 *   Fat:      25% of targetKcal ÷ 9 kcal/g
 *   Carbs:    remainder ÷ 4 kcal/g
 */
export function calculateMacros(
  targetKcal: number,
  weightKg: number,
  goal: DietGoal
): { proteinG: number; fatG: number; carbsG: number } {
  let proteinPerKg: number;
  if (goal === 'lose_weight') {
    proteinPerKg = 2.0;
  } else if (goal === 'gain_muscle') {
    proteinPerKg = 2.2;
  } else {
    proteinPerKg = 1.8;
  }

  const proteinG = Math.round(weightKg * proteinPerKg);
  const fatG = Math.round((targetKcal * 0.25) / 9);

  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsKcal = Math.max(0, targetKcal - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / 4);

  return { proteinG, fatG, carbsG };
}
