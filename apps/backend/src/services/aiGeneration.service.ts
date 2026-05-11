/**
 * 33.6 — AI diet plan generation service.
 * Replaces n8n.service.ts: enqueues BullMQ jobs instead of fire-and-forget HTTP to n8n.
 */
import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptJson, decryptJson } from '../utils/encryption';
import { validatePlan, autoAdjustContent, buildCategorizedShoppingList, type PlanContent, type PlanDay, type PlanMeal, type MealRecipe } from './planValidation.service';
import { createRevision } from './revision.service';
import { logAudit } from './audit.service';
import { segmentUser } from './segmentation.service';
import { markEventProcessed } from '../utils/idempotency';
import { saveAsTemplate } from './dietTemplateCache.service';
import { saveRecipesFromPlan } from './recipeExtraction.service';
import { buildPatientContext } from '../policies';
import { standardizePlanContent } from './productNameStandardization.service';
import { isOpenAiConfigured } from './openai.service';
import { dietGenerateQueue, dietRepairQueue, dietPartialQueue } from '../queues';
import { computeNutritionFromIngredients, isV2Plan, type NutrientsPer100g } from './nutritionCalculator.service';
import { smartScaleContent } from './gramScaling.service';
import { getPromptVersion } from './promptBuilder.service';

// Re-export for backward compatibility
export { isOpenAiConfigured };

// ─── config ──────────────────────────────────────────────────────────────────

/** @deprecated Use isOpenAiConfigured() instead */
export function isN8nConfigured(): boolean {
  return isOpenAiConfigured();
}

// ─── complexity level (17.1.3) ───────────────────────────────────────────────

export type ComplexityLevel = 'SIMPLE' | 'COMPLEX';

export function determineComplexity(
  chronicDiseases: string[],
  redFlagCount: number,
  policyRuleCount: number,
): ComplexityLevel {
  if (chronicDiseases.length > 0 || redFlagCount > 0 || policyRuleCount > 3) {
    return 'COMPLEX';
  }
  return 'SIMPLE';
}

// ─── trigger payload types ──────────────────────────────────────────────────

export interface TriggerN8nOptions {
  dietPlanId: string;
  complexityLevel: ComplexityLevel;
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  segment: {
    goal: string;
    kcalBucket: number;
    mealCount: number;
    dietType: string;
    allergies: string[];
  };
  anonymizedProfile: {
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    ageYears: number | null;
    goal: string | null;
  };
  policyContext: {
    excludeKeywords: string[];
    clinicalNotes: string[];
    nutrientLimits: Array<{ nutrient: string; scope: string; min?: number; max?: number }>;
    appliedRuleNames: string[];
  };
  preferences: {
    mealsPerDay: number;
    dietType: string;
    preferredFoods?: string[];
    dislikedFoods?: string[];
    activityLevel?: string;
    mainGoal?: string;
    cuisinePreferences?: string[];
    cookingTime?: string;
    budget?: string;
    additionalNotes?: string;
    supplements?: string[];
    activityTypes?: string[];
    stressLevel?: string;
    sleepHours?: string;
    alcoholFrequency?: string;
    workType?: string;
    intolerances?: string[];
    mealRhythm?: { firstMealTime?: string; lastMealTime?: string; eatsAtNight?: boolean };
  };
  constraints?: {
    maxCookingTimeMinutes?: number;
    preferredCuisines?: string[];
    mealSchedule?: Array<{ mealType: string; time: string; label: string }>;
  };
  requestedVariants?: ('THERMOMIX' | 'AIRFRYER')[];
  canonicalProductNames?: string[];
  canonicalProductsGrouped?: Record<string, string[]>;
  highlyRatedRecipeNames?: string[];
  /** Health-driven product recommendations with reasons (from productSelection service) */
  healthProducts?: Array<{ name: string; reason: string; category: string }>;
  /** Products the patient disliked (from ratings + textarea) */
  dislikedProducts?: string[];
  /** Dish names from previous plan to avoid repeating */
  previousDishNames?: string[];
}

// ─── enqueue diet generation (replaces triggerN8nWorkflow) ───────────────────

export async function enqueueDietGeneration(opts: TriggerN8nOptions): Promise<boolean> {
  if (!isOpenAiConfigured()) {
    throw new AppError(503, 'OPENAI_NOT_CONFIGURED', 'OpenAI API is not configured');
  }

  // Idempotency: prevent duplicate triggers for the same plan
  const isNew = await markEventProcessed('ai-generate', opts.dietPlanId, 3600);
  if (!isNew) {
    console.warn(`[ai] Duplicate trigger attempt for plan ${opts.dietPlanId}. Skipping.`);
    return false;
  }

  // Verify plan is still in AI_DRAFT before triggering
  const planCheck = await prisma.dietPlan.findUnique({
    where: { id: opts.dietPlanId },
    select: { status: true },
  });
  if (!planCheck || planCheck.status !== 'AI_DRAFT') {
    console.warn(`[ai] Plan ${opts.dietPlanId} is ${planCheck?.status ?? 'missing'}, not AI_DRAFT. Skipping.`);
    return false;
  }

  // Mark plan as pending AI processing
  await prisma.dietPlan.update({
    where: { id: opts.dietPlanId },
    data: {
      aiProvider: 'openai',
      aiModel: 'pending',
    },
  });

  // Enqueue BullMQ job
  await dietGenerateQueue.add('generate', {
    dietPlanId: opts.dietPlanId,
    complexityLevel: opts.complexityLevel,
    nutritionTargets: opts.nutritionTargets,
    segment: opts.segment,
    anonymizedProfile: opts.anonymizedProfile,
    policyContext: opts.policyContext,
    preferences: opts.preferences,
    constraints: opts.constraints,
    requestedVariants: opts.requestedVariants,
    canonicalProductNames: opts.canonicalProductNames,
    canonicalProductsGrouped: opts.canonicalProductsGrouped,
    highlyRatedRecipeNames: opts.highlyRatedRecipeNames,
  });

  // Audit log
  logAudit({
    action: 'AI_GENERATION_ENQUEUED',
    resourceType: 'DIET_PLAN',
    resourceId: opts.dietPlanId,
    metadata: {
      complexityLevel: opts.complexityLevel,
      segment: opts.segment,
      nutritionTargets: opts.nutritionTargets,
      appliedRules: opts.policyContext.appliedRuleNames,
      excludeKeywords: opts.policyContext.excludeKeywords,
      clinicalNotesCount: opts.policyContext.clinicalNotes.length,
      nutrientLimitsCount: opts.policyContext.nutrientLimits.length,
      mealsPerDay: opts.preferences.mealsPerDay,
      dietType: opts.preferences.dietType,
      requestedVariants: opts.requestedVariants ?? [],
      canonicalProductNamesCount: opts.canonicalProductNames?.length ?? 0,
    },
  });

  return true;
}

/** @deprecated Use enqueueDietGeneration() */
export const triggerN8nWorkflow = enqueueDietGeneration;

// ─── AI output validation (28.4) ─────────────────────────────────────────────

export interface AiViolation {
  day: string;
  mealName: string;
  violatingItem: string;
  keyword: string;
  restrictionLevel: 'HARD_BLOCK' | 'STRONG';
  category?: string;
  reason?: string;
}

export interface RepairAttempt {
  attemptNumber: number;
  triggeredAt: string;
  violations: AiViolation[];
  repairTriggered: boolean;
  maxAttemptsExceeded?: boolean;
}

export function validateAiOutput(
  content: PlanContent,
  foodRestrictions: Array<{ keywords: string[]; level: string; reason?: string; category?: string }>,
  excludeKeywords: string[],
): AiViolation[] {
  const restricted: Array<{ kw: string; level: 'HARD_BLOCK' | 'STRONG'; reason?: string; category?: string }> = [
    ...foodRestrictions
      .filter((r) => r.level === 'HARD_BLOCK' || r.level === 'STRONG')
      .flatMap((r) =>
        r.keywords.map((kw) => ({
          kw: kw.toLowerCase(),
          level: r.level as 'HARD_BLOCK' | 'STRONG',
          reason: r.reason,
          category: r.category,
        })),
      ),
    ...excludeKeywords.map((kw) => ({
      kw: kw.toLowerCase(),
      level: 'HARD_BLOCK' as const,
      reason: 'Policy exclusion',
    })),
  ];

  if (restricted.length === 0) return [];

  // Build regex patterns for word-boundary matching to avoid false positives
  // e.g. keyword "rak" should NOT match "krakersy"
  const kwPatterns = restricted.map((r) => ({
    ...r,
    regex: new RegExp(`(^|[\\s,;.()\\-/])${r.kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s,;.()\\-/])`, 'i'),
  }));

  const violations: AiViolation[] = [];

  for (const day of content.days) {
    for (const meal of day.meals) {
      const namesToCheck: string[] = [meal.name.toLowerCase()];
      for (const item of meal.items) {
        namesToCheck.push(item.name.toLowerCase());
        const ingredients = (item as unknown as Record<string, unknown>).ingredients;
        if (Array.isArray(ingredients)) {
          for (const ing of ingredients as Array<{ name?: string }>) {
            if (ing.name) namesToCheck.push(ing.name.toLowerCase());
          }
        }
      }

      for (const { kw, level, reason, category, regex } of kwPatterns) {
        // Check each name: first try word-boundary regex, fallback to exact match for single-word names
        const hit = namesToCheck.find((n) => regex.test(n) || n === kw);
        if (hit) {
          violations.push({ day: day.day, mealName: meal.name, violatingItem: hit, keyword: kw, restrictionLevel: level, category, reason });
          break;
        }
      }
    }
  }

  return violations;
}

// ─── cooking time validation (31.3.5) ────────────────────────────────────────

export interface CookingTimeViolation {
  day: string;
  mealName: string;
  prepTimeMin: number;
  maxAllowed: number;
}

export function validateCookingTime(
  content: PlanContent,
  maxCookingTimeMinutes: number | undefined,
): CookingTimeViolation[] {
  if (!maxCookingTimeMinutes) return [];

  const violations: CookingTimeViolation[] = [];

  for (const day of content.days) {
    for (const meal of day.meals) {
      const recipe = (meal as unknown as Record<string, unknown>).recipe as
        | { prepTimeMin?: number }
        | undefined;
      if (recipe?.prepTimeMin && recipe.prepTimeMin > maxCookingTimeMinutes) {
        violations.push({
          day: day.day,
          mealName: meal.name,
          prepTimeMin: recipe.prepTimeMin,
          maxAllowed: maxCookingTimeMinutes,
        });
      }
    }
  }

  if (violations.length > 0) {
    console.warn(
      `[ai] Cooking time violations: ${violations.length} meals exceed ${maxCookingTimeMinutes}min limit`,
      violations.map((v) => `${v.day}/${v.mealName}: ${v.prepTimeMin}min`),
    );
  }

  return violations;
}

// ─── enqueue repair (replaces triggerN8nRepairWorkflow) ──────────────────────

export async function enqueueDietRepair(opts: {
  dietPlanId: string;
  content: PlanContent;
  violations: AiViolation[];
  attemptNumber: number;
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
}): Promise<boolean> {
  if (!isOpenAiConfigured()) return false;

  // Build per-day, per-meal violation index
  const violationsByDay = new Map<string, Set<string>>();
  for (const v of opts.violations) {
    if (!violationsByDay.has(v.day)) violationsByDay.set(v.day, new Set());
    if (v.mealName) violationsByDay.get(v.day)!.add(v.mealName);
  }

  const preservedDayNames: string[] = [];
  const preservedMeals: Record<string, string[]> = {};
  const strippedDays: PlanContent['days'] = [];

  for (const day of opts.content.days) {
    const violatingMealNames = violationsByDay.get(day.day);
    if (!violatingMealNames || violatingMealNames.size === 0) {
      preservedDayNames.push(day.day);
      continue;
    }

    const preserved: string[] = [];
    const mealsToRepair: PlanMeal[] = [];
    for (const meal of day.meals) {
      if (violatingMealNames.has(meal.name)) {
        mealsToRepair.push(meal);
      } else {
        preserved.push(meal.name);
      }
    }

    if (mealsToRepair.length === 0) {
      strippedDays.push(day);
    } else {
      preservedMeals[day.day] = preserved;
      strippedDays.push({ ...day, meals: mealsToRepair });
    }
  }

  const daysToRepair = strippedDays.length > 0 ? strippedDays : opts.content.days;
  const violatingContent: PlanContent = { days: daysToRepair };

  // Collect existing dish names
  const existingDishNames = new Set<string>();
  for (const day of opts.content.days) {
    const violatingMealNames = violationsByDay.get(day.day);
    for (const meal of day.meals) {
      const isPreserved = !violatingMealNames || !violatingMealNames.has(meal.name);
      if (isPreserved) {
        for (const item of meal.items) {
          existingDishNames.add(item.name);
        }
      }
    }
  }

  await dietRepairQueue.add('repair', {
    dietPlanId: opts.dietPlanId,
    attemptNumber: opts.attemptNumber,
    violatingContent,
    preservedMeals,
    preservedDayNames,
    existingDishNames: [...existingDishNames],
    violations: opts.violations,
    mealTargets: computeMealTargets(opts.content, opts.nutritionTargets),
    dayTotals: computeDayTotals(violatingContent),
    nutritionTargets: opts.nutritionTargets,
    tolerance: 0.05,
  });

  logAudit({
    action: 'AI_REPAIR_ENQUEUED',
    resourceType: 'DIET_PLAN',
    resourceId: opts.dietPlanId,
    metadata: { attemptNumber: opts.attemptNumber, violationsCount: opts.violations.length },
  });

  return true;
}

// ─── enqueue partial regeneration (replaces triggerPartialRegeneration) ──────

export interface PartialRegenerateInput {
  days?: string[];
  meals?: Array<{ day: string; meal: string }>;
}

export async function enqueuePartialRegeneration(
  planId: string,
  input: PartialRegenerateInput,
): Promise<{ triggered: boolean; message: string }> {
  if (!isOpenAiConfigured()) {
    return { triggered: false, message: 'OpenAI is not configured' };
  }

  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    include: { patient: { include: { nutritionTargets: true } } },
  });

  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
  }

  const editableStatuses = ['GENERATED', 'MANUAL_REVIEW_REQUIRED', 'REVIEWED'];
  if (!editableStatuses.includes(plan.status)) {
    throw new AppError(400, 'INVALID_STATUS', `Cannot regenerate plan in status ${plan.status}`);
  }

  const content = decryptJson(plan.content) as PlanContent;
  if (!content?.days?.length) {
    throw new AppError(400, 'EMPTY_CONTENT', 'Plan has no content to partially regenerate');
  }

  // Validate that requested days/meals exist
  const planDayNames = content.days.map((d) => d.day);
  if (input.days) {
    for (const day of input.days) {
      if (!planDayNames.includes(day)) {
        throw new AppError(400, 'INVALID_DAY', `Day "${day}" not found in plan`);
      }
    }
  }
  if (input.meals) {
    for (const m of input.meals) {
      const dayData = content.days.find((d) => d.day === m.day);
      if (!dayData) throw new AppError(400, 'INVALID_DAY', `Day "${m.day}" not found in plan`);
      if (!dayData.meals.some((meal) => meal.name === m.meal)) {
        throw new AppError(400, 'INVALID_MEAL', `Meal "${m.meal}" not found in day "${m.day}"`);
      }
    }
  }

  const policyMeta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};
  const excludeKeywords = (policyMeta.excludeKeywords as string[]) ?? [];
  const clinicalNotes = (policyMeta.clinicalNotes as string[]) ?? [];

  const targets = plan.patient?.nutritionTargets;
  const nutritionTargets = {
    kcal: targets?.targetKcal ?? plan.kcal ?? 0,
    proteinG: Number(targets?.targetProteinG ?? plan.proteinG ?? 0),
    fatG: Number(targets?.targetFatG ?? plan.fatG ?? 0),
    carbsG: Number(targets?.targetCarbsG ?? plan.carbsG ?? 0),
  };

  // Set plan to AI_DRAFT while regenerating
  await prisma.dietPlan.update({
    where: { id: planId },
    data: { status: 'AI_DRAFT', aiModel: 'partial-regen-pending' },
  });

  await dietPartialQueue.add('partial', {
    dietPlanId: planId,
    targets: input,
    currentContent: content,
    nutritionTargets,
    excludeKeywords,
    clinicalNotes,
  });

  logAudit({
    action: 'AI_PARTIAL_REGEN_ENQUEUED',
    resourceType: 'DIET_PLAN',
    resourceId: planId,
    metadata: {
      targetDays: input.days ?? [],
      targetMeals: input.meals ?? [],
    },
  });

  return { triggered: true, message: 'Partial regeneration enqueued' };
}

/** @deprecated Use enqueuePartialRegeneration() */
export const triggerPartialRegeneration = enqueuePartialRegeneration;

// ─── fallback recipe generator (32.1.B) ─────────────────────────────────────

const COOKING_VERBS: Array<{ keywords: string[]; verb: string }> = [
  { keywords: ['kasza', 'ryż', 'makaron', 'płatki', 'owsianka', 'quinoa', 'bulgur', 'kuskus'], verb: 'Ugotuj' },
  { keywords: ['kurczak', 'indyk', 'pierś', 'filet', 'schab', 'polędwica'], verb: 'Usmaż na patelni lub upiecz' },
  { keywords: ['łosoś', 'dorsz', 'pstrąg', 'ryba', 'tuńczyk', 'makrela'], verb: 'Upiecz w piekarniku lub usmaż' },
  { keywords: ['jajko', 'jajka', 'jaje'], verb: 'Ugotuj lub usmaż' },
  { keywords: ['chleb', 'pieczywo', 'bułka', 'tortilla', 'wrap'], verb: 'Pokrój i przygotuj' },
  { keywords: ['jogurt', 'twaróg', 'kefir', 'mleko'], verb: 'Przygotuj w miseczce' },
  { keywords: ['sałata', 'sałatka', 'szpinak', 'rukola', 'jarmuż'], verb: 'Umyj i pokrój' },
];

function getCookingVerb(itemName: string): string {
  const lower = itemName.toLowerCase();
  for (const { keywords, verb } of COOKING_VERBS) {
    if (keywords.some((kw) => lower.includes(kw))) return verb;
  }
  return 'Przygotuj';
}

export function generateBasicRecipe(meal: PlanMeal): MealRecipe {
  const steps: string[] = [];
  const ingredientNames = meal.items.map((item) => item.name);

  if (ingredientNames.length === 0) {
    return { prepTimeMin: 10, steps: [`Przygotuj ${meal.name}.`] };
  }

  const grouped = new Map<string, string[]>();
  for (const name of ingredientNames) {
    const verb = getCookingVerb(name);
    const existing = grouped.get(verb) ?? [];
    existing.push(name);
    grouped.set(verb, existing);
  }

  for (const [verb, items] of grouped) {
    if (items.length === 1) {
      steps.push(`${verb} ${items[0]} (${meal.items.find((i) => i.name === items[0])?.grams ?? ''}g).`);
    } else {
      steps.push(`${verb}: ${items.join(', ')}.`);
    }
  }

  if (steps.length > 1) {
    steps.push(`Połącz składniki i podaj jako ${meal.name}.`);
  }

  const prepTimeMin = Math.min(5 + grouped.size * 3, 30);
  return { prepTimeMin, steps };
}

// ─── AI processing report (32.2.1) ──────────────────────────────────────────

export interface AiProcessingIssue {
  type: 'MISSING_RECIPES' | 'UNMATCHED_PRODUCTS' | 'KCAL_DEVIATION' | 'MACRO_DEVIATION' | 'VIOLATIONS' | 'HARD_FLOOR' | 'COOKING_TIME';
  count: number;
  details: string[];
}

export interface AiProcessingReport {
  receivedAt: string;
  aiProvider: string;
  aiModel: string;
  issues: AiProcessingIssue[];
  autoAdjusted: boolean;
  recipesExtracted: number;
  recipesGenerated: number;
  validationStatus: string;
  productStandardization: {
    totalItems: number;
    matched: number;
    unmatched: number;
    unmatchedNames: string[];
  };
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

// ─── process AI result (replaces processN8nCallback) ─────────────────────────

export interface AiResultPayload {
  dietPlanId: string;
  content: PlanContent;
  aiProvider?: string;
  aiModel?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

// Keep old name for backward compat
export type N8nCallbackPayload = AiResultPayload;

export async function processAiResult(payload: AiResultPayload): Promise<{
  dietPlanId: string;
  validationStatus: string;
}> {
  const { dietPlanId, aiProvider, aiModel, tokenUsage } = payload;
  let { content } = payload;

  // Debug: log raw AI response (first day only)
  if (content?.days?.[0]) {
    const d = content.days[0];
    console.log(`[ai] RAW day="${d.day}", meals=${d.meals?.length}`);
    for (const m of (d.meals ?? []).slice(0, 2)) {
      console.log(`[ai] RAW meal="${m.name}", items=${JSON.stringify(m.items?.map((i) => ({ name: i.name, ing: i.ingredients?.map((ig) => `${ig.name}:${ig.grams}g`) })))}, recipe=${!!m.recipe}, steps=${m.recipe?.steps?.length ?? 0}`);
    }
  }

  // 1. Verify plan exists
  const plan = await prisma.dietPlan.findUnique({
    where: { id: dietPlanId },
    include: { patient: { include: { nutritionTargets: true } } },
  });
  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
  }

  const resolvedTargetKcal = plan.patient?.nutritionTargets?.targetKcal ?? plan.kcal ?? null;
  if (!resolvedTargetKcal) {
    console.warn(`[ai] Plan ${dietPlanId}: no nutritionTargets and no plan.kcal — cannot auto-adjust calories`);
  }

  const acceptableStatuses = ['AI_DRAFT', 'MANUAL_REVIEW_REQUIRED'];
  if (!acceptableStatuses.includes(plan.status)) {
    console.warn(`[ai] Duplicate callback for plan ${dietPlanId}, status=${plan.status}. Skipping.`);
    return { dietPlanId, validationStatus: 'ALREADY_PROCESSED' };
  }

  // 1b. Merge partial content (repair or partial regen) into existing plan
  const isRepairCallback = aiModel?.includes('repair');
  const isPartialCallback = aiModel?.includes('partial');
  if ((isRepairCallback || isPartialCallback) && content?.days && plan.content) {
    try {
      const originalContent = decryptJson(plan.content as string) as PlanContent;
      if (originalContent?.days && originalContent.days.length > 0) {
        const newByDay = new Map<string, PlanDay>(
          (content.days as PlanDay[]).map((d) => [d.day, d]),
        );

        const originalDayNames = new Set(originalContent.days.map((d) => d.day));

        // Step 1: Update existing days (repair = per-meal merge, partial = full day replace)
        const mergedDays = originalContent.days.map((origDay) => {
          const newDay = newByDay.get(origDay.day);
          if (!newDay) return origDay; // No changes for this day → keep original

          if (isRepairCallback) {
            // Repair: merge repaired meals into original day, keeping preserved meals
            const repairedMealNames = new Set(newDay.meals.map((m) => m.name));
            const preservedFromOrig = origDay.meals.filter((m) => !repairedMealNames.has(m.name));
            const originalOrder = origDay.meals.map((m) => m.name);
            const allMeals: PlanMeal[] = [...preservedFromOrig, ...newDay.meals];
            allMeals.sort((a, b) => {
              const idxA = originalOrder.indexOf(a.name);
              const idxB = originalOrder.indexOf(b.name);
              return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            });
            return { ...origDay, meals: allMeals };
          }
          // Partial regen: replace entire day
          return newDay;
        });

        // Step 2: Add NEW days that weren't in the original (partial regen for missing days)
        const DAY_ORDER = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
        for (const [dayName, day] of newByDay) {
          if (!originalDayNames.has(dayName)) {
            mergedDays.push(day);
          }
        }
        // Sort days in correct order
        mergedDays.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

        const addedCount = mergedDays.length - originalContent.days.length;
        console.log(
          `[ai] ${isPartialCallback ? 'Partial' : 'Repair'} merge: ` +
          `${newByDay.size} day(s) from AI, ${originalContent.days.length} original → ${mergedDays.length} total` +
          (addedCount > 0 ? ` (+${addedCount} nowych dni)` : ''),
        );
        content = { ...content, days: mergedDays };
      }
    } catch (err) {
      console.warn(`[ai] Błąd scalania treści naprawy/uzupełnienia dla planu ${dietPlanId}:`, err instanceof Error ? err.message : err);
    }
  }

  // Early policyMeta extraction (needed by incomplete plan detection and later steps)
  const policyMeta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};

  // 2. Validate content structure
  if (!content?.days || !Array.isArray(content.days) || content.days.length === 0) {
    throw new AppError(400, 'INVALID_CONTENT', 'Plan content must contain a non-empty days array');
  }

  for (const day of content.days) {
    if (!day.day || !Array.isArray(day.meals)) {
      throw new AppError(400, 'INVALID_CONTENT', 'Each day must have a name and meals array');
    }
    for (const meal of day.meals) {
      if (!meal.name || !Array.isArray(meal.items)) {
        throw new AppError(400, 'INVALID_CONTENT', 'Each meal must have a name and items array');
      }
    }
  }

  // 2a-pre. Detect and fix placeholder meal/dish names ("Posiłek (breakfast)" etc.)
  const PLACEHOLDER_PATTERN = /^Posiłek\s*\(/i;
  const ENGLISH_MEAL_NAMES: Record<string, string> = {
    breakfast: 'Śniadanie',
    lunch: 'II Śniadanie',
    snack: 'Podwieczorek',
    dinner: 'Obiad',
    supper: 'Kolacja',
  };
  let placeholderCount = 0;
  for (const day of content.days) {
    for (const meal of day.meals) {
      // Fix English meal names → Polish
      if (ENGLISH_MEAL_NAMES[meal.name]) {
        meal.name = ENGLISH_MEAL_NAMES[meal.name];
      }
      // Fix placeholder dish names in items
      for (const item of meal.items) {
        if (PLACEHOLDER_PATTERN.test(item.name)) {
          placeholderCount++;
          // Try to build a name from ingredients
          const ingredientNames = (item.ingredients ?? [])
            .map((ing: { name: string }) => ing.name)
            .filter((n: string) => n && !PLACEHOLDER_PATTERN.test(n))
            .slice(0, 3);
          if (ingredientNames.length > 0) {
            item.name = `${meal.name}: ${ingredientNames.join(', ')}`;
          } else {
            item.name = `${meal.name} — posiłek do uzupełnienia`;
          }
        }
      }
    }
  }
  if (placeholderCount > 0) {
    console.warn(`[ai] Plan ${dietPlanId}: naprawiono ${placeholderCount} placeholder nazw posiłków ("Posiłek (...)")`);
  }

  // 2a. Detect incomplete plan (truncated output — fewer than 7 days)
  // Skip if this is already a repair or partial callback (to avoid infinite loops)
  if (content.days.length < 7 && !isRepairCallback && !isPartialCallback) {
    console.warn(`[ai] Plan ${dietPlanId}: only ${content.days.length}/7 days received (likely truncated output). Triggering partial regeneration for missing days.`);

    const DAY_NAMES_PL = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
    const receivedDays = new Set(content.days.map((d) => d.day));
    const missingDays = DAY_NAMES_PL.filter((d) => !receivedDays.has(d));

    // Save partial content so partial regen can build on it
    await prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: {
        content: encryptJson(content as Record<string, unknown>),
        status: 'AI_DRAFT',
        aiProvider: aiProvider ?? 'openai',
        aiModel: `${aiModel ?? 'ai'}-partial`,
        policyMetadata: {
          ...policyMeta,
          incompletePlan: {
            receivedDays: content.days.length,
            missingDays,
            detectedAt: new Date().toISOString(),
          },
        } as unknown as import('@db').Prisma.InputJsonValue,
      },
    });

    // Enqueue partial regeneration for missing days
    await dietPartialQueue.add('partial', {
      dietPlanId,
      targets: { days: missingDays },
      currentContent: content,
      nutritionTargets: {
        kcal: resolvedTargetKcal ?? plan.kcal ?? 0,
        proteinG: Number(plan.patient?.nutritionTargets?.targetProteinG ?? plan.proteinG ?? 0),
        fatG: Number(plan.patient?.nutritionTargets?.targetFatG ?? plan.fatG ?? 0),
        carbsG: Number(plan.patient?.nutritionTargets?.targetCarbsG ?? plan.carbsG ?? 0),
      },
      excludeKeywords: (policyMeta.excludeKeywords as string[]) ?? [],
      clinicalNotes: (policyMeta.clinicalNotes as string[]) ?? [],
    });

    return { dietPlanId, validationStatus: 'INCOMPLETE_PLAN_REGEN_TRIGGERED' };
  }

  // 2b. Normalize ingredients
  for (const day of content.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        if (!item.ingredients || !Array.isArray(item.ingredients) || item.ingredients.length === 0) {
          item.ingredients = [{ name: item.name, grams: Number(item.grams) || 0 }];
        } else {
          item.ingredients = item.ingredients
            .filter((ing: { name?: string }) => ing && typeof ing.name === 'string' && ing.name.trim().length > 0)
            .map((ing: { name: string; grams?: number }) => ({
              name: ing.name.trim(),
              grams: Number(ing.grams) || 0,
            }));
          if (item.ingredients.length === 0) {
            item.ingredients = [{ name: item.name, grams: Number(item.grams) || 0 }];
          }
        }
      }
    }
  }

  // 2c. Generate fallback recipes
  const mealsWithoutRecipe: string[] = [];
  // Log first day structure for debugging
  if (content.days[0]?.meals?.[0]) {
    const sample = content.days[0].meals[0];
    console.log(`[ai] Sample meal structure: name=${sample.name}, hasRecipe=${!!sample.recipe}, recipeKeys=${sample.recipe ? Object.keys(sample.recipe).join(',') : 'none'}, itemCount=${sample.items?.length ?? 0}`);
  }
  for (const day of content.days) {
    for (const meal of day.meals) {
      if (!meal.recipe || !Array.isArray(meal.recipe.steps) || meal.recipe.steps.length === 0) {
        mealsWithoutRecipe.push(`${day.day} → ${meal.name}`);
        meal.recipe = generateBasicRecipe(meal);
      }
    }
  }
  if (mealsWithoutRecipe.length > 0) {
    console.warn(`[ai] Plan ${dietPlanId}: ${mealsWithoutRecipe.length} meal(s) missing recipe — generated fallback`);
  }

  // 2d. Standardize product names
  const { content: standardizedContent, report: stdReport } = await standardizePlanContent(content);
  if (stdReport.unmatched > 0) {
    console.warn(`[ai] Product standardization: ${stdReport.matched}/${stdReport.totalItems} matched, ${stdReport.unmatched} unmatched`);
  }

  // 2d-v2. If V2 plan (no kcal per item), compute nutrition from DB
  let nutritionCalcReport: import('./nutritionCalculator.service').NutritionCalculationReport | null = null;
  let ingredientNutrientMap: Map<string, NutrientsPer100g> | null = null;
  if (isV2Plan(standardizedContent)) {
    console.log(`[ai] Plan ${dietPlanId}: V2 detected — computing nutrition from ingredients DB`);
    const { enrichedContent, report: calcReport, nutrientMap } = await computeNutritionFromIngredients(standardizedContent);
    // Replace standardizedContent with enriched version (now has kcal/B/T/W)
    Object.assign(standardizedContent, enrichedContent);
    nutritionCalcReport = calcReport;
    ingredientNutrientMap = nutrientMap;
    console.log(`[ai] Nutrition calc: ${calcReport.matchedCount}/${calcReport.totalIngredients} matched, ${calcReport.fallbackCount} fallback, ${calcReport.unmatchedCount} unknown`);
  }

  // 2e. Validate AI output against restrictions
  const protocolSnapshot = policyMeta.protocolSnapshot as {
    foodRestrictions?: Array<{ keywords: string[]; level: string; reason?: string; category?: string }>;
    avoidFoodCategories?: Array<{ category: string; reason?: string }>;
  } | null;
  const excludeKeywords = (policyMeta.excludeKeywords as string[]) ?? [];

  const mergedExcludeKeywords = [...excludeKeywords];
  if (protocolSnapshot?.avoidFoodCategories) {
    for (const cat of protocolSnapshot.avoidFoodCategories) {
      if (cat.category && !mergedExcludeKeywords.includes(cat.category.toLowerCase())) {
        mergedExcludeKeywords.push(cat.category.toLowerCase());
      }
    }
  }

  const violations = validateAiOutput(standardizedContent, protocolSnapshot?.foodRestrictions ?? [], mergedExcludeKeywords);

  const cookingTimeLimit = (policyMeta.constraints as { maxCookingTimeMinutes?: number } | undefined)?.maxCookingTimeMinutes;
  const cookingTimeViolations = validateCookingTime(standardizedContent, cookingTimeLimit);

  if (violations.length > 0) {
    const repairAttempts = (policyMeta.repairAttempts as RepairAttempt[]) ?? [];
    const attemptNumber = repairAttempts.length + 1;

    const attempt: RepairAttempt = {
      attemptNumber,
      triggeredAt: new Date().toISOString(),
      violations,
      repairTriggered: false,
    };

    console.warn(`[ai] Plan ${dietPlanId}: ${violations.length} violation(s) in attempt ${attemptNumber}`);

    if (attemptNumber <= 2 && isOpenAiConfigured()) {
      const triggered = await enqueueDietRepair({
        dietPlanId,
        content: standardizedContent,
        violations,
        attemptNumber,
        nutritionTargets: {
          kcal: resolvedTargetKcal ?? plan.kcal ?? 0,
          proteinG: Number(plan.patient?.nutritionTargets?.targetProteinG ?? plan.proteinG ?? 0),
          fatG: Number(plan.patient?.nutritionTargets?.targetFatG ?? plan.fatG ?? 0),
          carbsG: Number(plan.patient?.nutritionTargets?.targetCarbsG ?? plan.carbsG ?? 0),
        },
      });

      attempt.repairTriggered = triggered;

      await prisma.dietPlan.update({
        where: { id: dietPlanId },
        data: {
          policyMetadata: {
            ...policyMeta,
            repairAttempts: [...repairAttempts, attempt],
          } as unknown as import('@db').Prisma.InputJsonValue,
        },
      });

      if (triggered) {
        return { dietPlanId, validationStatus: 'REPAIR_TRIGGERED' };
      }
    }

    attempt.maxAttemptsExceeded = true;

    await prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: {
        content: encryptJson(standardizedContent as Record<string, unknown>),
        status: 'MANUAL_REVIEW_REQUIRED',
        aiProvider: aiProvider ?? 'openai',
        aiModel: aiModel ?? 'ai',
        policyMetadata: {
          ...policyMeta,
          repairAttempts: [...repairAttempts, attempt],
        } as unknown as import('@db').Prisma.InputJsonValue,
      },
    });

    await createRevision(dietPlanId, standardizedContent as Record<string, unknown>, 'AI_GENERATED');

    saveRecipesFromPlan(standardizedContent, dietPlanId)
      .catch((err) => console.error('[ai] Recipe extraction failed:', err instanceof Error ? err.message : err));

    return { dietPlanId, validationStatus: 'VIOLATIONS_UNRESOLVED' };
  }

  // 3. Calculate actual average daily macros from items
  let actualKcal = 0, actualP = 0, actualF = 0, actualC = 0;
  const days = (standardizedContent as { days?: Array<{ meals: Array<{ items: Array<{ kcal?: number; protein?: number; fat?: number; carbs?: number }> }> }> }).days ?? [];
  for (const day of days) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        actualKcal += item.kcal ?? 0;
        actualP += item.protein ?? 0;
        actualF += item.fat ?? 0;
        actualC += item.carbs ?? 0;
      }
    }
  }
  const numDays = days.length || 1;
  const avgP = Math.round(actualP / numDays);
  const avgF = Math.round(actualF / numDays);
  const avgC = Math.round(actualC / numDays);
  // Calculate kcal from macros (P*4 + F*9 + C*4) — more accurate than AI's kcal values
  const calcKcal = Math.round(avgP * 4 + avgF * 9 + avgC * 4);
  const avgMacros = {
    kcal: calcKcal,
    proteinG: avgP,
    fatG: avgF,
    carbsG: avgC,
  };

  // Save encrypted content + actual macros (not targets)
  const newStatus = plan.status === 'MANUAL_REVIEW_REQUIRED' ? 'MANUAL_REVIEW_REQUIRED' : 'GENERATED';
  await prisma.dietPlan.update({
    where: { id: dietPlanId },
    data: {
      content: encryptJson(standardizedContent as Record<string, unknown>),
      status: newStatus,
      kcal: avgMacros.kcal,
      proteinG: avgMacros.proteinG,
      fatG: avgMacros.fatG,
      carbsG: avgMacros.carbsG,
      aiProvider: aiProvider ?? 'openai',
      aiModel: aiModel ?? 'ai',
    },
  });

  // 4. Record revision
  await createRevision(dietPlanId, standardizedContent as Record<string, unknown>, 'AI_GENERATED');

  // 5. Validate
  const validationResult = await validatePlan(dietPlanId);

  // 6. Auto-adjust if needed
  let finalContent = standardizedContent;
  let finalValidationResult = validationResult;
  let finalValidationStatus = validationResult.status;

  // Auto-adjust whenever there are calorie/macro issues (NEEDS_ADJUST or NEEDS_REPAIR_AI with kcal deviation)
  const hasKcalIssue = validationResult.issues.some((i) => i.type === 'KCAL');
  const shouldAutoAdjust = validationResult.status === 'NEEDS_ADJUST' ||
    (validationResult.status === 'NEEDS_REPAIR_AI' && hasKcalIssue);

  if (shouldAutoAdjust) {
    const adjustTarget = resolvedTargetKcal ?? plan.kcal ?? 0;
    if (adjustTarget <= 0) {
      console.warn(`[ai] Plan ${dietPlanId}: skipping auto-adjust — no valid target kcal`);
    }

    let adjusted: PlanContent;
    if (adjustTarget > 0 && ingredientNutrientMap && ingredientNutrientMap.size > 0) {
      // Smart tier-aware scaling (preferred for V2 plans)
      const { scaledContent, report: scaleReport } = smartScaleContent(
        standardizedContent,
        ingredientNutrientMap,
        { targetKcal: adjustTarget },
      );
      adjusted = scaledContent;
      console.log(`[ai] Plan ${dietPlanId}: smart-scaled ${scaleReport.daysScaled}/${scaleReport.daysScaled + scaleReport.daysSkipped} days`);
      for (const d of scaleReport.details) {
        if (d.originalKcal !== d.finalKcal) {
          console.log(`  ${d.day}: ${d.originalKcal} → ${d.finalKcal} kcal (${d.scaledIngredients} ingredients, ${d.iterations} iter)`);
        }
      }
    } else if (adjustTarget > 0) {
      // Fallback: uniform scaling (V1 plans or no nutrient map)
      adjusted = autoAdjustContent(standardizedContent, adjustTarget);
    } else {
      adjusted = standardizedContent;
    }

    await prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: { content: encryptJson(adjusted as Record<string, unknown>) },
    });
    await createRevision(dietPlanId, adjusted as Record<string, unknown>, 'AUTO_ADJUST');
    const revalidation = await validatePlan(dietPlanId);
    finalContent = adjusted;
    finalValidationResult = revalidation;
    finalValidationStatus = revalidation.status;
    if (validationResult.status === 'NEEDS_REPAIR_AI' && hasKcalIssue) {
      console.warn(`[ai] Plan ${dietPlanId}: auto-adjusted despite NEEDS_REPAIR_AI (kcal deviation). New status: ${finalValidationStatus}`);
    }
  }

  // 6a-post. Round grams for portioned products (after autoAdjust so values are final)
  try {
    const planContent = finalContent as PlanContent;
    const allIngNames = new Set<string>();
    for (const day of planContent.days) {
      for (const meal of day.meals) {
        for (const item of meal.items) {
          allIngNames.add(item.name);
          for (const ing of item.ingredients ?? []) {
            allIngNames.add(ing.name);
          }
        }
      }
    }

    const portionProducts = await prisma.cleanProduct.findMany({
      where: { name: { in: [...allIngNames] } },
      select: {
        name: true,
        portions: {
          where: { portionName: { in: ['Sztuka', 'Kromka'] } },
          select: { portionName: true, weightG: true },
        },
      },
    });

    const portionMap = new Map<string, number>();
    for (const p of portionProducts) {
      if (p.portions.length === 0) continue;
      // Prefer Kromka over Sztuka for bread products (Kromka is the practical unit)
      const kromka = p.portions.find((por) => por.portionName === 'Kromka');
      const best = kromka ?? p.portions[0];
      portionMap.set(p.name, Number(best.weightG));
    }

    if (portionMap.size > 0) {
      let corrected = 0;
      for (const day of planContent.days) {
        for (const meal of day.meals) {
          for (const item of meal.items) {
            const itemUnit = portionMap.get(item.name);
            if (itemUnit && itemUnit > 0 && item.grams % itemUnit !== 0) {
              item.grams = Math.max(itemUnit, Math.round(item.grams / itemUnit) * itemUnit);
              corrected++;
            }
            for (const ing of item.ingredients ?? []) {
              const ingUnit = portionMap.get(ing.name);
              if (ingUnit && ingUnit > 0 && ing.grams % ingUnit !== 0) {
                ing.grams = Math.max(ingUnit, Math.round(ing.grams / ingUnit) * ingUnit);
              }
            }
          }
        }
      }
      if (corrected > 0) {
        console.log(`[ai] Plan ${dietPlanId}: rounded ${corrected} portioned items to whole units`);
        // Save corrected content
        await prisma.dietPlan.update({
          where: { id: dietPlanId },
          data: { content: encryptJson(planContent as unknown as Record<string, unknown>) },
        });
      }
    }
  } catch (err) {
    console.warn(`[ai] Plan ${dietPlanId}: portion rounding failed:`, err instanceof Error ? err.message : err);
  }

  // 6b. Rebuild shopping list
  try {
    const categories = buildCategorizedShoppingList(finalContent);
    const shoppingList: Record<string, string[]> = {};
    for (const cat of categories) {
      shoppingList[cat.category] = cat.items.map((item) => {
        const parts = [item.name, `${item.totalGrams}g`];
        if (item.pieces) parts.push(`(${item.pieces})`);
        return parts.join(' — ');
      });
    }
    (finalContent as Record<string, unknown>).shoppingList = shoppingList;

    await prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: { content: encryptJson(finalContent as Record<string, unknown>) },
    });
  } catch (err) {
    console.warn('[ai] Shopping list rebuild failed:', err instanceof Error ? err.message : err);
  }

  // 7. Save as template
  if (finalValidationStatus === 'VALID') {
    const segment = await segmentUser(plan.patientId).catch(() => null);
    if (segment) {
      const patientCtx = await buildPatientContext(plan.patientId).catch(() => null);
      saveAsTemplate({
        dietPlanId,
        content: finalContent,
        segment,
        diseases: patientCtx?.chronicDiseases ?? [],
        kcal: resolvedTargetKcal ?? plan.kcal ?? 0,
        proteinG: plan.proteinG ?? 0,
        fatG: plan.fatG ?? 0,
        carbsG: plan.carbsG ?? 0,
        aiModel: aiModel ?? 'openai',
      }).catch((err) => console.error('[ai] Template save failed:', err instanceof Error ? err.message : err));
    }
  }

  // 8. Extract recipes
  saveRecipesFromPlan(finalContent, dietPlanId)
    .catch((err) => console.error('[ai] Recipe extraction failed:', err instanceof Error ? err.message : err));

  // 9. Build AI processing report
  const reportIssues: AiProcessingIssue[] = [];

  if (mealsWithoutRecipe.length > 0) {
    reportIssues.push({ type: 'MISSING_RECIPES', count: mealsWithoutRecipe.length, details: mealsWithoutRecipe });
  }
  if (stdReport.unmatched > 0) {
    reportIssues.push({ type: 'UNMATCHED_PRODUCTS', count: stdReport.unmatched, details: stdReport.unmatchedNames.slice(0, 20) });
  }
  if (cookingTimeViolations.length > 0) {
    reportIssues.push({
      type: 'COOKING_TIME',
      count: cookingTimeViolations.length,
      details: cookingTimeViolations.map((v) => `${v.day}/${v.mealName}: ${v.prepTimeMin}min (max ${v.maxAllowed})`),
    });
  }

  for (const issue of finalValidationResult.issues) {
    if (issue.type === 'KCAL' && issue.actual != null && issue.expected != null) {
      const deviation = Math.round(((issue.actual - issue.expected) / issue.expected) * 100);
      const isHardFloor = issue.message.includes('hard floor');
      reportIssues.push({
        type: isHardFloor ? 'HARD_FLOOR' : 'KCAL_DEVIATION',
        count: 1,
        details: [`${issue.actual} vs ${issue.expected} kcal (${deviation > 0 ? '+' : ''}${deviation}%)`],
      });
    } else if (['PROTEIN', 'FAT', 'CARBS'].includes(issue.type) && issue.actual != null && issue.expected != null) {
      const deviation = Math.round(((issue.actual - issue.expected) / issue.expected) * 100);
      reportIssues.push({
        type: 'MACRO_DEVIATION',
        count: 1,
        details: [`${issue.type}: ${issue.actual}g vs ${issue.expected}g (${deviation > 0 ? '+' : ''}${deviation}%)`],
      });
    }
  }

  let aiRecipeCount = 0;
  for (const day of content.days) {
    for (const meal of day.meals) {
      if (meal.recipe?.steps?.length) aiRecipeCount++;
    }
  }

  const aiProcessingReport: AiProcessingReport = {
    receivedAt: new Date().toISOString(),
    aiProvider: aiProvider ?? 'openai',
    aiModel: aiModel ?? 'ai',
    issues: reportIssues,
    autoAdjusted: shouldAutoAdjust,
    recipesExtracted: aiRecipeCount,
    recipesGenerated: mealsWithoutRecipe.length,
    validationStatus: finalValidationStatus,
    productStandardization: {
      totalItems: stdReport.totalItems,
      matched: stdReport.matched,
      unmatched: stdReport.unmatched,
      unmatchedNames: stdReport.unmatchedNames.slice(0, 20),
    },
    tokenUsage,
    ...(nutritionCalcReport ? {
      nutritionCalculation: {
        totalIngredients: nutritionCalcReport.totalIngredients,
        matched: nutritionCalcReport.matchedCount,
        fallback: nutritionCalcReport.fallbackCount,
        unmatched: nutritionCalcReport.unmatchedCount,
        unmatchedNames: nutritionCalcReport.unmatchedNames.slice(0, 20),
        promptVersion: 'v2',
      },
    } : {}),
  };

  await prisma.dietPlan.update({
    where: { id: dietPlanId },
    data: {
      policyMetadata: {
        ...policyMeta,
        aiProcessingReport,
      } as unknown as import('@db').Prisma.InputJsonValue,
    },
  });

  return { dietPlanId, validationStatus: finalValidationStatus };
}

/** @deprecated Use processAiResult() */
export const processN8nCallback = processAiResult;

// ─── helpers ────────────────────────────────────────────────────────────────

function computeDayTotals(content: PlanContent): Record<string, { kcal: number; proteinG: number; fatG: number; carbsG: number }> {
  const totals: Record<string, { kcal: number; proteinG: number; fatG: number; carbsG: number }> = {};
  for (const day of content.days) {
    let kcal = 0, proteinG = 0, fatG = 0, carbsG = 0;
    for (const meal of day.meals) {
      for (const item of meal.items) {
        kcal += Number(item.kcal) || 0;
        proteinG += Number(item.protein) || 0;
        fatG += Number(item.fat) || 0;
        carbsG += Number(item.carbs) || 0;
      }
    }
    totals[day.day] = { kcal, proteinG, fatG, carbsG };
  }
  return totals;
}

function computeMealTargets(
  content: PlanContent,
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number },
): Record<string, { kcal: number; proteinG: number; fatG: number; carbsG: number }> {
  const mealNames = new Set<string>();
  for (const day of content.days) {
    for (const meal of day.meals) {
      mealNames.add(meal.name);
    }
  }
  const count = mealNames.size || 1;
  const perMeal = {
    kcal: Math.round(nutritionTargets.kcal / count),
    proteinG: Math.round(nutritionTargets.proteinG / count),
    fatG: Math.round(nutritionTargets.fatG / count),
    carbsG: Math.round(nutritionTargets.carbsG / count),
  };
  const targets: Record<string, { kcal: number; proteinG: number; fatG: number; carbsG: number }> = {};
  for (const name of mealNames) {
    targets[name] = perMeal;
  }
  return targets;
}
