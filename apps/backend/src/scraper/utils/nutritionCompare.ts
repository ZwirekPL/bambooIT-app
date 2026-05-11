/**
 * Nutrition recomputation / comparison layer (S-8).
 *
 * Use cases:
 *  1. During scrape, compare scraper-provided nutrition (from JSON-LD) against
 *     nutrition we compute from mapped ingredients. Large gaps → scraped is
 *     likely wrong or referring to different serving size — reject.
 *  2. Plausibility: do the final numbers (computed OR scraped) fit the meal
 *     type? A 3000-kcal "breakfast" is usually a scaling error.
 *
 * Inputs are per-serving values. No IO, no DB. Pure functions.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Subset of per-serving nutrients we actively validate. */
export interface NutritionSnapshot {
  calories?: number | null;  // kcal
  protein?: number | null;   // g
  fat?: number | null;       // g
  carbs?: number | null;     // g
  fiber?: number | null;     // g
  sugar?: number | null;     // g
  sodium?: number | null;    // mg
}

export type NutrientField =
  | 'calories'
  | 'protein'
  | 'fat'
  | 'carbs'
  | 'fiber'
  | 'sugar'
  | 'sodium';

export type ComparisonDecision = 'OK' | 'REVIEW' | 'REJECT' | 'UNKNOWN';

export interface FieldComparison {
  field: NutrientField;
  scraped: number | null;
  computed: number | null;
  absDiff: number | null;      // |scraped - computed|
  pctDiff: number | null;      // 0-100 (percent, relative to max(scraped, computed))
  decision: ComparisonDecision;
}

export interface ComparisonReport {
  fields: FieldComparison[];
  overall: ComparisonDecision;
  reasons: string[];
  primaryDriverField?: NutrientField;
}

// ─── Thresholds ────────────────────────────────────────────────────────────────

/** Field weight and decision thresholds (percent deviation). */
const MAIN_MACROS: NutrientField[] = ['calories', 'protein', 'fat', 'carbs'];
const EXTENDED: NutrientField[] = ['fiber', 'sugar', 'sodium'];

export const THRESHOLD_OK = 15;       // ≤15% → OK
export const THRESHOLD_REVIEW = 30;   // 15-30% → REVIEW, >30% → REJECT

// Small-value guards: below these absolute values we skip percentage checks
// (a 0.5g fiber vs 1g fiber is 50% but irrelevant).
const ABS_EPSILON: Record<NutrientField, number> = {
  calories: 20,   // kcal
  protein: 2,     // g
  fat: 2,         // g
  carbs: 2,       // g
  fiber: 1,       // g
  sugar: 1,       // g
  sodium: 50,     // mg
};

// ─── Comparison ────────────────────────────────────────────────────────────────

function pickField(n: NutritionSnapshot | null | undefined, field: NutrientField): number | null {
  if (!n) return null;
  const v = n[field];
  if (v == null || !Number.isFinite(v)) return null;
  return Number(v);
}

function decideFromPct(pct: number): ComparisonDecision {
  if (pct <= THRESHOLD_OK) return 'OK';
  if (pct <= THRESHOLD_REVIEW) return 'REVIEW';
  return 'REJECT';
}

function compareField(
  scraped: number | null,
  computed: number | null,
  field: NutrientField,
): FieldComparison {
  if (scraped == null || computed == null) {
    return {
      field,
      scraped,
      computed,
      absDiff: null,
      pctDiff: null,
      decision: 'UNKNOWN',
    };
  }
  const absDiff = Math.abs(scraped - computed);

  // If both values are near zero, consider them equal (no meaningful
  // percentage). This avoids "0.5g fiber vs 1g fiber = 50% off".
  if (Math.max(scraped, computed) < ABS_EPSILON[field]) {
    return { field, scraped, computed, absDiff, pctDiff: 0, decision: 'OK' };
  }

  // Relative to the larger value — symmetric, bounded 0-100.
  const denom = Math.max(scraped, computed);
  const pctDiff = denom > 0 ? (absDiff / denom) * 100 : 0;

  return {
    field,
    scraped,
    computed,
    absDiff,
    pctDiff: Math.round(pctDiff * 10) / 10,
    decision: decideFromPct(pctDiff),
  };
}

/**
 * Compare scraped vs computed nutrition. Returns field-level breakdown plus an
 * overall decision.
 *
 * Overall logic:
 *   - calories|protein|fat|carbs dominate. Any REJECT among them → REJECT.
 *   - Among main macros: worst decision wins (REJECT > REVIEW > OK).
 *   - Extended fields (fiber/sugar/sodium) can bump OK → REVIEW but can't
 *     force REJECT alone.
 *   - All fields UNKNOWN → overall UNKNOWN (not enough data).
 */
export function compareNutrition(
  scraped: NutritionSnapshot | null | undefined,
  computed: NutritionSnapshot | null | undefined,
): ComparisonReport {
  const allFields: NutrientField[] = [...MAIN_MACROS, ...EXTENDED];
  const fields: FieldComparison[] = allFields.map((f) =>
    compareField(pickField(scraped, f), pickField(computed, f), f)
  );

  const mainComparisons = fields.filter((f) => MAIN_MACROS.includes(f.field));
  const extComparisons = fields.filter((f) => EXTENDED.includes(f.field));

  const anyKnown = fields.some((f) => f.decision !== 'UNKNOWN');
  if (!anyKnown) {
    return { fields, overall: 'UNKNOWN', reasons: ['no overlapping fields between scraped and computed'] };
  }

  const worstMain = worstDecision(mainComparisons.map((f) => f.decision));
  const worstExt = worstDecision(extComparisons.map((f) => f.decision));

  let overall: ComparisonDecision;
  if (worstMain === 'REJECT') overall = 'REJECT';
  else if (worstMain === 'REVIEW' || worstExt === 'REJECT' || worstExt === 'REVIEW') overall = 'REVIEW';
  else if (worstMain === 'OK') overall = 'OK';
  else overall = 'UNKNOWN';

  const reasons: string[] = [];
  let primaryDriverField: NutrientField | undefined;
  let worstPct = -1;
  for (const f of fields) {
    if (f.decision === 'REJECT' || f.decision === 'REVIEW') {
      reasons.push(`${f.field}: ${f.pctDiff}% diff (scraped=${f.scraped}, computed=${f.computed}) → ${f.decision}`);
      if (f.pctDiff != null && f.pctDiff > worstPct) {
        worstPct = f.pctDiff;
        primaryDriverField = f.field;
      }
    }
  }

  return { fields, overall, reasons, primaryDriverField };
}

function worstDecision(decisions: ComparisonDecision[]): ComparisonDecision {
  if (decisions.includes('REJECT')) return 'REJECT';
  if (decisions.includes('REVIEW')) return 'REVIEW';
  if (decisions.includes('OK')) return 'OK';
  return 'UNKNOWN';
}

// ─── Plausibility per meal type ────────────────────────────────────────────────

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

interface PlausibilityRange {
  minKcal: number;
  maxKcal: number;
  maxSodiumMg?: number;  // per serving
}

/** Calorie ranges per serving per meal type. Sourced from the roadmap spec. */
const PLAUSIBILITY_RANGES: Record<MealType, PlausibilityRange> = {
  BREAKFAST:       { minKcal: 100, maxKcal: 900 },
  SECOND_BREAKFAST:{ minKcal: 100, maxKcal: 600 },
  LUNCH:           { minKcal: 200, maxKcal: 1400 },
  DINNER:          { minKcal: 200, maxKcal: 1400 },
  SUPPER:          { minKcal: 150, maxKcal: 900 },
  SNACK:           { minKcal: 50,  maxKcal: 500 },
  DESSERT:         { minKcal: 100, maxKcal: 700 },
  DRINK:           { minKcal: 0,   maxKcal: 500 },
  SAUCE:           { minKcal: 0,   maxKcal: 300 },
  SIDE_DISH:       { minKcal: 50,  maxKcal: 600 },
};

export interface PlausibilityReport {
  ok: boolean;
  reasons: string[];
  mealType: MealType;
  observed: { calories: number | null };
}

/**
 * Quick sanity check: does the per-serving kcal fit the expected meal-type band?
 * A "breakfast" with 3000 kcal is almost certainly a whole-recipe value
 * mislabelled as per-serving, or a wrong `servings` count.
 */
export function checkPlausibility(
  nutrition: NutritionSnapshot | null | undefined,
  mealType: MealType,
): PlausibilityReport {
  const range = PLAUSIBILITY_RANGES[mealType];
  const kcal = pickField(nutrition ?? null, 'calories');
  const reasons: string[] = [];

  if (kcal == null) {
    reasons.push('calories not provided — cannot evaluate plausibility');
    return { ok: false, reasons, mealType, observed: { calories: null } };
  }

  if (kcal < range.minKcal) {
    reasons.push(`kcal ${kcal} below ${mealType} minimum ${range.minKcal}`);
  }
  if (kcal > range.maxKcal) {
    reasons.push(`kcal ${kcal} exceeds ${mealType} maximum ${range.maxKcal}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    mealType,
    observed: { calories: kcal },
  };
}
