/**
 * 31.5 Meal schedule computation based on interview mealRhythm data.
 *
 * Key rule: if firstMealTime === 'skip', the patient already excluded breakfast
 * from their mealsPerDay count. So 4 meals + skip = 4 meals WITHOUT breakfast.
 */

// ─── types ──────────────────────────────────────────────────────────────────

export interface MealScheduleEntry {
  mealType: string;  // BREAKFAST, SECOND_BREAKFAST, LUNCH, SNACK, DINNER, SUPPER
  time: string;      // "07:30"
  label: string;     // "Śniadanie", "II Śniadanie", etc.
}

// ─── constants ──────────────────────────────────────────────────────────────

const FIRST_MEAL_TIME_MAP: Record<string, number> = {
  before_7: 6 * 60 + 30,  // 6:30
  '7_9': 7 * 60 + 30,     // 7:30
  after_9: 9 * 60 + 30,   // 9:30
};

const LAST_MEAL_TIME_MAP: Record<string, number> = {
  before_18: 17 * 60 + 30, // 17:30
  '18_20': 19 * 60,        // 19:00
  after_20: 20 * 60 + 30,  // 20:30
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Śniadanie',
  SECOND_BREAKFAST: 'II Śniadanie',
  LUNCH: 'Obiad',
  SNACK: 'Podwieczorek',
  DINNER: 'Kolacja',
  SUPPER: 'Przekąska wieczorna',
};

/** Meal types ordered by time of day — WITH breakfast */
const MEAL_TYPES_WITH_BREAKFAST: Record<number, string[]> = {
  3: ['BREAKFAST', 'LUNCH', 'DINNER'],
  4: ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'],
  5: ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'],
  6: ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER'],
};

/** Meal types ordered by time of day — WITHOUT breakfast (skip) */
const MEAL_TYPES_WITHOUT_BREAKFAST: Record<number, string[]> = {
  3: ['LUNCH', 'SNACK', 'DINNER'],
  4: ['SECOND_BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'],
  5: ['SECOND_BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER'],
  6: ['SECOND_BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER', 'SUPPER'],
};

// Default start when skip (no breakfast) — 10:00
const DEFAULT_SKIP_START_MINUTES = 10 * 60;

// Default last meal time — 19:00
const DEFAULT_LAST_MINUTES = 19 * 60;

// ─── public API ─────────────────────────────────────────────────────────────

export interface MealScheduleInput {
  mealsPerDay: number;
  firstMealTime?: string;  // 'before_7' | '7_9' | 'after_9' | 'skip'
  lastMealTime?: string;   // 'before_18' | '18_20' | 'after_20'
}

/**
 * Compute meal schedule with types and times.
 * Returns ordered list of meals with suggested times.
 */
export function computeMealSchedule(input: MealScheduleInput): MealScheduleEntry[] {
  const { mealsPerDay, firstMealTime, lastMealTime } = input;
  const skip = firstMealTime === 'skip';

  const mealTypes = getMealTypesForSchedule(mealsPerDay, skip);
  if (mealTypes.length === 0) return [];

  const startMinutes = skip
    ? DEFAULT_SKIP_START_MINUTES
    : (firstMealTime ? FIRST_MEAL_TIME_MAP[firstMealTime] : undefined) ?? FIRST_MEAL_TIME_MAP['7_9'];

  const endMinutes = (lastMealTime ? LAST_MEAL_TIME_MAP[lastMealTime] : undefined) ?? DEFAULT_LAST_MINUTES;

  // Ensure end > start (edge case: before_18 + after_9 with many meals)
  const effectiveEnd = Math.max(endMinutes, startMinutes + 60);

  const count = mealTypes.length;
  const gap = count > 1 ? (effectiveEnd - startMinutes) / (count - 1) : 0;

  return mealTypes.map((mealType, i) => {
    const minutes = Math.round(startMinutes + gap * i);
    return {
      mealType,
      time: minutesToTime(minutes),
      label: MEAL_TYPE_LABELS[mealType] ?? mealType,
    };
  });
}

/**
 * Get meal types for a given count, respecting skip breakfast.
 * Exported for use in planPipeline.service.ts (MEAL_TYPES_BY_COUNT replacement).
 */
export function getMealTypesForSchedule(mealsPerDay: number, skipBreakfast: boolean): string[] {
  const clamped = Math.max(3, Math.min(6, mealsPerDay));
  const lookup = skipBreakfast ? MEAL_TYPES_WITHOUT_BREAKFAST : MEAL_TYPES_WITH_BREAKFAST;
  return lookup[clamped] ?? lookup[3];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
