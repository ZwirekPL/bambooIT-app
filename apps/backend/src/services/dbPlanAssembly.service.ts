/**
 * DB-First Plan Assembly Engine
 *
 * Core service that assembles a 7-day diet plan from the recipe database.
 * Uses a greedy algorithm with dietary rule scoring to select and scale
 * recipes for each meal slot across the week.
 *
 * Pipeline: NutritionTargets → MealDistribution → RecipeCandidates → Scale → PlanContent
 */

import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { cleanIngredientName } from '../utils/ingredientDisplayName';
import {
  findCandidates,
  type RecipeCandidateQuery,
  type ScoredRecipeCandidate,
} from './recipeCandidate.service';
import {
  computeMealDistribution,
  loadPatientMealDistribution,
  type MealSlotTarget,
  type MealDistributionResult,
} from './mealDistribution.service';
import { scaleRecipeForMeal, type MealType } from './recipeScaler.service';
import { computeMicroDeficits, computeDropRate } from './scoringContext.service';
import type {
  PlanContent,
  PlanDay,
  PlanMeal,
  PlanItem,
  PlanIngredient,
  MealRecipe,
} from './planValidation.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** Input for assembling a plan from DB */
export interface AssemblyInput {
  patientId: string;
  dietitianId?: string;                  // For per-dietitian scoring weight overrides (76a)
  days?: number;                        // Default 7
  // Filters from patient interview/protocol
  excludeAllergens?: string[];
  requiredDietFlags?: string[];
  maxCookingTimeMinutes?: number;
  preferMealPrep?: boolean;
  maxCost?: 'BUDGET' | 'STANDARD' | 'PREMIUM';
  // Clinical condition flags derived from policy engine (for solver precision)
  conditionFlags?: string[];            // e.g. ['hypertension', 'diabetes', 'ckd']
  // #4: Nutrient limits from policy engine (daily totals)
  nutrientLimits?: Array<{ nutrient: string; min?: number; max?: number }>;
  // 84.2: Keywords to penalize in solver (from disliked foods + policy exclusions)
  excludeKeywords?: string[];
  // P-1 (2026-04-22): Patient context for solver — propagated to OR-Tools so
  // P-2 can compute per-patient RDA and P-7 can apply condition modules. Today
  // the solver still only acts on hypertension/diabetes booleans; these fields
  // are plumbed through for the upcoming phases.
  sex?: 'M' | 'F' | null;
  ageYears?: number | null;
  pregnancyTrimester?: number | null;   // 1 | 2 | 3
  lactating?: boolean;
  // ── Faza D D1: Cuisine preference HARD filter ────────────────────────────
  /**
   * Patient's preferred cuisines from interview answers (decrypted in
   * `policy-engine.ts:buildPatientContext`). When non-empty, recipe pools are
   * pre-filtered to recipes whose `cuisineType` matches one of these or is
   * universal. `['any']` disables the filter.
   */
  cuisinePreferences?: string[];
  // ── Faza D feature flag: 3-tuple meal composition ────────────────────────
  /**
   * When true, the solver groups LUNCH/DINNER ≥18% slots into 3-tuples
   * (main + carb_side + veg_side) instead of single recipes. Default false
   * during phased rollout — enabled via ENABLE_3_TUPLE_COMPOSITION env var
   * in `planPipeline.service.ts` / `dbPipeline.service.ts`.
   */
  composeMeals?: boolean;
  // ── Z1: Grey list (regeneration diversity) ───────────────────────────────
  /**
   * Recipe IDs from the patient's previous N plans (N = greyListWindow).
   * The solver applies PENALTY_GREY_LIST (-800) per candidate whose
   * `recipeId` is in this set, so regeneration walks away from the prior
   * selection while staying feasible. Empty / undefined ⇒ no-op (legacy
   * behaviour relied on by the gold-standard fixtures).
   */
  greyListRecipeIds?: ReadonlySet<string>;
  // ── P1.4 / P1.5 / P1.7 (Recipe Overhaul Master Plan): SC30 protein buckets ──
  /**
   * Canonical 8-bucket subset that the patient picked in `preferredFoods`,
   * AFTER `mapPreferredFoodsToKeywords` filtered out diet-incompatible codes
   * (vegan + fish, etc.). Drives the per-week PREFERRED_BONUS_DECAY in
   * SC30. Empty / undefined → solver's decay portion is dormant; caps and
   * minimums still run.
   */
  preferredProteinBuckets?: string[];
  /**
   * 'vegan' | 'vegetarian' | 'pescatarian' — drives PROTEIN_WEEKLY_MINS
   * skips (fish_total ≥ 1 only fires for non-vegan/vegetarian). Anything
   * else / undefined treated as omnivore default. Pulled from interview
   * `dietType`.
   */
  dietaryPattern?: string | null;
}

/** Coverage report for quality assessment */
export interface CoverageReport {
  totalSlots: number;                   // Total meal slots (days x mealsPerDay)
  filledFromDb: number;                 // Slots filled from recipe DB
  uncoveredSlots: number;               // Slots that couldn't be filled
  filledFromDbPct: number;              // filledFromDb / totalSlots * 100
  avgFitScore: number;                  // Average nutritionFitScore
  avgTotalScore: number;                // Average totalScore
  diversityScore: number;               // Unique recipes / total filled
  avgKcalDeviation: number;             // Average |actual-target| kcal deviation %
  // BUG-4: Shopping efficiency (seasonings excluded)
  uniqueIngredients?: number;           // Distinct cleanProductIds across all slot recipes (non-seasoning)
  totalIngredientUses?: number;         // Sum of ingredient uses across slots (non-seasoning)
  shoppingEfficiencyScore?: number;     // totalIngredientUses / uniqueIngredients — 1.0 = no reuse, higher = better
  // Per-day breakdown
  dailyKcal: number[];
  dailyProteinG: number[];
  dailyFatG: number[];
  dailyCarbsG: number[];
  // 82.3: Glycemic load per day (GL = GI/100 × carbsG per meal, summed)
  dailyGlycemicLoad?: number[];
}

/** BUG-4: Shopping efficiency metrics (seasonings excluded). */
export interface ShoppingEfficiencyMetrics {
  uniqueIngredients: number;
  totalIngredientUses: number;
  shoppingEfficiencyScore: number;
  seasoningsExcluded: number;                            // sanity check
  topSharedProducts: Array<{ cleanProductId: string; name: string; usedInSlots: number }>;
}

/** Full result of plan assembly */
export interface AssemblyResult {
  plan: PlanContent;                    // The diet plan in standard format
  coverage: CoverageReport;
  generationMethod: 'database';
  recipeIds: string[];                  // All recipe IDs used (for metadata)
  durationMs: number;
  slotDecisions: SlotDecision[];        // Per-slot decision audit trail
}

// ─── Slot Decision Audit Trail (Faza 72) ────────────────────────────────────

/** Confidence level based on score gap between chosen and runner-up */
export type DecisionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** A runner-up candidate with reason why it wasn't selected */
export interface RunnerUp {
  recipeId: string;
  title: string;
  totalScore: number;
  adjustedScore: number;
  rejectionReason: string;              // e.g. "PENALTY_PROTEIN_REPEAT: kurczak był wczoraj"
}

/** Full decision record for a single meal slot */
export interface SlotDecision {
  dayIndex: number;
  slotIndex: number;
  dayName: string;
  mealType: string;
  candidatesCount: number;              // Total candidates after hard filter
  // Chosen recipe
  chosen: {
    recipeId: string;
    title: string;
    totalScore: number;
    adjustedScore: number;
    scores: {
      nutritionFit: number;
      quality: number;
      patientRating: number;
      cuisine: number;
      season: number;
      diversity: number;
      cost: number;
      microFit: number;
      practicalFit: number;
      satietyProxy: number;
      interaction: number;
      compliance: number;
    };
  } | null;                             // null if slot is uncovered
  runnersUp: RunnerUp[];                // Top 3 alternatives
  rulesApplied: string[];               // C2 rules that affected scoring
  confidence: DecisionConfidence;       // Gap between chosen and runner-up
  scalingFailed: boolean;               // True if best candidate failed scaling
}

/** Context passed to dietary rule scoring adjustments */
interface DietaryContext {
  dayIndex: number;
  slotIndex: number;
  mealType: string;
  usedRecipeIds: Set<string>;
  usedTitlesToday: string[];            // Recipe titles used today (for name similarity check)
  proteinSourcesYesterday: string[];    // Previous day protein sources
  proteinSourcesToday: string[];        // Today so far
  categoryCountsWeekly: Map<string, number>;
  lunchKcalToday?: number;             // For kolacja < obiad rule
}

/** Tracking data for a single filled slot */
interface FilledSlotData {
  candidate: ScoredRecipeCandidate;
  adjustedScore: number;
  scaledKcal: number;
  scaledProteinG: number;
  scaledFatG: number;
  scaledCarbsG: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_NAMES = [
  'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela',
];

/** Candidate query limit — fetch top N per slot for dietary rule re-ranking */
const CANDIDATE_LIMIT = 20;

/** Minimum acceptable kcal per meal after scaling — reject if below this */
const MIN_MEAL_KCAL = 100;

/** Alternative mealTypes to try when primary has no candidates */
const FALLBACK_MEAL_TYPES: Record<string, string[]> = {
  SNACK: ['DESSERT', 'SECOND_BREAKFAST', 'SIDE_DISH'],
  SECOND_BREAKFAST: ['SNACK', 'BREAKFAST'],
  SUPPER: ['DINNER', 'SNACK'],
  DESSERT: ['SNACK'],
  SIDE_DISH: ['SNACK'],
  SAUCE: ['SIDE_DISH'],
};

/** Protein source keywords for rotation detection (Polish + English) */
const PROTEIN_SOURCE_MAP: Record<string, RegExp[]> = {
  poultry: [/kurczak/i, /indyk/i, /drob/i, /pierś/i, /udko/i, /filet\s*(z\s*)?kur/i],
  fish:    [/łosoś/i, /dorsz/i, /tuńczyk/i, /pstrąg/i, /makrela/i, /ryb/i, /krewet/i, /śledź/i],
  beef:    [/wołowin/i, /cielęc/i, /polędwic/i],
  pork:    [/wieprzow/i, /szynk/i, /schab/i, /boczek/i],
  eggs:    [/jaj[ko]/i, /jajka/i, /jaje/i],
  dairy:   [/twaróg/i, /jogurt/i, /kefir/i, /ser\b/i, /skyr/i, /ricotta/i, /feta/i, /mozzarella/i],
  legumes: [/soczewic/i, /ciecierzyc/i, /fasol/i, /groch/i, /bób\b/i],
  tofu:    [/tofu/i, /tempeh/i, /seitan/i],
};

// ─── C2 Dietary Rule Penalties / Bonuses ─────────────────────────────────────

const PENALTY_WEEKLY_CAP = -30;         // C2.2: category used too many times this week
const PENALTY_PROTEIN_REPEAT = -20;     // C2.4: same protein source as yesterday
const PENALTY_HEAVY_DINNER = -15;       // C2.6: dinner heavier than 85% of lunch
const PENALTY_BREAKFAST_LOW_PROTEIN = -25; // C2.7: breakfast with low protein
const PENALTY_PURE_CARB = -20;          // C2.9: meals with <10% protein by kcal
const PENALTY_SIMILAR_NAME_TODAY = -50; // NEW: same keyword in title as another meal today
const PENALTY_SAME_RECIPE_WEEK = -80;   // NEW: same recipe already used this week
const BONUS_WHOLE_GRAINS = 5;           // C2.10: whole grain ingredients
const BONUS_HIGH_FIBER = 5;             // C2.11: >8g fiber per serving

/** Weekly limits per category pattern */
const WEEKLY_CATEGORY_CAPS: Record<string, number> = {
  'owsian':    2, // max 2 oatmeal-based meals per week
  'oatmeal':   2,
  'sałatk':    2, // max 2 salad-based meals per week
  'salad':     2,
};

/** Weekly minimum thresholds for bonus scoring (not hard limits) */
const WEEKLY_CATEGORY_MINIMUMS: Record<string, number> = {
  'strączkowe': 2, // encourage at least 2 legume meals per week
  'legumes':    2,
};

// ─── Utility Helpers ─────────────────────────────────────────────────────────

/** Convert Prisma Decimal to number safely. */
function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

/**
 * Detect protein sources from recipe tags and title.
 * Returns an array of protein source category strings.
 */
function getProteinSources(candidate: ScoredRecipeCandidate): string[] {
  const sources: string[] = [];
  const searchText = [candidate.title, ...candidate.tags].join(' ');

  for (const [source, patterns] of Object.entries(PROTEIN_SOURCE_MAP)) {
    if (patterns.some((p) => p.test(searchText))) {
      sources.push(source);
    }
  }

  return sources;
}

/**
 * Check if a recipe title/tags/category match a keyword pattern.
 * Used for weekly cap and minimum tracking.
 */
function matchesCategoryPattern(candidate: ScoredRecipeCandidate, pattern: string): boolean {
  const regex = new RegExp(pattern, 'i');
  return (
    regex.test(candidate.title) ||
    regex.test(candidate.category) ||
    candidate.tags.some((t) => regex.test(t))
  );
}

/**
 * Compute protein % of total kcal for a recipe candidate.
 * Uses scaled values for accuracy.
 */
function proteinPctOfKcal(candidate: ScoredRecipeCandidate): number {
  if (candidate.scaledKcal <= 0) return 0;
  return (candidate.scaledProteinG * 4 / candidate.scaledKcal) * 100;
}

/**
 * Extract significant keywords from a recipe title (3+ chars, lowercased).
 * Used to detect "Omlet białkowy" vs "Omlet cesarski" as similar.
 */
function extractTitleKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[\s,\-–—:()]+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOP_WORDS.has(w));
}

/** Common words to ignore in title similarity checks */
const STOP_WORDS = new Set([
  'the', 'and', 'with', 'bez', 'dla', 'lub', 'jak', 'typ', 'ala',
  'przepis', 'sposób', 'styl', 'fit', 'wege', 'wegański', 'szybki',
]);

/**
 * Check if a candidate title shares significant keywords with any title used today.
 * Returns true if there's a naming overlap (e.g. both contain "omlet" or "naleśniki").
 */
function hasTitleSimilarityToday(title: string, usedTitlesToday: string[]): boolean {
  const candidateWords = extractTitleKeywords(title);
  for (const usedTitle of usedTitlesToday) {
    const usedWords = extractTitleKeywords(usedTitle);
    const overlap = candidateWords.filter((w) => usedWords.includes(w));
    if (overlap.length > 0) return true;
  }
  return false;
}

// ─── C2 Dietary Rules ────────────────────────────────────────────────────────

/**
 * Apply C2 dietary rules as score adjustments to candidate list.
 *
 * Rules are additive bonuses/penalties on the candidate's totalScore.
 * This allows soft preferences — rules influence but don't hard-filter.
 *
 * @param candidates - scored recipe candidates from findCandidates()
 * @param ctx - current assembly context (day, slot, weekly state)
 * @returns candidates with adjusted totalScore, sorted descending
 */
/** Result of applying dietary rules to a single candidate */
interface RankedCandidate extends ScoredRecipeCandidate {
  adjustedScore: number;
  appliedRules: string[];               // Rules that affected this candidate's score
}

function applyDietaryRules(
  candidates: ScoredRecipeCandidate[],
  ctx: DietaryContext,
): RankedCandidate[] {
  return candidates
    .map((c) => {
      let adjustment = 0;
      const appliedRules: string[] = [];

      // ── C2.2: Weekly category caps ──────────────────────────────────────
      for (const [pattern, maxCount] of Object.entries(WEEKLY_CATEGORY_CAPS)) {
        if (matchesCategoryPattern(c, pattern)) {
          const currentCount = ctx.categoryCountsWeekly.get(pattern) ?? 0;
          if (currentCount >= maxCount) {
            adjustment += PENALTY_WEEKLY_CAP;
            appliedRules.push(`WEEKLY_CAP: ${pattern} ${currentCount}/${maxCount}`);
          }
        }
      }

      // ── C2.4: Protein rotation — penalize if same protein source as yesterday
      const candidateProteins = getProteinSources(c);
      if (candidateProteins.length > 0 && ctx.proteinSourcesYesterday.length > 0) {
        const overlap = candidateProteins.filter((p) =>
          ctx.proteinSourcesYesterday.includes(p),
        );
        if (overlap.length > 0) {
          adjustment += PENALTY_PROTEIN_REPEAT;
          appliedRules.push(`PROTEIN_REPEAT: ${overlap.join(',')} was yesterday`);
        }
      }

      // ── C2.6: Light dinner — kolacja should be lighter than obiad ──────
      if (
        ctx.mealType === 'DINNER' &&
        ctx.lunchKcalToday != null &&
        ctx.lunchKcalToday > 0
      ) {
        const dinnerCap = ctx.lunchKcalToday * 0.85;
        if (c.scaledKcal > dinnerCap) {
          adjustment += PENALTY_HEAVY_DINNER;
          appliedRules.push(`HEAVY_DINNER: ${Math.round(c.scaledKcal)} > ${Math.round(dinnerCap)} (85% lunch)`);
        }
      }

      // ── C2.7: Breakfast must contain protein source ────────────────────
      if (ctx.mealType === 'BREAKFAST') {
        const protPct = proteinPctOfKcal(c);
        if (protPct < 15) {
          adjustment += PENALTY_BREAKFAST_LOW_PROTEIN;
          appliedRules.push(`LOW_BREAKFAST_PROTEIN: ${protPct.toFixed(1)}% < 15%`);
        }
      }

      // ── C2.9: No pure-carb meals — penalize <10% protein by kcal ──────
      const protPct = proteinPctOfKcal(c);
      if (protPct < 10) {
        adjustment += PENALTY_PURE_CARB;
        appliedRules.push(`PURE_CARB: protein ${protPct.toFixed(1)}% < 10%`);
      }

      // ── NEW: Penalize same recipe already used this week ──────────────
      if (ctx.usedRecipeIds.has(c.recipeId)) {
        adjustment += PENALTY_SAME_RECIPE_WEEK;
        appliedRules.push('SAME_RECIPE_WEEK');
      }

      // ── NEW: Penalize similar title in the same day (omlet+omlet, naleśniki+naleśniki)
      if (hasTitleSimilarityToday(c.title, ctx.usedTitlesToday)) {
        adjustment += PENALTY_SIMILAR_NAME_TODAY;
        appliedRules.push(`SIMILAR_NAME_TODAY: "${c.title}"`);
      }

      // ── C2.10: Whole grains bonus ─────────────────────────────────────
      const wholeGrainMatch = c.tags.some(
        (t) => /pełnoziarnist/i.test(t) || /whole\s*grain/i.test(t),
      );
      if (wholeGrainMatch) {
        adjustment += BONUS_WHOLE_GRAINS;
        appliedRules.push('WHOLE_GRAINS_BONUS');
      }

      // ── C2.11: High fiber bonus (>8g per serving) ─────────────────────
      if (c.fiberG > 8) {
        adjustment += BONUS_HIGH_FIBER;
        appliedRules.push(`HIGH_FIBER_BONUS: ${c.fiberG.toFixed(1)}g`);
      }

      return {
        ...c,
        adjustedScore: Math.max(0, c.totalScore + adjustment),
        appliedRules,
      };
    })
    .sort((a, b) => {
      const diff = b.adjustedScore - a.adjustedScore;
      return diff !== 0 ? diff : b.nutritionFitScore - a.nutritionFitScore;
    });
}

/**
 * Compute decision confidence based on score gap between #1 and #2.
 * HIGH = clear winner (>15 pts), MEDIUM = moderate (5-15), LOW = near tie (<5).
 */
function computeConfidence(chosenScore: number, runnerUpScore: number): DecisionConfidence {
  const gap = chosenScore - runnerUpScore;
  if (gap > 15) return 'HIGH';
  if (gap >= 5) return 'MEDIUM';
  return 'LOW';
}

/**
 * Build a SlotDecision record from the ranked candidates and chosen result.
 */
function buildSlotDecision(
  dayIndex: number,
  slotIndex: number,
  dayName: string,
  mealType: string,
  ranked: RankedCandidate[],
  chosen: RankedCandidate | null,
  scalingFailed: boolean,
): SlotDecision {
  const runnersUp: RunnerUp[] = ranked
    .filter((r) => r.recipeId !== chosen?.recipeId)
    .slice(0, 3)
    .map((r) => ({
      recipeId: r.recipeId,
      title: r.title,
      totalScore: Math.round(r.totalScore * 10) / 10,
      adjustedScore: Math.round(r.adjustedScore * 10) / 10,
      rejectionReason: r.appliedRules.length > 0
        ? r.appliedRules.join('; ')
        : 'Lower score',
    }));

  // Collect all unique rules that affected any candidate in this slot
  const allRules = new Set<string>();
  for (const r of ranked.slice(0, 10)) {
    for (const rule of r.appliedRules) {
      allRules.add(rule.split(':')[0]); // Just the rule name, not details
    }
  }

  const chosenScore = chosen?.adjustedScore ?? 0;
  const runnerUpScore = runnersUp[0]?.adjustedScore ?? 0;

  return {
    dayIndex,
    slotIndex,
    dayName,
    mealType,
    candidatesCount: ranked.length,
    chosen: chosen
      ? {
          recipeId: chosen.recipeId,
          title: chosen.title,
          totalScore: Math.round(chosen.totalScore * 10) / 10,
          adjustedScore: Math.round(chosen.adjustedScore * 10) / 10,
          scores: {
            nutritionFit: Math.round(chosen.nutritionFitScore * 10) / 10,
            quality: Math.round(chosen.qualityScore * 10) / 10,
            patientRating: Math.round(chosen.patientRatingScore * 10) / 10,
            cuisine: Math.round(chosen.cuisineScore * 10) / 10,
            season: Math.round(chosen.seasonScore * 10) / 10,
            diversity: Math.round(chosen.diversityScore * 10) / 10,
            cost: Math.round(chosen.costScore * 10) / 10,
            microFit: Math.round(chosen.microFitScore * 10) / 10,
            practicalFit: Math.round(chosen.practicalFitScore * 10) / 10,
            satietyProxy: Math.round(chosen.satietyProxyScore * 10) / 10,
            interaction: Math.round(chosen.interactionScore * 10) / 10,
            compliance: Math.round(chosen.complianceScore * 10) / 10,
          },
        }
      : null,
    runnersUp,
    rulesApplied: [...allRules],
    confidence: chosen ? computeConfidence(chosenScore, runnerUpScore) : 'LOW',
    scalingFailed,
  };
}

// ─── Recipe Data Loader ──────────────────────────────────────────────────────

/**
 * Load full recipe data for PlanMeal conversion (ingredients + steps).
 *
 * This is separate from the candidate query because we only load full data
 * for the SELECTED recipe, not all 20 candidates.
 */
async function loadRecipeForPlan(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      id: true,
      title: true,
      prepTimeMinutes: true,
      totalTimeMinutes: true,
      tips: true,
      servings: true,
      ingredients: {
        select: {
          id: true,
          grams: true,
          displayName: true,
          notes: true,
          cleanProduct: {
            select: {
              name: true,
              nutrients: {
                select: {
                  kcalPer100g: true,
                  proteinPer100g: true,
                  fatPer100g: true,
                  carbsPer100g: true,
                  fiberPer100g: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      instructionSteps: {
        select: {
          stepNumber: true,
          instruction: true,
        },
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  if (!recipe) {
    throw new AppError(404, 'RECIPE_NOT_FOUND', `Recipe ${recipeId} not found`);
  }

  return recipe;
}

// ─── PlanMeal Conversion ─────────────────────────────────────────────────────

/**
 * Convert a selected candidate + scaled ingredients into PlanMeal format.
 *
 * Loads full recipe data (ingredients with nutrients, instruction steps)
 * and builds the PlanMeal structure that matches the existing plan format.
 *
 * @param candidate - the selected scored recipe candidate
 * @param slot - the meal slot target (mealName, macros)
 * @param scaledIngredients - per-ingredient scaled grams from recipeScaler
 * @returns PlanMeal ready for inclusion in PlanDay
 */
async function candidateToMeal(
  candidate: ScoredRecipeCandidate,
  slot: MealSlotTarget,
  scaledIngredients: Array<{ ingredientId: string; displayName: string | null; grams: number }>,
): Promise<PlanMeal> {
  const recipe = await loadRecipeForPlan(candidate.recipeId);

  // Build ingredient lookup: ingredientId → scaled grams (for WHOLE recipe)
  const scaledMap = new Map<string, number>();
  for (const si of scaledIngredients) {
    scaledMap.set(si.ingredientId, si.grams);
  }

  // Build ingredients list and compute total macros for ONE SERVING
  // Note: scaler already returns per-serving grams (not whole recipe)
  const planIngredients: PlanIngredient[] = [];
  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalGrams = 0;

  for (const ing of recipe.ingredients) {
    // scaledMap values are already PER SERVING from recipeScaler
    // Fallback: divide original grams by servings if not in scaledMap
    const servings = recipe.servings || 1;
    const scaledGrams = scaledMap.get(ing.id) ?? (toNum(ing.grams) / servings);
    const displayName =
      ing.cleanProduct?.name ??
      cleanIngredientName(ing.displayName) ??
      'Unknown';
    const nutrients = ing.cleanProduct?.nutrients;

    if (nutrients) {
      const factor = scaledGrams / 100;
      totalKcal += toNum(nutrients.kcalPer100g) * factor;
      totalProtein += toNum(nutrients.proteinPer100g) * factor;
      totalFat += toNum(nutrients.fatPer100g) * factor;
      totalCarbs += toNum(nutrients.carbsPer100g) * factor;
    }

    totalGrams += scaledGrams;

    planIngredients.push({
      name: displayName,
      grams: Math.round(scaledGrams),
    });
  }

  // One PlanItem per recipe (matching AI plan format)
  const items: PlanItem[] = [
    {
      name: recipe.title,
      grams: Math.round(totalGrams),
      kcal: Math.round(totalKcal),
      protein: Math.round(totalProtein * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      ingredients: planIngredients,
    },
  ];

  // Build recipe steps
  const steps = recipe.instructionSteps.map((s) => s.instruction);

  const mealRecipe: MealRecipe = {
    prepTimeMin: recipe.prepTimeMinutes ?? recipe.totalTimeMinutes ?? 0,
    steps,
    ...(recipe.tips ? { tips: recipe.tips } : {}),
  };

  return {
    name: slot.mealName,
    items,
    recipe: mealRecipe,
  };
}

/**
 * Build a placeholder PlanMeal for uncovered slots.
 * This signals to downstream consumers that AI fallback or manual fill is needed.
 */
function buildPlaceholderMeal(slot: MealSlotTarget): PlanMeal {
  return {
    name: slot.mealName,
    items: [
      {
        name: `[Brak przepisu — ${slot.mealName}]`,
        grams: 0,
        kcal: slot.targetKcal,
        protein: slot.targetProteinG,
        fat: slot.targetFatG,
        carbs: slot.targetCarbsG,
      },
    ],
  };
}

// ─── Coverage Report Builder ─────────────────────────────────────────────────

function buildCoverageReport(
  numDays: number,
  slots: MealSlotTarget[],
  filledSlots: Map<string, FilledSlotData>,   // key: "day:slot"
  dayMeals: PlanDay[],
): CoverageReport {
  const totalSlots = numDays * slots.length;
  const filledFromDb = filledSlots.size;
  const uncoveredSlots = totalSlots - filledFromDb;
  const filledFromDbPct = totalSlots > 0
    ? Math.round((filledFromDb / totalSlots) * 1000) / 10
    : 0;

  // Average scores from filled slots
  let sumFitScore = 0;
  let sumTotalScore = 0;
  const uniqueRecipeIds = new Set<string>();
  let sumKcalDevPct = 0;

  for (const data of filledSlots.values()) {
    sumFitScore += data.candidate.nutritionFitScore;
    sumTotalScore += data.adjustedScore;
    uniqueRecipeIds.add(data.candidate.recipeId);
  }

  const avgFitScore = filledFromDb > 0
    ? Math.round((sumFitScore / filledFromDb) * 10) / 10
    : 0;
  const avgTotalScore = filledFromDb > 0
    ? Math.round((sumTotalScore / filledFromDb) * 10) / 10
    : 0;
  const diversityScore = filledFromDb > 0
    ? Math.round((uniqueRecipeIds.size / filledFromDb) * 1000) / 1000
    : 0;

  // Per-day macro totals
  const dailyKcal: number[] = [];
  const dailyProteinG: number[] = [];
  const dailyFatG: number[] = [];
  const dailyCarbsG: number[] = [];

  for (let d = 0; d < numDays; d++) {
    let dayKcal = 0;
    let dayProtein = 0;
    let dayFat = 0;
    let dayCarbs = 0;

    for (let s = 0; s < slots.length; s++) {
      const key = `${d}:${s}`;
      const data = filledSlots.get(key);
      if (data) {
        dayKcal += data.scaledKcal;
        dayProtein += data.scaledProteinG;
        dayFat += data.scaledFatG;
        dayCarbs += data.scaledCarbsG;
      }
    }

    dailyKcal.push(Math.round(dayKcal));
    dailyProteinG.push(Math.round(dayProtein * 10) / 10);
    dailyFatG.push(Math.round(dayFat * 10) / 10);
    dailyCarbsG.push(Math.round(dayCarbs * 10) / 10);

    // Compute daily kcal deviation %
    const dayTargetKcal = slots.reduce((sum, sl) => sum + sl.targetKcal, 0);
    if (dayTargetKcal > 0) {
      sumKcalDevPct += Math.abs(dayKcal - dayTargetKcal) / dayTargetKcal * 100;
    }
  }

  const avgKcalDeviation = numDays > 0
    ? Math.round((sumKcalDevPct / numDays) * 10) / 10
    : 0;

  return {
    totalSlots,
    filledFromDb,
    uncoveredSlots,
    filledFromDbPct,
    avgFitScore,
    avgTotalScore,
    diversityScore,
    avgKcalDeviation,
    dailyKcal,
    dailyProteinG,
    dailyFatG,
    dailyCarbsG,
  };
}

// ─── Shopping Efficiency (BUG-4) ─────────────────────────────────────────────

/**
 * Seasonings/spices measured "to taste" — excluded from shopping efficiency metric
 * because buying 1g of salt has no meaningful shopping-list impact and would
 * inflate reuse score artificially (same sól in every recipe).
 *
 * Kept in sync with TASTE_ONLY_NAMES in planValidation.service.ts.
 */
const SEASONING_NAMES: ReadonlySet<string> = new Set([
  'sól', 'sól i pieprz',
  'pieprz', 'pieprz czarny', 'pieprz biały',
  'chili',
  'papryka słodka', 'papryka ostra', 'papryka wędzona',
  'cynamon',
  'oregano', 'tymianek', 'rozmaryn', 'majeranek',
  'kurkuma', 'kminek', 'kmin rzymski',
  'gałka muszkatołowa', 'imbir mielony',
  'liść laurowy', 'ziele angielskie',
  'suszony czosnek', 'czosnek granulowany',
]);

const SEASONING_CATEGORY = 'Przyprawy i zioła';

/**
 * Compute shopping efficiency for a plan's selected recipes.
 *
 * Seasonings (CleanProduct.category='Przyprawy i zioła' OR name in TASTE_ONLY_NAMES)
 * are excluded — they don't reflect real shopping burden.
 *
 * @param recipeIds - list of recipe IDs, with duplicates preserved (one per slot).
 *                   Repeating a recipe in 2 slots counts its ingredients 2x in totalUses.
 */
export async function computeShoppingEfficiency(recipeIds: string[]): Promise<ShoppingEfficiencyMetrics> {
  const empty: ShoppingEfficiencyMetrics = {
    uniqueIngredients: 0,
    totalIngredientUses: 0,
    shoppingEfficiencyScore: 0,
    seasoningsExcluded: 0,
    topSharedProducts: [],
  };
  if (recipeIds.length === 0) return empty;

  const uniqueRecipeIds = [...new Set(recipeIds)];
  const rows = await prisma.recipeIngredient.findMany({
    where: { recipeId: { in: uniqueRecipeIds }, cleanProductId: { not: null } },
    select: {
      recipeId: true,
      cleanProductId: true,
      cleanProduct: { select: { name: true, category: true } },
    },
  });

  // Group non-seasoning ingredients per recipe (dedup cleanProductId within a recipe)
  const nonSeasoningByRecipe = new Map<string, Set<string>>();
  const productNames = new Map<string, string>();
  let seasoningsExcluded = 0;

  for (const r of rows) {
    if (!r.cleanProductId || !r.cleanProduct) continue;
    const name = r.cleanProduct.name.toLowerCase();
    const isSeasoning =
      r.cleanProduct.category === SEASONING_CATEGORY ||
      SEASONING_NAMES.has(name);

    if (isSeasoning) {
      seasoningsExcluded++;
      continue;
    }

    const set = nonSeasoningByRecipe.get(r.recipeId) ?? new Set<string>();
    set.add(r.cleanProductId);
    nonSeasoningByRecipe.set(r.recipeId, set);
    productNames.set(r.cleanProductId, r.cleanProduct.name);
  }

  // Count uses across slots (duplicate recipes count multiple times)
  const usageCount = new Map<string, number>();
  let totalIngredientUses = 0;

  for (const recipeId of recipeIds) {
    const products = nonSeasoningByRecipe.get(recipeId);
    if (!products) continue;
    for (const productId of products) {
      usageCount.set(productId, (usageCount.get(productId) ?? 0) + 1);
      totalIngredientUses++;
    }
  }

  const uniqueIngredients = usageCount.size;
  const shoppingEfficiencyScore = uniqueIngredients > 0
    ? Math.round((totalIngredientUses / uniqueIngredients) * 100) / 100
    : 0;

  const topSharedProducts = [...usageCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cleanProductId, usedInSlots]) => ({
      cleanProductId,
      name: productNames.get(cleanProductId) ?? 'Unknown',
      usedInSlots,
    }));

  return {
    uniqueIngredients,
    totalIngredientUses,
    shoppingEfficiencyScore,
    seasoningsExcluded,
    topSharedProducts,
  };
}

// ─── Main Assembly Function ──────────────────────────────────────────────────

/**
 * Assemble a complete diet plan from the recipe database.
 *
 * Algorithm — greedy with dietary rule re-ranking:
 *
 *  1. Load patient nutrition targets and compute meal distribution
 *  2. For each day (0..N-1), for each meal slot:
 *     a. Build a RecipeCandidateQuery with filters and exclusions
 *     b. Fetch scored candidates from the recipe DB
 *     c. Apply C2 dietary rules (weekly caps, rotation, light dinner, etc.)
 *     d. Pick the best candidate (highest adjusted score)
 *     e. Scale the recipe to match the slot's macro targets
 *     f. Convert to PlanMeal format
 *     g. Update tracking state (used recipes, protein sources, categories)
 *  3. Build coverage report for quality assessment
 *  4. Return the assembled plan with metadata
 *
 * @param input - assembly configuration (patientId, filters, preferences)
 * @returns the assembled plan, coverage report, and recipe IDs used
 * @throws AppError if patient data (targets, interview) is missing
 */
export async function assembleDbPlan(input: AssemblyInput): Promise<AssemblyResult> {
  const startMs = Date.now();
  const numDays = input.days ?? 7;

  // ── 1. Load patient data and compute meal distribution ─────────────────
  const distInput = await loadPatientMealDistribution(input.patientId);
  // Faza D Phase 1 W2-Wed: forward compose flag (gates D4/D7 distribution variants).
  const distribution = computeMealDistribution({ ...distInput, composeMeals: input.composeMeals });

  // ── 1b. Load scoring context (Faza 73/75C) ────────────────────────────
  const [microDeficits, dropRate] = await Promise.all([
    computeMicroDeficits(input.patientId).catch(() => []),
    computeDropRate(input.patientId).catch(() => ({ highTime: 0.15, highIngredient: 0.1 })),
  ]);

  // ── 1c. Load per-dietitian scoring weight overrides (76a) ────────────
  let dietitianWeightOverrides: Record<string, number> | null = null;
  if (input.dietitianId) {
    const profile = await prisma.dietitianProfile.findUnique({
      where: { userId: input.dietitianId },
      select: { scoringWeightsOverride: true },
    });
    if (profile?.scoringWeightsOverride) {
      dietitianWeightOverrides = profile.scoringWeightsOverride as Record<string, number>;
    }
  }

  // ── 2. Initialize tracking state ───────────────────────────────────────
  const usedRecipeIds = new Set<string>();
  const usedCuisinesByDay = new Map<number, string[]>();
  const proteinSourcesByDay = new Map<number, string[]>();
  const categoryCountsWeekly = new Map<string, number>();

  // Filled slot tracking for coverage report
  const filledSlots = new Map<string, FilledSlotData>();
  const allRecipeIds: string[] = [];
  const slotDecisions: SlotDecision[] = [];

  // Build plan days
  const planDays: PlanDay[] = [];

  // Current month for seasonal scoring
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Compute daily kcal target from slot targets (for portion limit scaling)
  const dailyKcalTarget = distribution.slots.reduce((sum, s) => sum + s.targetKcal, 0);

  // ── 3. Iterate over each day ───────────────────────────────────────────
  for (let dayIndex = 0; dayIndex < numDays; dayIndex++) {
    const dayMeals: PlanMeal[] = [];
    const dayName = DAY_NAMES[dayIndex % DAY_NAMES.length];

    // Initialize day-level tracking
    usedCuisinesByDay.set(dayIndex, []);
    proteinSourcesByDay.set(dayIndex, []);
    const usedTitlesToday: string[] = [];

    // Track lunch kcal for the light-dinner rule
    let lunchKcalToday: number | undefined;

    // ── 3a. Iterate over each meal slot ──────────────────────────────────
    for (let slotIndex = 0; slotIndex < distribution.slots.length; slotIndex++) {
      const slot = distribution.slots[slotIndex];

      // Build candidate query
      const query: RecipeCandidateQuery = {
        mealType: slot.mealType,
        targetKcal: slot.targetKcal,
        targetProteinG: slot.targetProteinG,
        targetFatG: slot.targetFatG,
        targetCarbsG: slot.targetCarbsG,
        excludeAllergens: input.excludeAllergens,
        requiredDietFlags: input.requiredDietFlags,
        excludeRecipeIds: [...usedRecipeIds],
        excludeCuisineTypes: usedCuisinesByDay.get(dayIndex) ?? [],
        maxTotalTimeMinutes: input.maxCookingTimeMinutes,
        preferMealPrep: input.preferMealPrep,
        season: currentMonth,
        maxCost: input.maxCost,
        limit: CANDIDATE_LIMIT,
        // Faza 73/75C: Scoring context
        patientMaxCookingTime: input.maxCookingTimeMinutes,
        microDeficits: microDeficits as Array<{ nutrient: string; gapPct: number }>,
        patientDropRate: dropRate as { highTime: number; highIngredient: number },
        currentSlotIndex: slotIndex,
        // Faza 76a: Per-dietitian scoring weight overrides
        dietitianWeightOverrides,
      };

      // Fetch scored candidates
      let candidates: ScoredRecipeCandidate[];
      try {
        candidates = await findCandidates(query);
      } catch (err) {
        // If query fails (e.g. invalid target), log and skip
        console.warn(
          `[dbPlanAssembly] Failed to find candidates for day ${dayIndex}, slot ${slotIndex} (${slot.mealName}):`,
          err instanceof Error ? err.message : err,
        );
        candidates = [];
      }

      // Fallback 1: relax cuisine exclusion
      if (candidates.length === 0) {
        try {
          candidates = await findCandidates({ ...query, excludeCuisineTypes: undefined });
        } catch { candidates = []; }
      }

      // Fallback 2: try alternative mealTypes (SNACK → DESSERT, SECOND_BREAKFAST, etc.)
      if (candidates.length === 0) {
        const altMealTypes = FALLBACK_MEAL_TYPES[slot.mealType] ?? [];
        for (const altType of altMealTypes) {
          try {
            candidates = await findCandidates({ ...query, mealType: altType, excludeCuisineTypes: undefined });
            if (candidates.length > 0) break;
          } catch { /* continue */ }
        }
      }

      // Fallback 3: allow recipe repeats (last resort)
      if (candidates.length === 0) {
        try {
          candidates = await findCandidates({ ...query, excludeRecipeIds: undefined, excludeCuisineTypes: undefined });
        } catch { candidates = []; }
      }

      // ── 3b. Apply C2 dietary rules ────────────────────────────────────
      if (candidates.length === 0) {
        // No candidates at all — mark as uncovered
        dayMeals.push(buildPlaceholderMeal(slot));
        slotDecisions.push(buildSlotDecision(dayIndex, slotIndex, dayName, slot.mealType, [], null, false));
        continue;
      }

      const dietaryContext: DietaryContext = {
        dayIndex,
        slotIndex,
        mealType: slot.mealType,
        usedRecipeIds,
        usedTitlesToday,
        proteinSourcesYesterday: dayIndex > 0
          ? (proteinSourcesByDay.get(dayIndex - 1) ?? [])
          : [],
        proteinSourcesToday: proteinSourcesByDay.get(dayIndex) ?? [],
        categoryCountsWeekly,
        lunchKcalToday,
      };

      const ranked = applyDietaryRules(candidates, dietaryContext);

      // ── 3c. Pick best candidate that scales to >= MIN_MEAL_KCAL ─────
      let meal: PlanMeal | null = null;
      let best: RankedCandidate | null = null;
      let actualKcal = 0;
      let actualProtein = 0;
      let actualFat = 0;
      let actualCarbs = 0;

      // Map slot mealType to scaler MealType for portion limits
      const SCALER_MEAL_MAP: Record<string, MealType> = {
        BREAKFAST: 'breakfast', SECOND_BREAKFAST: 'snack',
        LUNCH: 'lunch', DINNER: 'dinner',
        SUPPER: 'snack', SNACK: 'snack',
      };
      const scalerMealType = SCALER_MEAL_MAP[slot.mealType] ?? 'lunch';

      // Try top candidates until one scales properly
      for (const candidate of ranked.slice(0, 5)) {
        try {
          const scalingResult = await scaleRecipeForMeal(candidate.recipeId, {
            targetKcal: slot.targetKcal,
            targetProteinG: slot.targetProteinG,
            targetFatG: slot.targetFatG,
            targetCarbsG: slot.targetCarbsG,
          }, scalerMealType, dailyKcalTarget);

          // Reject if scaled kcal is too low (portion too small to be a real meal)
          if (scalingResult.scaledNutrition.kcal < MIN_MEAL_KCAL && slot.targetKcal >= MIN_MEAL_KCAL) {
            continue; // Try next candidate
          }

          // Convert to PlanMeal format
          meal = await candidateToMeal(candidate, slot, scalingResult.ingredients);

          // Scaler's scaledNutrition is already PER SERVING
          actualKcal = scalingResult.scaledNutrition.kcal;
          actualProtein = scalingResult.scaledNutrition.proteinG;
          actualFat = scalingResult.scaledNutrition.fatG;
          actualCarbs = scalingResult.scaledNutrition.carbsG;

          // Override meal item macros with scaler's per-serving values
          if (meal.items.length > 0) {
            meal.items[0].kcal = Math.round(actualKcal);
            meal.items[0].protein = Math.round(actualProtein * 10) / 10;
            meal.items[0].fat = Math.round(actualFat * 10) / 10;
            meal.items[0].carbs = Math.round(actualCarbs * 10) / 10;
          }

          best = candidate;
          break; // Found a good candidate
        } catch {
          continue; // Scaling failed, try next
        }
      }

      if (!meal || !best) {
        // All candidates failed scaling — use placeholder
        dayMeals.push(buildPlaceholderMeal(slot));
        slotDecisions.push(buildSlotDecision(dayIndex, slotIndex, dayName, slot.mealType, ranked, null, true));
        continue;
      }

      // Record slot decision audit trail
      slotDecisions.push(buildSlotDecision(dayIndex, slotIndex, dayName, slot.mealType, ranked, best, false));

      // Track filled slot
      const slotKey = `${dayIndex}:${slotIndex}`;
      filledSlots.set(slotKey, {
        candidate: best,
        adjustedScore: best.adjustedScore,
        scaledKcal: actualKcal,
        scaledProteinG: actualProtein,
        scaledFatG: actualFat,
        scaledCarbsG: actualCarbs,
      });

      // Track lunch kcal for the light-dinner rule
      if (slot.mealType === 'LUNCH') {
        lunchKcalToday = actualKcal;
      }

      dayMeals.push(meal);

      // ── 3f. Update tracking state ─────────────────────────────────────
      usedRecipeIds.add(best.recipeId);
      allRecipeIds.push(best.recipeId);
      usedTitlesToday.push(best.title);

      // Track cuisine type for day-level diversity
      if (best.cuisineType) {
        const dayCuisines = usedCuisinesByDay.get(dayIndex) ?? [];
        dayCuisines.push(best.cuisineType);
        usedCuisinesByDay.set(dayIndex, dayCuisines);
      }

      // Track protein sources for rotation
      const proteinSources = getProteinSources(best);
      if (proteinSources.length > 0) {
        const dayProteins = proteinSourcesByDay.get(dayIndex) ?? [];
        dayProteins.push(...proteinSources);
        proteinSourcesByDay.set(dayIndex, dayProteins);
      }

      // Update weekly category counts
      for (const pattern of Object.keys(WEEKLY_CATEGORY_CAPS)) {
        if (matchesCategoryPattern(best, pattern)) {
          const current = categoryCountsWeekly.get(pattern) ?? 0;
          categoryCountsWeekly.set(pattern, current + 1);
        }
      }
    }

    planDays.push({
      day: dayName,
      meals: dayMeals,
    });
  }

  // ── 4. Build coverage report ───────────────────────────────────────────
  const coverage = buildCoverageReport(
    numDays,
    distribution.slots,
    filledSlots,
    planDays,
  );

  // BUG-4: Shopping efficiency (seasonings excluded)
  const shopping = await computeShoppingEfficiency(allRecipeIds);
  coverage.uniqueIngredients = shopping.uniqueIngredients;
  coverage.totalIngredientUses = shopping.totalIngredientUses;
  coverage.shoppingEfficiencyScore = shopping.shoppingEfficiencyScore;

  // ── 5. Build and return result ─────────────────────────────────────────
  const plan: PlanContent = { days: planDays };
  const durationMs = Date.now() - startMs;

  return {
    plan,
    coverage,
    generationMethod: 'database',
    recipeIds: allRecipeIds,
    durationMs,
    slotDecisions,
  };
}
