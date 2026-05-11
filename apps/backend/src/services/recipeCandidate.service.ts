import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { classifyCuisineMatch } from '../utils/cuisineMapping';
import { getScoringWeights, type ScoringWeights } from './appSettings.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** Query to find recipe candidates for a specific meal slot. */
export interface RecipeCandidateQuery {
  mealType: string;
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
  kcalTolerance?: number; // % tolerance (default 30 = ±30%)
  // Exclusion filters
  excludeAllergens?: string[];
  requiredDietFlags?: string[];
  excludeRecipeIds?: string[];
  excludeCuisineTypes?: string[];
  excludeProteinSources?: string[]; // protein tag prefixes already used today
  // Preference filters
  maxTotalTimeMinutes?: number;
  preferMealPrep?: boolean;
  season?: number; // current month (1-12)
  maxCost?: 'BUDGET' | 'STANDARD' | 'PREMIUM';
  // 82.2: GI filter for diabetic-friendly recipe selection
  maxGlycemicIndex?: number;  // e.g., 55 for low-GI only
  // #3: FODMAP filter for IBS/IBD patients
  excludeHighFodmap?: boolean; // true → exclude recipes with HIGH FODMAP ingredients
  // Pagination
  limit?: number; // default 50
  // ── Faza 73: Extended scoring context ─────────────────────────────────────
  /** Patient's max cooking time budget from interview (minutes) — for practicalFit */
  patientMaxCookingTime?: number;
  /** Micronutrient deficits to optimize for — [{name, gapPct}] sorted by priority */
  microDeficits?: Array<{ nutrient: string; gapPct: number }>;
  /** Patient's historical drop rate for complex recipes (0-1) — for compliancePredictor */
  patientDropRate?: { highTime: number; highIngredient: number };
  /** Dairy-containing slot indices in today's plan so far — for interactionPenalty */
  todayDairySlots?: number[];
  /** Current slot index — for interaction penalty context */
  currentSlotIndex?: number;
  // ── Faza 76a: Dynamic scoring weights ───────────────────────────────────
  /** Per-dietitian scoring weight overrides (merged on top of AppSettings + defaults) */
  dietitianWeightOverrides?: Partial<ScoringWeights> | null;
  // ── Faza D D1: Cuisine preference HARD filter (master plan §HC10) ──────
  /**
   * Patient's preferred cuisines (e.g. ['polska', 'włoska']). When non-empty,
   * candidates are restricted to recipes whose `cuisineType` matches one of
   * these OR is null (cuisine-unset recipes always pass). Empty or `['any']`
   * disables the filter. (The legacy 'uniwersalna' value was dropped in P0.3.)
   */
  cuisinePreferences?: string[];
  // ── Faza D: Override default dishCompleteness gating (for 3-tuple side pools) ──
  /**
   * Override the mealType→dishCompleteness mapping in queryRecipeCandidates.
   * When set, restricts candidates to ONLY these completeness levels.
   * Used by the 3-tuple composer to fetch CARB_SIDE / VEG_SIDE pools
   * separately. Leave undefined for legacy mealType-driven gating.
   */
  dishCompletenessOverride?: Array<'COMPLETE_MEAL' | 'MAIN_DISH' | 'CARB_SIDE' | 'VEG_SIDE' | 'COMPONENT'>;
}

/** A recipe candidate with computed score. */
export interface ScoredRecipeCandidate {
  recipeId: string;
  title: string;
  category: string;
  mealType: string;
  cuisineType: string | null;
  // Nutrition per serving (original, before scaling)
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  // Scaling
  scaleFactor: number;
  scaledKcal: number;
  scaledProteinG: number;
  scaledFatG: number;
  scaledCarbsG: number;
  // Scores (0-100 each, weighted to final)
  nutritionFitScore: number;   // 32% weight
  qualityScore: number;        // 8% weight
  patientRatingScore: number;  // 8% weight
  cuisineScore: number;        // 7% weight
  seasonScore: number;         // 5% weight
  diversityScore: number;      // 7% weight
  costScore: number;           // disabled (0%)
  // Faza 73: New sub-scores
  microFitScore: number;       // 11% weight — micronutrient deficit coverage
  practicalFitScore: number;   // 7% weight — cooking time vs patient budget
  satietyProxyScore: number;   // 5% weight — satiety index proxy
  interactionScore: number;    // 5% weight — nutrient interaction penalty (dairy+iron)
  complianceScore: number;     // 5% weight — predicted compliance from history
  totalScore: number;          // weighted sum 0-100
  // Metadata
  totalTimeMinutes: number | null;
  difficulty: string;
  servings: number;
  tags: string[];
  mealPrepFriendly: boolean;
  cookingMethod: string | null;  // 84.3: BAKED, BOILED, FRIED, GRILLED, STEAMED, RAW, OTHER
  // Faza 77: Extended data for solver precision
  sodiumMg: number;
  ironMg: number;
  calciumMg: number;
  vitaminDUg: number;
  folateUg: number;
  vitaminB12Ug: number;
  zincMg: number;
  vitaminCMg: number;
  // QW#16+17: Additional micronutrients for solver RDA coverage
  magnesiumMg: number;
  potassiumMg: number;
  vitaminAUg: number;
  vitaminKUg: number;
  // #12: More micronutrients
  omega3G: number;
  seleniumUg: number;
  iodineUg: number;
  phosphorusMg: number;
  // ── Faza D: Composition flags exposed for 3-tuple solver path ──────────
  /** Recipe's dishCompleteness classification (Faza C). null when unclassified. */
  dishCompleteness: 'COMPLETE_MEAL' | 'MAIN_DISH' | 'CARB_SIDE' | 'VEG_SIDE' | 'COMPONENT' | null;
  /** Whether the recipe already contains ≥100g of vegetables (audit-derived). */
  containsVegetableServing: boolean;
}

/** Result of a scaled recipe for plan integration. */
export interface ScaledNutrition {
  scaleFactor: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  ingredients: Array<{
    ingredientId: string;
    originalGrams: number;
    scaledGrams: number;
    displayName: string | null;
  }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_KCAL_TOLERANCE = 30; // ±30%
const DEFAULT_LIMIT = 50;
const MIN_SCALE_FACTOR = 0.5;   // Must align with scaler MIN_SERVINGS=1 — reject recipes too caloric for the slot

// Faza E — per-servingType scale ranges. Each servingType interprets the scale
// factor differently:
//   PER_PORTION → 0.5–3.0 servings (default behavior)
//   PER_PIECE   → 1–6 pieces (5 naleśników, not 17 servings)
//   PER_100G    → 1.5–5 (150–500 g of soup/sauce per meal)
const SCALE_RANGES: Record<string, { min: number; max: number }> = {
  PER_PORTION: { min: 0.5, max: 3.0 },
  PER_PIECE:   { min: 1.0, max: 6.0 },
  PER_100G:    { min: 1.5, max: 5.0 },
};

function getScaleRange(servingType: string): { min: number; max: number } {
  return SCALE_RANGES[servingType] ?? SCALE_RANGES.PER_PORTION!;
}
const MAX_SCALE_FACTOR = 3.0;   // Must align with scaler MAX_SERVINGS=3

/** Cost hierarchy for filtering: BUDGET < STANDARD < PREMIUM */
const COST_ALLOWED: Record<string, string[]> = {
  BUDGET: ['BUDGET'],
  STANDARD: ['BUDGET', 'STANDARD'],
  PREMIUM: ['BUDGET', 'STANDARD', 'PREMIUM'],
};

/**
 * Scoring weights — loaded from AppSettings (76a), with optional per-dietitian override.
 * Hardcoded fallback kept for reference / offline use.
 */
const FALLBACK_WEIGHTS: ScoringWeights = {
  nutritionFit: 0.32,
  quality: 0.08,
  patientRating: 0.08,
  cuisine: 0.07,
  season: 0.05,
  diversity: 0.07,
  cost: 0,
  microFit: 0.11,
  practicalFit: 0.07,
  satietyProxy: 0.05,
  interaction: 0.05,
  compliance: 0.05,
};

// ─── Internal types ──────────────────────────────────────────────────────────

/** Shape returned from the Prisma query (before scoring). */
interface RawRecipeCandidate {
  id: string;
  title: string;
  category: string | null;
  mealType: string;
  cuisineType: string | null;
  qualityScore: number;
  averageRating: Prisma.Decimal | null;
  ratingCount: number;
  totalTimeMinutes: number | null;
  difficulty: string;
  servings: number;
  servingType: string; // Faza E: PER_PORTION | PER_PIECE | PER_100G
  tags: string[];
  mealPrepFriendly: boolean;
  seasons: number[];
  estimatedCost: string;
  ingredientCount: number;
  // Faza D: composition classification + veg flag
  dishCompleteness: 'COMPLETE_MEAL' | 'MAIN_DISH' | 'CARB_SIDE' | 'VEG_SIDE' | 'COMPONENT' | null;
  containsVegetableServing: boolean;
  nutritionSnapshot: {
    kcal: Prisma.Decimal;
    protein_g: Prisma.Decimal;
    fat_g: Prisma.Decimal;
    carbs_g: Prisma.Decimal;
    fiber_g: Prisma.Decimal | null;
    // Faza 73: Micronutrients for microFit scoring
    iron_mg: Prisma.Decimal | null;
    calcium_mg: Prisma.Decimal | null;
    magnesium_mg: Prisma.Decimal | null;
    zinc_mg: Prisma.Decimal | null;
    potassium_mg: Prisma.Decimal | null;
    vitaminC_mg: Prisma.Decimal | null;
    vitaminD_ug: Prisma.Decimal | null;
    vitaminB12_ug: Prisma.Decimal | null;
    folate_ug: Prisma.Decimal | null;
    omega3_g: Prisma.Decimal | null;
    // Faza 77: Sodium for solver constraint
    sodium_mg: Prisma.Decimal | null;
    // QW#16+17: Additional micronutrients
    vitaminA_ug: Prisma.Decimal | null;
    vitaminK_ug: Prisma.Decimal | null;
    // #12: More micronutrients
    selenium_ug: Prisma.Decimal | null;
    iodine_ug: Prisma.Decimal | null;
    phosphorus_mg: Prisma.Decimal | null;
    // For satiety proxy (energy density via total recipe weight)
    totalKcal: Prisma.Decimal;
    totalProtein_g: Prisma.Decimal;
  } | null;
  // Cooking method from Recipe model
  cookingMethod: string | null;
}

// ─── DB Query ────────────────────────────────────────────────────────────────

/**
 * Build Prisma where clause and fetch recipe candidates from the database.
 *
 * Applies 9 filter layers:
 *  1. isActive = true
 *  2. mealType match
 *  3. allergen exclusion (CONTAINS)
 *  4. required diet flags
 *  5. cost ceiling
 *  6. max cooking time
 *  7. kcal tolerance range (via nutritionSnapshot)
 *  8. exclude already-used recipe IDs
 *  9. exclude protein source tags
 *
 * Season and mealPrep are NOT hard-filtered — used for scoring only.
 */
async function queryRecipeCandidates(
  query: RecipeCandidateQuery,
): Promise<RawRecipeCandidate[]> {
  const tolerance = query.kcalTolerance ?? DEFAULT_KCAL_TOLERANCE;
  const limit = query.limit ?? DEFAULT_LIMIT;

  const minKcal = query.targetKcal * (1 - tolerance / 100);
  const maxKcal = query.targetKcal * (1 + tolerance / 100);

  // Build AND conditions
  const andConditions: Prisma.RecipeWhereInput[] = [];

  // 1. Active only + trusted sources (never use AI-generated recipes for DB-first)
  andConditions.push({ isActive: true });
  andConditions.push({ source: { in: ['imported', 'manual'] } });

  // 2. Meal type
  andConditions.push({ mealType: query.mealType as Prisma.EnumRecipeMealTypeFilter['equals'] });

  // 2b. Dish-completeness gating — zastąpiło hotfix Faza A.1 (mealType notIn).
  // Faza C wprowadziła Recipe.dishCompleteness, które precyzyjniej opisuje
  // czy przepis nadaje się solo. Dla 162 NULL receptur (czekają na GPT pass)
  // zachowujemy backward-compat przez OR — żeby nie zmniejszać puli.
  //
  // Reguły:
  //   • BREAKFAST/SECOND_BREAKFAST/SNACK/DESSERT → tylko COMPLETE_MEAL
  //   • LUNCH/DINNER/SUPPER → COMPLETE_MEAL lub MAIN_DISH (MAIN_DISH solo
  //     to stan przejściowy do czasu Faza D — solver na razie wybiera samo
  //     mięso bez carb/veg, ale lepsze niż infeasible)
  //   • SAUCE/SIDE_DISH slots — bez dodatkowego filtra, mealType już zawęża
  const SOLO_FRIENDLY_SLOTS = new Set(['BREAKFAST', 'SECOND_BREAKFAST', 'SNACK', 'DESSERT']);
  const COMPOSITION_SLOTS = new Set(['LUNCH', 'DINNER', 'SUPPER']);

  // Faza D: Caller-supplied dishCompleteness override takes precedence over the
  // mealType-driven defaults below. Used by the 3-tuple composer to fetch
  // CARB_SIDE / VEG_SIDE pools without backward-compat NULL fallback.
  if (query.dishCompletenessOverride && query.dishCompletenessOverride.length > 0) {
    andConditions.push({
      dishCompleteness: { in: query.dishCompletenessOverride },
    });
  } else if (SOLO_FRIENDLY_SLOTS.has(query.mealType)) {
    andConditions.push({
      OR: [
        { dishCompleteness: 'COMPLETE_MEAL' },
        { dishCompleteness: null }, // backward-compat dla nieprzeklasyfikowanych
      ],
    });
  } else if (COMPOSITION_SLOTS.has(query.mealType)) {
    andConditions.push({
      OR: [
        { dishCompleteness: { in: ['COMPLETE_MEAL', 'MAIN_DISH'] } },
        { dishCompleteness: null },
      ],
    });
  }
  // SAUCE/SIDE_DISH/DRINK slots — solver może chcieć tych typów pod fallback
  // (FALLBACK_MEAL_TYPES w weekSolver.service.ts), nie filtrujemy tutaj.

  // Faza D D1 (revised): Cuisine preference is now a SOFT constraint —
  // see classifyCuisineMatch + cuisineScore below. The previous hard filter
  // wiped every candidate pool to zero for any patient who picked a specific
  // cuisine because:
  //   • The interview emits English codes (`polish`, `mexican`, `mediterranean`)
  //     while Recipe.cuisineType stores Polish (`polska`, `meksykańska`,
  //     `śródziemnomorska`). A WHERE `cuisineType IN ('mexican')` never matches.
  //   • Even with EN→PL translation, rare cuisines (`francuska` 45,
  //     `indyjska` 25) cannot fill 7 days × 5 slots while staying recipe-unique.
  // Cuisine match now feeds `cuisineScore` (per-candidate gradient) and the
  // solver's SC8 soft constraint (strong ±bonus). Universal recipes still
  // pass through neutrally, mismatches penalize without blocking.

  // 3. Allergen exclusion — exclude recipes that CONTAIN any of the specified allergens
  if (query.excludeAllergens && query.excludeAllergens.length > 0) {
    andConditions.push({
      allergens: {
        none: {
          allergenCode: { in: query.excludeAllergens },
          presence: 'CONTAINS',
        },
      },
    });
  }

  // 4. Required diet flags — recipe must have each flag = true
  if (query.requiredDietFlags && query.requiredDietFlags.length > 0) {
    for (const flagCode of query.requiredDietFlags) {
      andConditions.push({
        dietFlags: {
          some: {
            flagCode,
            value: true,
          },
        },
      });
    }
  }

  // 5. Cost ceiling
  if (query.maxCost) {
    const allowed = COST_ALLOWED[query.maxCost];
    if (allowed) {
      andConditions.push({
        estimatedCost: { in: allowed as Prisma.EnumPriceCategoryFilter['in'] },
      });
    }
  }

  // 6. Max cooking time
  if (query.maxTotalTimeMinutes != null) {
    andConditions.push({
      OR: [
        { totalTimeMinutes: { lte: query.maxTotalTimeMinutes } },
        { totalTimeMinutes: null }, // allow recipes without time data
      ],
    });
  }

  // 7. Require nutrition snapshot with valid kcal (no kcal range filter — scaler handles 0.5x-2.0x)
  andConditions.push({
    nutritionSnapshot: { is: { kcal: { gt: 0 } } },
  });

  // 8. Exclude already-used recipe IDs
  if (query.excludeRecipeIds && query.excludeRecipeIds.length > 0) {
    andConditions.push({
      id: { notIn: query.excludeRecipeIds },
    });
  }

  // 9. Exclude protein source tags (e.g. ["protein:chicken", "protein:beef"])
  if (query.excludeProteinSources && query.excludeProteinSources.length > 0) {
    for (const prefix of query.excludeProteinSources) {
      // Prisma doesn't support array element prefix matching natively,
      // so we use raw filtering on the tags array.
      // We exclude recipes where ANY tag starts with the given prefix.
      andConditions.push({
        NOT: {
          tags: { has: prefix },
        },
      });
    }
  }

  // 10. FODMAP hard filter — exclude recipes with ≥1 mandatory HIGH-FODMAP ingredient.
  // Pushed into DB query (was a post-filter) so `take: limit` does not silently drop
  // safe recipes by picking 25 HIGH-FODMAP-heavy ones first.
  if (query.excludeHighFodmap) {
    andConditions.push({
      ingredients: {
        none: {
          isOptional: false,
          cleanProduct: { fodmapLevel: 'HIGH' },
        },
      },
    });
  }

  const recipes = await prisma.recipe.findMany({
    where: { AND: andConditions },
    select: {
      id: true,
      title: true,
      category: true,
      mealType: true,
      cuisineType: true,
      qualityScore: true,
      averageRating: true,
      ratingCount: true,
      totalTimeMinutes: true,
      difficulty: true,
      servings: true,
      servingType: true, // Faza E
      tags: true,
      mealPrepFriendly: true,
      cookingMethod: true,
      seasons: true,
      estimatedCost: true,
      // Faza D: expose composition classification + veg flag for solver
      dishCompleteness: true,
      containsVegetableServing: true,
      _count: { select: { ingredients: true } },
      nutritionSnapshot: {
        select: {
          kcal: true,
          protein_g: true,
          fat_g: true,
          carbs_g: true,
          fiber_g: true,
          // Faza 73: Micronutrients for scoring
          iron_mg: true,
          calcium_mg: true,
          magnesium_mg: true,
          zinc_mg: true,
          potassium_mg: true,
          vitaminC_mg: true,
          vitaminD_ug: true,
          vitaminB12_ug: true,
          folate_ug: true,
          omega3_g: true,
          // Faza 77: Sodium for solver constraint
          sodium_mg: true,
          // QW#17: Fat-soluble vitamins for solver RDA coverage
          vitaminA_ug: true,
          vitaminK_ug: true,
          // #12: More micronutrients
          selenium_ug: true,
          iodine_ug: true,
          phosphorus_mg: true,
          // For satiety proxy (energy density)
          totalKcal: true,
          totalProtein_g: true,
        },
      },
    },
    orderBy: { qualityScore: 'desc' },
    take: limit,
  });

  return recipes.map((r) => ({
    ...r,
    category: r.category ?? null,
    ingredientCount: (r as unknown as { _count: { ingredients: number } })._count?.ingredients ?? 0,
  })) as unknown as RawRecipeCandidate[];
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Convert Prisma.Decimal to number safely. */
function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

/**
 * Compute all sub-scores and final totalScore for a single candidate.
 *
 * All sub-scores are in [0, 100]. The totalScore is a weighted sum.
 */
function scoreCandidate(
  candidate: RawRecipeCandidate,
  query: RecipeCandidateQuery,
  weights: ScoringWeights = FALLBACK_WEIGHTS,
): ScoredRecipeCandidate {
  const snap = candidate.nutritionSnapshot!;
  const kcal = toNum(snap.kcal);
  const proteinG = toNum(snap.protein_g);
  const fatG = toNum(snap.fat_g);
  const carbsG = toNum(snap.carbs_g);
  const fiberG = toNum(snap.fiber_g);

  // ── Scale factor (Faza E: servingType-aware) ────────────────────────────
  // PER_PORTION: scaleFactor = liczba porcji (0.5–3 talerze)
  // PER_PIECE:   scaleFactor = liczba sztuk (1–6 naleśników)
  // PER_100G:    scaleFactor = liczba 100g (1.5–5 = 150–500g zupy)
  const range = getScaleRange(candidate.servingType);
  const rawScale = kcal > 0 ? query.targetKcal / kcal : 1;
  const scaleFactor = clamp(rawScale, range.min, range.max);

  // For PER_PIECE: round to integer (cannot eat 2.7 naleśników).
  // For PER_PORTION/PER_100G: keep fractional.
  const realisticScale = candidate.servingType === 'PER_PIECE'
    ? Math.max(range.min, Math.min(range.max, Math.round(scaleFactor)))
    : scaleFactor;

  // Effective scale used for "real" macros — caps below min at min (scaler floor).
  // Snacks ≤250 kcal can shrink to 0.5; main slots can't go below min.
  const scalerMin = query.targetKcal <= 250 ? Math.min(range.min, 0.5) : range.min;
  const effectiveScale = rawScale < scalerMin ? scalerMin : realisticScale;
  const realKcal = kcal * effectiveScale;
  const realProteinG = proteinG * effectiveScale;
  const realFatG = fatG * effectiveScale;
  const realCarbsG = carbsG * effectiveScale;

  // Scaled values returned to the solver — use realisticScale (integer for
  // PER_PIECE) so that the solver and downstream payloads see honest values.
  const scaledKcal = kcal * realisticScale;
  const scaledProteinG = proteinG * realisticScale;
  const scaledFatG = fatG * realisticScale;
  const scaledCarbsG = carbsG * realisticScale;

  // ── 1. Nutrition fit score (40%) ────────────────────────────────────────
  //    Use REAL values (post-scaler) for scoring, not theoretical scaled values
  const deviations: number[] = [];

  if (query.targetKcal > 0) {
    deviations.push(Math.abs(realKcal - query.targetKcal) / query.targetKcal);
  }
  if (query.targetProteinG > 0) {
    deviations.push(Math.abs(realProteinG - query.targetProteinG) / query.targetProteinG);
  }
  if (query.targetFatG > 0) {
    deviations.push(Math.abs(realFatG - query.targetFatG) / query.targetFatG);
  }
  if (query.targetCarbsG > 0) {
    deviations.push(Math.abs(realCarbsG - query.targetCarbsG) / query.targetCarbsG);
  }

  const avgDeviation = deviations.length > 0
    ? deviations.reduce((a, b) => a + b, 0) / deviations.length
    : 0;
  const nutritionFitScore = clamp(100 - avgDeviation * 200, 0, 100);

  // ── 2. Quality score (15%) ──────────────────────────────────────────────
  const qualityScore = clamp(candidate.qualityScore, 0, 100);

  // ── 3. Patient rating score (15%) ───────────────────────────────────────
  const patientRatingScore = candidate.averageRating != null && candidate.ratingCount > 0
    ? clamp(toNum(candidate.averageRating) * 20, 0, 100)
    : 50; // neutral default for unrated recipes

  // ── 4. Cuisine match score (10%) ────────────────────────────────────────
  // Three-way gradient:
  //   • exclude list hit  → 30 (legacy diversity penalty preserved)
  //   • match patient pref → 100  (recipe cuisine in classified prefs)
  //   • neutral (no prefs / universal recipe) → 100  (don't drag score down)
  //   • mismatch (prefs set, cuisine differs) → 30  (visible discount, but
  //     not a kill — solver decides via SC8 if a stronger signal is needed)
  const cuisineKind = classifyCuisineMatch(candidate.cuisineType, query.cuisinePreferences);
  let cuisineScore: number;
  if (candidate.cuisineType && query.excludeCuisineTypes?.includes(candidate.cuisineType)) {
    cuisineScore = 30;
  } else if (cuisineKind === 'mismatch') {
    cuisineScore = 30;
  } else {
    cuisineScore = 100; // match or neutral
  }

  // ── 5. Season score (5%) ────────────────────────────────────────────────
  let seasonScore: number;
  if (!query.season || candidate.seasons.length === 0) {
    seasonScore = 60; // neutral — no season data or no preference
  } else if (candidate.seasons.includes(query.season)) {
    seasonScore = 100;
  } else {
    seasonScore = 20;
  }

  // ── 6. Diversity score (10%) ────────────────────────────────────────────
  //    Already filtered out excludeRecipeIds, so base is 100.
  //    Reduce if cuisine type is already heavily represented.
  let diversityScore = 100;
  if (candidate.cuisineType && query.excludeCuisineTypes?.includes(candidate.cuisineType)) {
    diversityScore = 60;
  }

  // ── 7. Cost score — DISABLED (no reliable data) ────────────────────────
  const costScore = 0;

  // ── 8. Micro-fit score (8%) — Faza 73 ──────────────────────────────────
  //    How well this recipe covers the patient's micronutrient deficits.
  //    Higher score = recipe provides more of what the patient is missing.
  let microFitScore = 50; // neutral default
  if (query.microDeficits && query.microDeficits.length > 0 && snap) {
    const microMap: Record<string, number> = {
      iron: toNum(snap.iron_mg),
      calcium: toNum(snap.calcium_mg),
      magnesium: toNum(snap.magnesium_mg),
      zinc: toNum(snap.zinc_mg),
      potassium: toNum(snap.potassium_mg),
      vitamin_c: toNum(snap.vitaminC_mg),
      vitamin_d: toNum(snap.vitaminD_ug),
      vitamin_b12: toNum(snap.vitaminB12_ug),
      folate: toNum(snap.folate_ug),
      omega3: toNum(snap.omega3_g),
    };

    let coverageSum = 0;
    let weightSum = 0;
    for (const deficit of query.microDeficits.slice(0, 5)) {
      const amount = microMap[deficit.nutrient] ?? 0;
      const weight = Math.min(deficit.gapPct, 100) / 100; // higher gap = more important
      // Score: has nutrient > 0 = good, scaled by amount relative contribution
      coverageSum += (amount > 0 ? 80 + Math.min(amount * 2, 20) : 20) * weight;
      weightSum += weight;
    }
    microFitScore = weightSum > 0 ? clamp(coverageSum / weightSum, 0, 100) : 50;
  }

  // ── 9. Practical-fit score (7%) — Faza 73 ─────────────────────────────
  //    How well the recipe fits the patient's time budget.
  let practicalFitScore = 80; // default: slightly favorable
  if (query.patientMaxCookingTime != null && candidate.totalTimeMinutes != null) {
    if (candidate.totalTimeMinutes <= query.patientMaxCookingTime) {
      practicalFitScore = 100; // fits within budget
    } else {
      const overageMinutes = candidate.totalTimeMinutes - query.patientMaxCookingTime;
      practicalFitScore = clamp(100 - overageMinutes * 5, 0, 100);
    }
  }

  // ── 10. Satiety proxy (5%) — Faza 73 ──────────────────────────────────
  //    Estimated satiety from protein %, fiber, and energy density.
  //    Formula: protein_pct * 40 + fiber_g * 3 + (1 - energy_density_normalized) * 20
  // Estimate total grams from macros (protein=4kcal/g, fat=9kcal/g, carbs=4kcal/g, water+fiber~rest)
  // Rough proxy: totalGrams ≈ protein+fat+carbs+fiber + water (estimated as 60% of total weight)
  const macroGrams = scaledProteinG + scaledFatG + scaledCarbsG + fiberG;
  const estimatedTotalGrams = macroGrams > 0 ? macroGrams / 0.4 : 300; // macros are ~40% of food weight
  const energyDensity = estimatedTotalGrams > 0 ? scaledKcal / estimatedTotalGrams : 1.5;
  const normalizedED = clamp(energyDensity / 3, 0, 1); // 3 kcal/g = max density
  const proteinPctForSatiety = scaledKcal > 0 ? (scaledProteinG * 4 / scaledKcal) : 0;
  const satietyProxyScore = clamp(
    proteinPctForSatiety * 40 * 3 + // protein % contribution (scaled ×3 for 0-1 range)
    fiberG * 3 +                     // fiber contribution
    (1 - normalizedED) * 20,         // low energy density bonus
    0,
    100,
  );

  // ── 11. Interaction penalty (5%) — Faza 73 ────────────────────────────
  //    Penalize if this recipe is iron-rich and adjacent slot has dairy (or vice versa).
  //    Dairy inhibits non-heme iron absorption.
  let interactionScore = 100; // default: no conflict
  if (query.todayDairySlots && query.currentSlotIndex != null) {
    const isDairy = candidate.tags.some((t) =>
      /nabiał|dairy|mleczn|jogurt|kefir|twaróg|ser\b/i.test(t),
    );
    const isIronRich = toNum(snap.iron_mg) > 3; // >3mg = significant
    const hasAdjacentDairy = query.todayDairySlots.some(
      (s) => Math.abs(s - query.currentSlotIndex!) <= 1,
    );

    if (isIronRich && hasAdjacentDairy) {
      interactionScore = 40; // penalty: iron next to dairy
    } else if (isDairy && hasAdjacentDairy) {
      interactionScore = 60; // mild: double dairy adjacent
    }
  }

  // ── 12. Compliance predictor (5%) — Faza 73 ──────────────────────────
  //    Predict whether patient will actually follow through based on history.
  let complianceScore = 80; // default: slightly favorable
  if (query.patientDropRate) {
    // Penalize complex recipes if patient historically drops them
    if (candidate.totalTimeMinutes != null && candidate.totalTimeMinutes > 45) {
      complianceScore -= query.patientDropRate.highTime * 50; // 0-50 penalty
    }
    if (candidate.ingredientCount > 8) {
      complianceScore -= query.patientDropRate.highIngredient * 30; // 0-30 penalty
    }
    complianceScore = clamp(complianceScore, 0, 100);
  }

  // ── Meal-prep bonus ─────────────────────────────────────────────────────
  //    Small bonus (up to 5pts) if preferMealPrep is set and recipe supports it.
  const mealPrepBonus = query.preferMealPrep && candidate.mealPrepFriendly ? 5 : 0;

  // ── Weighted total ──────────────────────────────────────────────────────
  const totalScore = clamp(
    nutritionFitScore * weights.nutritionFit +
    qualityScore * weights.quality +
    patientRatingScore * weights.patientRating +
    cuisineScore * weights.cuisine +
    seasonScore * weights.season +
    diversityScore * weights.diversity +
    costScore * weights.cost +
    microFitScore * weights.microFit +
    practicalFitScore * weights.practicalFit +
    satietyProxyScore * weights.satietyProxy +
    interactionScore * weights.interaction +
    complianceScore * weights.compliance +
    mealPrepBonus,
    0,
    100,
  );

  return {
    recipeId: candidate.id,
    title: candidate.title,
    category: candidate.category ?? '',
    mealType: candidate.mealType,
    cuisineType: candidate.cuisineType,
    kcal,
    proteinG,
    fatG,
    carbsG,
    fiberG,
    scaleFactor: Math.round(realisticScale * 1000) / 1000,
    scaledKcal: Math.round(scaledKcal * 10) / 10,
    scaledProteinG: Math.round(scaledProteinG * 10) / 10,
    scaledFatG: Math.round(scaledFatG * 10) / 10,
    scaledCarbsG: Math.round(scaledCarbsG * 10) / 10,
    nutritionFitScore: Math.round(nutritionFitScore * 10) / 10,
    qualityScore,
    patientRatingScore: Math.round(patientRatingScore * 10) / 10,
    cuisineScore,
    seasonScore,
    diversityScore,
    costScore,
    microFitScore: Math.round(microFitScore * 10) / 10,
    practicalFitScore: Math.round(practicalFitScore * 10) / 10,
    satietyProxyScore: Math.round(satietyProxyScore * 10) / 10,
    interactionScore: Math.round(interactionScore * 10) / 10,
    complianceScore: Math.round(complianceScore * 10) / 10,
    totalScore: Math.round(totalScore * 10) / 10,
    totalTimeMinutes: candidate.totalTimeMinutes,
    difficulty: candidate.difficulty,
    servings: candidate.servings,
    tags: candidate.tags,
    mealPrepFriendly: candidate.mealPrepFriendly,
    cookingMethod: candidate.cookingMethod ?? null,
    // Faza 77 + E: Pass micronutrient data through for solver, scaled by
    // realisticScale (integer for PER_PIECE) so micros are honest.
    sodiumMg: toNum(snap.sodium_mg) * realisticScale,
    ironMg: toNum(snap.iron_mg) * realisticScale,
    calciumMg: toNum(snap.calcium_mg) * realisticScale,
    vitaminDUg: toNum(snap.vitaminD_ug) * realisticScale,
    folateUg: toNum(snap.folate_ug) * realisticScale,
    vitaminB12Ug: toNum(snap.vitaminB12_ug) * realisticScale,
    zincMg: toNum(snap.zinc_mg) * realisticScale,
    vitaminCMg: toNum(snap.vitaminC_mg) * realisticScale,
    magnesiumMg: toNum(snap.magnesium_mg) * realisticScale,
    potassiumMg: toNum(snap.potassium_mg) * realisticScale,
    vitaminAUg: toNum(snap.vitaminA_ug) * realisticScale,
    vitaminKUg: toNum(snap.vitaminK_ug) * realisticScale,
    omega3G: toNum(snap.omega3_g) * realisticScale,
    seleniumUg: toNum(snap.selenium_ug) * realisticScale,
    iodineUg: toNum(snap.iodine_ug) * realisticScale,
    phosphorusMg: toNum(snap.phosphorus_mg) * realisticScale,
    // Faza D: composition flags pass-through for the 3-tuple solver
    dishCompleteness: candidate.dishCompleteness,
    containsVegetableServing: candidate.containsVegetableServing,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Find and score recipe candidates for a specific meal slot.
 *
 * Workflow:
 *  1. Query DB with multi-layer filters (allergens, diet flags, kcal range, etc.)
 *  2. Score each candidate on nutrition fit, quality, ratings, diversity, season, cost
 *  3. Sort by totalScore descending
 *
 * @param query - candidate query with targets, exclusions, and preferences
 * @returns scored and sorted recipe candidates
 */
export async function findCandidates(
  query: RecipeCandidateQuery,
): Promise<ScoredRecipeCandidate[]> {
  if (query.targetKcal <= 0) {
    throw new AppError(400, 'INVALID_TARGET', 'targetKcal must be > 0');
  }

  // Load scoring weights from AppSettings + optional per-dietitian override (76a)
  const weights = await getScoringWeights(query.dietitianWeightOverrides);

  const raw = await queryRecipeCandidates(query);

  if (raw.length === 0) {
    return [];
  }

  let scored = raw.map((candidate) => scoreCandidate(candidate, query, weights));

  // 82.2: Post-filter by max glycemic index (batch-compute avg GI from ingredients)
  if (query.maxGlycemicIndex != null) {
    const recipeIds = scored.map((c) => c.recipeId);
    const giIngredients = await prisma.recipeIngredient.findMany({
      where: { recipeId: { in: recipeIds }, cleanProductId: { not: null } },
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
    scored = scored.filter((c) => {
      const acc = giAccum.get(c.recipeId);
      if (!acc || acc.sumGrams === 0) return true; // unknown GI → keep
      const avgGi = acc.sumGiGrams / acc.sumGrams;
      return avgGi <= query.maxGlycemicIndex!;
    });
  }

  // FODMAP filter moved into queryRecipeCandidates (DB hard filter, rule 10).

  // Sort by totalScore descending, then by nutritionFitScore as tiebreaker
  scored.sort((a, b) => {
    const diff = b.totalScore - a.totalScore;
    return diff !== 0 ? diff : b.nutritionFitScore - a.nutritionFitScore;
  });

  return scored;
}

/**
 * Compute scaled nutrition and ingredient amounts for a recipe.
 *
 * Loads the recipe with all ingredients (and their CleanProduct nutrients),
 * applies the scale factor, and recomputes nutrition totals from individual
 * ingredient contributions.
 *
 * @param recipeId - the recipe to scale
 * @param scaleFactor - scaling multiplier (clamped to [0.5, 2.0])
 * @returns scaled nutrition totals and per-ingredient grams
 */
export async function computeScaledNutrition(
  recipeId: string,
  scaleFactor: number,
): Promise<ScaledNutrition> {
  const clamped = clamp(scaleFactor, MIN_SCALE_FACTOR, MAX_SCALE_FACTOR);

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      id: true,
      ingredients: {
        select: {
          id: true,
          grams: true,
          displayName: true,
          retentionFactor: true,
          cleanProduct: {
            select: {
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
    },
  });

  if (!recipe) {
    throw new AppError(404, 'RECIPE_NOT_FOUND', `Recipe ${recipeId} not found`);
  }

  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalFiber = 0;

  const ingredients: ScaledNutrition['ingredients'] = [];

  for (const ing of recipe.ingredients) {
    const originalGrams = toNum(ing.grams);
    const scaledGrams = Math.round(originalGrams * clamped * 10) / 10;

    ingredients.push({
      ingredientId: ing.id,
      originalGrams,
      scaledGrams,
      displayName: ing.displayName,
    });

    // Recompute nutrition from clean product nutrients (per 100g)
    const nutrients = ing.cleanProduct?.nutrients;
    if (nutrients) {
      const factor = scaledGrams / 100;
      totalKcal += toNum(nutrients.kcalPer100g) * factor;
      totalProtein += toNum(nutrients.proteinPer100g) * factor;
      totalFat += toNum(nutrients.fatPer100g) * factor;
      totalCarbs += toNum(nutrients.carbsPer100g) * factor;
      totalFiber += toNum(nutrients.fiberPer100g) * factor;
    }
  }

  return {
    scaleFactor: clamped,
    kcal: Math.round(totalKcal * 10) / 10,
    proteinG: Math.round(totalProtein * 10) / 10,
    fatG: Math.round(totalFat * 10) / 10,
    carbsG: Math.round(totalCarbs * 10) / 10,
    fiberG: Math.round(totalFiber * 10) / 10,
    ingredients,
  };
}
