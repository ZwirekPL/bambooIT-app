/**
 * Meal-type and difficulty auto-classifiers (S-11).
 *
 * Meal-type detection blends title keywords with per-serving kcal:
 *   - a "śniadaniowe" keyword narrows to BREAKFAST regardless of kcal
 *   - kcal range nudges the default when the title is generic
 *
 * Difficulty maps coarse ranges of (step_count, total_time, technique
 * complexity) to EASY / MEDIUM / HARD.
 *
 * Both functions are deterministic and cheap; no LLM.
 */

import { normalizeProductName } from './productMatcher';

// ─── Meal type ─────────────────────────────────────────────────────────────────

export type MealType =
  | 'BREAKFAST'
  | 'SECOND_BREAKFAST'
  | 'LUNCH'
  | 'DINNER'
  | 'SUPPER'
  | 'SNACK'
  | 'DESSERT'
  | 'DRINK'
  | 'SAUCE'
  | 'SIDE_DISH';

interface MealTypeSignal {
  mealType: MealType;
  patterns: RegExp[];
  /** Priority — higher wins on ties. */
  priority: number;
}

// Patterns run after normalizeProductName (lowercase + NFD-stripped diacritics,
// no stemming). Each alternative uses a stem and permits trailing \w*.
const MEAL_SIGNALS: MealTypeSignal[] = [
  {
    mealType: 'DESSERT',
    priority: 90,
    patterns: [
      /\b(ciasto|ciasta|ciastk|sernik|szarlotk|makowiec|piernik|mazurek|tort\b|babka|keks|muffin|babeczk|herbatnik|biszkopt|brownie|blondie|tiramis|panna|lody|sorbet|galaretk|mus\s*czekolad|pavlov|pasch|kutia)\w*/,
    ],
  },
  {
    mealType: 'DRINK',
    priority: 85,
    patterns: [
      /\b(koktajl|smoothie|drink|lemoniad|kompot|herbat|kawa|kawy|latte|cappuc|bubble\s*tea|napoj|shake|milkshake|horchata)\w*/,
    ],
  },
  {
    mealType: 'SAUCE',
    priority: 80,
    patterns: [
      /\b(sos|sosy|dressing|winegret|majonez|marynat|dip|salsa|pesto|aioli)\w*/,
    ],
  },
  {
    mealType: 'SNACK',
    priority: 70,
    patterns: [
      /\b(przekask|snack|crackers|grissin|orzeszki|chipsy|popcorn|batonik|kuleczk|palusz|fistaszk|prazon)\w*/,
    ],
  },
  {
    mealType: 'BREAKFAST',
    priority: 60,
    patterns: [
      /\b(owsian|owsianka|granol|musli|muesli|platki|jajecznic|omlet|scramble|shakshuka|kanapk|tost|wafelk|nalesnik|placuszki|overnight|jaglank|chia\s*pudding|sniadan|breakfast)\w*/,
    ],
  },
  {
    mealType: 'SUPPER',
    priority: 55,
    patterns: [
      /\b(kolacj|supper)\w*/,
    ],
  },
  {
    mealType: 'SECOND_BREAKFAST',
    priority: 50,
    patterns: [
      /\b(drugie\s*sniadan|second\s*breakfast|lunch\s*box|lunchbox)\w*/,
    ],
  },
  {
    mealType: 'SIDE_DISH',
    priority: 40,
    patterns: [
      /\b(dodatek|side\s*dish|puree|pure\b|pyza|kluski|surowk|colesla)\w*/,
    ],
  },
  {
    mealType: 'LUNCH',
    priority: 30,
    patterns: [
      /\b(obiad|lunch|zupa|zupy|gulasz|kotlet|schabow|pierog|bigos|rosol|risotto|paell|tagine|ragou|stroganoff)\w*/,
    ],
  },
  {
    mealType: 'DINNER',
    priority: 25,
    patterns: [
      /\b(dinner|pieczen|stek|roast)\w*/,
    ],
  },
];

const KCAL_RANGES: Array<[MealType, number, number]> = [
  // meal, minKcal, maxKcal — narrow ranges, used only as tie-breaker
  ['SNACK', 50, 250],
  ['BREAKFAST', 250, 600],
  ['LUNCH', 400, 900],
  ['DINNER', 400, 1000],
  ['DESSERT', 200, 700],
];

export interface MealTypeReport {
  mealType: MealType;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
}

export function classifyMealType(
  title: string,
  caloriesPerServing: number | null | undefined,
  fallback: MealType = 'LUNCH',
): MealTypeReport {
  const text = normalizeProductName(title);
  const reasons: string[] = [];

  // Pattern-based — scan signals in priority order, first match wins.
  const sorted = [...MEAL_SIGNALS].sort((a, b) => b.priority - a.priority);
  for (const s of sorted) {
    if (s.patterns.some((p) => p.test(text))) {
      reasons.push(`title keyword → ${s.mealType}`);
      return { mealType: s.mealType, confidence: 'HIGH', reasons };
    }
  }

  // Fallback — pick meal type whose kcal range contains the value.
  if (caloriesPerServing != null && Number.isFinite(caloriesPerServing) && caloriesPerServing > 0) {
    for (const [mealType, min, max] of KCAL_RANGES) {
      if (caloriesPerServing >= min && caloriesPerServing <= max) {
        reasons.push(`kcal ${caloriesPerServing} in ${mealType} range (${min}-${max})`);
        return { mealType, confidence: 'MEDIUM', reasons };
      }
    }
  }

  reasons.push(`no signal — falling back to ${fallback}`);
  return { mealType: fallback, confidence: 'LOW', reasons };
}

// ─── Difficulty ────────────────────────────────────────────────────────────────

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface DifficultyReport {
  difficulty: Difficulty;
  score: number;     // 0-100
  reasons: string[];
}

const COMPLEX_TECHNIQUES = /\b(marynow|marinad|pomal|sous\s*vide|wedz|fermentow|kiszon|zakwas|drozdz|piecz\s*chleb|rolad|faszerow|glazurow|flamb|clarify|deglaze|consomme|confit|braisow|karamel|ganache|custard|meringue)\w*/i;

export function scoreDifficulty(
  totalTimeMinutes: number | null | undefined,
  stepCount: number,
  title?: string,
  steps?: string[],
): DifficultyReport {
  let score = 0;
  const reasons: string[] = [];

  const tt = totalTimeMinutes ?? 0;
  if (tt >= 180) {
    score += 40;
    reasons.push(`total time ${tt} min (+40)`);
  } else if (tt >= 90) {
    score += 25;
    reasons.push(`total time ${tt} min (+25)`);
  } else if (tt >= 45) {
    score += 10;
    reasons.push(`total time ${tt} min (+10)`);
  }

  if (stepCount >= 10) {
    score += 30;
    reasons.push(`${stepCount} steps (+30)`);
  } else if (stepCount >= 6) {
    score += 20;
    reasons.push(`${stepCount} steps (+20)`);
  } else if (stepCount >= 4) {
    score += 10;
    reasons.push(`${stepCount} steps (+10)`);
  }

  // Complex technique signal — check title + first few steps
  const haystack = [title ?? '', ...(steps ?? []).slice(0, 6)].join(' ');
  if (COMPLEX_TECHNIQUES.test(haystack)) {
    score += 20;
    reasons.push('complex technique detected (+20)');
  }

  score = Math.min(100, score);

  let difficulty: Difficulty;
  if (score >= 55) difficulty = 'HARD';
  else if (score >= 25) difficulty = 'MEDIUM';
  else difficulty = 'EASY';

  return { difficulty, score, reasons };
}
