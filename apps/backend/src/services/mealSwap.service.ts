/**
 * Meal Swap Service
 *
 * Generates swap alternatives for patient meal replacements using the OR-Tools
 * solver pipeline. Falls back to recipe candidate scoring, then to legacy Meal
 * table if solver is unavailable.
 *
 * Fallback chain: Solver → Recipe pipeline → Meal DB → Scaled variants
 */

import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { decryptJson, encryptJson } from '../utils/encryption';
import { checkSwapLimit } from './paywall.service';
import { findCandidates, type ScoredRecipeCandidate } from './recipeCandidate.service';
import { buildDbPolicyConstraints, mergeConstraintsIntoInput } from './dbPolicyBridge.service';
import { scaleRecipeForMeal } from './recipeScaler.service';
import { findRecipeSwapAlternatives } from './recipeSwap.service';
import { mealNameToMealType } from './recipeSwap.service';
import {
  computeMealDistribution,
  loadPatientMealDistribution,
} from './mealDistribution.service';
import type { PlanContent, PlanMeal, PlanItem } from './planValidation.service';
import type { SlotDecision } from './dbPlanAssembly.service';

// ─── types ────────────────────────────────────────────────────────────────────

interface SwapRequest {
  dietPlanId: string;
  dayIndex: number;
  mealIndex: number;
  userId: string;
  patientId: string;
}

interface AlternativeMeal extends PlanMeal {
  /** Short explanation why this is a good swap */
  reason: string;
  /** How well it matches macros (0-100) */
  fitScore?: number;
  /** Overall quality score (0-100) */
  totalScore?: number;
  /** Source of the alternative */
  source?: 'SOLVER' | 'CANDIDATE' | 'MEAL_DB';
}

// ─── constants ────────────────────────────────────────────────────────────────

const SOLVER_URL = process.env.SOLVER_URL ?? 'http://localhost:5050';
const SOLVER_TIMEOUT_MS = 10000;
const CANDIDATES_PER_SLOT = 25;
const NUM_ALTERNATIVES = 3;

/** Map meal name (PL) → MealType enum for legacy Meal DB lookup */
const MEAL_NAME_TO_TYPE: Record<string, string> = {
  'Śniadanie': 'BREAKFAST',
  'Drugie śniadanie': 'SNACK',
  'Obiad': 'LUNCH',
  'Podwieczorek': 'SNACK',
  'Przekąska': 'SNACK',
  'Kolacja': 'DINNER',
  'Kolacja / Podwieczorek': 'SUPPER',
};

const PROTEIN_SOURCE_MAP: Record<string, RegExp[]> = {
  poultry: [/kurczak/i, /indyk/i, /drob/i, /pierś/i, /udko/i],
  fish:    [/łosoś/i, /dorsz/i, /tuńczyk/i, /pstrąg/i, /makrela/i, /ryb/i],
  beef:    [/wołowin/i, /cielęc/i],
  pork:    [/wieprzow/i, /szynk/i, /schab/i],
  eggs:    [/jaj/i],
  dairy:   [/twaróg/i, /jogurt/i, /kefir/i, /ser\b/i, /skyr/i],
  legumes: [/soczewic/i, /ciecierzyc/i, /fasol/i, /groch/i],
  tofu:    [/tofu/i, /tempeh/i],
};

function getProteinSource(candidate: ScoredRecipeCandidate): string | null {
  const text = [candidate.title, ...candidate.tags].join(' ');
  for (const [source, patterns] of Object.entries(PROTEIN_SOURCE_MAP)) {
    if (patterns.some((p) => p.test(text))) return source;
  }
  return null;
}

const CATEGORY_CAPS: Record<string, { pattern: RegExp; max: number }> = {
  oatmeal: { pattern: /owsian|oatmeal/i, max: 2 },
  salad:   { pattern: /sałatk|salad/i, max: 2 },
};

function getCategoryTag(candidate: ScoredRecipeCandidate): string | null {
  const text = [candidate.title, ...candidate.tags, candidate.category].join(' ');
  for (const [catName, cap] of Object.entries(CATEGORY_CAPS)) {
    if (cap.pattern.test(text)) return catName;
  }
  return null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function sumMealMacros(meal: PlanMeal): { kcal: number; protein: number; fat: number; carbs: number } {
  return meal.items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (item.kcal || 0),
      protein: acc.protein + (item.protein || 0),
      fat: acc.fat + (item.fat || 0),
      carbs: acc.carbs + (item.carbs || 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

// ─── main: generate swap alternatives ─────────────────────────────────────────

/**
 * Generate 3 alternative meals for a given meal in a diet plan.
 *
 * Pipeline: OR-Tools solver → recipe candidate scoring → legacy Meal DB → scaled variants.
 *
 * Steps:
 * 1. Validate plan ownership & swap limits
 * 2. Extract the original meal from the plan content
 * 3. Use solver to find optimal replacement + 2 runner-ups from candidate scoring
 * 4. Return MealSwap record with 3 alternatives
 */
export async function requestSwap(input: SwapRequest) {
  const { dietPlanId, dayIndex, mealIndex, userId, patientId } = input;

  // 1. Check swap limit
  const limitCheck = await checkSwapLimit(userId);
  if (!limitCheck.allowed) {
    throw new AppError(403, 'SWAP_LIMIT_REACHED', limitCheck.reason ?? 'Swap limit reached');
  }

  // 2. Load and decrypt plan
  const plan = await prisma.dietPlan.findUnique({
    where: { id: dietPlanId },
    select: { id: true, patientId: true, content: true, status: true, policyMetadata: true },
  });

  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
  }

  if (plan.patientId !== patientId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  // Only allow swaps on active plans (PUBLISHED or SENT)
  if (!['PUBLISHED', 'SENT', 'REVIEWED', 'GENERATED'].includes(plan.status)) {
    throw new AppError(422, 'INVALID_STATUS', 'Can only swap meals on active plans');
  }

  const content = decryptJson(plan.content as string) as PlanContent;

  if (!content.days || dayIndex < 0 || dayIndex >= content.days.length) {
    throw new AppError(400, 'INVALID_DAY', `Invalid day index: ${dayIndex}`);
  }

  const day = content.days[dayIndex];
  if (!day.meals || mealIndex < 0 || mealIndex >= day.meals.length) {
    throw new AppError(400, 'INVALID_MEAL', `Invalid meal index: ${mealIndex}`);
  }

  const originalMeal = day.meals[mealIndex];

  // 3. Find alternatives via solver pipeline (with fallback chain)
  const meta = (plan.policyMetadata as Record<string, unknown>) ?? {};
  const slotDecisions = (meta.slotDecisions ?? []) as SlotDecision[];

  const alternatives = await solverSwapAlternatives(
    originalMeal,
    mealIndex,
    dayIndex,
    patientId,
    slotDecisions,
  );

  // 4. Save MealSwap record
  const swap = await prisma.mealSwap.create({
    data: {
      dietPlanId,
      dayIndex,
      mealIndex,
      originalMeal: originalMeal as unknown as Prisma.InputJsonValue,
      alternatives: alternatives as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    id: swap.id,
    dietPlanId: swap.dietPlanId,
    dayIndex: swap.dayIndex,
    mealIndex: swap.mealIndex,
    originalMeal,
    alternatives,
    remaining: limitCheck.remaining,
  };
}

// ─── solver-based swap alternatives ──────────────────────────────────────────

/**
 * Use OR-Tools solver to find optimal replacement for a meal slot.
 * Returns: solver pick as #1, top 2 candidates as #2 and #3.
 * Falls back to recipe pipeline, then to legacy Meal DB.
 */
async function solverSwapAlternatives(
  originalMeal: PlanMeal,
  slotIndex: number,
  dayIndex: number,
  patientId: string,
  slotDecisions: SlotDecision[],
): Promise<AlternativeMeal[]> {
  try {
    // 1. Load patient meal distribution → target macros for this slot
    const distInput = await loadPatientMealDistribution(patientId);
    const distribution = computeMealDistribution(distInput);

    if (slotIndex >= distribution.slots.length) {
      // Slot index out of range for distribution — fall back to recipe pipeline
      return await recipePipelineFallback(originalMeal, patientId, slotDecisions);
    }

    const targetSlot = distribution.slots[slotIndex];
    const currentMonth = new Date().getMonth() + 1;

    // 2. Load policy constraints for GI/FODMAP-aware swap (#7)
    const dbConstraints = await buildDbPolicyConstraints(patientId);
    const policyInput = mergeConstraintsIntoInput({ patientId }, dbConstraints);
    const hasDiabetes = policyInput.conditionFlags?.includes('diabetes') ?? false;
    const hasIbs = policyInput.conditionFlags?.includes('ibs') ?? false;

    // 2b. Find candidates with condition-aware filters
    const candidates = await findCandidates({
      mealType: targetSlot.mealType,
      targetKcal: targetSlot.targetKcal,
      targetProteinG: targetSlot.targetProteinG,
      targetFatG: targetSlot.targetFatG,
      targetCarbsG: targetSlot.targetCarbsG,
      excludeAllergens: policyInput.excludeAllergens,
      season: currentMonth,
      limit: CANDIDATES_PER_SLOT,
      maxGlycemicIndex: hasDiabetes ? 55 : undefined,
      excludeHighFodmap: hasIbs,
    });

    // 3. Filter out recipes already used in the plan (diversity)
    const usedRecipeIds = new Set<string>();
    for (const sd of slotDecisions) {
      if (sd.chosen) usedRecipeIds.add(sd.chosen.recipeId);
    }

    // Also extract current slot's recipe to exclude
    const currentDecision = slotDecisions.find(
      (sd) => sd.dayIndex === dayIndex && sd.slotIndex === slotIndex,
    );
    const excludeRecipeId = currentDecision?.chosen?.recipeId;

    const filtered = candidates.filter((c) => {
      if (excludeRecipeId && c.recipeId === excludeRecipeId) return false;
      if (usedRecipeIds.has(c.recipeId)) return false;
      return true;
    });

    if (filtered.length === 0) {
      return await recipePipelineFallback(originalMeal, patientId, slotDecisions);
    }

    // 4. Batch load supporting data for solver payload
    const allRecipeIds = filtered.map((c) => c.recipeId);

    const ingredients = await prisma.recipeIngredient.findMany({
      where: { recipeId: { in: allRecipeIds }, cleanProductId: { not: null } },
      select: { recipeId: true, cleanProductId: true, grams: true },
      orderBy: [{ recipeId: 'asc' }, { grams: 'desc' }],
    });

    const mainIngredientMap = new Map<string, string | null>();
    const ingredientIdsMap = new Map<string, string[]>();
    for (const ing of ingredients) {
      if (!mainIngredientMap.has(ing.recipeId)) {
        mainIngredientMap.set(ing.recipeId, ing.cleanProductId);
      }
      const ids = ingredientIdsMap.get(ing.recipeId) ?? [];
      if (ids.length < 5 && ing.cleanProductId && !ids.includes(ing.cleanProductId)) {
        ids.push(ing.cleanProductId);
        ingredientIdsMap.set(ing.recipeId, ids);
      }
    }

    const preferenceMap = new Map<string, number>();
    const ratings = await prisma.recipeRating.findMany({
      where: { recipeId: { in: allRecipeIds }, patientId },
      select: { recipeId: true, rating: true },
      orderBy: { updatedAt: 'desc' },
    });
    for (const r of ratings) {
      if (!preferenceMap.has(r.recipeId)) {
        const pref = r.rating === 1 ? 0 : r.rating === 2 ? 20 : r.rating === 3 ? 50 : r.rating === 4 ? 80 : 100;
        preferenceMap.set(r.recipeId, pref);
      }
    }

    // 5. Build solver payload — single day, single slot
    const candidatePayloads = filtered.map((recipe) => {
      const shortId = recipe.recipeId.slice(-8);
      return {
        id: `d0_s${slotIndex}_r${shortId}`,
        day_index: 0,
        slot_index: slotIndex,
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
        protein_source: getProteinSource(recipe),
        category_tag: getCategoryTag(recipe),
        meal_type: targetSlot.mealType,
        sodium_mg: Math.round(recipe.sodiumMg * 10) / 10,
        iron_mg: Math.round(recipe.ironMg * 100) / 100,
        calcium_mg: Math.round(recipe.calciumMg * 10) / 10,
        vitamin_d_ug: Math.round(recipe.vitaminDUg * 100) / 100,
        folate_ug: Math.round(recipe.folateUg * 10) / 10,
        vitamin_b12_ug: Math.round(recipe.vitaminB12Ug * 100) / 100,
        zinc_mg: Math.round(recipe.zincMg * 100) / 100,
        vitamin_c_mg: Math.round(recipe.vitaminCMg * 10) / 10,
        fat_g_total: recipe.scaledFatG,
        prep_time_minutes: recipe.totalTimeMinutes ?? 30,
        meal_prep_friendly: recipe.mealPrepFriendly,
        main_ingredient_id: mainIngredientMap.get(recipe.recipeId) ?? null,
        patient_preference: preferenceMap.get(recipe.recipeId) ?? 50,
        ingredient_ids: ingredientIdsMap.get(recipe.recipeId) ?? [],
        allergen_penalty: 0,
      };
    });

    const solverPayload = {
      candidates: candidatePayloads,
      slots: [{
        slot_index: slotIndex,
        meal_type: targetSlot.mealType,
        target_kcal: targetSlot.targetKcal,
        target_protein_g: targetSlot.targetProteinG,
        target_fat_g: targetSlot.targetFatG,
        target_carbs_g: targetSlot.targetCarbsG,
      }],
      num_days: 1,
      daily_target_kcal: targetSlot.targetKcal,
      daily_target_protein_g: targetSlot.targetProteinG,
      daily_target_fat_g: targetSlot.targetFatG,
      daily_target_carbs_g: targetSlot.targetCarbsG,
      kcal_tolerance: 1.0,
      time_limit_sec: 3,
    };

    // 6. Call solver
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

    let solverRecipeId: string | null = null;

    try {
      const res = await fetch(`${SOLVER_URL}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solverPayload),
        signal: controller.signal,
      });

      if (res.ok) {
        const solverResponse = await res.json() as {
          status: string;
          selections: Array<{ day_index: number; slot_index: number; recipe_id: string }>;
        };

        if (solverResponse.status === 'OPTIMAL' || solverResponse.status === 'FEASIBLE') {
          const selection = solverResponse.selections.find(
            (s) => s.day_index === 0 && s.slot_index === slotIndex,
          );
          if (selection) {
            solverRecipeId = selection.recipe_id;
          }
        }
      }
    } catch (err) {
      console.warn(`[MealSwap] Solver unavailable, using candidate ranking:`, (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    // 7. Build 3 alternatives: solver pick (#1) + top 2 runner-ups (#2, #3)
    const sortedByScore = [...filtered].sort((a, b) => b.totalScore - a.totalScore);

    const solverPick = solverRecipeId
      ? filtered.find((c) => c.recipeId === solverRecipeId)
      : null;

    const pickedIds = new Set<string>();
    const orderedCandidates: Array<{ candidate: ScoredRecipeCandidate; source: 'SOLVER' | 'CANDIDATE' }> = [];

    // Add solver pick first (if found)
    if (solverPick) {
      orderedCandidates.push({ candidate: solverPick, source: 'SOLVER' });
      pickedIds.add(solverPick.recipeId);
    }

    // Fill remaining from top-scored candidates
    for (const c of sortedByScore) {
      if (orderedCandidates.length >= NUM_ALTERNATIVES) break;
      if (pickedIds.has(c.recipeId)) continue;
      orderedCandidates.push({ candidate: c, source: 'CANDIDATE' });
      pickedIds.add(c.recipeId);
    }

    if (orderedCandidates.length === 0) {
      return await recipePipelineFallback(originalMeal, patientId, slotDecisions);
    }

    // 8. Scale recipes and build PlanMeal for each alternative
    const alternatives: AlternativeMeal[] = [];

    for (const { candidate, source } of orderedCandidates) {
      try {
        const scaled = await scaleRecipeForMeal(candidate.recipeId, {
          targetKcal: targetSlot.targetKcal,
          targetProteinG: targetSlot.targetProteinG,
          targetFatG: targetSlot.targetFatG,
          targetCarbsG: targetSlot.targetCarbsG,
        });

        const fullRecipe = await prisma.recipe.findUnique({
          where: { id: candidate.recipeId },
          select: {
            title: true,
            prepTimeMinutes: true,
            tips: true,
            instructionSteps: {
              select: { instruction: true },
              orderBy: { stepNumber: 'asc' },
            },
          },
        });

        const items: PlanItem[] = scaled.ingredients.map((ing) => ({
          name: ing.displayName ?? '',
          grams: Math.round(ing.grams),
          kcal: 0, protein: 0, fat: 0, carbs: 0,
          ingredients: [{ name: ing.displayName ?? '', grams: Math.round(ing.grams) }],
        }));

        if (items.length > 0) {
          items[0].kcal = Math.round(scaled.scaledNutrition.kcal);
          items[0].protein = Math.round(scaled.scaledNutrition.proteinG * 10) / 10;
          items[0].fat = Math.round(scaled.scaledNutrition.fatG * 10) / 10;
          items[0].carbs = Math.round(scaled.scaledNutrition.carbsG * 10) / 10;
        }

        const meal: AlternativeMeal = {
          name: fullRecipe?.title ?? candidate.title,
          items,
          reason: `${Math.round(scaled.scaledNutrition.kcal)} kcal`,
          fitScore: candidate.nutritionFitScore,
          totalScore: candidate.totalScore,
          source,
        };

        if (fullRecipe?.instructionSteps && fullRecipe.instructionSteps.length > 0) {
          meal.recipe = {
            prepTimeMin: fullRecipe.prepTimeMinutes ?? 0,
            steps: fullRecipe.instructionSteps.map((s) => s.instruction),
            tips: fullRecipe.tips ?? undefined,
          };
        }

        alternatives.push(meal);
      } catch {
        // Skip recipes that fail to scale
        continue;
      }
    }

    if (alternatives.length === 0) {
      return await recipePipelineFallback(originalMeal, patientId, slotDecisions);
    }

    return alternatives;
  } catch (err) {
    // If the entire solver pipeline fails (e.g., no NutritionTargets), fall back
    console.warn(`[MealSwap] Solver pipeline failed, falling back:`, (err as Error).message);
    return await recipePipelineFallback(originalMeal, patientId, slotDecisions);
  }
}

// ─── fallback: recipe pipeline (without solver) ──────────────────────────────

async function recipePipelineFallback(
  originalMeal: PlanMeal,
  patientId: string,
  slotDecisions: SlotDecision[],
): Promise<AlternativeMeal[]> {
  try {
    const excludeRecipeIds = slotDecisions
      .filter((sd) => sd.chosen)
      .map((sd) => sd.chosen!.recipeId);

    const recipeAlts = await findRecipeSwapAlternatives({
      originalMeal,
      mealName: originalMeal.name,
      patientId,
      excludeRecipeIds,
      count: NUM_ALTERNATIVES,
    });

    if (recipeAlts.length > 0) {
      return recipeAlts.map((alt) => ({
        ...alt.meal,
        reason: `${Math.round(alt.meal.items.reduce((s, i) => s + (i.kcal || 0), 0))} kcal`,
        fitScore: alt.fitScore,
        totalScore: alt.totalScore,
        source: 'CANDIDATE' as const,
      }));
    }
  } catch (err) {
    console.warn(`[MealSwap] Recipe pipeline fallback failed:`, (err as Error).message);
  }

  // Final fallback: legacy Meal DB
  return await legacyMealDbFallback(originalMeal, patientId);
}

// ─── fallback: legacy Meal DB ────────────────────────────────────────────────

async function legacyMealDbFallback(
  originalMeal: PlanMeal,
  patientId: string,
): Promise<AlternativeMeal[]> {
  const macros = sumMealMacros(originalMeal);
  const mealType = MEAL_NAME_TO_TYPE[originalMeal.name] ?? null;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true },
  });

  const interview = patient
    ? await prisma.interview.findFirst({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        select: { medicalFlags: true },
      })
    : null;

  const excludeAllergens = extractAllergenFlags(interview?.medicalFlags);
  const tolerance = 0.25;
  const minKcal = Math.round(macros.kcal * (1 - tolerance));
  const maxKcal = Math.round(macros.kcal * (1 + tolerance));

  const where: Prisma.MealWhereInput = {
    isActive: true,
    kcal: { gte: minKcal, lte: maxKcal },
    name: { not: originalMeal.name },
    ...(mealType ? { mealType: mealType as Prisma.EnumMealTypeFilter['equals'] } : {}),
    ...buildAllergenExclusion(excludeAllergens),
  };

  const candidates = await prisma.meal.findMany({
    where,
    take: 20,
    include: {
      recipe: {
        include: {
          instructionSteps: { orderBy: { stepNumber: 'asc' } },
        },
      },
    },
  });

  const ranked = candidates
    .map((meal) => {
      const kcalDiff = Math.abs(meal.kcal - macros.kcal);
      const proteinDiff = Math.abs(Number(meal.proteinG) - macros.protein);
      const fatDiff = Math.abs(Number(meal.fatG) - macros.fat);
      const carbsDiff = Math.abs(Number(meal.carbsG) - macros.carbs);
      const score = kcalDiff + proteinDiff * 2 + fatDiff + carbsDiff;
      return { meal, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, NUM_ALTERNATIVES);

  if (ranked.length === 0) {
    return generateScaledAlternatives(originalMeal);
  }

  return ranked.map(({ meal }) => {
    const planMeal = dbMealToPlanMeal(meal);
    return {
      ...planMeal,
      reason: `${meal.kcal} kcal`,
      source: 'MEAL_DB' as const,
    };
  });
}

// ─── allergen helpers ─────────────────────────────────────────────────────────

function extractAllergenFlags(medicalFlags: unknown): string[] {
  if (!medicalFlags || typeof medicalFlags !== 'object') return [];

  const flags = medicalFlags as Record<string, unknown>;
  const allergens: string[] = [];

  if (flags['gluten_free'] || flags['celiac']) allergens.push('hasGluten');
  if (flags['lactose_free'] || flags['lactoseIntolerant']) allergens.push('hasLactose');
  if (flags['nut_free'] || flags['nutAllergy']) allergens.push('hasNuts');
  if (flags['soy_free'] || flags['soyAllergy']) allergens.push('hasSoy');
  if (flags['egg_free'] || flags['eggAllergy']) allergens.push('hasEggs');
  if (flags['fish_free'] || flags['fishAllergy']) allergens.push('hasFish');

  return allergens;
}

function buildAllergenExclusion(allergenFlags: string[]): Prisma.MealWhereInput {
  const exclusion: Prisma.MealWhereInput = {};
  for (const flag of allergenFlags) {
    (exclusion as Record<string, boolean>)[flag] = false;
  }
  return exclusion;
}

// ─── legacy helpers ──────────────────────────────────────────────────────────

function dbMealToPlanMeal(meal: {
  name: string;
  kcal: number;
  proteinG: Prisma.Decimal;
  fatG: Prisma.Decimal;
  carbsG: Prisma.Decimal;
  recipe?: {
    prepTimeMinutes: number | null;
    totalTimeMinutes: number | null;
    instructionSteps: { stepNumber: number; instruction: string }[];
    tips: string | null;
  } | null;
}): PlanMeal {
  const planMeal: PlanMeal = {
    name: meal.name,
    items: [
      {
        name: meal.name,
        grams: 0,
        kcal: meal.kcal,
        protein: Number(meal.proteinG),
        fat: Number(meal.fatG),
        carbs: Number(meal.carbsG),
      },
    ],
  };

  if (meal.recipe) {
    planMeal.recipe = {
      prepTimeMin: meal.recipe.totalTimeMinutes ?? meal.recipe.prepTimeMinutes ?? 15,
      steps: meal.recipe.instructionSteps
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map((s) => s.instruction),
      tips: meal.recipe.tips ?? undefined,
    };
  }

  return planMeal;
}

function generateScaledAlternatives(originalMeal: PlanMeal): AlternativeMeal[] {
  const scales = [0.85, 1.0, 1.15];
  const labels = ['Lżejsza wersja (-15%)', 'Oryginalna porcja', 'Większa porcja (+15%)'];

  return scales.map((scale, i) => ({
    name: originalMeal.name,
    items: originalMeal.items.map((item) => ({
      ...item,
      grams: Math.round(item.grams * scale),
      kcal: Math.round(item.kcal * scale),
      protein: Math.round(item.protein * scale * 10) / 10,
      fat: Math.round(item.fat * scale * 10) / 10,
      carbs: Math.round(item.carbs * scale * 10) / 10,
    })),
    recipe: originalMeal.recipe,
    reason: labels[i],
    source: 'MEAL_DB' as const,
  }));
}

// ─── confirm swap ─────────────────────────────────────────────────────────────

/**
 * Confirm a meal swap: apply the chosen alternative to the plan content.
 */
export async function confirmSwap(swapId: string, chosenIndex: number, userId: string) {
  const swap = await prisma.mealSwap.findUnique({
    where: { id: swapId },
    include: {
      dietPlan: {
        select: { id: true, patientId: true, content: true, status: true },
      },
    },
  });

  if (!swap) {
    throw new AppError(404, 'NOT_FOUND', 'Swap not found');
  }

  if (swap.confirmed) {
    throw new AppError(422, 'ALREADY_CONFIRMED', 'Swap already confirmed');
  }

  // Verify patient ownership
  const patient = await prisma.patient.findUnique({
    where: { id: swap.dietPlan.patientId },
    select: { userId: true },
  });

  if (!patient || patient.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  const alternatives = swap.alternatives as unknown as AlternativeMeal[];

  if (chosenIndex < 0 || chosenIndex >= alternatives.length) {
    throw new AppError(400, 'INVALID_CHOICE', `Invalid choice index: ${chosenIndex}`);
  }

  const chosenMeal = alternatives[chosenIndex];

  // Update plan content with the new meal
  const content = decryptJson(swap.dietPlan.content as string) as PlanContent;
  content.days[swap.dayIndex].meals[swap.mealIndex] = {
    name: chosenMeal.name,
    items: chosenMeal.items,
    recipe: chosenMeal.recipe,
  };

  // Encrypt updated content and save
  const encrypted = encryptJson(content);

  await prisma.$transaction([
    prisma.mealSwap.update({
      where: { id: swapId },
      data: {
        chosenIndex,
        newMeal: chosenMeal as unknown as Prisma.InputJsonValue,
        confirmed: true,
      },
    }),
    prisma.dietPlan.update({
      where: { id: swap.dietPlan.id },
      data: { content: encrypted },
    }),
  ]);

  return {
    id: swapId,
    confirmed: true,
    chosenIndex,
    newMeal: chosenMeal,
  };
}

// ─── list swaps for a plan ────────────────────────────────────────────────────

export async function listSwaps(dietPlanId: string) {
  return prisma.mealSwap.findMany({
    where: { dietPlanId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      dayIndex: true,
      mealIndex: true,
      originalMeal: true,
      alternatives: true,
      chosenIndex: true,
      newMeal: true,
      confirmed: true,
      createdAt: true,
    },
  });
}
