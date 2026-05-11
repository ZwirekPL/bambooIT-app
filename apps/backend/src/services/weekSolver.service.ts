/**
 * Week Solver Service (Faza 75-FIX)
 *
 * Calls the Python OR-Tools CP-SAT microservice to find the globally optimal
 * set of recipes for a 7-day diet plan.
 *
 * Hard constraints (enforced by OR-Tools):
 *   1. Exactly 1 recipe per slot
 *   2. Per-day kcal ±10%
 *   3. Recipe uniqueness: max 1x per week
 *   4. Category caps (oatmeal ≤2, salads ≤2)
 *   5. Light dinner: dinnerKcal ≤ 0.85 × lunchKcal
 *   6. Protein rotation: max 2 of 3 consecutive days with same source
 *
 * Soft constraints (in objective):
 *   7. Macro deviation penalty (protein, fat, carbs)
 *   8. Breakfast protein, pure carb, whole grains, fiber, seasonal, cuisine
 *
 * Fallback: if solver fails or times out, pipeline falls back to greedy.
 */

import {
  findCandidates,
  type RecipeCandidateQuery,
  type ScoredRecipeCandidate,
} from './recipeCandidate.service';
import {
  computeRecipeProteinSource,
  type RecipeIngredientInput,
} from '../scraper/utils/proteinSource';
import {
  computeCanonicalProteinBucket,
  type ProteinCanonicalBucket,
} from '../scraper/utils/proteinSourceCanonical';
import {
  computeMealDistribution,
  loadPatientMealDistribution,
  type MealSlotTarget,
} from './mealDistribution.service';
import { scaleMealComposition, scaleRecipeForMeal, type MealType } from './recipeScaler.service';
import { mapCuisinePrefsToDb } from '../utils/cuisineMapping';
import {
  computeShoppingEfficiency,
  type AssemblyInput,
  type AssemblyResult,
  type CoverageReport,
  type SlotDecision,
} from './dbPlanAssembly.service';
import type {
  PlanDay,
  PlanMeal,
  PlanItem,
  PlanIngredient,
  MealRecipe,
} from './planValidation.service';
import { prisma } from '@db';
import { captureException } from '../utils/sentry';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SolverStatus = 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'TIMEOUT' | 'ERROR';

export interface SolverResult {
  status: SolverStatus;
  /**
   * Selected recipes per slot.
   *  * Legacy (compose_meals=false): array always has exactly 1 item — the MAIN.
   *  * Compose mode (compose_meals=true): array has 1-3 items in fixed order
   *    `[MAIN, CARB?, VEG?]` (sorted via dishCompleteness — see selectionsKey
   *    builder in `solveWeekPlan`). Downstream `assembleSolverPlan` uses the
   *    array length to dispatch single-recipe vs joint scaling.
   * Key shape: `"<dayIndex>:<slotIndex>"`.
   */
  selections: Map<string, ScoredRecipeCandidate[]>;
  objectiveValue: number;
  totalVariables: number;
  totalConstraints: number;
  durationMs: number;
  seedUsed?: number | null; // 78.5: for deterministic replay
  infeasibilityReasons?: Array<{ constraint: string; description: string; suggestion: string; severity: string }>; // 78.1
  // Faza D Phase 2 prep — surface for /admin/solver-stats aggregations.
  // Mirrors the value sent in the solver request payload so dashboards can
  // separate compose vs legacy runs without re-deriving it from slot data.
  composeSlotsCount?: number;
  // SC22 telemetry (Faza D D1 revisited). Both `null` when cuisine pref was
  // not active (cuisine_target_pct=0). When set, dietitian UI can render
  // "cuisine match: 28/35 slots (80%)" + warn when ratio < target.
  cuisineMatchCount?: number | null;
  cuisineMainTotal?: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max candidates per slot — OR-Tools handles 25 × 5 × 7 = 875 vars easily */
const CANDIDATES_PER_SLOT = 25;

/** Solver service URL */
const SOLVER_URL = process.env.SOLVER_URL ?? 'http://localhost:5050';

/** Kcal tolerance for hard constraint — 15% gives solver room to find optimum fast */
const KCAL_TOLERANCE = 0.15;

/**
 * HTTP timeout for the fetch() to the solver. Caps how long the backend
 * waits before giving up on the response. Compose mode runs OR-Tools
 * with `time_limit_sec=30` (P99 target), so the HTTP timeout sits at
 * 35s = 30s deadline + 5s grace for network + Sentry init.
 */
const SOLVER_TIMEOUT_MS = 35000;

/** Per-slot kcal pre-filter — max % deviation from target */
const SLOT_KCAL_FILTER = 0.40;

/**
 * Cuisine match coverage target sent to the solver as `cuisine_target_pct`.
 * Each MAIN slot below this ratio costs PENALTY_CUISINE_SHORTFALL=-200 in
 * the solver objective. 0.6 = "≥60% of mains in patient cuisines"; chosen
 * with rare cuisines (`francuska`=45 recipes) in mind so a feasible plan
 * is still attainable while pushing back against lazy mismatches.
 */
const CUISINE_TARGET_PCT = 0.6;

/**
 * True when patient cuisine prefs translate to at least one DB cuisineType
 * (i.e. not empty and not just `["any"]`). Drives the SC22 coverage signal.
 */
function hasActiveCuisinePref(prefs: string[] | undefined | null): boolean {
  return mapCuisinePrefsToDb(prefs).length > 0;
}

// ─── Protein source detection ────────────────────────────────────────────────
//
// P-3 (2026-04-22): Primary detection is argmax(protein_g × weight) via
// scraper/utils/proteinSource.ts (S-11), sourced from the recipe's ingredient
// list. The regex-on-title fallback below remains only for recipes where the
// batch ingredient query returned nothing (no cleanProductId links — rare).

const PROTEIN_SOURCE_MAP: Record<string, RegExp[]> = {
  poultry: [/kurczak/i, /indyk/i, /drob/i, /pierś/i, /udko/i],
  fish:    [/łosoś/i, /dorsz/i, /tuńczyk/i, /pstrąg/i, /makrela/i, /ryb/i],
  beef:    [/wołowin/i, /cielęc/i],
  pork:    [/wieprzow/i, /szynk/i, /schab/i],
  egg:     [/jaj/i],
  dairy:   [/twaróg/i, /jogurt/i, /kefir/i, /ser\b/i, /skyr/i],
  legume:  [/soczewic/i, /ciecierzyc/i, /fasol/i, /groch/i],
  tofu:    [/tofu/i, /tempeh/i],
};

/** Legacy title+tags regex — fallback when ingredient-level data is missing. */
function getProteinSourceFromTitle(candidate: ScoredRecipeCandidate): string | null {
  const text = [candidate.title, ...candidate.tags].join(' ');
  for (const [source, patterns] of Object.entries(PROTEIN_SOURCE_MAP)) {
    if (patterns.some((p) => p.test(text))) return source;
  }
  return null;
}

// ─── Category detection ──────────────────────────────────────────────────────

const CATEGORY_CAPS: Record<string, { pattern: RegExp; max: number }> = {
  oatmeal: { pattern: /owsian|oatmeal/i, max: 2 },
  salad:   { pattern: /sałatk|salad/i, max: 2 },
  pasta:   { pattern: /makaron|pasta|spaghett|penne|tagliatell|lasagn/i, max: 3 },
  soup:    { pattern: /zup[aąeę]|krem z|bulion|soup/i, max: 3 },
};

function getCategoryTag(candidate: ScoredRecipeCandidate): string | null {
  const text = [candidate.title, ...candidate.tags, candidate.category].join(' ');
  for (const [catName, cap] of Object.entries(CATEGORY_CAPS)) {
    if (cap.pattern.test(text)) return catName;
  }
  return null;
}

// ─── Solver HTTP Client ──────────────────────────────────────────────────────

interface SolverCandidatePayload {
  id: string;
  day_index: number;
  slot_index: number;
  recipe_id: string;
  title: string;
  total_score: number;
  scaled_kcal: number;
  scaled_protein_g: number;
  scaled_fat_g: number;
  scaled_carbs_g: number;
  fiber_g: number;
  season_score: number;
  cuisine_score: number;
  tags: string[];
  protein_source: string | null;
  category_tag: string | null;
  meal_type: string;
  // Faza D Phase 1: 3-tuple element typing. Defaults match the legacy
  // single-element behaviour — when `compose_meals=false` the solver still
  // builds one BoolVar per candidate in `x_main` only.
  element_type?: 'MAIN' | 'CARB' | 'VEG';
  /** Whether this main already contains a carb component (pasta, rice, etc.). */
  main_contains_carb?: boolean;
  /** Whether this main already contains ≥100g of vegetables. */
  main_contains_veg?: boolean;
  // Faza 77: Extended fields for solver precision
  sodium_mg: number;
  iron_mg: number;
  calcium_mg: number;
  vitamin_d_ug: number;
  folate_ug: number;
  vitamin_b12_ug: number;
  zinc_mg: number;
  vitamin_c_mg: number;
  // QW#16+17: Additional micronutrients for solver RDA coverage
  magnesium_mg: number;
  potassium_mg: number;
  vitamin_a_ug: number;
  vitamin_k_ug: number;
  // #12: More micronutrients
  omega3_g: number;
  selenium_ug: number;
  iodine_ug: number;
  phosphorus_mg: number;
  // P0-1: Glycemic index for diabetes-aware scoring
  glycemic_index: number;  // 0-100, weighted average from ingredients (0 = unknown)
  fat_g_total: number;
  prep_time_minutes: number;
  meal_prep_friendly: boolean;
  cooking_method: string | null;  // 84.3
  main_ingredient_id: string | null;
  patient_preference: number; // 0-100, from patient ratings (78.4)
  ingredient_ids: string[]; // top 5 cleanProductIds for shopping optimization (78.8)
  allergen_penalty: number; // 78.7: 0=ok, -200=preference, -500=intolerance
  grey_list_penalty: number; // Z1: 0=fresh, -800=present in patient's previous N plans
  // P1.3 (Recipe Overhaul Master Plan 2026-04-29): canonical protein bucket for
  // SC30 caps/minimums/decay. One of fish_fatty | fish_white | seafood |
  // poultry | red_meat | eggs | legumes | tofu, or null when the recipe is
  // not protein-bucket'd (dairy/nuts/grain/vegetable/other).
  protein_canonical: string | null;
}

interface SolverSlotPayload {
  slot_index: number;
  meal_type: string;
  target_kcal: number;
  target_protein_g: number;
  target_fat_g: number;
  target_carbs_g: number;
}

interface SolverRequest {
  candidates: SolverCandidatePayload[];
  slots: SolverSlotPayload[];
  num_days: number;
  daily_target_kcal: number;
  daily_target_protein_g: number;
  daily_target_fat_g: number;
  daily_target_carbs_g: number;
  kcal_tolerance: number;
  time_limit_sec: number;
  // Faza 77: Extended solver configuration
  daily_cooking_budget_min?: number;   // default 90 min
  prefers_meal_prep?: boolean;         // patient preference
  hypertension?: boolean;              // stronger sodium penalty
  diabetes?: boolean;                  // GI/GL penalty for high-GI meals
  // #4: Dynamic nutrient limits from policy engine (daily totals)
  nutrient_limits?: Array<{ nutrient: string; min?: number; max?: number }>;
  // Faza 78.5: Deterministic replay
  random_seed?: number;
  // Faza 78.2: Incremental solving
  frozen_slots?: Array<{ day_index: number; slot_index: number; recipe_id: string }>;
  // P-1 (2026-04-22): Patient context — propagated for P-2 (per-patient RDA)
  // and P-7 (condition modules). Solver currently echoes for traceability;
  // doesn't drive constraints (only `hypertension` / `diabetes` bools do today).
  sex?: 'M' | 'F' | null;
  age_years?: number | null;
  pregnancy_trimester?: number | null;  // 1 | 2 | 3
  lactating?: boolean;
  condition_flags?: string[];           // canonical condition set
  // ── Faza D Phase 1: 3-tuple meal composition ─────────────────────────────
  /**
   * When true, the solver activates the 3-tuple path: build_decision_vars
   * partitions candidates by element_type and adds HC8 linking constraints.
   * Default false during phased rollout keeps the legacy single-array path
   * bit-equal with pre-Faza-D snapshots.
   */
  compose_meals?: boolean;
  /**
   * Slot indices (matching SlotTarget.slot_index) that should be composed as
   * 3-tuples — driven by the master-plan rule
   * `mealType ∈ {LUNCH, DINNER} AND slot.pctOfDaily ≥ 18%`.
   */
  compose_slots?: number[];
  /**
   * Faza D D1 (revisited): cuisine preference is a soft constraint. When the
   * patient picked a non-"any" cuisine in the interview, backend sets this to
   * 0.6 — the solver penalises every MAIN slot below that match ratio
   * (PENALTY_CUISINE_SHORTFALL=-200 per missing slot). Default 0.0 disables
   * the global constraint entirely (per-candidate gradient still runs).
   */
  cuisine_target_pct?: number;
  // ── P1.4 / P1.5 / P1.7 (Recipe Overhaul Master Plan): SC30 protein buckets ──
  /**
   * Canonical protein buckets the patient picked in `preferredFoods` (after
   * vegan/vegetarian guard). Drives the per-week PREFERRED_BONUS_DECAY.
   * Empty / undefined → SC30 decay disabled, caps + minimums still run.
   */
  preferred_protein_buckets?: string[];
  /**
   * 'vegan' | 'vegetarian' | 'pescatarian' — drives PROTEIN_WEEKLY_MINS skips
   * (fish_total ≥ 1 only fires for non-vegan/vegetarian). Anything else /
   * undefined treated as omnivore default.
   */
  dietary_pattern?: string | null;
}

interface SolverResponseSelection {
  day_index: number;
  slot_index: number;
  recipe_id: string;
  candidate_id: string;
  // Faza D Phase 1: which sub-slot this selection fills. Defaults to "MAIN"
  // for backward compat — legacy responses never include this field.
  element_type?: 'MAIN' | 'CARB' | 'VEG';
}

interface SolverResponse {
  status: string;
  selections: SolverResponseSelection[];
  objective_value: number;
  total_variables: number;
  total_constraints: number;
  duration_ms: number;
  seed_used?: number | null;
  infeasibility_reasons?: Array<{
    constraint: string;
    description: string;
    suggestion: string;
    severity: string;
  }>;
  // SC22 telemetry — null when cuisine_target_pct=0 (constraint disabled).
  cuisine_match_count?: number | null;
  cuisine_main_total?: number | null;
}

async function callSolver(request: SolverRequest): Promise<SolverResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

  try {
    const res = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Solver HTTP ${res.status}: ${await res.text()}`);
    }

    return await res.json() as SolverResponse;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Main Solver Function ────────────────────────────────────────────────────

export async function solveWeekPlan(input: AssemblyInput): Promise<SolverResult> {
  const startMs = Date.now();
  const numDays = input.days ?? 7;

  // ── 1. Load targets and distribution ────────────────────────────────
  const distInput = await loadPatientMealDistribution(input.patientId);
  // Faza D Phase 1 W2-Wed: forward the compose flag so D4 (skip breakfast) /
  // D7 (night shift) distribution variants only fire under compose mode —
  // legacy / gold-standard runs (composeMeals=false) keep DEFAULT_DISTRIBUTIONS.
  const distribution = computeMealDistribution({ ...distInput, composeMeals: input.composeMeals });
  const slots = distribution.slots;

  const dailyTargetKcal = distribution.totalKcal;
  const dailyTargetProteinG = distribution.totalProteinG;
  const dailyTargetFatG = distribution.totalFatG;
  const dailyTargetCarbsG = distribution.totalCarbsG;

  // ── 1b. Load per-dietitian scoring weight overrides (76a) ──────────
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

  // ── 2. Fetch candidates per slot type ───────────────────────────────
  const currentMonth = new Date().getMonth() + 1;

  // Faza A.1: usunięto SIDE_DISH z fallback dla SNACK — SIDE_DISH to komponent (sos/dodatek),
  // nie samodzielna przekąska. Solver wcześniej wybierał np. "marynatę" jako podwieczorek.
  const FALLBACK_MEAL_TYPES: Record<string, string[]> = {
    SNACK: ['DESSERT', 'SECOND_BREAKFAST'],
    SECOND_BREAKFAST: ['SNACK', 'BREAKFAST'],
    SUPPER: ['DINNER', 'SNACK'],
    DESSERT: ['SNACK'],
    SIDE_DISH: ['SNACK'],
    SAUCE: ['SIDE_DISH'],
  };

  const candidatesBySlot = new Map<number, ScoredRecipeCandidate[]>();

  for (let s = 0; s < slots.length; s++) {
    const slot = slots[s];
    const baseQuery: RecipeCandidateQuery = {
      mealType: slot.mealType,
      targetKcal: slot.targetKcal,
      targetProteinG: slot.targetProteinG,
      targetFatG: slot.targetFatG,
      targetCarbsG: slot.targetCarbsG,
      excludeAllergens: input.excludeAllergens,
      requiredDietFlags: input.requiredDietFlags,
      maxTotalTimeMinutes: input.maxCookingTimeMinutes,
      maxCost: input.maxCost,
      season: currentMonth,
      preferMealPrep: input.preferMealPrep,
      limit: CANDIDATES_PER_SLOT,
      // #3: FODMAP filter for IBS/IBD patients
      excludeHighFodmap: input.conditionFlags?.includes('ibs') ?? false,
      // Faza 76a: Per-dietitian scoring weight overrides
      dietitianWeightOverrides,
      // Faza D D1: cuisine HARD filter from interview answers
      cuisinePreferences: input.cuisinePreferences,
    };

    let slotCandidates: ScoredRecipeCandidate[];
    try {
      slotCandidates = await findCandidates(baseQuery);
    } catch {
      slotCandidates = [];
    }

    // Fallback: try alt mealTypes if too few candidates
    if (slotCandidates.length < numDays) {
      const alts = FALLBACK_MEAL_TYPES[slot.mealType] ?? [];
      for (const alt of alts) {
        try {
          const altCandidates = await findCandidates({ ...baseQuery, mealType: alt });
          const existingIds = new Set(slotCandidates.map((c) => c.recipeId));
          for (const c of altCandidates) {
            if (!existingIds.has(c.recipeId)) {
              slotCandidates.push(c);
              existingIds.add(c.recipeId);
            }
            if (slotCandidates.length >= CANDIDATES_PER_SLOT) break;
          }
        } catch { /* continue */ }
        if (slotCandidates.length >= numDays) break;
      }
    }

    if (slotCandidates.length === 0) {
      return {
        status: 'INFEASIBLE',
        selections: new Map(),
        objectiveValue: 0,
        totalVariables: 0,
        totalConstraints: 0,
        durationMs: Date.now() - startMs,
        infeasibilityReasons: [{
          constraint: 'SLOT_EMPTY_TS',
          description: `Brak kandydatów dla slotu ${slot.mealType} (index ${s}) — filtr wycina wszystko`,
          suggestion: 'Sprawdź filtry alergenne / requiredDietFlags / maxCookingTime / maxCost / excludeHighFodmap',
          severity: 'HARD',
        }],
      };
    }

    // Pre-filter on kcal (hard constraint). Macros are soft.
    const filtered = slotCandidates.filter((c) => {
      return slot.targetKcal === 0 ||
        Math.abs(c.scaledKcal - slot.targetKcal) / slot.targetKcal <= SLOT_KCAL_FILTER;
    });
    candidatesBySlot.set(s, filtered.length >= numDays ? filtered : slotCandidates);
  }

  // ── 2-bis. Faza D Phase 1 W2-Mon-B: Side pools for compose slots ────
  // For each slot in compose_slots (LUNCH/DINNER ≥18% kcal), fetch CARB_SIDE
  // and VEG_SIDE pools sized to their share of the slot (master plan §M1:
  // 60/28/12 kcal split). Pools are reused across all days — the solver's
  // build_decision_vars partitions by element_type and HC8 linking ties
  // exactly one carb + one veg to the selected main per (day, slot).
  const carbSidePoolBySlot = new Map<number, ScoredRecipeCandidate[]>();
  const vegSidePoolBySlot = new Map<number, ScoredRecipeCandidate[]>();

  // Helper to identify compose slots by index — match logic with composeSlots
  // computation later. Avoids drift when slot.slotIndex ?? s differs.
  const isComposeSlot = (slot: typeof slots[number], slotPosition: number): boolean => {
    if (!input.composeMeals) return false;
    const isLunchOrDinner = slot.mealType === 'LUNCH' || slot.mealType === 'DINNER';
    return isLunchOrDinner && slot.pctOfDaily >= 18;
  };

  if (input.composeMeals) {
    const SIDE_POOL_LIMIT = 25;  // smaller than main pool — fewer side recipes overall
    const CARB_KCAL_SHARE = 0.28;
    const CARB_PROTEIN_SHARE = 0.10;
    const CARB_FAT_SHARE = 0.05;
    const CARB_CARBS_SHARE = 0.65;
    const VEG_KCAL_SHARE = 0.12;
    const VEG_PROTEIN_SHARE = 0.10;
    const VEG_FAT_SHARE = 0.30;  // sides typically dressed with oil
    const VEG_CARBS_SHARE = 0.10;

    for (let s = 0; s < slots.length; s++) {
      const slot = slots[s];
      const slotIdx = slot.slotIndex ?? s;
      if (!isComposeSlot(slot, s)) continue;

      // CARB_SIDE / VEG_SIDE recipes carry `mealType: 'SIDE_DISH'` in the DB
      // — they're slot-agnostic accompaniments, not standalone LUNCH/DINNER
      // meals. Filtering on the compose slot's mealType returns 0 candidates;
      // override to SIDE_DISH so the side pool gets populated. Verified from
      // production DB: 60 CARB_SIDE + 90 VEG_SIDE all tagged SIDE_DISH.
      const sharedQuery: Pick<RecipeCandidateQuery,
        'mealType' | 'excludeAllergens' | 'requiredDietFlags' | 'maxTotalTimeMinutes' |
        'maxCost' | 'season' | 'preferMealPrep' | 'excludeHighFodmap' |
        'cuisinePreferences' | 'dietitianWeightOverrides' | 'limit'
      > = {
        mealType: 'SIDE_DISH',
        excludeAllergens: input.excludeAllergens,
        requiredDietFlags: input.requiredDietFlags,
        maxTotalTimeMinutes: input.maxCookingTimeMinutes,
        maxCost: input.maxCost,
        season: currentMonth,
        preferMealPrep: input.preferMealPrep,
        excludeHighFodmap: input.conditionFlags?.includes('ibs') ?? false,
        cuisinePreferences: input.cuisinePreferences,
        dietitianWeightOverrides,
        limit: SIDE_POOL_LIMIT,
      };

      try {
        const carbCands = await findCandidates({
          ...sharedQuery,
          targetKcal:    slot.targetKcal    * CARB_KCAL_SHARE,
          targetProteinG: slot.targetProteinG * CARB_PROTEIN_SHARE,
          targetFatG:    slot.targetFatG    * CARB_FAT_SHARE,
          targetCarbsG:  slot.targetCarbsG  * CARB_CARBS_SHARE,
          dishCompletenessOverride: ['CARB_SIDE'],
        });
        carbSidePoolBySlot.set(slotIdx, carbCands);
      } catch {
        carbSidePoolBySlot.set(slotIdx, []);
      }

      try {
        const vegCands = await findCandidates({
          ...sharedQuery,
          targetKcal:    slot.targetKcal    * VEG_KCAL_SHARE,
          targetProteinG: slot.targetProteinG * VEG_PROTEIN_SHARE,
          targetFatG:    slot.targetFatG    * VEG_FAT_SHARE,
          targetCarbsG:  slot.targetCarbsG  * VEG_CARBS_SHARE,
          dishCompletenessOverride: ['VEG_SIDE'],
        });
        vegSidePoolBySlot.set(slotIdx, vegCands);
      } catch {
        vegSidePoolBySlot.set(slotIdx, []);
      }
    }
  }

  // ── 2b. Batch-load main ingredient per recipe (77.4) ────────────────
  // Faza D: include side pool recipes so batch loads (GI / ingredients /
  // patient ratings / allergen penalties) cover them too.
  const allRecipeIds = [...new Set([
    ...Array.from(candidatesBySlot.values()).flat().map((c) => c.recipeId),
    ...Array.from(carbSidePoolBySlot.values()).flat().map((c) => c.recipeId),
    ...Array.from(vegSidePoolBySlot.values()).flat().map((c) => c.recipeId),
  ])];
  const mainIngredientMap = new Map<string, string | null>();
  const ingredientIdsMap = new Map<string, string[]>(); // recipeId → top 5 cleanProductIds
  const recipeGlycemicMap = new Map<string, number>(); // recipeId → weighted avg GI
  // P-3: argmax(protein × weight) dominant source — replaces weak title regex
  const proteinSourceMap = new Map<string, string>();  // recipeId → protein source label
  // P1.3: canonical 8-bucket projection used by SC30 caps + decay + minimums.
  const proteinCanonicalMap = new Map<string, ProteinCanonicalBucket>();
  if (allRecipeIds.length > 0) {
    const ingredients = await prisma.recipeIngredient.findMany({
      where: { recipeId: { in: allRecipeIds }, cleanProductId: { not: null } },
      select: {
        recipeId: true, cleanProductId: true, grams: true, displayName: true,
        cleanProduct: {
          select: {
            name: true,
            glycemicIndex: true,
            nutrients: { select: { proteinPer100g: true } },
          },
        },
      },
      orderBy: [{ recipeId: 'asc' }, { grams: 'desc' }],
    });
    // P0-1: Accumulate weighted GI per recipe
    const giAccum = new Map<string, { sumGiGrams: number; sumGrams: number }>();
    // P-3: Collect ingredient rows for argmax protein-source computation
    const ingredientsByRecipe = new Map<string, RecipeIngredientInput[]>();

    for (const ing of ingredients) {
      if (!mainIngredientMap.has(ing.recipeId)) {
        mainIngredientMap.set(ing.recipeId, ing.cleanProductId);
      }
      const ids = ingredientIdsMap.get(ing.recipeId) ?? [];
      if (ids.length < 5 && ing.cleanProductId && !ids.includes(ing.cleanProductId)) {
        ids.push(ing.cleanProductId);
        ingredientIdsMap.set(ing.recipeId, ids);
      }
      // Accumulate GI weighted by grams (only ingredients with known GI)
      const gi = ing.cleanProduct?.glycemicIndex;
      const grams = Number(ing.grams);
      if (gi != null && grams > 0) {
        const acc = giAccum.get(ing.recipeId) ?? { sumGiGrams: 0, sumGrams: 0 };
        acc.sumGiGrams += gi * grams;
        acc.sumGrams += grams;
        giAccum.set(ing.recipeId, acc);
      }
      // P-3: Gather {name, grams, proteinPer100g} for protein-source argmax
      const name = ing.cleanProduct?.name ?? ing.displayName ?? '';
      if (name && grams > 0) {
        const per100 = ing.cleanProduct?.nutrients?.proteinPer100g;
        const list = ingredientsByRecipe.get(ing.recipeId) ?? [];
        list.push({
          name,
          grams,
          proteinPer100g: per100 != null ? Number(per100) : null,
        });
        ingredientsByRecipe.set(ing.recipeId, list);
      }
    }
    // Compute weighted average GI per recipe
    for (const [recipeId, acc] of giAccum) {
      if (acc.sumGrams > 0) {
        recipeGlycemicMap.set(recipeId, Math.round(acc.sumGiGrams / acc.sumGrams));
      }
    }
    // P-3: Resolve dominant protein source per recipe from ingredient argmax
    for (const [recipeId, ings] of ingredientsByRecipe) {
      const report = computeRecipeProteinSource(ings);
      // Only store a confident result; 'other' means the argmax had no
      // meaningful protein (e.g. < 2g total), fall through to title regex below.
      if (report.source !== 'other') {
        proteinSourceMap.set(recipeId, report.source);
      }
      // P1.3: canonical bucket reuses the same ingredient list. Returns null
      // for non-protein-bucket sources (dairy/nuts/grain/vegetable/other) — we
      // skip those so SC30 sees only protein-bucket'd recipes in its sums.
      const bucketReport = computeCanonicalProteinBucket(ings);
      if (bucketReport.bucket) proteinCanonicalMap.set(recipeId, bucketReport.bucket);
    }
  }

  // ── 2c. Batch-load patient recipe ratings for preference (78.4) ─────
  const preferenceMap = new Map<string, number>();
  if (allRecipeIds.length > 0) {
    const ratings = await prisma.recipeRating.findMany({
      where: { recipeId: { in: allRecipeIds }, patientId: input.patientId },
      select: { recipeId: true, rating: true },
      orderBy: { updatedAt: 'desc' },
    });
    // Latest rating per recipe → map to 0-100 scale
    for (const r of ratings) {
      if (!preferenceMap.has(r.recipeId)) {
        // rating 1→0, 2→20, 3→50, 4→80, 5→100
        const pref = r.rating === 1 ? 0 : r.rating === 2 ? 20 : r.rating === 3 ? 50 : r.rating === 4 ? 80 : 100;
        preferenceMap.set(r.recipeId, pref);
      }
    }
  }

  // ── 2d. Batch-load allergen penalties for MAY_CONTAIN (78.7) ─────────
  const allergenPenaltyMap = new Map<string, number>(); // recipeId → penalty
  const patientAllergens = input.excludeAllergens ?? [];
  if (patientAllergens.length > 0 && allRecipeIds.length > 0) {
    const recipeAllergens = await prisma.recipeAllergen.findMany({
      where: {
        recipeId: { in: allRecipeIds },
        allergenCode: { in: patientAllergens },
        presence: 'MAY_CONTAIN',
      },
      select: { recipeId: true },
    });
    // Any MAY_CONTAIN match → -200 penalty (CONTAINS already filtered by findCandidates)
    for (const ra of recipeAllergens) {
      if (!allergenPenaltyMap.has(ra.recipeId)) {
        allergenPenaltyMap.set(ra.recipeId, -200);
      }
    }
  }

  // ── 2e. Disliked food keyword matching → penalty (84.2) ─────────────
  const dislikeKeywords = input.excludeKeywords ?? [];
  const dislikePenaltyMap = new Map<string, number>(); // recipeId → penalty
  if (dislikeKeywords.length > 0) {
    const kwPatterns = dislikeKeywords.map((kw) => kw.toLowerCase());
    // Faza D: scan main pools + side pools so disliked keywords penalize
    // CARB_SIDE / VEG_SIDE candidates too.
    const allCandidateGroups: Iterable<ScoredRecipeCandidate[]> = [
      ...candidatesBySlot.values(),
      ...carbSidePoolBySlot.values(),
      ...vegSidePoolBySlot.values(),
    ];
    for (const candidates of allCandidateGroups) {
      for (const recipe of candidates) {
        if (dislikePenaltyMap.has(recipe.recipeId)) continue;
        const text = [recipe.title, ...recipe.tags].join(' ').toLowerCase();
        if (kwPatterns.some((kw) => text.includes(kw))) {
          dislikePenaltyMap.set(recipe.recipeId, -300);
        }
      }
    }
  }

  // ── 2f. Z1: Grey-list penalty (regeneration diversity) ─────────────
  // For every recipe present in `input.greyListRecipeIds` we apply
  // PENALTY_GREY_LIST (-800) at the per-candidate level. Mitigation R1:
  // when a slot's candidate pool is mostly grey-listed (> 50%), we drop
  // the penalty for that slot to avoid SC22 cuisine-cohesion regressions
  // where the patient's preferred cuisine is small and would otherwise
  // be steered away from. Tracked per-slot Set; size ≤ slots×days.
  const PENALTY_GREY_LIST = -800;
  const GREY_POOL_RATIO_GUARD = 0.5; // skip penalty if > 50% would be hit
  const greyListIds = input.greyListRecipeIds ?? null;
  const greyApplyPerSlot = new Map<number, Set<string>>(); // slotIndex → recipeIds with penalty active
  if (greyListIds && greyListIds.size > 0) {
    const slotIndexes = new Set<number>();
    for (const slot of slots) slotIndexes.add(slot.slotIndex ?? slots.indexOf(slot));

    const inspectPool = (slotIndex: number, pool: ScoredRecipeCandidate[] | undefined) => {
      if (!pool || pool.length === 0) return;
      const matches = pool.filter((r) => greyListIds.has(r.recipeId));
      if (matches.length === 0) return;
      // Mitigation: if more than half the pool would be grey-listed, skip
      // penalty entirely for this slot so the solver doesn't get pushed
      // away from a small cuisine pool the patient explicitly prefers.
      if (matches.length / pool.length > GREY_POOL_RATIO_GUARD) {
        console.log(
          `[weekSolver] grey-list mitigation: slot ${slotIndex} would penalise ` +
          `${matches.length}/${pool.length} candidates (>${Math.round(GREY_POOL_RATIO_GUARD * 100)}%) — skipping`,
        );
        return;
      }
      let active = greyApplyPerSlot.get(slotIndex);
      if (!active) {
        active = new Set<string>();
        greyApplyPerSlot.set(slotIndex, active);
      }
      for (const r of matches) active.add(r.recipeId);
    };

    for (let s = 0; s < slots.length; s++) {
      const slotIndexValue = slots[s].slotIndex ?? s;
      inspectPool(slotIndexValue, candidatesBySlot.get(s));
      // Side pools share the same slot index in their respective maps.
      inspectPool(slotIndexValue, carbSidePoolBySlot.get(slotIndexValue));
      inspectPool(slotIndexValue, vegSidePoolBySlot.get(slotIndexValue));
    }

    if (greyApplyPerSlot.size > 0) {
      let totalApplied = 0;
      for (const ids of greyApplyPerSlot.values()) totalApplied += ids.size;
      console.log(
        `[weekSolver] grey list active on ${greyApplyPerSlot.size} slot(s), ` +
        `${totalApplied} (slot, recipeId) penalty pair(s)`,
      );
    }
  }

  // ── 3. Build solver payload ─────────────────────────────────────────
  const candidatePayloads: SolverCandidatePayload[] = [];
  const recipeMap = new Map<string, ScoredRecipeCandidate>(); // candidateId → recipe

  // Faza D Phase 1 W2-Mon-B: factor out the candidate payload shape so MAIN
  // and CARB / VEG side candidates share the same structure. element_type +
  // main_contains_* flags vary per element category.
  const buildCandidatePayload = (
    recipe: ScoredRecipeCandidate,
    d: number,
    slotIndexValue: number,
    mealType: string,
    elementType: 'MAIN' | 'CARB' | 'VEG',
    candidateIdSuffix: string,
  ): SolverCandidatePayload => {
    const shortId = recipe.recipeId.slice(-8);
    const candidateId = `d${d}_s${slotIndexValue}_${candidateIdSuffix}_r${shortId}`;
    recipeMap.set(candidateId, recipe);
    return {
      id: candidateId,
      day_index: d,
      slot_index: slotIndexValue,
      recipe_id: recipe.recipeId,
      title: recipe.title,
      total_score: recipe.totalScore,
      scaled_kcal: recipe.scaledKcal,
      scaled_protein_g: recipe.scaledProteinG,
      scaled_fat_g: recipe.scaledFatG,
      scaled_carbs_g: recipe.scaledCarbsG,
      fiber_g: recipe.fiberG,
      season_score: recipe.seasonScore,
      cuisine_score: recipe.cuisineScore,
      tags: recipe.tags,
      // P-3: ingredient argmax first, title regex only as fallback
      protein_source: proteinSourceMap.get(recipe.recipeId) ?? getProteinSourceFromTitle(recipe),
      // P1.3: canonical bucket for SC30 caps/minimums/decay (null when recipe
      // is not protein-bucket'd, e.g. dairy / nuts / grain / vegetable side).
      protein_canonical: proteinCanonicalMap.get(recipe.recipeId) ?? null,
      category_tag: getCategoryTag(recipe),
      meal_type: mealType,
      // Faza 77: Extended fields
      sodium_mg: Math.round(recipe.sodiumMg * 10) / 10,
      iron_mg: Math.round(recipe.ironMg * 100) / 100,
      calcium_mg: Math.round(recipe.calciumMg * 10) / 10,
      vitamin_d_ug: Math.round(recipe.vitaminDUg * 100) / 100,
      folate_ug: Math.round(recipe.folateUg * 10) / 10,
      vitamin_b12_ug: Math.round(recipe.vitaminB12Ug * 100) / 100,
      zinc_mg: Math.round(recipe.zincMg * 100) / 100,
      vitamin_c_mg: Math.round(recipe.vitaminCMg * 10) / 10,
      magnesium_mg: Math.round(recipe.magnesiumMg * 10) / 10,
      potassium_mg: Math.round(recipe.potassiumMg),
      vitamin_a_ug: Math.round(recipe.vitaminAUg * 10) / 10,
      vitamin_k_ug: Math.round(recipe.vitaminKUg * 10) / 10,
      omega3_g: Math.round(recipe.omega3G * 1000) / 1000,
      selenium_ug: Math.round(recipe.seleniumUg * 10) / 10,
      iodine_ug: Math.round(recipe.iodineUg * 10) / 10,
      phosphorus_mg: Math.round(recipe.phosphorusMg),
      glycemic_index: recipeGlycemicMap.get(recipe.recipeId) ?? 0,
      fat_g_total: recipe.scaledFatG,
      prep_time_minutes: recipe.totalTimeMinutes ?? 30,
      meal_prep_friendly: recipe.mealPrepFriendly,
      cooking_method: recipe.cookingMethod ?? null,
      main_ingredient_id: mainIngredientMap.get(recipe.recipeId) ?? null,
      patient_preference: preferenceMap.get(recipe.recipeId) ?? 50,
      ingredient_ids: ingredientIdsMap.get(recipe.recipeId) ?? [],
      allergen_penalty: Math.min(
        allergenPenaltyMap.get(recipe.recipeId) ?? 0,
        dislikePenaltyMap.get(recipe.recipeId) ?? 0,
      ),
      grey_list_penalty: greyApplyPerSlot.get(slotIndexValue)?.has(recipe.recipeId)
        ? PENALTY_GREY_LIST
        : 0,
      element_type: elementType,
      // main_contains_* only meaningful for MAIN elements (drives HC8 linking)
      main_contains_carb: elementType === 'MAIN'
        ? recipe.dishCompleteness === 'COMPLETE_MEAL'
        : false,
      main_contains_veg: elementType === 'MAIN'
        ? (recipe.dishCompleteness === 'COMPLETE_MEAL' || recipe.containsVegetableServing === true)
        : false,
    };
  };

  for (let d = 0; d < numDays; d++) {
    for (let s = 0; s < slots.length; s++) {
      const slot = slots[s];
      const slotIndexValue = slot.slotIndex ?? s;
      const slotCandidates = candidatesBySlot.get(s)!;

      // MAIN candidates — always emitted for every (day, slot)
      for (const recipe of slotCandidates) {
        candidatePayloads.push(
          buildCandidatePayload(recipe, d, slotIndexValue, slot.mealType, 'MAIN', 'main'),
        );
      }

      // Faza D: CARB_SIDE + VEG_SIDE only for compose slots. The Python
      // solver's HC8 linking ensures sides are picked iff a main with
      // main_contains_carb/veg=false is selected at this (d, s).
      if (input.composeMeals && isComposeSlot(slot, s)) {
        const carbPool = carbSidePoolBySlot.get(slotIndexValue) ?? [];
        for (const recipe of carbPool) {
          candidatePayloads.push(
            buildCandidatePayload(recipe, d, slotIndexValue, slot.mealType, 'CARB', 'carb'),
          );
        }
        const vegPool = vegSidePoolBySlot.get(slotIndexValue) ?? [];
        for (const recipe of vegPool) {
          candidatePayloads.push(
            buildCandidatePayload(recipe, d, slotIndexValue, slot.mealType, 'VEG', 'veg'),
          );
        }
      }
    }
  }

  const slotPayloads: SolverSlotPayload[] = slots.map((s, i) => ({
    slot_index: s.slotIndex ?? i,
    meal_type: s.mealType,
    target_kcal: s.targetKcal,
    target_protein_g: s.targetProteinG,
    target_fat_g: s.targetFatG,
    target_carbs_g: s.targetCarbsG,
  }));

  // Faza D Phase 1: compose_slots driven by master-plan rule
  //   `mealType ∈ {LUNCH, DINNER} AND slot.pctOfDaily ≥ 18%`
  // SUPPER (Podwieczorek, ~8-10% kcal) is intentionally excluded — it's a
  // small snack, not a main meal. compose_meals=false ⇒ list still emitted
  // but solver ignores it (early return in _solve_3tuple). When the env
  // flag flips on, the same list activates 3-tuple linking.
  const COMPOSE_PCT_THRESHOLD = 18;
  const composeSlots: number[] = slots
    .map((s, i) => ({ idx: s.slotIndex ?? i, mealType: s.mealType, pct: s.pctOfDaily }))
    .filter((s) => (s.mealType === 'LUNCH' || s.mealType === 'DINNER') && s.pct >= COMPOSE_PCT_THRESHOLD)
    .map((s) => s.idx);

  // ── 4. Call OR-Tools solver ─────────────────────────────────────────
  let response: SolverResponse;
  try {
    response = await callSolver({
      candidates: candidatePayloads,
      slots: slotPayloads,
      num_days: numDays,
      daily_target_kcal: dailyTargetKcal,
      daily_target_protein_g: dailyTargetProteinG,
      daily_target_fat_g: dailyTargetFatG,
      daily_target_carbs_g: dailyTargetCarbsG,
      kcal_tolerance: KCAL_TOLERANCE,
      // Compose mode (3-tuple) hits ~1100 vars + ~2600 constraints — ~3× and
      // ~6× the legacy single-array path. Master plan §performance criteria:
      // P50 ≤ 5s, P95 ≤ 15s, P99 ≤ 30s. Use 30s to keep TIMEOUT rare during
      // shadow rollout; HTTP fetch timeout (SOLVER_TIMEOUT_MS=25s + 5s grace)
      // backs it. Legacy stays at 3s — its problem is small.
      time_limit_sec: input.composeMeals ? 30 : 3,
      // Faza 77: Extended solver config
      daily_cooking_budget_min: input.maxCookingTimeMinutes ?? 90,
      prefers_meal_prep: input.preferMealPrep ?? false,
      // Clinical condition flags → solver-specific booleans
      hypertension: input.conditionFlags?.includes('hypertension') ?? false,
      diabetes: input.conditionFlags?.includes('diabetes') ?? false,
      // #4: Dynamic nutrient limits from policy engine
      nutrient_limits: input.nutrientLimits?.length ? input.nutrientLimits : undefined,
      // P-1: Patient context for upcoming P-2 (per-patient RDA) and P-7 (condition modules)
      sex: input.sex ?? undefined,
      age_years: input.ageYears ?? undefined,
      pregnancy_trimester: input.pregnancyTrimester ?? undefined,
      lactating: input.lactating ?? undefined,
      condition_flags: input.conditionFlags?.length ? input.conditionFlags : undefined,
      // Faza D Phase 0 Task #1: opt-in deterministic seed for gold standard tests.
      // Test-only env var. Never set in production — would make plans non-varying across re-generations.
      random_seed: process.env.SOLVER_SEED ? Number(process.env.SOLVER_SEED) : undefined,
      // Faza D Phase 1: 3-tuple meal composition. Default false during phased
      // rollout — the solver's _solve_3tuple branch only activates when flag
      // is true AND compose_slots is non-empty. With composeMeals=false the
      // solver routes to the legacy single-array path (bit-equal pre-Faza-D).
      compose_meals: input.composeMeals ?? false,
      compose_slots: composeSlots.length > 0 ? composeSlots : undefined,
      // Faza D D1 (revisited): when patient picked a non-"any" cuisine in
      // the interview, ask the solver to honour ≥60% match ratio. The map
      // util returns [] for `any`/empty/undefined, in which case we leave
      // `cuisine_target_pct` undefined → solver disables SC22 entirely.
      cuisine_target_pct: hasActiveCuisinePref(input.cuisinePreferences) ? CUISINE_TARGET_PCT : undefined,
      // P1.4 / P1.5 / P1.7: SC30 protein buckets. Both fields default to
      // undefined → solver runs SC30 at clinical defaults (caps + legumes
      // min only, no decay). When set, decay rewards patient-preferred
      // buckets and dietary_pattern skips fish_total min for vegans.
      preferred_protein_buckets: input.preferredProteinBuckets?.length ? input.preferredProteinBuckets : undefined,
      dietary_pattern: input.dietaryPattern ?? undefined,
    });
  } catch (err) {
    console.error('[Solver] OR-Tools call failed:', (err as Error).message);
    return {
      status: 'ERROR',
      selections: new Map(),
      objectiveValue: 0,
      totalVariables: candidatePayloads.length,
      totalConstraints: 0,
      durationMs: Date.now() - startMs,
      composeSlotsCount: composeSlots.length,
    };
  }

  // ── 5. Map response to selections ───────────────────────────────────
  const solverStatus = response.status as SolverStatus;

  // Faza D Task #16: structured solver metrics for monitoring dashboards.
  // Single-line JSON for log aggregator parsing (Sentry breadcrumbs, Grafana Loki, etc).
  console.log(JSON.stringify({
    event: 'solver.request',
    patientId: input.patientId,
    durationMs: Date.now() - startMs,
    solverDurationMs: response.duration_ms,
    status: solverStatus,
    objectiveValue: response.objective_value,
    totalVariables: response.total_variables,
    totalConstraints: response.total_constraints,
    selectionsCount: response.selections.length,
    composeMeals: input.composeMeals ?? false,
    composeSlotsCount: composeSlots.length,
    infeasibilityCount: response.infeasibility_reasons?.length ?? 0,
    cuisineMatchCount: response.cuisine_match_count ?? null,
    cuisineMainTotal: response.cuisine_main_total ?? null,
  }));

  if (solverStatus !== 'OPTIMAL' && solverStatus !== 'FEASIBLE') {
    return {
      status: solverStatus,
      selections: new Map(),
      objectiveValue: 0,
      totalVariables: response.total_variables,
      totalConstraints: response.total_constraints,
      durationMs: Date.now() - startMs,
      infeasibilityReasons: response.infeasibility_reasons ?? [],
      composeSlotsCount: composeSlots.length,
    };
  }

  // Faza D Phase 1 W2-Mon-B: build multi-item selections per (day, slot).
  // Legacy compose_meals=false → response has exactly 1 entry per slot,
  // so each array ends up single-element (back-compat with assembleSolverPlan).
  // Compose mode → response has 1-3 entries per slot tagged element_type;
  // we sort MAIN→CARB→VEG below so downstream code can rely on items[0]
  // being the MAIN.
  const selections = new Map<string, ScoredRecipeCandidate[]>();
  const elementOrderRank: Record<string, number> = { MAIN: 0, CARB: 1, VEG: 2 };
  const elementByCandidateId = new Map<string, 'MAIN' | 'CARB' | 'VEG'>();
  for (const sel of response.selections) {
    const recipe = recipeMap.get(sel.candidate_id);
    if (!recipe) continue;
    const key = `${sel.day_index}:${sel.slot_index}`;
    const list = selections.get(key) ?? [];
    list.push(recipe);
    selections.set(key, list);
    // Solver echoes element_type when compose_meals=true; legacy responses
    // omit the field — default to MAIN so legacy ordering is a no-op.
    elementByCandidateId.set(sel.candidate_id, sel.element_type ?? 'MAIN');
  }
  // Sort each slot's items: MAIN first, then CARB, then VEG. Falls back to
  // dishCompleteness when element_type echo is missing (defensive).
  for (const [key, list] of selections) {
    list.sort((a, b) => {
      const rankFor = (r: ScoredRecipeCandidate): number => {
        if (r.dishCompleteness === 'CARB_SIDE') return elementOrderRank.CARB!;
        if (r.dishCompleteness === 'VEG_SIDE') return elementOrderRank.VEG!;
        return elementOrderRank.MAIN!;
      };
      return rankFor(a) - rankFor(b);
    });
    selections.set(key, list);
  }

  return {
    status: solverStatus,
    selections,
    objectiveValue: Math.round(response.objective_value * 10) / 10,
    totalVariables: response.total_variables,
    totalConstraints: response.total_constraints,
    durationMs: Date.now() - startMs,
    seedUsed: response.seed_used ?? null,
    infeasibilityReasons: response.infeasibility_reasons ?? [],
    composeSlotsCount: composeSlots.length,
    cuisineMatchCount: response.cuisine_match_count ?? null,
    cuisineMainTotal: response.cuisine_main_total ?? null,
  };
}

// ─── Solver → PlanContent Assembly ──────────────────────────────────────────

const DAY_NAMES = [
  'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela',
];

/**
 * Convert solver selections into a full AssemblyResult (PlanContent + coverage).
 */
export async function assembleSolverPlan(
  solverResult: SolverResult,
  input: AssemblyInput,
): Promise<AssemblyResult> {
  const startMs = Date.now();
  const numDays = input.days ?? 7;

  const distInput = await loadPatientMealDistribution(input.patientId);
  // Faza D Phase 1 W2-Wed: forward the compose flag so D4 (skip breakfast) /
  // D7 (night shift) distribution variants only fire under compose mode —
  // legacy / gold-standard runs (composeMeals=false) keep DEFAULT_DISTRIBUTIONS.
  const distribution = computeMealDistribution({ ...distInput, composeMeals: input.composeMeals });
  const slots = distribution.slots;

  const planDays: PlanDay[] = [];
  const allRecipeIds: string[] = [];
  const slotDecisions: SlotDecision[] = [];
  let filledCount = 0;
  let totalFitScore = 0;
  let totalScore = 0;
  const dailyKcal: number[] = [];
  const dailyProteinG: number[] = [];
  const dailyFatG: number[] = [];
  const dailyCarbsG: number[] = [];

  const proteinSourcesByDay = new Map<number, string[]>();
  const categoryCountsWeekly = new Map<string, number>();
  const lunchKcalByDay = new Map<number, number>();

  // 82.1: Batch-load recipe-level GI for meal labels
  // Faza D: each selection is now a list of 1-3 recipes (main + sides).
  const assemblyRecipeIds = [...new Set(
    [...solverResult.selections.values()].flat().map((r) => r.recipeId),
  )];
  const recipeGiMap = new Map<string, number>();
  if (assemblyRecipeIds.length > 0) {
    const giIngredients = await prisma.recipeIngredient.findMany({
      where: { recipeId: { in: assemblyRecipeIds }, cleanProductId: { not: null } },
      select: {
        recipeId: true, grams: true,
        cleanProduct: { select: { glycemicIndex: true } },
      },
    });
    const giAccum = new Map<string, { sumGiGrams: number; sumGrams: number }>();
    for (const ing of giIngredients) {
      const gi = (ing as { cleanProduct?: { glycemicIndex: number | null } }).cleanProduct?.glycemicIndex;
      const grams = Number(ing.grams);
      if (gi != null && gi > 0 && grams > 0) {
        const acc = giAccum.get(ing.recipeId) ?? { sumGiGrams: 0, sumGrams: 0 };
        acc.sumGiGrams += gi * grams;
        acc.sumGrams += grams;
        giAccum.set(ing.recipeId, acc);
      }
    }
    for (const [recipeId, acc] of giAccum) {
      if (acc.sumGrams > 0) {
        recipeGiMap.set(recipeId, Math.round(acc.sumGiGrams / acc.sumGrams));
      }
    }
  }

  // Compute daily kcal target from slot targets (for portion limit scaling)
  const dailyKcalTarget = slots.reduce((sum, s) => sum + s.targetKcal, 0);

  const dailyGlycemicLoad: number[] = [];

  for (let d = 0; d < numDays; d++) {
    const dayMeals: PlanMeal[] = [];
    const dayName = DAY_NAMES[d % DAY_NAMES.length];
    let dayKcal = 0, dayProt = 0, dayFat = 0, dayCarbs = 0;
    let dayGL = 0;

    for (let s = 0; s < slots.length; s++) {
      const slot = slots[s];
      const key = `${d}:${slot.slotIndex ?? s}`;
      const recipes = solverResult.selections.get(key) ?? [];

      if (recipes.length === 0) {
        dayMeals.push({
          name: `[Brak przepisu – ${slot.mealName}]`,
          items: [],
        });
        slotDecisions.push({
          dayIndex: d, slotIndex: s, dayName, mealType: slot.mealType,
          candidatesCount: 0, chosen: null, runnersUp: [],
          rulesApplied: [], confidence: 'LOW', scalingFailed: false,
        });
        continue;
      }

      // Faza D Phase 1 W2-Mon-B: solve_3tuple may return multiple items per
      // (day, slot). Items are pre-sorted MAIN→CARB→VEG by solveWeekPlan.
      // Single-element selections (legacy + COMPLETE_MEAL compose) take the
      // existing scaleRecipeForMeal path; multi-element ones go through the
      // joint scaleMealComposition.
      const recipe = recipes[0]!;   // MAIN — preserved name for back-compat below
      const carbRecipe = recipes.find((r) => r.dishCompleteness === 'CARB_SIDE');
      const vegRecipe  = recipes.find((r) => r.dishCompleteness === 'VEG_SIDE');
      const isComposed = !!(carbRecipe || vegRecipe);

      let meal: PlanMeal;
      let actualKcal = recipe.scaledKcal;
      let actualProt = recipe.scaledProteinG;
      let actualFat = recipe.scaledFatG;
      let actualCarbs = recipe.scaledCarbsG;

      // Fetch full recipe data for ALL items in the slot (needed for fallback
      // and for per-item ingredient lists / titles). Compose mode pulls 1-3,
      // legacy/COMPLETE_MEAL pull 1.
      const fullRecipeRows = await prisma.recipe.findMany({
        where: { id: { in: recipes.map((r) => r.recipeId) } },
        select: {
          id: true,
          title: true,
          servings: true,
          prepTimeMinutes: true,
          tips: true,
          instructionSteps: {
            select: { instruction: true },
            orderBy: { stepNumber: 'asc' },
          },
          ingredients: {
            select: {
              grams: true,
              displayName: true,
              cleanProduct: { select: { name: true } },
              foodProduct: { select: { name: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      const fullRecipeById = new Map(fullRecipeRows.map((fr) => [fr.id, fr]));
      const fullRecipe = fullRecipeById.get(recipe.recipeId);

      // Map slot mealType to scaler MealType for portion limits
      const SCALER_MEAL_MAP: Record<string, MealType> = {
        BREAKFAST: 'breakfast', SECOND_BREAKFAST: 'snack',
        LUNCH: 'lunch', DINNER: 'dinner',
        SUPPER: 'snack', SNACK: 'snack',
      };
      const scalerMealType = SCALER_MEAL_MAP[slot.mealType] ?? 'lunch';

      try {
        if (isComposed) {
          // ── 3-tuple joint scaling via Faza D §M1 ─────────────────────
          const composition = await scaleMealComposition({
            mainRecipeId: recipe.recipeId,
            carbRecipeId: carbRecipe?.recipeId,
            vegRecipeId: vegRecipe?.recipeId,
          }, {
            targetKcal: slot.targetKcal,
            targetProteinG: slot.targetProteinG,
            targetFatG: slot.targetFatG,
            targetCarbsG: slot.targetCarbsG,
          }, scalerMealType, dailyKcalTarget);

          const items: PlanItem[] = [];
          const pushItem = (
            elementRecipe: ScoredRecipeCandidate,
            partial: typeof composition.main | undefined,
          ): void => {
            if (!partial) return;
            const elementFull = fullRecipeById.get(elementRecipe.recipeId);
            // ScalingResult.ingredients carries scaledGrams (vs scaleRecipeForMeal
            // which already remaps to .grams). Round here for display.
            const planIngredients: PlanIngredient[] = partial.ingredients.map((ing) => ({
              name: ing.displayName ?? '',
              grams: Math.round(ing.scaledGrams),
            }));
            const totalGrams = planIngredients.reduce((sum, ing) => sum + ing.grams, 0);
            items.push({
              name: elementFull?.title ?? elementRecipe.title,
              grams: totalGrams,
              kcal: Math.round(partial.scaledNutrition.kcal),
              protein: Math.round(partial.scaledNutrition.proteinG * 10) / 10,
              fat: Math.round(partial.scaledNutrition.fatG * 10) / 10,
              carbs: Math.round(partial.scaledNutrition.carbsG * 10) / 10,
              ingredients: planIngredients.length > 0 ? planIngredients : undefined,
            });
          };
          pushItem(recipe, composition.main);
          if (carbRecipe) pushItem(carbRecipe, composition.carb);
          if (vegRecipe)  pushItem(vegRecipe,  composition.veg);

          const mealRecipe: MealRecipe | undefined = fullRecipe ? {
            prepTimeMin: fullRecipe.prepTimeMinutes ?? 0,
            steps: fullRecipe.instructionSteps.map((st) => st.instruction),
            tips: fullRecipe.tips ?? undefined,
          } : undefined;

          meal = {
            name: fullRecipe?.title ?? recipe.title,
            items,
            recipe: mealRecipe,
            glycemicIndex: recipeGiMap.get(recipe.recipeId),
            cookingMethod: recipe.cookingMethod ?? undefined,
          };

          actualKcal = composition.totals.kcal;
          actualProt = composition.totals.proteinG;
          actualFat = composition.totals.fatG;
          actualCarbs = composition.totals.carbsG;
        } else {
          // ── Single-element legacy / COMPLETE_MEAL path ───────────────
          const scalingResult = await scaleRecipeForMeal(recipe.recipeId, {
            targetKcal: slot.targetKcal,
            targetProteinG: slot.targetProteinG,
            targetFatG: slot.targetFatG,
            targetCarbsG: slot.targetCarbsG,
          }, scalerMealType, dailyKcalTarget);

          const planIngredients: PlanIngredient[] = scalingResult.ingredients.map((ing) => ({
            name: ing.displayName ?? '',
            grams: Math.round(ing.grams),
          }));

          const totalGrams = planIngredients.reduce((sum, ing) => sum + ing.grams, 0);

          const items: PlanItem[] = [{
            name: fullRecipe?.title ?? recipe.title,
            grams: totalGrams,
            kcal: Math.round(scalingResult.scaledNutrition.kcal),
            protein: Math.round(scalingResult.scaledNutrition.proteinG * 10) / 10,
            fat: Math.round(scalingResult.scaledNutrition.fatG * 10) / 10,
            carbs: Math.round(scalingResult.scaledNutrition.carbsG * 10) / 10,
            ingredients: planIngredients,
          }];

          const mealRecipe: MealRecipe | undefined = fullRecipe ? {
            prepTimeMin: fullRecipe.prepTimeMinutes ?? 0,
            steps: fullRecipe.instructionSteps.map((st) => st.instruction),
            tips: fullRecipe.tips ?? undefined,
          } : undefined;

          meal = {
            name: fullRecipe?.title ?? recipe.title,
            items,
            recipe: mealRecipe,
            glycemicIndex: recipeGiMap.get(recipe.recipeId),
            cookingMethod: recipe.cookingMethod ?? undefined,
          };

          // Use scaler nutrition (always at least 1 full serving now)
          actualKcal = scalingResult.scaledNutrition.kcal;
          actualProt = scalingResult.scaledNutrition.proteinG;
          actualFat = scalingResult.scaledNutrition.fatG;
          actualCarbs = scalingResult.scaledNutrition.carbsG;
        }
      } catch (scalingErr) {
        // Scaler failed — recipe likely has no nutrient data (legacy or missing cleanProduct)
        // OR scaleMealComposition failed for a 3-tuple. In both cases we degrade
        // to single-element raw rendering of the MAIN — shopping list / recipe
        // steps still work, sides simply don't show up that one slot.
        captureException(scalingErr, {
          recipeId: recipe.recipeId,
          recipeTitle: recipe.title,
          context: isComposed ? 'weekSolver.scaleMealComposition' : 'weekSolver.scaleRecipeForMeal',
          composeItemsCount: recipes.length,
        });

        const fallbackServings = Math.max(fullRecipe?.servings ?? 1, 1);
        const fallbackIngredients: PlanIngredient[] = (fullRecipe?.ingredients ?? [])
          .map((ing) => ({
            name: ing.displayName ?? ing.cleanProduct?.name ?? ing.foodProduct?.name ?? '',
            grams: Math.round(Number(ing.grams) / fallbackServings),
          }))
          .filter((ing) => ing.name.length > 0);

        const fallbackTotalGrams = fallbackIngredients.reduce((s, i) => s + i.grams, 0);

        const fallbackRecipe: MealRecipe | undefined = fullRecipe ? {
          prepTimeMin: fullRecipe.prepTimeMinutes ?? 0,
          steps: fullRecipe.instructionSteps.map((st) => st.instruction),
          tips: fullRecipe.tips ?? undefined,
        } : undefined;

        meal = {
          name: fullRecipe?.title ?? recipe.title,
          items: [{
            name: fullRecipe?.title ?? recipe.title,
            grams: fallbackTotalGrams,
            kcal: Math.round(actualKcal),
            protein: Math.round(actualProt * 10) / 10,
            fat: Math.round(actualFat * 10) / 10,
            carbs: Math.round(actualCarbs * 10) / 10,
            ingredients: fallbackIngredients.length > 0 ? fallbackIngredients : undefined,
          }],
          recipe: fallbackRecipe,
          glycemicIndex: recipeGiMap.get(recipe.recipeId),
          cookingMethod: recipe.cookingMethod ?? undefined,
        };
      }

      dayMeals.push(meal);
      // Faza D: track every selected recipe (main + sides) for shopping list /
      // recipe metadata, not just the main.
      for (const r of recipes) allRecipeIds.push(r.recipeId);
      filledCount++;
      totalFitScore += recipe.nutritionFitScore;
      totalScore += recipe.totalScore;
      dayKcal += actualKcal;
      dayProt += actualProt;
      dayFat += actualFat;
      dayCarbs += actualCarbs;

      // 82.3: Accumulate daily glycemic load
      const mealGi = recipeGiMap.get(recipe.recipeId);
      if (mealGi && mealGi > 0) {
        dayGL += (mealGi / 100) * actualCarbs;
      }

      // ── Retrospective C2 rule analysis ──────────────────────────────
      const appliedRules: string[] = ['SOLVER_SELECTED'];

      const recipeProtein = getProteinSourceFromTitle(recipe);
      if (recipeProtein) {
        const dayProteins = proteinSourcesByDay.get(d) ?? [];
        dayProteins.push(recipeProtein);
        proteinSourcesByDay.set(d, dayProteins);
        const yesterdayProteins = proteinSourcesByDay.get(d - 1) ?? [];
        if (yesterdayProteins.includes(recipeProtein)) {
          appliedRules.push(`PROTEIN_REPEAT: ${recipeProtein} also yesterday`);
        }
      }

      const CAPS: Record<string, number> = { owsian: 2, oatmeal: 2, sałatk: 2, salad: 2 };
      const titleAndTags = [recipe.title, ...recipe.tags].join(' ');
      for (const [pattern, max] of Object.entries(CAPS)) {
        if (new RegExp(pattern, 'i').test(titleAndTags)) {
          const count = categoryCountsWeekly.get(pattern) ?? 0;
          categoryCountsWeekly.set(pattern, count + 1);
          if (count + 1 > max) {
            appliedRules.push(`WEEKLY_CAP: ${pattern} ${count + 1}/${max}`);
          }
        }
      }

      if (slot.mealType === 'LUNCH') lunchKcalByDay.set(d, actualKcal);
      if (slot.mealType === 'DINNER') {
        const lunchKcal = lunchKcalByDay.get(d);
        if (lunchKcal && actualKcal > lunchKcal * 0.85) {
          appliedRules.push(`HEAVY_DINNER: ${Math.round(actualKcal)} > ${Math.round(lunchKcal * 0.85)}`);
        }
      }

      if (slot.mealType === 'BREAKFAST') {
        const protPct = actualKcal > 0 ? (actualProt * 4 / actualKcal) * 100 : 0;
        if (protPct < 15) {
          appliedRules.push(`LOW_BREAKFAST_PROTEIN: ${protPct.toFixed(1)}% < 15%`);
        }
      }

      const protPctAll = actualKcal > 0 ? (actualProt * 4 / actualKcal) * 100 : 0;
      if (protPctAll < 10) {
        appliedRules.push(`PURE_CARB: protein ${protPctAll.toFixed(1)}% < 10%`);
      }

      if (recipe.tags.some((t) => /pełnoziarnist|whole\s*grain/i.test(t))) {
        appliedRules.push('WHOLE_GRAINS_BONUS');
      }
      if (recipe.fiberG > 8) {
        appliedRules.push(`HIGH_FIBER_BONUS: ${recipe.fiberG.toFixed(1)}g`);
      }

      slotDecisions.push({
        dayIndex: d, slotIndex: s, dayName, mealType: slot.mealType,
        candidatesCount: CANDIDATES_PER_SLOT,
        chosen: {
          recipeId: recipe.recipeId,
          title: recipe.title,
          totalScore: recipe.totalScore,
          adjustedScore: recipe.totalScore,
          scores: {
            nutritionFit: recipe.nutritionFitScore,
            quality: recipe.qualityScore,
            patientRating: recipe.patientRatingScore,
            cuisine: recipe.cuisineScore,
            season: recipe.seasonScore,
            diversity: recipe.diversityScore,
            cost: recipe.costScore,
            microFit: recipe.microFitScore,
            practicalFit: recipe.practicalFitScore,
            satietyProxy: recipe.satietyProxyScore,
            interaction: recipe.interactionScore,
            compliance: recipe.complianceScore,
          },
        },
        runnersUp: [],
        rulesApplied: appliedRules,
        confidence: 'HIGH',
        scalingFailed: false,
      });

      // 82.10: Attach human-readable reasons to the meal for patient tooltip
      const humanReasons: string[] = [];
      if (recipe.seasonScore > 70) humanReasons.push('Sezonowe składniki');
      if (recipe.fiberG > 8) humanReasons.push(`Bogaty w błonnik (${recipe.fiberG.toFixed(0)}g)`);
      const gi = recipeGiMap.get(recipe.recipeId);
      if (gi && gi > 0 && gi <= 55) humanReasons.push(`Niski IG (${gi})`);
      if (recipe.nutritionFitScore > 80) humanReasons.push('Doskonałe dopasowanie makro');
      if (recipe.totalTimeMinutes && recipe.totalTimeMinutes <= 20) humanReasons.push('Szybki w przygotowaniu');
      if (recipe.mealPrepFriendly) humanReasons.push('Nadaje się do meal prep');
      if (humanReasons.length > 0) meal.reasons = humanReasons.slice(0, 3);
    }

    planDays.push({ day: dayName, meals: dayMeals });
    dailyKcal.push(Math.round(dayKcal));
    dailyProteinG.push(Math.round(dayProt));
    dailyFatG.push(Math.round(dayFat));
    dailyCarbsG.push(Math.round(dayCarbs));
    dailyGlycemicLoad.push(Math.round(dayGL));
  }

  const totalSlots = numDays * slots.length;
  const uniqueRecipes = new Set(allRecipeIds).size;

  // BUG-4: Shopping efficiency (seasonings excluded)
  const shopping = await computeShoppingEfficiency(allRecipeIds);

  const coverage: CoverageReport = {
    totalSlots,
    filledFromDb: filledCount,
    uncoveredSlots: totalSlots - filledCount,
    filledFromDbPct: totalSlots > 0 ? (filledCount / totalSlots) * 100 : 0,
    avgFitScore: filledCount > 0 ? Math.round(totalFitScore / filledCount * 10) / 10 : 0,
    avgTotalScore: filledCount > 0 ? Math.round(totalScore / filledCount * 10) / 10 : 0,
    diversityScore: filledCount > 0 ? Math.round(uniqueRecipes / filledCount * 100) / 100 : 0,
    avgKcalDeviation: 0,
    uniqueIngredients: shopping.uniqueIngredients,
    totalIngredientUses: shopping.totalIngredientUses,
    shoppingEfficiencyScore: shopping.shoppingEfficiencyScore,
    dailyKcal,
    dailyProteinG,
    dailyFatG,
    dailyCarbsG,
    dailyGlycemicLoad,
  };

  return {
    plan: { days: planDays },
    coverage,
    generationMethod: 'database',
    recipeIds: allRecipeIds,
    durationMs: Date.now() - startMs,
    slotDecisions,
  };
}
