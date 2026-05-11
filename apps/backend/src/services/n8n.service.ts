import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptJson, decryptJson } from '../utils/encryption';
import { validatePlan, autoAdjustContent, buildCategorizedShoppingList, type PlanContent, type PlanDay, type PlanMeal, type MealRecipe } from './planValidation.service';
import { createRevision } from './revision.service';
import { logAudit } from './audit.service';
import { getNutritionTargets } from './nutrition.service';
import { segmentUser, type UserSegment } from './segmentation.service';
import { markEventProcessed } from '../utils/idempotency';
import { saveAsTemplate } from './dietTemplateCache.service';
import { saveRecipesFromPlan } from './recipeExtraction.service';
import { buildPatientContext } from '../policies';
import { standardizePlanContent, getCanonicalNamesList } from './productNameStandardization.service';

// ─── config ──────────────────────────────────────────────────────────────────

export function isN8nConfigured(): boolean {
  return !!(process.env.N8N_WEBHOOK_URL && process.env.N8N_API_SECRET);
}

// ─── complexity level (17.1.3) ───────────────────────────────────────────────

export type ComplexityLevel = 'SIMPLE' | 'COMPLEX';

/**
 * Determine AI prompt complexity based on patient's clinical profile.
 * SIMPLE = no chronic diseases → cheaper, shorter prompt.
 * COMPLEX = has chronic diseases / special conditions → full clinical analysis.
 */
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

// ─── trigger n8n workflow ────────────────────────────────────────────────────

interface TriggerPayload {
  dietPlanId: string;
  callbackUrl: string;
  idempotencyKey: string;

  /** AI prompt complexity — SIMPLE (no diseases) or COMPLEX (clinical analysis needed) */
  complexityLevel: ComplexityLevel;

  /** Post-policy adjusted nutrition targets */
  nutritionTargets: {
    kcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  };

  segment: {
    goal: string;
    kcalBucket: number;
    mealCount: number;
    dietType: string;
    allergies: string[];
  };

  /** Anonymized patient profile (17.5) — no email, name, birthDate, userId */
  anonymizedProfile: {
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    ageYears: number | null;
    goal: string | null;
  };

  /** Policy engine output — restrictions, exclusions, clinical notes for AI */
  policyContext: {
    excludeKeywords: string[];
    clinicalNotes: string[];
    nutrientLimits: Array<{
      nutrient: string;
      scope: string;
      min?: number;
      max?: number;
    }>;
    appliedRuleNames: string[];
  };

  /** Sanitized interview preferences (no PII) */
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
    // 31.6.1: new lifestyle preferences
    alcoholFrequency?: string;
    workType?: string;
    intolerances?: string[];
    mealRhythm?: { firstMealTime?: string; lastMealTime?: string; eatsAtNight?: boolean };
  };

  /** Cooking/meal constraints for AI (31.3, 31.4, 31.5) */
  constraints?: {
    maxCookingTimeMinutes?: number;
    preferredCuisines?: string[]; // 31.4.3: explicit cuisine constraint for AI
    mealSchedule?: Array<{ mealType: string; time: string; label: string }>; // 31.5.4
  };

  /** Requested recipe variants based on Order addons (17.3.3) */
  requestedVariants?: ('THERMOMIX' | 'AIRFRYER')[];

  /** Canonical product names from DB for AI prompt injection (17.4) */
  canonicalProductNames?: string[];
}

export interface TriggerN8nOptions {
  dietPlanId: string;
  complexityLevel: ComplexityLevel;
  nutritionTargets: TriggerPayload['nutritionTargets'];
  segment: TriggerPayload['segment'];
  anonymizedProfile: TriggerPayload['anonymizedProfile'];
  policyContext: TriggerPayload['policyContext'];
  preferences: TriggerPayload['preferences'];
  /** Cooking/meal constraints for AI (31.3) */
  constraints?: TriggerPayload['constraints'];
  /** Requested recipe variants based on Order addons (17.3.3) */
  requestedVariants?: ('THERMOMIX' | 'AIRFRYER')[];
  /** Canonical product names from DB for AI prompt injection (17.4) */
  canonicalProductNames?: string[];
}

/**
 * Trigger n8n AI workflow to generate a diet plan (AI-first pipeline, 17.1).
 *
 * The pipeline provides all required data — this function only:
 * 1. Checks idempotency
 * 2. Verifies plan is AI_DRAFT
 * 3. Sends payload to n8n
 *
 * Fire-and-forget — plan stays AI_DRAFT until n8n calls back.
 * Returns true if triggered, false if skipped (duplicate/wrong status).
 */
export async function triggerN8nWorkflow(opts: TriggerN8nOptions): Promise<boolean> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const apiSecret = process.env.N8N_API_SECRET;

  if (!webhookUrl || !apiSecret) {
    throw new AppError(503, 'N8N_NOT_CONFIGURED', 'n8n integration is not configured');
  }

  // Idempotency: prevent duplicate triggers for the same plan
  const isNew = await markEventProcessed('n8n-trigger', opts.dietPlanId, 3600);
  if (!isNew) {
    console.warn(`[n8n] Duplicate trigger attempt for plan ${opts.dietPlanId}. Skipping.`);
    return false;
  }

  // Verify plan is still in AI_DRAFT before triggering
  const planCheck = await prisma.dietPlan.findUnique({
    where: { id: opts.dietPlanId },
    select: { status: true },
  });
  if (!planCheck || planCheck.status !== 'AI_DRAFT') {
    console.warn(`[n8n] Plan ${opts.dietPlanId} is ${planCheck?.status ?? 'missing'}, not AI_DRAFT. Skipping.`);
    return false;
  }

  // Build callback URL (n8n runs in Docker, host.docker.internal to reach host)
  const backendPort = process.env.PORT ?? '4000';
  const callbackUrl = `http://host.docker.internal:${backendPort}/webhooks/n8n`;

  const idempotencyKey = `plan-${opts.dietPlanId}-${Date.now()}`;

  const payload: TriggerPayload = {
    dietPlanId: opts.dietPlanId,
    callbackUrl,
    idempotencyKey,
    complexityLevel: opts.complexityLevel,
    nutritionTargets: opts.nutritionTargets,
    segment: opts.segment,
    anonymizedProfile: opts.anonymizedProfile,
    policyContext: opts.policyContext,
    preferences: opts.preferences,
    constraints: opts.constraints,
    requestedVariants: opts.requestedVariants,
    canonicalProductNames: opts.canonicalProductNames,
  };

  // Mark plan as pending AI processing
  await prisma.dietPlan.update({
    where: { id: opts.dietPlanId },
    data: {
      aiProvider: 'n8n',
      aiModel: 'pending',
    },
  });

  // Fire-and-forget: send payload to n8n and don't wait for the full pipeline.
  // n8n will process asynchronously (OpenAI ~20s) and POST callback to /webhooks/n8n.
  // We only wait long enough to confirm n8n received the webhook (not for the full result).
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Api-Secret': apiSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((response) => {
        clearTimeout(timeout);
        if (!response.ok) {
          console.error(`[n8n] Workflow response: ${response.status} ${response.statusText}`);
        }
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error('[n8n] Workflow error (async):', err instanceof Error ? err.message : err);
      });

    // Audit log: record what was sent to AI (no PII, 17.5.3)
    logAudit({
      action: 'N8N_WORKFLOW_TRIGGERED',
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
        idempotencyKey,
        triggeredAt: new Date().toISOString(),
      },
    });

    return true;
  } catch (err) {
    console.error('[n8n] Trigger error:', err instanceof Error ? err.message : err);
    await prisma.dietPlan.update({
      where: { id: opts.dietPlanId },
      data: { aiModel: 'trigger_failed' },
    });
    return false;
  }
}

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

/**
 * 28.4.1 Validate AI-generated content against protocol restrictions and policy exclusions.
 * Checks HARD_BLOCK and STRONG level restrictions in meal names AND ingredient names.
 */
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

/**
 * 31.3.5 Validate AI-generated meals' prepTimeMin against maxCookingTimeMinutes.
 * Returns violations (warnings — not blocking, but logged for quality tracking).
 */
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
      `[n8n] Cooking time violations: ${violations.length} meals exceed ${maxCookingTimeMinutes}min limit`,
      violations.map((v) => `${v.day}/${v.mealName}: ${v.prepTimeMin}min`),
    );
  }

  return violations;
}

// ─── n8n repair workflow (28.4.2-28.4.6) ─────────────────────────────────────

export function isN8nRepairConfigured(): boolean {
  return !!(process.env.N8N_REPAIR_WEBHOOK_URL && process.env.N8N_API_SECRET);
}

interface RepairPayload {
  dietPlanId: string;
  action: 'repair';
  attemptNumber: number;
  callbackUrl: string;
  idempotencyKey: string;
  /** Only violating meals per day — stripped of correct meals to save tokens */
  violatingContent: PlanContent;
  /** Map: dayName → list of meal names that are correct and must NOT be changed */
  preservedMeals: Record<string, string[]>;
  /** Day names with zero violations (entirely preserved, not sent) */
  preservedDayNames: string[];
  /** Dish names already in the plan (preserved days + preserved meals) — AI must not repeat these */
  existingDishNames: string[];
  violations: AiViolation[];
  /** Per-meal targets (kcal, B, T, W) based on equal distribution */
  mealTargets: Record<string, { kcal: number; proteinG: number; fatG: number; carbsG: number }>;
  /** Actual day totals for violating days only */
  dayTotals: Record<string, { kcal: number; proteinG: number; fatG: number; carbsG: number }>;
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  /** Tolerance in fraction, e.g. 0.05 for ±5% (28.4.6) */
  tolerance: number;
}

function computeDayTotals(content: PlanContent): RepairPayload['dayTotals'] {
  const totals: RepairPayload['dayTotals'] = {};
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
): RepairPayload['mealTargets'] {
  // Collect unique meal names across all days, use equal distribution
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
  const targets: RepairPayload['mealTargets'] = {};
  for (const name of mealNames) {
    targets[name] = perMeal;
  }
  return targets;
}

/**
 * 28.4.2–28.4.6 Trigger n8n repair workflow with violation context.
 * Sends ONLY violating days (not the full plan) to save tokens.
 * Backend merges repaired days back into original in processN8nCallback.
 */
async function triggerN8nRepairWorkflow(opts: {
  dietPlanId: string;
  content: PlanContent;
  violations: AiViolation[];
  attemptNumber: number;
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
}): Promise<boolean> {
  const repairUrl = process.env.N8N_REPAIR_WEBHOOK_URL;
  const apiSecret = process.env.N8N_API_SECRET;

  if (!repairUrl || !apiSecret) return false;

  const backendPort = process.env.PORT ?? '4000';
  const callbackUrl = `http://host.docker.internal:${backendPort}/webhooks/n8n`;

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
      // Entire day is fine — skip it
      preservedDayNames.push(day.day);
      continue;
    }

    // Send only violating meals; record preserved meal names for merge
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
      // Violations had no mealName match — send whole day as fallback
      strippedDays.push(day);
    } else {
      preservedMeals[day.day] = preserved;
      strippedDays.push({ ...day, meals: mealsToRepair });
    }
  }

  // Safety fallback: if nothing extracted, send all
  const daysToRepair = strippedDays.length > 0 ? strippedDays : opts.content.days;
  const violatingContent: PlanContent = { days: daysToRepair };

  // Collect dish names from preserved days + preserved meals within violating days
  // so AI avoids repeating them in repaired meals
  const existingDishNames = new Set<string>();
  for (const day of opts.content.days) {
    const violatingMealNames = violationsByDay.get(day.day);
    for (const meal of day.meals) {
      // Include if: entire day is preserved, OR this specific meal is preserved
      const isPreserved = !violatingMealNames || !violatingMealNames.has(meal.name);
      if (isPreserved) {
        for (const item of meal.items) {
          existingDishNames.add(item.name);
        }
      }
    }
  }

  const payload: RepairPayload = {
    dietPlanId: opts.dietPlanId,
    action: 'repair',
    attemptNumber: opts.attemptNumber,
    callbackUrl,
    idempotencyKey: `repair-${opts.dietPlanId}-attempt${opts.attemptNumber}-${Date.now()}`,
    violatingContent,
    preservedMeals,
    preservedDayNames,
    existingDishNames: [...existingDishNames],
    violations: opts.violations,
    mealTargets: computeMealTargets(opts.content, opts.nutritionTargets),
    dayTotals: computeDayTotals(violatingContent),
    nutritionTargets: opts.nutritionTargets,
    tolerance: 0.05,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    fetch(repairUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-N8N-Api-Secret': apiSecret },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeout);
        if (!res.ok) console.error(`[n8n] Repair workflow response: ${res.status} ${res.statusText}`);
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error('[n8n] Repair workflow error (async):', err instanceof Error ? err.message : err);
      });

    logAudit({
      action: 'N8N_WORKFLOW_TRIGGERED',
      resourceType: 'DIET_PLAN',
      resourceId: opts.dietPlanId,
      metadata: { action: 'repair', attemptNumber: opts.attemptNumber, violationsCount: opts.violations.length },
    });

    return true;
  } catch (err) {
    console.error('[n8n] Repair trigger error:', err instanceof Error ? err.message : err);
    return false;
  }
}

// ─── fallback recipe generator (32.1.B) ─────────────────────────────────────

/** Cooking verb heuristics based on ingredient keywords */
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
    if (keywords.some(kw => lower.includes(kw))) return verb;
  }
  return 'Przygotuj';
}

/**
 * 32.1.B: Generate a basic recipe from meal name and ingredients when AI doesn't return one.
 * Creates simple step-by-step instructions based on ingredient names.
 */
function generateBasicRecipe(meal: PlanMeal): MealRecipe {
  const steps: string[] = [];
  const ingredientNames = meal.items.map(item => item.name);

  if (ingredientNames.length === 0) {
    return { prepTimeMin: 10, steps: [`Przygotuj ${meal.name}.`] };
  }

  // Group items by cooking verb to create coherent steps
  const grouped = new Map<string, string[]>();
  for (const name of ingredientNames) {
    const verb = getCookingVerb(name);
    const existing = grouped.get(verb) ?? [];
    existing.push(name);
    grouped.set(verb, existing);
  }

  let stepNum = 1;
  for (const [verb, items] of grouped) {
    if (items.length === 1) {
      steps.push(`${verb} ${items[0]} (${meal.items.find(i => i.name === items[0])?.grams ?? ''}g).`);
    } else {
      steps.push(`${verb}: ${items.join(', ')}.`);
    }
    stepNum++;
  }

  // Final assembly step
  if (steps.length > 1) {
    steps.push(`Połącz składniki i podaj jako ${meal.name}.`);
  }

  // Estimate prep time: 5min base + 3min per unique cooking action
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
}

// ─── process n8n callback ────────────────────────────────────────────────────

export interface N8nCallbackPayload {
  dietPlanId: string;
  content: PlanContent;
  aiProvider?: string;
  aiModel?: string;
}

/**
 * Process the AI-generated plan received from n8n callback.
 *
 * Steps:
 * 1. Verify diet plan exists and is in AI_DRAFT status
 * 2. Encrypt and save the new content
 * 3. Record AI_GENERATED revision
 * 4. Run validation
 * 5. Auto-adjust if needed
 */
export async function processN8nCallback(payload: N8nCallbackPayload): Promise<{
  dietPlanId: string;
  validationStatus: string;
}> {
  const { dietPlanId, aiProvider, aiModel } = payload;
  let { content } = payload;

  // 1. Verify plan exists — include nutritionTargets for accurate kcal fallback (32.3.4)
  const plan = await prisma.dietPlan.findUnique({
    where: { id: dietPlanId },
    include: { patient: { include: { nutritionTargets: true } } },
  });
  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
  }

  // 32.3.4: Resolve target kcal — prefer nutritionTargets, fallback to plan.kcal, warn if neither
  const resolvedTargetKcal = plan.patient?.nutritionTargets?.targetKcal ?? plan.kcal ?? null;
  if (!resolvedTargetKcal) {
    console.warn(`[n8n] Plan ${dietPlanId}: no nutritionTargets and no plan.kcal — cannot auto-adjust calories`);
  }

  // Accept AI_DRAFT (normal) or MANUAL_REVIEW_REQUIRED (HIGH red flag set before n8n callback)
  const acceptableStatuses = ['AI_DRAFT', 'MANUAL_REVIEW_REQUIRED'];
  if (!acceptableStatuses.includes(plan.status)) {
    // Plan already fully processed (e.g. duplicate callback) — return success to stop retries
    console.warn(`[n8n] Duplicate callback for plan ${dietPlanId}, status=${plan.status}. Skipping.`);
    return { dietPlanId, validationStatus: 'ALREADY_PROCESSED' };
  }

  // 1b. Merge partial repair: repaired callback may contain only violating days/meals
  const isRepairCallback = aiModel?.includes('repair');
  if (isRepairCallback && content?.days && plan.content) {
    try {
      const originalContent = decryptJson(plan.content as string) as PlanContent;
      if (originalContent?.days && content.days.length < originalContent.days.length) {
        // Day-level merge: repaired days replace originals, missing days kept as-is
        const repairedByDay = new Map<string, PlanDay>(
          (content.days as PlanDay[]).map((d) => [d.day, d]),
        );
        const mergedDays = originalContent.days.map((origDay) => {
          const repairedDay = repairedByDay.get(origDay.day);
          if (!repairedDay) return origDay; // Day had no violations — keep original

          // Meal-level merge: if repaired day has fewer meals, restore preserved meals from original
          if (repairedDay.meals.length < origDay.meals.length) {
            const repairedMealNames = new Set(repairedDay.meals.map((m) => m.name));
            const preservedFromOrig = origDay.meals.filter((m) => !repairedMealNames.has(m.name));
            // Combine: preserved originals + repaired meals, in original order
            const originalOrder = origDay.meals.map((m) => m.name);
            const allMeals: PlanMeal[] = [...preservedFromOrig, ...repairedDay.meals];
            allMeals.sort((a, b) => originalOrder.indexOf(a.name) - originalOrder.indexOf(b.name));
            return { ...repairedDay, meals: allMeals };
          }
          return repairedDay;
        });

        const repairedDayCount = repairedByDay.size;
        console.log(
          `[n8n] Repair merge: ${repairedDayCount} repaired day(s) [${[...repairedByDay.keys()].join(', ')}] ` +
          `merged into ${originalContent.days.length}-day plan (meal-level restore applied)`,
        );
        content = { ...content, days: mergedDays };
      }
    } catch (err) {
      console.warn(`[n8n] Could not merge partial repair for plan ${dietPlanId}, using callback content as-is:`, err);
    }
  }

  // 2. Validate content structure (basic sanity check)
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

  // 2b. Normalize ingredients: ensure every item has ingredients[] (24.7.2)
  for (const day of content.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        if (!item.ingredients || !Array.isArray(item.ingredients) || item.ingredients.length === 0) {
          item.ingredients = [{ name: item.name, grams: Number(item.grams) || 0 }];
        } else {
          // Sanitize existing ingredients
          item.ingredients = item.ingredients
            .filter((ing: { name?: string }) => ing && typeof ing.name === 'string' && ing.name.trim().length > 0)
            .map((ing: { name: string; grams?: number }) => ({
              name: ing.name.trim(),
              grams: Number(ing.grams) || 0,
            }));
          // If all filtered out, fallback
          if (item.ingredients.length === 0) {
            item.ingredients = [{ name: item.name, grams: Number(item.grams) || 0 }];
          }
        }
      }
    }
  }

  // 2c. Generate fallback recipes for meals missing them (32.1.B)
  const mealsWithoutRecipe: string[] = [];
  for (const day of content.days) {
    for (const meal of day.meals) {
      if (!meal.recipe || !Array.isArray(meal.recipe.steps) || meal.recipe.steps.length === 0) {
        mealsWithoutRecipe.push(`${day.day} → ${meal.name}`);
        meal.recipe = generateBasicRecipe(meal);
      }
    }
  }
  if (mealsWithoutRecipe.length > 0) {
    console.warn(
      `[n8n] Plan ${dietPlanId}: ${mealsWithoutRecipe.length} meal(s) missing recipe — generated fallback: ${mealsWithoutRecipe.join(', ')}`,
    );
  }

  // 2d. Standardize product names against canonical DB (17.4.3–17.4.4)
  const { content: standardizedContent, report: stdReport } = await standardizePlanContent(content);

  if (stdReport.unmatched > 0) {
    console.warn(
      `[n8n] Product name standardization: ${stdReport.matched}/${stdReport.totalItems} matched, ` +
      `${stdReport.unmatched} unmatched: ${stdReport.unmatchedNames.join(', ')}`,
    );
  }

  // 2e. Validate AI output against protocol restrictions and policy exclusions (28.4.1 + 30.3.4)
  const policyMeta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};
  const protocolSnapshot = policyMeta.protocolSnapshot as {
    foodRestrictions?: Array<{ keywords: string[]; level: string; reason?: string; category?: string }>;
    avoidFoodCategories?: Array<{ category: string; reason?: string }>;
  } | null;
  const excludeKeywords = (policyMeta.excludeKeywords as string[]) ?? [];

  // 30.3.4: Merge avoidFoodCategories keywords into excludeKeywords for validation
  const mergedExcludeKeywords = [...excludeKeywords];
  if (protocolSnapshot?.avoidFoodCategories) {
    for (const cat of protocolSnapshot.avoidFoodCategories) {
      if (cat.category && !mergedExcludeKeywords.includes(cat.category.toLowerCase())) {
        mergedExcludeKeywords.push(cat.category.toLowerCase());
      }
    }
  }

  const violations = validateAiOutput(standardizedContent, protocolSnapshot?.foodRestrictions ?? [], mergedExcludeKeywords);

  // 31.3.5: Check cooking time constraints (warning only, not blocking)
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

    console.warn(
      `[n8n] Plan ${dietPlanId}: ${violations.length} violation(s) in attempt ${attemptNumber}. ` +
      `Keywords: ${violations.map((v) => v.keyword).join(', ')}`,
    );

    if (attemptNumber <= 2 && isN8nRepairConfigured()) {
      // 28.4.3: Trigger repair — max 2 attempts
      // 28.4.5: Repair only violating meals, not entire diet
      const triggered = await triggerN8nRepairWorkflow({
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

      // 28.4.4: Log repair attempt in policyMetadata, plan stays in AI_DRAFT
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
      // If repair trigger failed → fall through to save content as MANUAL_REVIEW_REQUIRED
    }

    // Max attempts exceeded (or repair not configured) → save with MANUAL_REVIEW_REQUIRED
    attempt.maxAttemptsExceeded = true;

    await prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: {
        content: encryptJson(standardizedContent as Record<string, unknown>),
        status: 'MANUAL_REVIEW_REQUIRED',
        aiProvider: aiProvider ?? 'n8n',
        aiModel: aiModel ?? 'ai',
        policyMetadata: {
          ...policyMeta,
          repairAttempts: [...repairAttempts, attempt],
        } as unknown as import('@db').Prisma.InputJsonValue,
      },
    });

    await createRevision(dietPlanId, standardizedContent as Record<string, unknown>, 'AI_GENERATED');

    console.warn(`[n8n] Plan ${dietPlanId}: violations unresolved after ${attemptNumber} attempt(s). Set to MANUAL_REVIEW_REQUIRED.`);

    saveRecipesFromPlan(standardizedContent, dietPlanId)
      .catch((err) => console.error('[n8n] Recipe extraction failed:', err instanceof Error ? err.message : err));

    return { dietPlanId, validationStatus: 'VIOLATIONS_UNRESOLVED' };
  }

  // 3. Save encrypted content. Keep MANUAL_REVIEW_REQUIRED if set by red flag, else GENERATED.
  const newStatus = plan.status === 'MANUAL_REVIEW_REQUIRED' ? 'MANUAL_REVIEW_REQUIRED' : 'GENERATED';
  await prisma.dietPlan.update({
    where: { id: dietPlanId },
    data: {
      content: encryptJson(standardizedContent as Record<string, unknown>),
      status: newStatus,
      aiProvider: aiProvider ?? 'n8n',
      aiModel: aiModel ?? 'ai',
    },
  });

  // 4. Record revision
  await createRevision(dietPlanId, standardizedContent as Record<string, unknown>, 'AI_GENERATED');

  // 5. Validate
  const validationResult = await validatePlan(dietPlanId);

  // 6. Auto-adjust if needed
  let finalContent = standardizedContent;
  let finalValidationStatus = validationResult.status;

  if (validationResult.status === 'NEEDS_ADJUST') {
    // 32.3.4: Use resolved target kcal instead of hardcoded 2000 fallback
    const adjustTarget = resolvedTargetKcal ?? plan.kcal ?? 0;
    if (adjustTarget <= 0) {
      console.warn(`[n8n] Plan ${dietPlanId}: skipping auto-adjust — no valid target kcal`);
    }
    const adjusted = adjustTarget > 0
      ? autoAdjustContent(standardizedContent, adjustTarget)
      : standardizedContent;
    await prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: { content: encryptJson(adjusted as Record<string, unknown>) },
    });
    await createRevision(dietPlanId, adjusted as Record<string, unknown>, 'AUTO_ADJUST');
    const revalidation = await validatePlan(dietPlanId);
    finalContent = adjusted;
    finalValidationStatus = revalidation.status;
  }

  // 6b. Rebuild shopping list from ingredients (24.7) — replace AI-generated list with proper aggregation
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

    // Re-save with updated shopping list
    await prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: { content: encryptJson(finalContent as Record<string, unknown>) },
    });
  } catch (err) {
    console.warn('[n8n] Shopping list rebuild failed:', err instanceof Error ? err.message : err);
  }

  // 7. Save as reusable template (17.2) — fire-and-forget
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
        aiModel: aiModel ?? 'n8n',
      }).catch((err) => console.error('[n8n] Template save failed:', err instanceof Error ? err.message : err));
    }
  }

  // 8. Extract and save recipes to Recipe table (17.3.5) — fire-and-forget
  saveRecipesFromPlan(finalContent, dietPlanId)
    .catch((err) => console.error('[n8n] Recipe extraction failed:', err instanceof Error ? err.message : err));

  // 9. Build and save aiProcessingReport (32.2.1–32.2.2)
  const reportIssues: AiProcessingIssue[] = [];

  if (mealsWithoutRecipe.length > 0) {
    reportIssues.push({
      type: 'MISSING_RECIPES',
      count: mealsWithoutRecipe.length,
      details: mealsWithoutRecipe,
    });
  }

  if (stdReport.unmatched > 0) {
    reportIssues.push({
      type: 'UNMATCHED_PRODUCTS',
      count: stdReport.unmatched,
      details: stdReport.unmatchedNames.slice(0, 20),
    });
  }

  if (cookingTimeViolations.length > 0) {
    reportIssues.push({
      type: 'COOKING_TIME',
      count: cookingTimeViolations.length,
      details: cookingTimeViolations.map(v => `${v.day}/${v.mealName}: ${v.prepTimeMin}min (max ${v.maxAllowed})`),
    });
  }

  // Kcal/macro issues from validation
  for (const issue of validationResult.issues) {
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

  // Count AI-provided vs fallback-generated recipes
  let aiRecipeCount = 0;
  for (const day of content.days) {
    for (const meal of day.meals) {
      if (meal.recipe?.steps?.length) aiRecipeCount++;
    }
  }

  const aiProcessingReport: AiProcessingReport = {
    receivedAt: new Date().toISOString(),
    aiProvider: aiProvider ?? 'n8n',
    aiModel: aiModel ?? 'ai',
    issues: reportIssues,
    autoAdjusted: validationResult.status === 'NEEDS_ADJUST',
    recipesExtracted: aiRecipeCount,
    recipesGenerated: mealsWithoutRecipe.length,
    validationStatus: finalValidationStatus,
    productStandardization: {
      totalItems: stdReport.totalItems,
      matched: stdReport.matched,
      unmatched: stdReport.unmatched,
      unmatchedNames: stdReport.unmatchedNames.slice(0, 20),
    },
  };

  // Save report to policyMetadata
  const currentMeta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};
  await prisma.dietPlan.update({
    where: { id: dietPlanId },
    data: {
      policyMetadata: {
        ...currentMeta,
        aiProcessingReport,
      } as unknown as import('@db').Prisma.InputJsonValue,
    },
  });

  return { dietPlanId, validationStatus: finalValidationStatus };
}

// ─── partial regeneration (32.2.7) ──────────────────────────────────────────

export interface PartialRegenerateInput {
  /** Full days to regenerate, e.g. ["Sobota", "Wtorek"] */
  days?: string[];
  /** Specific meals to regenerate, e.g. [{ day: "Sobota", meal: "Obiad" }] */
  meals?: Array<{ day: string; meal: string }>;
}

interface PartialRegeneratePayload {
  dietPlanId: string;
  action: 'partial-regenerate';
  callbackUrl: string;
  idempotencyKey: string;
  /** Items to regenerate */
  targets: PartialRegenerateInput;
  /** Current plan content (for context — AI can see other meals) */
  currentContent: PlanContent;
  /** Daily nutrition targets */
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  /** Policy restrictions to respect */
  excludeKeywords: string[];
  clinicalNotes: string[];
}

/**
 * 32.2.7: Trigger partial regeneration of specific days/meals via n8n.
 * Keeps rest of the plan intact.
 */
export async function triggerPartialRegeneration(
  planId: string,
  input: PartialRegenerateInput,
): Promise<{ triggered: boolean; message: string }> {
  if (!isN8nConfigured()) {
    return { triggered: false, message: 'n8n is not configured' };
  }

  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    include: { patient: { include: { nutritionTargets: true } } },
  });

  if (!plan) {
    throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');
  }

  // Only allow partial regen on editable plans
  const editableStatuses = ['GENERATED', 'MANUAL_REVIEW_REQUIRED', 'REVIEWED'];
  if (!editableStatuses.includes(plan.status)) {
    throw new AppError(400, 'INVALID_STATUS', `Cannot regenerate plan in status ${plan.status}`);
  }

  const content = decryptJson(plan.content) as PlanContent;
  if (!content?.days?.length) {
    throw new AppError(400, 'EMPTY_CONTENT', 'Plan has no content to partially regenerate');
  }

  // Validate that requested days/meals exist in the plan
  const planDayNames = content.days.map(d => d.day);
  if (input.days) {
    for (const day of input.days) {
      if (!planDayNames.includes(day)) {
        throw new AppError(400, 'INVALID_DAY', `Day "${day}" not found in plan`);
      }
    }
  }
  if (input.meals) {
    for (const m of input.meals) {
      const dayData = content.days.find(d => d.day === m.day);
      if (!dayData) throw new AppError(400, 'INVALID_DAY', `Day "${m.day}" not found in plan`);
      if (!dayData.meals.some(meal => meal.name === m.meal)) {
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

  // Use dedicated partial regen URL, fall back to main webhook
  const webhookUrl = process.env.N8N_PARTIAL_REGEN_WEBHOOK_URL ?? process.env.N8N_WEBHOOK_URL;
  const apiSecret = process.env.N8N_API_SECRET;

  if (!webhookUrl || !apiSecret) {
    return { triggered: false, message: 'n8n webhook not configured' };
  }

  const backendPort = process.env.PORT ?? '4000';
  const callbackUrl = `http://host.docker.internal:${backendPort}/webhooks/n8n`;

  const payload: PartialRegeneratePayload = {
    dietPlanId: planId,
    action: 'partial-regenerate',
    callbackUrl,
    idempotencyKey: `partial-${planId}-${Date.now()}`,
    targets: input,
    currentContent: content,
    nutritionTargets,
    excludeKeywords,
    clinicalNotes,
  };

  // Set plan to AI_DRAFT while regenerating
  await prisma.dietPlan.update({
    where: { id: planId },
    data: { status: 'AI_DRAFT', aiModel: 'partial-regen-pending' },
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-N8N-Api-Secret': apiSecret },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(res => {
        clearTimeout(timeout);
        if (!res.ok) console.error(`[n8n] Partial regen response: ${res.status}`);
      })
      .catch(err => {
        clearTimeout(timeout);
        console.error('[n8n] Partial regen error:', err instanceof Error ? err.message : err);
      });

    logAudit({
      action: 'N8N_WORKFLOW_TRIGGERED',
      resourceType: 'DIET_PLAN',
      resourceId: planId,
      metadata: {
        action: 'partial-regenerate',
        targetDays: input.days ?? [],
        targetMeals: input.meals ?? [],
      },
    });

    return { triggered: true, message: 'Partial regeneration triggered' };
  } catch (err) {
    console.error('[n8n] Partial regen trigger error:', err instanceof Error ? err.message : err);
    await prisma.dietPlan.update({
      where: { id: planId },
      data: { status: 'GENERATED', aiModel: 'partial-regen-failed' },
    });
    return { triggered: false, message: 'Failed to trigger partial regeneration' };
  }
}
