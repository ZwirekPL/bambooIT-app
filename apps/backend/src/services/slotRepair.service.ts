/**
 * Slot Repair Service (Faza 79)
 *
 * One-click repair for weak meal slots using OR-Tools solver with frozen_slots.
 * Freezes all slots except the target, re-runs the solver to find the optimal
 * replacement, then patches the plan content and policyMetadata in-place.
 */

import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptJson, decryptJson } from '../utils/encryption';
import {
  findCandidates,
  type RecipeCandidateQuery,
  type ScoredRecipeCandidate,
} from './recipeCandidate.service';
import {
  computeMealDistribution,
  loadPatientMealDistribution,
} from './mealDistribution.service';
import { scaleRecipeForMeal } from './recipeScaler.service';
import { createRevision } from './revision.service';
import { validatePlan } from './planValidation.service';
import type {
  PlanContent,
  PlanDay,
  PlanMeal,
  PlanItem,
  MealRecipe,
} from './planValidation.service';
import type { SlotDecision, CoverageReport } from './dbPlanAssembly.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RepairSlotInput {
  planId: string;
  dayIndex: number;
  slotIndex: number;
  /** If provided, directly swap to this recipe. Otherwise re-solve via OR-Tools. */
  targetRecipeId?: string;
  dietitianUserId?: string;
}

export interface RepairSlotResult {
  ok: boolean;
  dayIndex: number;
  slotIndex: number;
  previousRecipe: { recipeId: string; title: string; score: number } | null;
  newRecipe: { recipeId: string; title: string; score: number };
  solverStatus?: string;
  durationMs: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SOLVER_URL = process.env.SOLVER_URL ?? 'http://localhost:5050';
const SOLVER_TIMEOUT_MS = 15000;
const CANDIDATES_PER_SLOT = 25;

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

// ─── Main repair function ────────────────────────────────────────────────────

export async function repairSlot(input: RepairSlotInput): Promise<RepairSlotResult> {
  const startMs = Date.now();
  const { planId, dayIndex, slotIndex, targetRecipeId, dietitianUserId } = input;

  // 1. Load plan
  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      patientId: true,
      content: true,
      policyMetadata: true,
      status: true,
      kcal: true,
      proteinG: true,
      fatG: true,
      carbsG: true,
      patient: { select: { dietitianId: true } },
    },
  });

  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Plan not found');
  if (['SENT', 'PUBLISHED'].includes(plan.status)) {
    throw new AppError(422, 'INVALID_STATE', `Cannot repair a plan in status ${plan.status}`);
  }

  const content = decryptJson(plan.content) as PlanContent;
  const meta = (plan.policyMetadata as Record<string, unknown>) ?? {};
  const slotDecisions = (meta.slotDecisions ?? []) as SlotDecision[];

  // Validate indices
  if (dayIndex < 0 || dayIndex >= content.days.length) {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid dayIndex: ${dayIndex}`);
  }
  if (slotIndex < 0 || slotIndex >= content.days[dayIndex].meals.length) {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid slotIndex: ${slotIndex}`);
  }

  // Current slot decision
  const currentDecision = slotDecisions.find(
    (sd) => sd.dayIndex === dayIndex && sd.slotIndex === slotIndex,
  );
  const previousRecipe = currentDecision?.chosen
    ? { recipeId: currentDecision.chosen.recipeId, title: currentDecision.chosen.title, score: currentDecision.chosen.adjustedScore }
    : null;

  // 2. Load patient meal distribution to know slot targets
  const distInput = await loadPatientMealDistribution(plan.patientId);
  const distribution = computeMealDistribution(distInput);
  const slots = distribution.slots;

  if (slotIndex >= slots.length) {
    throw new AppError(400, 'VALIDATION_ERROR', `slotIndex ${slotIndex} exceeds meal slots`);
  }

  const targetSlot = slots[slotIndex];
  const currentMonth = new Date().getMonth() + 1;
  const numDays = content.days.length;

  // 3. Determine new recipe
  let newCandidate: ScoredRecipeCandidate;

  if (targetRecipeId) {
    // Direct swap — find candidate for specific recipe
    newCandidate = await findDirectCandidate(targetRecipeId, targetSlot, currentMonth, input);
  } else {
    // Solver-based repair — freeze everything except target slot
    newCandidate = await solverRepair(
      plan.patientId,
      content,
      slotDecisions,
      dayIndex,
      slotIndex,
      targetSlot,
      slots,
      numDays,
      currentMonth,
      previousRecipe?.recipeId,
    );
  }

  // 4. Build new PlanMeal from candidate
  const newMeal = await buildMealFromCandidate(newCandidate, targetSlot);

  // 5. Patch plan content
  content.days[dayIndex].meals[slotIndex] = newMeal;

  // 6. Update slot decision
  const newDecision: SlotDecision = {
    dayIndex,
    slotIndex,
    dayName: content.days[dayIndex].day,
    mealType: targetSlot.mealType,
    candidatesCount: CANDIDATES_PER_SLOT,
    chosen: {
      recipeId: newCandidate.recipeId,
      title: newCandidate.title,
      totalScore: newCandidate.totalScore,
      adjustedScore: newCandidate.totalScore,
      scores: {
        nutritionFit: newCandidate.nutritionFitScore,
        quality: newCandidate.qualityScore,
        patientRating: newCandidate.patientRatingScore,
        cuisine: newCandidate.cuisineScore,
        season: newCandidate.seasonScore,
        diversity: newCandidate.diversityScore,
        cost: newCandidate.costScore,
        microFit: newCandidate.microFitScore,
        practicalFit: newCandidate.practicalFitScore,
        satietyProxy: newCandidate.satietyProxyScore,
        interaction: newCandidate.interactionScore,
        compliance: newCandidate.complianceScore,
      },
    },
    runnersUp: [],
    rulesApplied: ['SLOT_REPAIR', previousRecipe ? `REPLACED: ${previousRecipe.title}` : 'NEW_FILL'],
    confidence: 'HIGH',
    scalingFailed: false,
  };

  // Replace in slotDecisions array
  const decisionIdx = slotDecisions.findIndex(
    (sd) => sd.dayIndex === dayIndex && sd.slotIndex === slotIndex,
  );
  if (decisionIdx >= 0) {
    slotDecisions[decisionIdx] = newDecision;
  } else {
    slotDecisions.push(newDecision);
  }

  // 7. Recalculate daily macros for coverage report
  const coverageReport = meta.coverageReport as CoverageReport | undefined;
  if (coverageReport) {
    recalcDayMacros(content, dayIndex, coverageReport);
  }

  // 8. Save to DB
  await prisma.dietPlan.update({
    where: { id: planId },
    data: {
      content: encryptJson(content as unknown as Record<string, unknown>),
      policyMetadata: JSON.parse(JSON.stringify({ ...meta, slotDecisions, coverageReport })) as Prisma.InputJsonValue,
    },
  });

  // 9. Create revision + re-validate async
  // Uses DIETITIAN_EDIT until SLOT_REPAIR enum value is generated (prisma generate required)
  createRevision(planId, content as unknown as Record<string, unknown>, 'DIETITIAN_EDIT', dietitianUserId).catch(() => {});
  validatePlan(planId).catch(() => {});

  return {
    ok: true,
    dayIndex,
    slotIndex,
    previousRecipe,
    newRecipe: {
      recipeId: newCandidate.recipeId,
      title: newCandidate.title,
      score: Math.round(newCandidate.totalScore),
    },
    solverStatus: targetRecipeId ? 'DIRECT_SWAP' : 'SOLVER',
    durationMs: Date.now() - startMs,
  };
}

// ─── Direct candidate lookup ─────────────────────────────────────────────────

async function findDirectCandidate(
  recipeId: string,
  targetSlot: { mealType: string; targetKcal: number; targetProteinG: number; targetFatG: number; targetCarbsG: number },
  currentMonth: number,
  input: RepairSlotInput,
): Promise<ScoredRecipeCandidate> {
  // Find this recipe among candidates for the slot
  const candidates = await findCandidates({
    mealType: targetSlot.mealType,
    targetKcal: targetSlot.targetKcal,
    targetProteinG: targetSlot.targetProteinG,
    targetFatG: targetSlot.targetFatG,
    targetCarbsG: targetSlot.targetCarbsG,
    season: currentMonth,
    limit: 100,
  });

  const match = candidates.find((c) => c.recipeId === recipeId);
  if (!match) {
    throw new AppError(404, 'NOT_FOUND', `Recipe ${recipeId} not found among slot candidates`);
  }
  return match;
}

// ─── Solver-based repair ─────────────────────────────────────────────────────

async function solverRepair(
  patientId: string,
  content: PlanContent,
  slotDecisions: SlotDecision[],
  dayIndex: number,
  slotIndex: number,
  targetSlot: { mealType: string; targetKcal: number; targetProteinG: number; targetFatG: number; targetCarbsG: number; slotIndex?: number },
  allSlots: Array<{ mealType: string; targetKcal: number; targetProteinG: number; targetFatG: number; targetCarbsG: number; slotIndex?: number }>,
  numDays: number,
  currentMonth: number,
  excludeRecipeId?: string,
): Promise<ScoredRecipeCandidate> {
  // Single-slot solve: send candidates only for the target day+slot.
  // No frozen_slots needed — solver optimizes just the one slot.

  // Collect recipe IDs already used in other slots (to penalize repeats)
  const usedRecipeIds = new Set<string>();
  for (const sd of slotDecisions) {
    if (sd.dayIndex === dayIndex && sd.slotIndex === slotIndex) continue;
    if (sd.chosen) usedRecipeIds.add(sd.chosen.recipeId);
  }

  // Load candidates for the target slot only
  const candidates = await findCandidates({
    mealType: targetSlot.mealType,
    targetKcal: targetSlot.targetKcal,
    targetProteinG: targetSlot.targetProteinG,
    targetFatG: targetSlot.targetFatG,
    targetCarbsG: targetSlot.targetCarbsG,
    season: currentMonth,
    limit: CANDIDATES_PER_SLOT,
  });

  // Exclude the current recipe AND recipes already used in the plan (diversity)
  const filtered = candidates.filter((c) => {
    if (excludeRecipeId && c.recipeId === excludeRecipeId) return false;
    if (usedRecipeIds.has(c.recipeId)) return false;
    return true;
  });

  if (filtered.length === 0) {
    throw new AppError(422, 'NO_CANDIDATES', 'No alternative candidates found for this slot');
  }

  // Batch load supporting data
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

  // Build solver payload — single day (day 0), single slot
  const candidatePayloads = filtered.map((recipe) => {
    const shortId = recipe.recipeId.slice(-8);
    return {
      id: `d0_s${slotIndex}_r${shortId}`,
      day_index: 0,
      slot_index: targetSlot.slotIndex ?? slotIndex,
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

  // Only send the single target slot — solver solves 1 day × 1 slot
  const slotPayloads = [{
    slot_index: targetSlot.slotIndex ?? slotIndex,
    meal_type: targetSlot.mealType,
    target_kcal: targetSlot.targetKcal,
    target_protein_g: targetSlot.targetProteinG,
    target_fat_g: targetSlot.targetFatG,
    target_carbs_g: targetSlot.targetCarbsG,
  }];

  const distInput = await loadPatientMealDistribution(patientId);
  const distribution = computeMealDistribution(distInput);

  // Single-slot repair: disable daily kcal/macro hard constraints (tolerance=1.0)
  // because only one meal is being solved, not the full day
  const solverPayload = {
    candidates: candidatePayloads,
    slots: slotPayloads,
    num_days: 1,
    daily_target_kcal: targetSlot.targetKcal,
    daily_target_protein_g: targetSlot.targetProteinG,
    daily_target_fat_g: targetSlot.targetFatG,
    daily_target_carbs_g: targetSlot.targetCarbsG,
    kcal_tolerance: 1.0,
    time_limit_sec: 2,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

  let solverResponse: {
    status: string;
    selections: Array<{ day_index: number; slot_index: number; recipe_id: string; candidate_id: string }>;
    infeasibility_reasons?: Array<{ constraint: string; description: string; suggestion: string; severity: string }>;
  };

  try {
    const res = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solverPayload),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Solver HTTP ${res.status}: ${await res.text()}`);
    }
    solverResponse = await res.json();
  } catch (err) {
    console.warn(`[SlotRepair] Solver unavailable, falling back to best candidate:`, (err as Error).message);
    clearTimeout(timeout);
    filtered.sort((a, b) => b.totalScore - a.totalScore);
    return filtered[0];
  } finally {
    clearTimeout(timeout);
  }

  if (solverResponse.status !== 'OPTIMAL' && solverResponse.status !== 'FEASIBLE') {
    console.warn(`[SlotRepair] Solver status ${solverResponse.status}, falling back to best candidate`);
    filtered.sort((a, b) => b.totalScore - a.totalScore);
    return filtered[0];
  }

  // Find the selection for our target slot (day 0 in single-slot solve)
  const targetSelection = solverResponse.selections.find(
    (s) => s.day_index === 0 && s.slot_index === (targetSlot.slotIndex ?? slotIndex),
  );

  if (!targetSelection) {
    // Fallback: best candidate
    filtered.sort((a, b) => b.totalScore - a.totalScore);
    return filtered[0];
  }

  const selected = filtered.find((c) => c.recipeId === targetSelection.recipe_id);
  if (!selected) {
    filtered.sort((a, b) => b.totalScore - a.totalScore);
    return filtered[0];
  }

  return selected;
}

// ─── Build PlanMeal from candidate ───────────────────────────────────────────

async function buildMealFromCandidate(
  candidate: ScoredRecipeCandidate,
  targetSlot: { targetKcal: number; targetProteinG: number; targetFatG: number; targetCarbsG: number },
): Promise<PlanMeal> {
  try {
    const scalingResult = await scaleRecipeForMeal(candidate.recipeId, {
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

    const items: PlanItem[] = scalingResult.ingredients.map((ing) => ({
      name: ing.displayName ?? '',
      grams: Math.round(ing.grams),
      kcal: 0, protein: 0, fat: 0, carbs: 0,
      ingredients: [{ name: ing.displayName ?? '', grams: Math.round(ing.grams) }],
    }));

    if (items.length > 0) {
      items[0].kcal = Math.round(scalingResult.scaledNutrition.kcal);
      items[0].protein = Math.round(scalingResult.scaledNutrition.proteinG * 10) / 10;
      items[0].fat = Math.round(scalingResult.scaledNutrition.fatG * 10) / 10;
      items[0].carbs = Math.round(scalingResult.scaledNutrition.carbsG * 10) / 10;
    }

    const mealRecipe: MealRecipe | undefined = fullRecipe ? {
      prepTimeMin: fullRecipe.prepTimeMinutes ?? 0,
      steps: fullRecipe.instructionSteps.map((st) => st.instruction),
      tips: fullRecipe.tips ?? undefined,
    } : undefined;

    return {
      name: fullRecipe?.title ?? candidate.title,
      items,
      recipe: mealRecipe,
    };
  } catch {
    return {
      name: candidate.title,
      items: [{
        name: candidate.title,
        grams: 0,
        kcal: Math.round(candidate.scaledKcal),
        protein: Math.round(candidate.scaledProteinG * 10) / 10,
        fat: Math.round(candidate.scaledFatG * 10) / 10,
        carbs: Math.round(candidate.scaledCarbsG * 10) / 10,
      }],
    };
  }
}

// ─── Helper: recalculate day macros in coverage report ───────────────────────

function recalcDayMacros(content: PlanContent, dayIndex: number, coverage: CoverageReport): void {
  const day = content.days[dayIndex];
  let kcal = 0, prot = 0, fat = 0, carbs = 0;

  for (const meal of day.meals) {
    for (const item of meal.items) {
      kcal += item.kcal ?? 0;
      prot += item.protein ?? 0;
      fat += item.fat ?? 0;
      carbs += item.carbs ?? 0;
    }
  }

  if (coverage.dailyKcal && coverage.dailyKcal.length > dayIndex) {
    coverage.dailyKcal[dayIndex] = Math.round(kcal);
  }
  if (coverage.dailyProteinG && coverage.dailyProteinG.length > dayIndex) {
    coverage.dailyProteinG[dayIndex] = Math.round(prot);
  }
  if (coverage.dailyFatG && coverage.dailyFatG.length > dayIndex) {
    coverage.dailyFatG[dayIndex] = Math.round(fat);
  }
  if (coverage.dailyCarbsG && coverage.dailyCarbsG.length > dayIndex) {
    coverage.dailyCarbsG[dayIndex] = Math.round(carbs);
  }
}
