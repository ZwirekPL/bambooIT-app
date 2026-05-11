/**
 * Pre-flight Quality Gate for scraped recipes.
 *
 * Evaluates a candidate recipe BEFORE the expensive pipeline (normalize →
 * map-products → calculate-macros → ...). Rejects clearly broken or unscalable
 * inputs to save CPU and DB pollution.
 *
 * Decision tree:
 *   1. Any REQUIRED field missing → REJECT (score 0).
 *   2. NON_SCALABLE detected → REJECT (recipe can't be resized for diet plans).
 *   3. Score bonuses: ≥80 → AUTO, 60-79 → REVIEW, <60 → REJECT.
 *
 * Design notes:
 *   - Works on a shared `QualityInput` shape that any source can build:
 *     scraped JSON-LD, existing DB Recipe, or a manual form.
 *   - Unit-test friendly: pure function, no IO.
 */

// ─── Input & output types ──────────────────────────────────────────────────────

/** Subset of recipe fields the gate cares about. Source-agnostic. */
export interface QualityInput {
  title?: string | null;
  description?: string | null;
  ingredients?: Array<{ name?: string; text?: string }> | string[];
  steps?: string[];

  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;

  /** Weight of a single serving in grams (optional). */
  servingWeightG?: number | null;
  /** Total yield in grams (optional). */
  yieldWeightG?: number | null;

  imageUrl?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  category?: string | null;
  cuisineType?: string | null;
  tags?: string[] | null;

  /** Main macros. All 4 required for a recipe to pass. */
  nutrition?: {
    calories?: number | null;    // kcal per serving
    protein?: number | null;     // g per serving
    fat?: number | null;         // g per serving
    carbs?: number | null;       // g per serving
    fiber?: number | null;
    sugar?: number | null;
    sodium?: number | null;
    cholesterol?: number | null;
  } | null;
}

export type QualityDecision = 'AUTO' | 'REVIEW' | 'REJECT';
export type Scalability = 'SCALABLE' | 'NON_SCALABLE';

export interface QualityReport {
  score: number;                // 0-100
  decision: QualityDecision;
  scalability: Scalability;
  missingRequired: string[];
  nonScalableReasons: string[];
  bonusReasons: string[];       // human-readable list of what contributed
  penaltyReasons: string[];     // soft deductions
  summary: string;              // one-line summary
}

// ─── Thresholds ────────────────────────────────────────────────────────────────

export const AUTO_THRESHOLD = 80;
export const REVIEW_THRESHOLD = 60;
const BASE_SCORE_WHEN_REQUIRED_MET = 60;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ingredientCount(input: QualityInput): number {
  const ing = input.ingredients;
  if (!ing) return 0;
  if (Array.isArray(ing)) return ing.length;
  return 0;
}

function hasFourMainMacros(n: QualityInput['nutrition']): boolean {
  if (!n) return false;
  return (
    isPositive(n.calories) &&
    isPositive(n.protein) &&
    isPositive(n.fat) &&
    isPositive(n.carbs)
  );
}

function isPositive(v: number | null | undefined): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

// ─── NON_SCALABLE detection ────────────────────────────────────────────────────

/**
 * Title/description patterns that suggest a single-vessel recipe (tray, round
 * cake, bread loaf). Such recipes use fixed equipment and can't easily scale
 * down to a single portion, so the diet-plan solver can't use them.
 */
// Polish inflection covers nom/gen/acc/inst and locative (ch→sz alternation for
// "blacha", k→c for "foremka"/"keksówka"). Patterns cover all common forms.
const NON_SCALABLE_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  // blacha X×Y — strongest signal, always non-scalable
  { re: /\b(?:blach\w*|blasz[ey]\w*)\s+\d+\s*[x×]\s*\d+/i, reason: 'fixed-size tray ("blacha NxM")' },
  // Generic blacha/blasze (nom + locative)
  { re: /\b(?:blach[aęyą]|blasz[ey])\b/i, reason: 'baking tray ("blacha")' },
  // tort — word boundary excludes "tortilla"
  { re: /\btort\b/i, reason: 'layered cake ("tort")' },
  // tortownica + inflected forms (tortownicy/tortownicę/tortownicą)
  { re: /\btortownic\w*/i, reason: 'springform pan ("tortownica")' },
  // foremka nominative + locative (foremce)
  { re: /\bforemk[aęyiąi]\b/i, reason: 'baking mold ("foremka")' },
  { re: /\bforemc[eyiąe]\b/i, reason: 'baking mold locative ("foremce")' },
  // keksówka nominative + locative (keksówce)
  { re: /\bkeks[óo]wk[aęyiąi]\b/i, reason: 'loaf pan ("keksówka")' },
  { re: /\bkeks[óo]wc[eyiąe]\b/i, reason: 'loaf pan locative ("keksówce")' },
  { re: /\bforma\s+(?:do\s+)?chleb/i, reason: 'bread form ("forma do chleba")' },
];

interface ScalabilityCheck {
  scalable: boolean;
  reasons: string[];
}

export function checkScalability(input: QualityInput): ScalabilityCheck {
  const reasons: string[] = [];
  const haystack = [input.title, input.description].filter(Boolean).join(' ').toLowerCase();

  for (const { re, reason } of NON_SCALABLE_PATTERNS) {
    if (re.test(haystack)) reasons.push(reason);
  }

  const servings = input.servings ?? 0;
  const kcal = input.nutrition?.calories ?? 0;
  const servingWeight = input.servingWeightG ?? 0;

  // Single-portion with huge calories — typically a whole cake miscounted
  // as "1 serving" by the source. Solver would insert 1800 kcal / dessert
  // into a slot.
  if (servings > 0 && servings <= 1 && kcal > 1200) {
    reasons.push(`single serving with high kcal (${servings} × ${kcal} kcal)`);
  }

  // Two or fewer servings but a single serving already weighs > 500 g →
  // likely a whole loaf / tart / casserole labelled as "2 portions".
  if (servings > 0 && servings <= 2 && servingWeight > 500) {
    reasons.push(`serving weight exceeds 500g for ≤2 servings (${servingWeight}g × ${servings})`);
  }

  return { scalable: reasons.length === 0, reasons };
}

// ─── Main evaluator ────────────────────────────────────────────────────────────

export function evaluateRecipeQuality(input: QualityInput): QualityReport {
  // 1. REQUIRED fields — hard reject on any miss.
  const missingRequired: string[] = [];

  if (!input.title || input.title.trim().length === 0) {
    missingRequired.push('title');
  }

  const ingCount = ingredientCount(input);
  if (ingCount < 3) {
    missingRequired.push(`ingredients>=3 (got ${ingCount})`);
  }

  const stepCount = input.steps?.length ?? 0;
  if (stepCount < 2) {
    missingRequired.push(`steps>=2 (got ${stepCount})`);
  }

  if (!hasFourMainMacros(input.nutrition)) {
    missingRequired.push('macros (calories+protein+fat+carbs)');
  }

  if (missingRequired.length > 0) {
    return {
      score: 0,
      decision: 'REJECT',
      scalability: 'SCALABLE', // not evaluated when required fails
      missingRequired,
      nonScalableReasons: [],
      bonusReasons: [],
      penaltyReasons: [],
      summary: `REJECT: missing required fields — ${missingRequired.join(', ')}`,
    };
  }

  // 2. NON_SCALABLE — hard reject.
  const scalability = checkScalability(input);
  if (!scalability.scalable) {
    return {
      score: 0,
      decision: 'REJECT',
      scalability: 'NON_SCALABLE',
      missingRequired: [],
      nonScalableReasons: scalability.reasons,
      bonusReasons: [],
      penaltyReasons: [],
      summary: `REJECT: non-scalable — ${scalability.reasons.join(', ')}`,
    };
  }

  // 3. Score with bonuses & penalties.
  let score = BASE_SCORE_WHEN_REQUIRED_MET;
  const bonusReasons: string[] = [];
  const penaltyReasons: string[] = [];

  const addBonus = (pts: number, label: string) => {
    score += pts;
    bonusReasons.push(`+${pts} ${label}`);
  };
  const addPenalty = (pts: number, label: string) => {
    score -= pts;
    penaltyReasons.push(`-${pts} ${label}`);
  };

  if (ingCount >= 5) addBonus(3, 'rich ingredient list (≥5)');
  if (stepCount >= 3) addBonus(3, 'detailed steps (≥3)');

  if (isPositive(input.servings)) addBonus(3, 'servings known');
  else addPenalty(5, 'servings missing');

  const hasTime =
    isPositive(input.totalTimeMinutes) ||
    isPositive(input.prepTimeMinutes) ||
    isPositive(input.cookTimeMinutes);
  if (hasTime) addBonus(5, 'time data');
  else addPenalty(5, 'no time data');

  if (input.imageUrl && input.imageUrl.trim().length > 0) addBonus(3, 'image');

  if (isPositive(input.rating)) {
    if ((input.ratingCount ?? 0) >= 10) {
      if ((input.rating ?? 0) >= 4.0) addBonus(5, `rating ≥4 with ${input.ratingCount} reviews`);
      else addBonus(2, 'rating present');
    } else {
      addBonus(2, 'rating present (few reviews)');
    }
  }

  if (input.category) addBonus(3, 'category');
  if (input.cuisineType) addBonus(2, 'cuisine type');
  if (input.description && input.description.trim().length >= 30) addBonus(3, 'description');

  const tagCount = input.tags?.length ?? 0;
  if (tagCount >= 3) addBonus(3, `${tagCount} tags`);
  else if (tagCount >= 1) addBonus(1, `${tagCount} tags`);

  // Extended nutrition (fiber/sugar/sodium) — bonus each, up to +9
  const n = input.nutrition!;
  let extNutrientCount = 0;
  if (isPositive(n.fiber)) extNutrientCount++;
  if (isPositive(n.sugar)) extNutrientCount++;
  if (isPositive(n.sodium)) extNutrientCount++;
  if (isPositive(n.cholesterol)) extNutrientCount++;
  if (extNutrientCount > 0) {
    addBonus(extNutrientCount * 2, `${extNutrientCount} extended nutrients`);
  }

  // Clamp
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  const decision: QualityDecision =
    score >= AUTO_THRESHOLD ? 'AUTO' : score >= REVIEW_THRESHOLD ? 'REVIEW' : 'REJECT';

  const summary = `${decision} (score=${score}): ${bonusReasons.length} bonuses, ${penaltyReasons.length} penalties`;

  return {
    score,
    decision,
    scalability: 'SCALABLE',
    missingRequired: [],
    nonScalableReasons: [],
    bonusReasons,
    penaltyReasons,
    summary,
  };
}
