import { createHash } from 'node:crypto';
import { prisma } from '@db';
import { encryptJson, decryptJson } from '../utils/encryption';
import { AppError } from '../utils/errors';
import { computeAndSaveNutritionTargets, getNutritionTargets } from './nutrition.service';
import { segmentUser, type UserSegment } from './segmentation.service';
import { findBestTemplatePlan } from './template.service';
import { getCandidateMeals, cookingTimeToMinutes, type MealTypeValue } from './meal.service';
import {
  validatePlan,
  autoAdjustContent,
  type PlanContent,
  type PlanDay,
  type PlanMeal,
} from './planValidation.service';
import {
  buildPlanMatchCacheKey,
  getCachedPlan,
  setCachedPlan,
} from '../utils/dietPlanCache';
import {
  checkTemplateCache,
  saveAsTemplate,
  type CacheCheckResult,
} from './dietTemplateCache.service';
import { createRevision } from './revision.service';
import { isOpenAiConfigured, enqueueDietGeneration, determineComplexity, type RepairAttempt } from './aiGeneration.service';
// Backward compat aliases
const isN8nConfigured = isOpenAiConfigured;
const triggerN8nWorkflow = enqueueDietGeneration;
import { saveRecipesFromPlan } from './recipeExtraction.service';
import { getCanonicalNamesGrouped } from './productNameStandardization.service';
import { getPersonalizedProducts, type PersonalizedProductList } from './productSelection.service';
import { getHighlyRatedRecipeNames } from './rating.service';
import { analyzePlanMicronutrients } from './micronutrientAnalysis.service';
import {
  buildPatientContext,
  evaluatePolicies,
  applyTargetModifications,
  CLINICAL_RULES,
  evaluateRedFlags,
  buildPlanExplanation,
  loadPolicyRules,
  evaluateRedFlagsFromDb,
} from '../policies';
import { logAudit } from './audit.service';
import { PipelineTimer, logAiUsage } from './aiUsage.service';
import { resolveActiveProtocol, buildProtocolSnapshot, type ResolvedProtocol } from './protocol.service';
import { computeMealSchedule } from '../utils/mealSchedule';
import { isComposeMealsEnabledFor } from '../utils/composeMealsFlag';
import { matchProtocolsFromInterview, type MatchedProtocol } from './protocolMatcher.service';
import { mergeProtocols, type MergedProtocol } from './protocolMerger.service';
import { getDbDietMode, shouldUseDbInAbTest } from './dbFeatureFlag.service';
import { assembleDbPlan, type AssemblyResult, type AssemblyInput } from './dbPlanAssembly.service';
import { buildDbPolicyConstraints, mergeConstraintsIntoInput } from './dbPolicyBridge.service';
import { solveWeekPlan, assembleSolverPlan, type SolverResult } from './weekSolver.service';
import { postProcessPlan } from './planPostProcessing.service';
import { runSoftValidations } from './softValidation.service';
import { runClinicalSafetyCheck } from './clinicalSafetyCheck.service';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute a deterministic hash of the pipeline inputs.
 * If the same hash is seen again, the DB-first pipeline would produce the same plan
 * (assuming the recipe database has not changed). Enables replay/reproducibility.
 */
function computeInputHash(
  assemblyInput: AssemblyInput,
  recipeIds: string[],
): string {
  const payload = JSON.stringify({
    patientId: assemblyInput.patientId,
    days: assemblyInput.days ?? 7,
    excludeAllergens: assemblyInput.excludeAllergens ?? [],
    requiredDietFlags: assemblyInput.requiredDietFlags ?? [],
    maxCookingTimeMinutes: assemblyInput.maxCookingTimeMinutes ?? null,
    maxCost: assemblyInput.maxCost ?? null,
    preferMealPrep: assemblyInput.preferMealPrep ?? false,
    recipeDbSnapshot: recipeIds.sort().join(','),
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  dietPlanId: string;
  source: 'template' | 'candidate_meals' | 'fallback' | 'cached_template' | 'cached_template_rescaled';
  validationStatus: string;
  cached: boolean;
  /** true when plan was sent for AI generation */
  n8nTriggered: boolean;
  /** Alias for n8nTriggered (33.7) */
  aiTriggered: boolean;
  /** true when red flags blocked auto-generation */
  blocked: boolean;
  /** Policy rules that were applied */
  appliedRules: string[];
  /** Red flags that were triggered */
  redFlags: string[];
  /** Generation method used (DB-first, AI, or hybrid) */
  generationMethod?: 'database' | 'database_solver' | 'ai' | 'database_ai_hybrid';
  /** DB-first coverage percentage (0-100) */
  coveragePct?: number;
}

// ─── meal slot config ─────────────────────────────────────────────────────────

/** Map English meal type enums to Polish meal names */
const MEAL_TYPE_PL: Record<string, string> = {
  BREAKFAST: 'Śniadanie',
  LUNCH: 'II Śniadanie',
  SNACK: 'Podwieczorek',
  DINNER: 'Obiad',
  SUPPER: 'Kolacja',
};

const MEAL_TYPES_BY_COUNT: Record<number, MealTypeValue[]> = {
  3: ['BREAKFAST', 'LUNCH', 'DINNER'],
  4: ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'],
  5: ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER'],
};

// 31.5.3: meal types without breakfast (patient already excluded it from count)
// SNACK used for morning snack slot (II śniadanie) since MealType enum has no SECOND_BREAKFAST
const MEAL_TYPES_SKIP_BREAKFAST: Record<number, MealTypeValue[]> = {
  3: ['LUNCH', 'SNACK', 'DINNER'],
  4: ['SNACK', 'LUNCH', 'DINNER', 'SUPPER'],
  5: ['SNACK', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER'],
};

const DAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

// ─── helpers ──────────────────────────────────────────────────────────────────

function getMealTypes(mealCount: number, skipBreakfast = false): MealTypeValue[] {
  const normalized = mealCount <= 3 ? 3 : mealCount >= 5 ? 5 : 4;
  const lookup = skipBreakfast ? MEAL_TYPES_SKIP_BREAKFAST : MEAL_TYPES_BY_COUNT;
  return lookup[normalized];
}

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── build plan from TemplatePlan ─────────────────────────────────────────────

type TemplatePlanWithMeals = Awaited<ReturnType<typeof findBestTemplatePlan>>;

function buildPlanFromTemplate(template: NonNullable<TemplatePlanWithMeals>): PlanContent {
  // Group meals by dayNumber
  const byDay = new Map<number, typeof template.meals>();
  for (const slot of template.meals) {
    const existing = byDay.get(slot.dayNumber) ?? [];
    existing.push(slot);
    byDay.set(slot.dayNumber, existing);
  }

  const days: PlanDay[] = DAY_NAMES.map((dayName, idx) => {
    const dayNumber = idx + 1;
    const slots = byDay.get(dayNumber) ?? [];

    const meals: PlanMeal[] = slots.map((slot) => ({
      name: slot.meal.name,
      items: [
        {
          name: slot.meal.name,
          grams: 300,
          kcal: slot.meal.kcal,
          protein: Number(slot.meal.proteinG),
          fat: Number(slot.meal.fatG),
          carbs: Number(slot.meal.carbsG),
        },
      ],
    }));

    // Fill missing slots with placeholder if template is incomplete for this day
    return { day: dayName, meals };
  });

  return { days, generatedFrom: 'template', templateId: template.id };
}

// ─── build plan from candidate meals ─────────────────────────────────────────

async function buildPlanFromCandidates(
  segment: UserSegment,
  targetKcal: number,
  maxCookingTimeMinutes?: number,
  preferredCuisines?: string[],
  skipBreakfast = false,
): Promise<PlanContent | null> {
  const mealTypes = getMealTypes(segment.mealCount, skipBreakfast);
  const kcalPerMeal = Math.round(targetKcal / mealTypes.length);

  const allergyFlags = {
    excludeGluten: segment.allergies.includes('gluten'),
    excludeLactose: segment.allergies.includes('lactose'),
    excludeNuts: segment.allergies.includes('nuts'),
    excludeSoy: segment.allergies.includes('soy'),
    excludeEggs: segment.allergies.includes('eggs'),
    excludeFish: segment.allergies.includes('fish'),
  };

  // Pre-fetch candidate pools per meal type (avoid N*7 DB calls)
  const candidatePools = new Map<MealTypeValue, Awaited<ReturnType<typeof getCandidateMeals>>>();

  await Promise.all(
    mealTypes.map(async (mealType) => {
      const candidates = await getCandidateMeals({
        mealType,
        targetKcal: kcalPerMeal,
        tolerancePct: 35,
        dietType: segment.dietType !== 'STANDARD' ? segment.dietType : undefined,
        ...allergyFlags,
        maxCookingTimeMinutes,
        preferredCuisines,
        limit: 20,
      });
      candidatePools.set(mealType, candidates);
    }),
  );

  // Check if we have at least some candidates
  const totalCandidates = [...candidatePools.values()].reduce((sum, arr) => sum + arr.length, 0);
  if (totalCandidates === 0) return null;

  const days: PlanDay[] = DAY_NAMES.map((dayName) => {
    const meals: PlanMeal[] = mealTypes.map((mealType) => {
      const pool = candidatePools.get(mealType) ?? [];
      const meal = pickRandom(pool);

      if (!meal) {
        // Placeholder when no candidate available for this type
        const polishName = MEAL_TYPE_PL[mealType] ?? mealType;
        return {
          name: polishName,
          items: [
            {
              name: `${polishName} — do uzupełnienia`,
              grams: 200,
              kcal: kcalPerMeal,
              protein: Math.round(kcalPerMeal * 0.25 / 4),
              fat: Math.round(kcalPerMeal * 0.30 / 9),
              carbs: Math.round(kcalPerMeal * 0.45 / 4),
            },
          ],
        };
      }

      return {
        name: meal.name,
        items: [
          {
            name: meal.name,
            grams: 300,
            kcal: meal.kcal,
            protein: Number(meal.proteinG),
            fat: Number(meal.fatG),
            carbs: Number(meal.carbsG),
          },
        ],
      };
    });

    return { day: dayName, meals };
  });

  return { days, generatedFrom: 'candidate_meals' };
}

// ─── fallback plan (when no meals in DB) ─────────────────────────────────────

function buildFallbackPlan(targetKcal: number, mealCount: number, skipBreakfast = false): PlanContent {
  const mealTypes = getMealTypes(mealCount, skipBreakfast);
  const kcalPerMeal = Math.round(targetKcal / mealTypes.length);

  const days: PlanDay[] = DAY_NAMES.map((dayName) => ({
    day: dayName,
    meals: mealTypes.map((mealType) => ({
      name: MEAL_TYPE_PL[mealType] ?? mealType,
      items: [
        {
          name: `${MEAL_TYPE_PL[mealType] ?? mealType} — do uzupełnienia`,
          grams: 200,
          kcal: kcalPerMeal,
          protein: Math.round(kcalPerMeal * 0.25 / 4),
          fat: Math.round(kcalPerMeal * 0.30 / 9),
          carbs: Math.round(kcalPerMeal * 0.45 / 4),
        },
      ],
    })),
  }));

  return { days, generatedFrom: 'fallback' };
}

// ─── main pipeline (17.1 — AI-first) ─────────────────────────────────────────

/**
 * Full diet plan generation pipeline for a patient.
 *
 * AI-FIRST FLOW (17.1):
 * 1. Compute/fetch NutritionTargets
 * 2. Policy Engine: build context, evaluate rules, red flags
 * 3. Apply target modifications
 * 4. If CRITICAL red flag → create blocked plan, stop
 * 5. Segment user
 * 6. Create AI_DRAFT plan in DB
 * 7. **PRIMARY**: If n8n configured → trigger AI generation (async callback)
 * 8. **FALLBACK**: If n8n NOT configured → TemplatePlan → Candidate meals → Fallback
 * 9. Validate, auto-adjust, finalize
 *
 * Returns null when patient profile is missing required anthropometric data.
 */
export async function runGenerationPipeline(
  patientId: string,
  activityLevelRaw?: string,
  mainGoalRaw?: string,
  activityTypes?: string[],
  workoutsPerWeek?: number,
  workoutDurationMin?: number,
  preMatchedProtocols?: MatchedProtocol[],
): Promise<PipelineResult | null> {
  const timer = new PipelineTimer();
  const triggeredAt = new Date();
  let autoAdjusted = false;

  // ── 0. Clean up stale AI_DRAFT plans (stuck > 5 min) ────────────────────────
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Delete stale AI_DRAFTs so they don't block new generation
  const staleDrafts = await prisma.dietPlan.findMany({
    where: { patientId, status: 'AI_DRAFT', createdAt: { lt: staleThreshold } },
    select: { id: true },
  });
  if (staleDrafts.length > 0) {
    console.warn(`[pipeline] Cleaning up ${staleDrafts.length} stale AI_DRAFT plan(s) for patient ${patientId}`);
    await prisma.dietPlan.updateMany({
      where: { id: { in: staleDrafts.map(d => d.id) } },
      data: { status: 'GENERATED', aiModel: 'stale-draft-recovered' },
    });
  }

  // Check for recent AI_DRAFT (< 5 min — n8n might still be processing)
  const recentDraft = await prisma.dietPlan.findFirst({
    where: { patientId, status: 'AI_DRAFT', createdAt: { gte: staleThreshold } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  if (recentDraft) {
    console.warn(`[pipeline] Patient ${patientId} has recent AI_DRAFT plan ${recentDraft.id} (created ${recentDraft.createdAt.toISOString()}). Returning for polling.`);
    return {
      dietPlanId: recentDraft.id,
      source: 'fallback',
      validationStatus: 'PENDING',
      cached: false,
      n8nTriggered: true, aiTriggered: true, // tell frontend to poll
      blocked: false,
      appliedRules: [],
      redFlags: [],
    };
  }

  // ── 0.5. Resolve protocol: auto-match + dietitian override + merge (30.3.3) ─
  const patientForProtocol = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { dietitianId: true },
  });

  // Fallback: resolve dietitian-assigned or global default protocol
  let activeProtocol: ResolvedProtocol | null = null;
  try {
    activeProtocol = await resolveActiveProtocol(patientForProtocol?.dietitianId);
  } catch {
    console.warn('[pipeline] Could not resolve active protocol — using pipeline defaults');
  }

  // 30.3.3: If pre-matched protocols available, merge them (with dietitian override)
  let mergedProtocol: MergedProtocol | null = null;
  const effectiveMatchedProtocols = preMatchedProtocols ?? [];

  if (effectiveMatchedProtocols.length > 0) {
    try {
      mergedProtocol = await mergeProtocols(
        effectiveMatchedProtocols,
        patientForProtocol?.dietitianId ? activeProtocol?.id : null,
        mainGoalRaw ?? null,
      );
      if (mergedProtocol) {
        console.log(
          `[pipeline] Merged ${mergedProtocol.sourceProtocols.length} protocol(s) for patient ${patientId}: ` +
          mergedProtocol.sourceProtocols.map((p) => p.name).join(', '),
        );
      }
    } catch (err) {
      console.error('[pipeline] Protocol merge failed, falling back to active protocol:', err instanceof Error ? err.message : err);
    }
  }

  // Effective protocol: merged > active > null
  const effectiveProtocol: ResolvedProtocol | null = mergedProtocol ?? activeProtocol;

  // ── 1. NutritionTargets ─────────────────────────────────────────────────────
  let targets = await getNutritionTargets(patientId);

  if (!targets && activityLevelRaw && mainGoalRaw) {
    targets = await computeAndSaveNutritionTargets(
      patientId, activityLevelRaw, mainGoalRaw,
      activityTypes, workoutsPerWeek, workoutDurationMin,
    );
  }

  timer.mark('nutrition_targets');

  if (!targets) return null;

  // ── 2. Policy Engine: build context & evaluate ──────────────────────────────
  const patientCtx = await buildPatientContext(patientId);

  timer.mark('patient_context');

  const fallbackCtx: import('../policies/types').PatientContext = {
    patientId,
    chronicDiseases: [],
    digestiveIssues: [],
    allergies: [],
    dietType: '',
    medications: '',
    mealsPerDay: 5,
    targetKcal: targets.targetKcal,
    targetProteinG: targets.targetProteinG,
    targetFatG: targets.targetFatG,
    targetCarbsG: targets.targetCarbsG,
    sex: '',
    weightKg: 0,
    heightCm: 0,
    ageYears: 0,
    goal: targets.goal ?? '',
  };

  const effectiveCtx = patientCtx ?? fallbackCtx;

  // Load rules from DB (with Redis cache), fallback to hardcoded
  const dbPolicyRules = await loadPolicyRules();
  const policyResult = evaluatePolicies(dbPolicyRules, effectiveCtx);

  timer.mark('policy_evaluation');

  // ── 3. Red Flags check ──────────────────────────────────────────────────────
  const redFlagResult = patientCtx ? await evaluateRedFlagsFromDb(patientCtx) : { triggered: false, flags: [], blockGeneration: false };

  if (redFlagResult.triggered) {
    for (const _flag of redFlagResult.flags) {
      logAudit({
        action: 'RED_FLAG_TRIGGERED',
        resourceType: 'DIET_PLAN',
        resourceId: patientId,
      });
    }
  }

  timer.mark('red_flags');

  // ── 4. Apply target modifications from policies ─────────────────────────────
  const adjustedTargets = applyTargetModifications(
    {
      targetKcal: targets.targetKcal,
      targetProteinG: targets.targetProteinG,
      targetFatG: targets.targetFatG,
      targetCarbsG: targets.targetCarbsG,
    },
    policyResult.targetModifications,
  );

  // ── 4b. Clinical safety check (Faza 83.1) — BLOCKS generation if CRITICAL ──
  if (patientCtx) {
    const safetyResult = runClinicalSafetyCheck(patientCtx, adjustedTargets);
    if (!safetyResult.safe) {
      const blockerDescs = safetyResult.blockers
        .filter((b) => b.severity === 'CRITICAL')
        .map((b) => `[${b.rule}] ${b.description}`)
        .join('; ');
      console.error(`[pipeline] SAFETY BLOCK for patient ${patientId}: ${blockerDescs}`);
      for (const blocker of safetyResult.blockers) {
        logAudit({
          action: 'PLAN_BLOCKED',
          resourceType: 'DIET_PLAN',
          resourceId: patientId,
          metadata: { rule: blocker.rule, severity: blocker.severity, description: blocker.description },
        });
      }
      throw new AppError(
        422,
        'CLINICAL_SAFETY_BLOCK',
        `Plan zablokowany ze względów bezpieczeństwa: ${blockerDescs}`,
      );
    }
    // Log HIGH-severity warnings (don't block, but audit)
    for (const blocker of safetyResult.blockers.filter((b) => b.severity === 'HIGH')) {
      logAudit({
        action: 'CLINICAL_SAFETY_WARNING',
        resourceType: 'DIET_PLAN',
        resourceId: patientId,
        metadata: { rule: blocker.rule, description: blocker.description },
      });
    }
  }

  const explanation = patientCtx
    ? buildPlanExplanation(patientCtx, policyResult, adjustedTargets, redFlagResult)
    : undefined;

  // 31.1.5 — Add deficit timeline warning to explanation
  const deficitBreakdown = (targets.breakdown as Record<string, unknown>)?.deficitBreakdown as
    { timelineRealistic?: boolean; note?: string | null } | undefined;
  if (explanation && deficitBreakdown?.note && !deficitBreakdown.timelineRealistic) {
    explanation.warnings.push(deficitBreakdown.note);
  }

  // Build rules snapshot for audit trail (Phase 27 — 27.1.6)
  const rulesSnapshot = dbPolicyRules
    .filter(r => policyResult.appliedRules.some(a => a.ruleId === r.id))
    .map(r => ({ ruleId: r.id, name: r.name, version: r.version ?? '1.0' }));

  // 28.5.1 — Build full patientContextSnapshot for audit trail
  const patientContextSnapshot = {
    capturedAt: triggeredAt.toISOString(),
    profile: {
      sex: effectiveCtx.sex,
      ageYears: effectiveCtx.ageYears,
      weightKg: effectiveCtx.weightKg,
      heightCm: effectiveCtx.heightCm,
      goal: effectiveCtx.goal,
    },
    healthData: {
      chronicDiseases: effectiveCtx.chronicDiseases,
      digestiveIssues: effectiveCtx.digestiveIssues,
      allergies: effectiveCtx.allergies,
      intolerances: effectiveCtx.intolerances,
      medications: effectiveCtx.medications,
      medicationsList: effectiveCtx.medicationsList,
      surgeryHistory: effectiveCtx.surgeryHistory,
      pregnancyStatus: effectiveCtx.pregnancyStatus,
      hormonalIssues: effectiveCtx.hormonalIssues,
      stage: effectiveCtx.stage,
    },
    activityData: {
      activityLevel: activityLevelRaw,
      activityTypes: effectiveCtx.activityTypes,
      workoutsPerWeek: effectiveCtx.workoutsPerWeek,
      workoutDurationMin: effectiveCtx.workoutDurationMin,
      tdeeMethod: targets.activityLevel,
      bmr: targets.bmr ? Number(targets.bmr) : null,
      tdee: targets.tdee ? Number(targets.tdee) : null,
      tdeeBreakdown: targets.breakdown,
    },
    preferencesData: {
      dietType: effectiveCtx.dietType,
      cuisinePreferences: effectiveCtx.cuisinePreferences,
      dislikedFoods: effectiveCtx.dislikedFoods,
      mealsPerDay: effectiveCtx.mealsPerDay,
      cookingTime: effectiveCtx.cookingTime,
      budget: effectiveCtx.budget,
      supplements: effectiveCtx.supplements,
      additionalNotes: effectiveCtx.additionalNotes,
      stressLevel: effectiveCtx.stressLevel,
      sleepHours: effectiveCtx.sleepHours,
      alcoholFrequency: effectiveCtx.alcoholFrequency,
      workType: effectiveCtx.workType,
      mealRhythm: effectiveCtx.mealRhythm,
    },
    targetsData: {
      kcal: adjustedTargets.targetKcal,
      proteinG: adjustedTargets.targetProteinG,
      fatG: adjustedTargets.targetFatG,
      carbsG: adjustedTargets.targetCarbsG,
      originalKcal: targets.targetKcal,
      deficitBreakdown: (targets.breakdown as Record<string, unknown>)?.deficitBreakdown ?? null,
    },
    generationMeta: {
      triggeredAt: triggeredAt.toISOString(),
      n8nWorkflow: isN8nConfigured() ? 'gen-diet-draft-01' : 'pipeline-fallback',
      activityLevelRaw,
      mainGoalRaw,
    },
  };

  const policyMetadata = {
    appliedRules: policyResult.appliedRules.map(r => ({ id: r.ruleId, name: r.ruleName })),
    redFlags: redFlagResult.flags.map(f => ({ id: f.flagId, name: f.name, severity: f.severity })),
    explanation,
    excludeKeywords: policyResult.excludeKeywords,
    rulesSnapshot,
    supplements: policyResult.supplements.length > 0
      ? policyResult.supplements.map(s => ({ name: s.name, dose: s.dose, reason: s.reason }))
      : undefined,
    conflicts: policyResult.conflicts.length > 0 ? policyResult.conflicts : undefined,
    // Protocol snapshot (28.3.4 → 30.3.3: uses merged protocol when available)
    protocolSnapshot: effectiveProtocol ? buildProtocolSnapshot(effectiveProtocol) : undefined,
    // 30.3.3: Auto-matched protocol details for audit trail
    matchedProtocols: effectiveMatchedProtocols.length > 0
      ? effectiveMatchedProtocols.map((m) => ({
          protocolId: m.protocolId,
          protocolName: m.protocolName,
          triggerField: m.interviewField,
          triggerValue: m.interviewValue,
          priority: m.priority,
          score: m.score,
        }))
      : undefined,
    mergedTargetOverrides: mergedProtocol
      ? {
          sourceProtocols: mergedProtocol.sourceProtocols,
          mergeExplanation: mergedProtocol.mergeExplanation,
        }
      : undefined,
    // Patient context snapshot (28.5)
    patientContextSnapshot,
    // Repair attempts tracked here (28.4.4)
    repairAttempts: [] as import('../services/aiGeneration.service').RepairAttempt[],
    // 31.3: Cooking time constraints for AI validation
    constraints: {
      maxCookingTimeMinutes: cookingTimeToMinutes(effectiveCtx.cookingTime),
    },
  };

  timer.mark('target_modifications');

  // ── 5. If CRITICAL red flag → create blocked plan, stop ─────────────────────
  if (redFlagResult.blockGeneration) {
    logAudit({
      action: 'GENERATION_BLOCKED',
      resourceType: 'DIET_PLAN',
      resourceId: patientId,
    });

    const blockedPlan = await prisma.dietPlan.create({
      data: {
        patientId,
        source: 'AI',
        status: 'MANUAL_REVIEW_REQUIRED',
        kcal: adjustedTargets.targetKcal,
        proteinG: adjustedTargets.targetProteinG,
        fatG: adjustedTargets.targetFatG,
        carbsG: adjustedTargets.targetCarbsG,
        aiProvider: 'pipeline',
        aiModel: 'blocked',
        content: encryptJson({ days: [], blocked: true, reason: 'Red flag triggered' }),
        templateId: effectiveProtocol?.id ?? null,
        policyMetadata: policyMetadata as unknown as import('@db').Prisma.InputJsonValue,
      },
    });

    timer.mark('blocked_plan_created');

    logAiUsage({
      patientId,
      dietPlanId: blockedPlan.id,
      triggeredAt,
      durationMs: timer.totalMs,
      source: 'fallback',
      cached: false,
      n8nTriggered: false, aiTriggered: false,
      blocked: true,
      validationStatus: 'NEEDS_REPAIR_AI',
      autoAdjusted: false,
      policyRulesCount: policyResult.appliedRules.length,
      redFlagsCount: redFlagResult.flags.length,
      redFlagSeverity: 'CRITICAL',
      stepTimings: timer.steps,
      success: true,
      aiProvider: 'pipeline',
      aiModel: 'blocked',
    });

    return {
      dietPlanId: blockedPlan.id,
      source: 'fallback',
      validationStatus: 'NEEDS_REPAIR_AI',
      cached: false,
      n8nTriggered: false, aiTriggered: false,
      blocked: true,
      appliedRules: policyResult.appliedRules.map(r => r.ruleId),
      redFlags: redFlagResult.flags.map(f => f.flagId),
    };
  }

  // ── 6. Segment ──────────────────────────────────────────────────────────────
  const segment = await segmentUser(patientId);
  if (!segment) return null;

  timer.mark('segmentation');

  // ── 7. Determine AI complexity (17.1.3) ─────────────────────────────────────
  const complexityLevel = determineComplexity(
    effectiveCtx.chronicDiseases,
    redFlagResult.flags.length,
    policyResult.appliedRules.length,
  );

  // ── 7b. Check DietTemplate cache (17.2) ───────────────────────────────────
  const cacheResult = await checkTemplateCache(segment, effectiveCtx.chronicDiseases);
  timer.mark('template_cache_check');

  if (cacheResult.decision !== 'MISS' && cacheResult.content) {
    const cacheSource: PipelineResult['source'] = cacheResult.decision === 'EXACT_HIT'
      ? 'cached_template'
      : 'cached_template_rescaled';

    // Apply keyword exclusions from policy engine
    let finalContent = cacheResult.content;
    if (policyResult.excludeKeywords.length > 0) {
      finalContent = filterExcludedItems(finalContent, policyResult.excludeKeywords);
    }

    const hasHighFlags = redFlagResult.triggered && redFlagResult.flags.some(f => f.severity === 'HIGH');
    const finalStatus = hasHighFlags ? 'MANUAL_REVIEW_REQUIRED' : 'GENERATED';

    const dietPlan = await prisma.dietPlan.create({
      data: {
        patientId,
        source: 'AI',
        status: finalStatus as import('@db').Prisma.DietPlanCreateInput['status'],
        kcal: adjustedTargets.targetKcal,
        proteinG: adjustedTargets.targetProteinG,
        fatG: adjustedTargets.targetFatG,
        carbsG: adjustedTargets.targetCarbsG,
        aiProvider: 'pipeline',
        aiModel: cacheSource,
        content: encryptJson(finalContent as Record<string, unknown>),
        templateId: effectiveProtocol?.id ?? null,
        policyMetadata: policyMetadata as unknown as import('@db').Prisma.InputJsonValue,
      },
    });

    await createRevision(dietPlan.id, finalContent as Record<string, unknown>, 'AI_GENERATED');
    const validationResult = await validatePlan(dietPlan.id);

    if (validationResult.status === 'NEEDS_ADJUST') {
      const adjusted = autoAdjustContent(finalContent, adjustedTargets.targetKcal);
      await prisma.dietPlan.update({
        where: { id: dietPlan.id },
        data: { content: encryptJson(adjusted as Record<string, unknown>) },
      });
      await createRevision(dietPlan.id, adjusted as Record<string, unknown>, 'AUTO_ADJUST');
      await validatePlan(dietPlan.id);
      autoAdjusted = true;
    }

    timer.mark('finalization');

    const maxSeverity = redFlagResult.flags.length > 0
      ? redFlagResult.flags.some(f => f.severity === 'HIGH') ? 'HIGH' : 'MODERATE'
      : undefined;

    logAiUsage({
      patientId,
      dietPlanId: dietPlan.id,
      triggeredAt,
      durationMs: timer.totalMs,
      source: cacheSource,
      cached: true,
      n8nTriggered: false, aiTriggered: false,
      blocked: false,
      validationStatus: validationResult.status,
      autoAdjusted,
      policyRulesCount: policyResult.appliedRules.length,
      redFlagsCount: redFlagResult.flags.length,
      redFlagSeverity: maxSeverity,
      stepTimings: timer.steps,
      success: true,
      aiProvider: 'pipeline',
      aiModel: cacheSource,
    });

    return {
      dietPlanId: dietPlan.id,
      source: cacheSource,
      validationStatus: validationResult.status,
      cached: true,
      n8nTriggered: false, aiTriggered: false,
      blocked: false,
      appliedRules: policyResult.appliedRules.map(r => r.ruleId),
      redFlags: redFlagResult.flags.map(f => f.flagId),
    };
  }

  // ── 7c. DB-first generation ────────────────────────────────────────────────
  // Check feature flag to determine if DB-first should be attempted
  const patientUser = await prisma.user.findFirst({
    where: { patient: { id: patientId } },
    select: { id: true, role: true },
  });
  const dbDietMode = await getDbDietMode(patientUser?.id, patientUser?.role);

  if (dbDietMode !== 'OFF') {
    const useDb = dbDietMode === 'AB_TEST' ? shouldUseDbInAbTest() : true;

    if (useDb) {
      try {
        timer.mark('db_assembly_start');

        // Build assembly input using already-computed policy data
        const dbConstraints = await buildDbPolicyConstraints(patientId);

        // P-1: Patient context for solver (sex / age / pregnancy / lactating).
        // Source of truth is `effectiveCtx` (already has sex normalized + ageYears
        // computed + pregnancyStatus mapped from interview answers).
        const sexNormalized: 'M' | 'F' | null =
          effectiveCtx.sex === 'male' ? 'M'
          : effectiveCtx.sex === 'female' ? 'F'
          : null;
        const isPregnant = effectiveCtx.pregnancyStatus === 'pregnant';
        const isBreastfeeding = effectiveCtx.pregnancyStatus === 'breastfeeding';

        const assemblyInput: AssemblyInput = mergeConstraintsIntoInput({
          patientId,
          dietitianId: patientForProtocol?.dietitianId ?? undefined, // 76a: per-dietitian scoring weights
          days: 7,
          maxCookingTimeMinutes: effectiveCtx.cookingTime
            ? cookingTimeToMinutes(effectiveCtx.cookingTime)
            : undefined,
          maxCost: effectiveCtx.budget as 'BUDGET' | 'STANDARD' | 'PREMIUM' | undefined,
          // IW-5: map mainMealAt to meal-prep preference
          preferMealPrep: effectiveCtx.mainMealAt === 'work',
          // P-1: solver patient context. Trimester is unknown from current
          // interview shape — when pregnant, default to 2 (middle/most-common
          // intake reference). Refine when an explicit trimester field exists.
          sex: sexNormalized,
          ageYears: effectiveCtx.ageYears > 0 ? effectiveCtx.ageYears : null,
          pregnancyTrimester: isPregnant ? 2 : null,
          lactating: isBreastfeeding,
          // Faza D Phase 2 prep: per-patient compose-meals gating via the
          // env-based allowlist. Resolves to true when EITHER the global
          // env flag is on OR this patientId is in COMPOSE_MEALS_PATIENT_IDS.
          composeMeals: isComposeMealsEnabledFor(patientId),
        }, dbConstraints);

        // ── Solver path (DB_SOLVER mode) ──────────────────────────────────
        let solverMeta: {
          status: string;
          objectiveValue: number;
          variables: number;
          constraints: number;
          durationMs: number;
          // Faza D Phase 2 prep — compose-mode signals for /admin/solver-stats
          composeMeals: boolean;
          composeSlotsCount: number;
          multiItemSlotCount: number;
          // Faza D D1 (revisited): cuisine soft-constraint telemetry. Both null
          // when patient cuisinePreferences are inactive (empty / "any") so
          // SC22 was disabled in the solver. Surfaced in /admin/solver-stats
          // and per-plan dietitian view.
          cuisineMatchCount: number | null;
          cuisineMainTotal: number | null;
        } | null = null;

        if (dbDietMode === 'DB_SOLVER') {
          try {
            timer.mark('solver_start');
            const solverResult = await solveWeekPlan(assemblyInput);
            timer.mark('solver_end');

            // Count slots with ≥2 items — proxy for "compose mode actually fired".
            // Pre-Faza-D and compose-meals=false plans: every selection list has
            // exactly 1 item, so this counter stays 0 and the dashboard can
            // distinguish legacy from compose-active runs.
            let multiItemSlotCount = 0;
            for (const items of solverResult.selections.values()) {
              if (items.length >= 2) multiItemSlotCount++;
            }

            solverMeta = {
              status: solverResult.status,
              objectiveValue: solverResult.objectiveValue,
              variables: solverResult.totalVariables,
              constraints: solverResult.totalConstraints,
              durationMs: solverResult.durationMs,
              composeMeals: assemblyInput.composeMeals === true,
              composeSlotsCount: solverResult.composeSlotsCount ?? 0,
              multiItemSlotCount,
              cuisineMatchCount: solverResult.cuisineMatchCount ?? null,
              cuisineMainTotal: solverResult.cuisineMainTotal ?? null,
            };

            if (solverResult.status === 'OPTIMAL' || solverResult.status === 'FEASIBLE') {
              console.log(`[pipeline] Solver ${solverResult.status}: score=${solverResult.objectiveValue}, ${solverResult.totalVariables} vars, ${solverResult.durationMs}ms — using solver plan`);
              // Use solver plan instead of greedy
              const solverAssembly = await assembleSolverPlan(solverResult, assemblyInput);
              // Merge solver timing into assembly
              solverAssembly.durationMs += solverResult.durationMs;

              // Continue with solver assembly instead of greedy — replace assembly variable
              // by reassigning and skipping greedy below
              const assembly = solverAssembly;
              timer.mark('db_assembly_end');

              const coveragePct = assembly.coverage.filledFromDbPct;
              if (coveragePct >= 80 || dbDietMode === 'DB_SOLVER') {
                const { macros, portionsRounded } = await postProcessPlan(assembly.plan);
                const hasHighFlagsDb = redFlagResult.triggered && redFlagResult.flags.some(f => f.severity === 'HIGH');
                const finalStatus = hasHighFlagsDb ? 'MANUAL_REVIEW_REQUIRED' : 'GENERATED';

                const aiProcessingReport = {
                  receivedAt: new Date().toISOString(),
                  aiProvider: 'database_solver',
                  aiModel: 'mip-solver',
                  issues: [] as Array<{ type: string; count: number; details: string[] }>,
                  autoAdjusted: false,
                  recipesExtracted: assembly.recipeIds.length,
                  recipesGenerated: 0,
                  validationStatus: finalStatus,
                  productStandardization: { totalItems: assembly.recipeIds.length * 8, matched: assembly.recipeIds.length * 8, unmatched: 0, unmatchedNames: [] },
                };

                const dbPlan = await prisma.dietPlan.create({
                  data: {
                    patientId,
                    source: 'AI',
                    status: finalStatus as import('@db').Prisma.DietPlanCreateInput['status'],
                    content: encryptJson(assembly.plan as Record<string, unknown>),
                    kcal: macros.kcal,
                    proteinG: macros.proteinG,
                    fatG: macros.fatG,
                    carbsG: macros.carbsG,
                    aiModel: 'mip-solver',
                    policyMetadata: JSON.parse(JSON.stringify({
                      ...policyMetadata,
                      generationMethod: 'database_solver',
                      coverageReport: assembly.coverage,
                      recipeIds: assembly.recipeIds,
                      slotDecisions: assembly.slotDecisions,
                      inputHash: computeInputHash(assemblyInput, assembly.recipeIds),
                      solverReport: solverMeta,
                      portionsRounded,
                      dbDurationMs: assembly.durationMs,
                      aiProcessingReport,
                    })) as import('@db').Prisma.InputJsonValue,
                  },
                });

                await createRevision(dbPlan.id, assembly.plan as Record<string, unknown>, 'AI_GENERATED');

                // Soft validations
                try {
                  const qualityResult = await runSoftValidations(assembly.plan, assembly.coverage);
                  await prisma.dietPlan.update({
                    where: { id: dbPlan.id },
                    data: {
                      policyMetadata: JSON.parse(JSON.stringify({
                        ...(dbPlan.policyMetadata as Record<string, unknown>),
                        planQuality: { grade: qualityResult.grade, score: qualityResult.score, softValidations: qualityResult.softValidations, weeklyMetrics: qualityResult.weeklyMetrics },
                      })) as import('@db').Prisma.InputJsonValue,
                    },
                  });
                } catch { /* non-blocking */ }

                const validation = await validatePlan(dbPlan.id);

                logAudit({ userId: patientUser?.id, action: 'GENERATE_PLAN', resourceType: 'DIET_PLAN', resourceId: dbPlan.id,
                  metadata: { source: 'database_solver', coveragePct: Math.round(coveragePct), durationMs: assembly.durationMs, solverStatus: solverResult.status },
                });

                logAiUsage({ patientId, dietPlanId: dbPlan.id, triggeredAt, durationMs: timer.totalMs, source: 'database', cached: false, n8nTriggered: false, aiTriggered: false, blocked: false,
                  autoAdjusted: validation.status === 'NEEDS_ADJUST', policyRulesCount: policyResult.appliedRules.length, redFlagsCount: redFlagResult.flags.length,
                  stepTimings: timer.steps, success: true, aiModel: 'mip-solver', promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0,
                });

                return {
                  dietPlanId: dbPlan.id,
                  source: 'fallback' as PipelineResult['source'],
                  validationStatus: validation.status,
                  cached: false, n8nTriggered: false, aiTriggered: false, blocked: false,
                  appliedRules: policyResult.appliedRules.map(r => r.ruleId),
                  redFlags: redFlagResult.flags.map(f => f.flagId),
                  generationMethod: 'database_solver',
                  coveragePct: Math.round(coveragePct),
                };
              }
              // Coverage too low — fall through to greedy
            } else {
              console.log(`[pipeline] Solver ${solverResult.status}, falling back to greedy (${solverResult.durationMs}ms)`);
              const reasons = solverResult.infeasibilityReasons ?? [];
              if (reasons.length > 0) {
                for (const r of reasons) {
                  console.log(`  [pipeline] reason: [${r.severity}] ${r.constraint} — ${r.description} → ${r.suggestion}`);
                }
              } else {
                console.log('  [pipeline] (no infeasibility reasons returned — check solver stdout)');
              }
            }
          } catch (err) {
            console.warn('[pipeline] Solver failed, falling back to greedy:', (err as Error).message);
          }
        }

        const assembly = await assembleDbPlan(assemblyInput);
        timer.mark('db_assembly_end');

        const coveragePct = assembly.coverage.filledFromDbPct;
        const MIN_COVERAGE = 80;

        if (coveragePct >= MIN_COVERAGE || dbDietMode === 'DB_ONLY') {
          // ── DB plan is sufficient — finalize and return immediately ──
          const { macros, portionsRounded } = await postProcessPlan(assembly.plan);

          const hasHighFlagsDb = redFlagResult.triggered && redFlagResult.flags.some(f => f.severity === 'HIGH');
          const finalStatus = hasHighFlagsDb ? 'MANUAL_REVIEW_REQUIRED' : 'GENERATED';

          // Build processing report (same structure as AI report — for dietitian UI)
          const kcalDevPct = adjustedTargets
            ? Math.abs(macros.kcal - adjustedTargets.targetKcal) / adjustedTargets.targetKcal * 100
            : 0;
          const proteinDevPct = adjustedTargets
            ? Math.abs(macros.proteinG - adjustedTargets.targetProteinG) / adjustedTargets.targetProteinG * 100
            : 0;
          const fatDevPct = adjustedTargets
            ? Math.abs(macros.fatG - adjustedTargets.targetFatG) / adjustedTargets.targetFatG * 100
            : 0;
          const carbsDevPct = adjustedTargets
            ? Math.abs(macros.carbsG - adjustedTargets.targetCarbsG) / adjustedTargets.targetCarbsG * 100
            : 0;

          const dbIssues: Array<{ type: string; count: number; details: string[] }> = [];
          if (kcalDevPct > 10) {
            dbIssues.push({
              type: 'KCAL_DEVIATION',
              count: 1,
              details: [`Średnie kcal: ${macros.kcal} (target: ${adjustedTargets?.targetKcal ?? '?'}), odchylenie: ${kcalDevPct.toFixed(1)}%`],
            });
          }
          if (proteinDevPct > 15) {
            dbIssues.push({
              type: 'MACRO_DEVIATION',
              count: 1,
              details: [`Białko: ${macros.proteinG}g (target: ${adjustedTargets?.targetProteinG ?? '?'}g), odchylenie: ${proteinDevPct.toFixed(1)}%`],
            });
          }
          if (fatDevPct > 15) {
            dbIssues.push({
              type: 'MACRO_DEVIATION',
              count: 1,
              details: [`Tłuszcze: ${macros.fatG}g (target: ${adjustedTargets?.targetFatG ?? '?'}g), odchylenie: ${fatDevPct.toFixed(1)}%`],
            });
          }
          if (carbsDevPct > 15) {
            dbIssues.push({
              type: 'MACRO_DEVIATION',
              count: 1,
              details: [`Węglowodany: ${macros.carbsG}g (target: ${adjustedTargets?.targetCarbsG ?? '?'}g), odchylenie: ${carbsDevPct.toFixed(1)}%`],
            });
          }

          const aiProcessingReport = {
            receivedAt: new Date().toISOString(),
            aiProvider: 'database',
            aiModel: 'recipe-db',
            issues: dbIssues,
            autoAdjusted: false,
            recipesExtracted: assembly.recipeIds.length,
            recipesGenerated: 0,
            validationStatus: finalStatus,
            productStandardization: {
              totalItems: assembly.recipeIds.length * 8, // approximate
              matched: assembly.recipeIds.length * 8,
              unmatched: 0,
              unmatchedNames: [],
            },
          };

          const dbPlan = await prisma.dietPlan.create({
            data: {
              patientId,
              source: 'AI',
              status: finalStatus as import('@db').Prisma.DietPlanCreateInput['status'],
              content: encryptJson(assembly.plan as Record<string, unknown>),
              kcal: macros.kcal,
              proteinG: macros.proteinG,
              fatG: macros.fatG,
              carbsG: macros.carbsG,
              aiModel: 'database',
              policyMetadata: JSON.parse(JSON.stringify({
                ...policyMetadata,
                generationMethod: dbDietMode === 'DB_SOLVER' ? 'database_solver' : 'database',
                coverageReport: assembly.coverage,
                recipeIds: assembly.recipeIds,
                slotDecisions: assembly.slotDecisions,
                inputHash: computeInputHash(assemblyInput, assembly.recipeIds),
                ...(solverMeta ? { solverReport: solverMeta } : {}),
                portionsRounded,
                dbDurationMs: assembly.durationMs,
                aiProcessingReport,
              })) as import('@db').Prisma.InputJsonValue,
            },
          });

          // Create revision
          await createRevision(dbPlan.id, assembly.plan as Record<string, unknown>, 'AI_GENERATED');

          // Run soft validations (Faza 74) — non-blocking quality assessment
          try {
            const qualityResult = await runSoftValidations(assembly.plan, assembly.coverage);
            await prisma.dietPlan.update({
              where: { id: dbPlan.id },
              data: {
                policyMetadata: JSON.parse(JSON.stringify({
                  ...(dbPlan.policyMetadata as Record<string, unknown>),
                  planQuality: {
                    grade: qualityResult.grade,
                    score: qualityResult.score,
                    softValidations: qualityResult.softValidations,
                    weeklyMetrics: qualityResult.weeklyMetrics,
                  },
                })) as import('@db').Prisma.InputJsonValue,
              },
            });
          } catch (err) {
            console.warn('[pipeline] Soft validation failed (non-blocking):', (err as Error).message);
          }

          // Validate
          const validation = await validatePlan(dbPlan.id);
          if (validation.status === 'NEEDS_ADJUST' && adjustedTargets) {
            const adjusted = autoAdjustContent(assembly.plan, adjustedTargets.targetKcal);
            await prisma.dietPlan.update({
              where: { id: dbPlan.id },
              data: { content: encryptJson(adjusted as Record<string, unknown>) },
            });
          }

          // Audit
          logAudit({
            userId: patientUser?.id,
            action: 'GENERATE_PLAN',
            resourceType: 'DIET_PLAN',
            resourceId: dbPlan.id,
            metadata: {
              source: 'database',
              coveragePct: Math.round(coveragePct),
              durationMs: assembly.durationMs,
              appliedRules: policyMetadata.appliedRules,
            },
          });

          // Usage log
          logAiUsage({
            patientId,
            dietPlanId: dbPlan.id,
            triggeredAt,
            durationMs: timer.totalMs,
            source: 'database',
            cached: false,
            n8nTriggered: false,
            aiTriggered: false,
            blocked: false,
            autoAdjusted: validation.status === 'NEEDS_ADJUST',
            policyRulesCount: policyResult.appliedRules.length,
            redFlagsCount: redFlagResult.flags.length,
            stepTimings: timer.steps,
            success: true,
            aiModel: 'database',
            promptTokens: 0,
            completionTokens: 0,
            estimatedCostUsd: 0,
          });

          return {
            dietPlanId: dbPlan.id,
            source: 'fallback' as PipelineResult['source'],
            validationStatus: validation.status,
            cached: false,
            n8nTriggered: false,
            aiTriggered: false,
            blocked: false,
            appliedRules: policyResult.appliedRules.map(r => r.ruleId),
            redFlags: redFlagResult.flags.map(f => f.flagId),
            generationMethod: dbDietMode === 'DB_SOLVER' ? 'database_solver' : 'database',
            coveragePct: Math.round(coveragePct),
          };
        }

        // ── Coverage too low in DB_FIRST mode → fall through to AI ──
        if (dbDietMode === 'DB_FIRST') {
          console.log(`[pipeline] DB coverage ${coveragePct.toFixed(1)}% < ${MIN_COVERAGE}%, falling back to AI`);
          // Fall through to AI path below
        }
      } catch (err) {
        console.warn('[pipeline] DB-first generation failed, falling back to AI:', (err as Error).message);
        // Fall through to AI path below
      }
    }
  }

  // ── 8. AI-FIRST: Try n8n as primary source (17.1.1) ────────────────────────
  if (isN8nConfigured()) {
    // Create minimal AI_DRAFT plan in DB (n8n callback will fill content)
    const skipBreakfast = effectiveCtx.mealRhythm?.firstMealTime === 'skip';
    const placeholderContent = buildFallbackPlan(adjustedTargets.targetKcal, segment.mealCount, skipBreakfast);

    const dietPlan = await prisma.dietPlan.create({
      data: {
        patientId,
        source: 'AI',
        status: 'AI_DRAFT',
        kcal: adjustedTargets.targetKcal,
        proteinG: adjustedTargets.targetProteinG,
        fatG: adjustedTargets.targetFatG,
        carbsG: adjustedTargets.targetCarbsG,
        aiProvider: 'n8n',
        aiModel: 'pending',
        content: encryptJson(placeholderContent as Record<string, unknown>),
        templateId: effectiveProtocol?.id ?? null,
        policyMetadata: policyMetadata as unknown as import('@db').Prisma.InputJsonValue,
      },
    });

    timer.mark('draft_plan_saved');

    await createRevision(dietPlan.id, placeholderContent as Record<string, unknown>, 'AI_GENERATED');

    // Build anonymized profile (17.5)
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { sex: true, heightCm: true, weightKg: true, birthYear: true, birthDate: true },
    });

    // Recipe variant addons removed in 29.1 cleanup (THERMOMIX/AIRFRYER no longer offered)
    const requestedVariants: ('THERMOMIX' | 'AIRFRYER')[] = [];

    // Fetch highly rated recipe names for AI prompt (37.5.11)
    const highlyRatedNames = await getHighlyRatedRecipeNames().catch(() => [] as string[]);

    // Fetch dish names from previous plan to avoid repeating on regeneration
    let previousDishNames: string[] = [];
    try {
      const prevPlan = await prisma.dietPlan.findFirst({
        where: {
          patientId,
          status: { in: ['GENERATED', 'REVIEWED', 'PUBLISHED', 'SENT', 'MANUAL_REVIEW_REQUIRED'] },
          id: { not: dietPlan.id },
        },
        orderBy: { createdAt: 'desc' },
        select: { content: true },
      });
      if (prevPlan?.content) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prevContent = decryptJson(prevPlan.content as string) as any;
        if (prevContent?.days) {
          for (const day of prevContent.days) {
            for (const meal of day.meals ?? []) {
              // Collect meal NAMES (dish names), not ingredient items
              const mealName = meal.name;
              if (mealName && !/do uzupełnienia|breakfast|lunch|dinner|snack/i.test(mealName)) {
                previousDishNames.push(mealName);
              }
              // Also collect first item name as dish name (more specific)
              const firstItem = meal.items?.[0];
              const dishName = typeof firstItem === 'string' ? firstItem : firstItem?.name;
              if (dishName && !/do uzupełnienia|Posiłek/i.test(dishName) && !previousDishNames.includes(dishName)) {
                previousDishNames.push(dishName);
              }
            }
          }
          // Limit to max 40 to not overwhelm AI
          if (previousDishNames.length > 40) {
            previousDishNames = previousDishNames.slice(0, 40);
          }
        }
      }
    } catch {
      // Previous plan lookup is optional
    }
    if (previousDishNames.length > 0) {
      console.log(`[pipeline] Excluding ${previousDishNames.length} dishes from previous plan`);
    }

    // Intelligent 4-layer product selection (replaces old getCanonicalNamesGrouped)
    let personalizedProducts: PersonalizedProductList | null = null;
    let canonicalProductsGrouped: Record<string, string[]> = {};
    try {
      // Try to get micronutrient report for health-driven products
      let microReport = null;
      try {
        const prevPlan = await prisma.dietPlan.findFirst({
          where: { patientId, status: { in: ['GENERATED', 'REVIEWED', 'PUBLISHED', 'SENT'] } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, content: true },
        });
        if (prevPlan?.content) {
          const planContent = decryptJson(prevPlan.content as string);
          const pAge = patient?.birthDate
            ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : patient?.birthYear
              ? new Date().getFullYear() - patient.birthYear
              : null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          microReport = await analyzePlanMicronutrients(planContent as any, patient?.sex ?? null, pAge);
        }
      } catch {
        // Micronutrient data is optional
      }

      personalizedProducts = await getPersonalizedProducts({
        patientId,
        policyResult,
        micronutrientReport: microReport,
        preferences: {
          dietType: segment.dietType,
          allergies: segment.allergies,
          preferredFoods: effectiveCtx.preferredFoods,
          preferredFoodsOther: effectiveCtx.preferredFoodsOther,
          dislikedFoods: effectiveCtx.dislikedFoods,
          dislikedFoodsOther: effectiveCtx.dislikedFoodsOther,
          budget: effectiveCtx.budget,
        },
      });
      canonicalProductsGrouped = personalizedProducts.categories;

      // Enrich product names with portion info (e.g. "Jajko kurze" → "Jajko kurze (1szt=60g)")
      try {
        const allNames = Object.values(canonicalProductsGrouped).flat();
        if (allNames.length > 0) {
          const products = await prisma.cleanProduct.findMany({
            where: { name: { in: allNames } },
            select: {
              name: true,
              portions: {
                where: { portionName: { in: ['Sztuka', 'Kromka'] } },
                select: { portionName: true, weightG: true },
              },
            },
          });
          const portionMap = new Map<string, string>();
          for (const p of products) {
            if (p.portions.length === 0) continue;
            // Prefer Kromka over Sztuka (bread slice vs whole loaf)
            const kromka = p.portions.find(por => por.portionName === 'Kromka');
            const best = kromka ?? p.portions[0];
            const label = best.portionName === 'Kromka' ? 'kromka' : 'szt';
            portionMap.set(p.name, `(1${label}=${Number(best.weightG)}g)`);
          }
          if (portionMap.size > 0) {
            for (const [cat, names] of Object.entries(canonicalProductsGrouped)) {
              canonicalProductsGrouped[cat] = names.map(n => {
                const suffix = portionMap.get(n);
                return suffix ? `${n} ${suffix}` : n;
              });
            }
            console.log(`[pipeline] Enriched ${portionMap.size} products with portion info`);
          }
        }
      } catch (err) {
        console.warn('[pipeline] Failed to enrich products with portions:', err instanceof Error ? err.message : err);
      }

      if (personalizedProducts.warnings.length > 0) {
        for (const warn of personalizedProducts.warnings) {
          console.warn(warn);
        }
      }
    } catch (err) {
      console.error('[pipeline] Personalized product selection failed, falling back to basic:', err instanceof Error ? err.message : err);
      // Fallback to old method
      canonicalProductsGrouped = await getCanonicalNamesGrouped({
        dietType: segment.dietType,
        allergies: segment.allergies,
        excludeKeywords: policyResult.excludeKeywords,
      }).catch(() => ({} as Record<string, string[]>));
    }
    const totalProducts = Object.values(canonicalProductsGrouped).reduce((s, arr) => s + arr.length, 0);
    console.log(`[pipeline] Canonical products: ${totalProducts} in ${Object.keys(canonicalProductsGrouped).length} categories`);

    let ageYears: number | null = null;
    if (patient?.birthDate) {
      ageYears = Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    } else if (patient?.birthYear) {
      ageYears = new Date().getFullYear() - patient.birthYear;
    }

    // Trigger n8n with full policy context
    const triggered = await triggerN8nWorkflow({
      dietPlanId: dietPlan.id,
      complexityLevel,
      nutritionTargets: {
        kcal: adjustedTargets.targetKcal,
        proteinG: adjustedTargets.targetProteinG,
        fatG: adjustedTargets.targetFatG,
        carbsG: adjustedTargets.targetCarbsG,
      },
      segment: {
        goal: segment.goal,
        kcalBucket: segment.kcalBucket,
        mealCount: segment.mealCount,
        dietType: segment.dietType,
        allergies: segment.allergies,
      },
      anonymizedProfile: {
        sex: patient?.sex ?? null,
        heightCm: patient?.heightCm ? Number(patient.heightCm) : null,
        weightKg: patient?.weightKg ? Number(patient.weightKg) : null,
        ageYears,
        goal: effectiveCtx.goal ?? null,
      },
      policyContext: {
        excludeKeywords: policyResult.excludeKeywords,
        clinicalNotes: policyResult.clinicalNotes.map(n => n.note),
        nutrientLimits: policyResult.nutrientLimits.map(l => ({
          nutrient: l.nutrient,
          scope: l.scope,
          min: l.min,
          max: l.max,
        })),
        appliedRuleNames: policyResult.appliedRules.map(r => r.ruleName),
      },
      preferences: {
        mealsPerDay: effectiveCtx.mealsPerDay,
        dietType: effectiveCtx.dietType,
        activityLevel: activityLevelRaw,
        mainGoal: mainGoalRaw,
        cuisinePreferences: effectiveCtx.cuisinePreferences,
        dislikedFoods: effectiveCtx.dislikedFoods,
        preferredFoods: effectiveCtx.preferredFoods,
        cookingTime: effectiveCtx.cookingTime,
        budget: effectiveCtx.budget,
        additionalNotes: effectiveCtx.additionalNotes,
        supplements: effectiveCtx.supplements,
        activityTypes: effectiveCtx.activityTypes,
        stressLevel: effectiveCtx.stressLevel,
        sleepHours: effectiveCtx.sleepHours,
        // 31.6.1: new lifestyle preferences
        alcoholFrequency: effectiveCtx.alcoholFrequency,
        workType: effectiveCtx.workType,
        intolerances: effectiveCtx.intolerances,
        mealRhythm: effectiveCtx.mealRhythm,
      },
      constraints: {
        maxCookingTimeMinutes: cookingTimeToMinutes(effectiveCtx.cookingTime),
        preferredCuisines: effectiveCtx.cuisinePreferences,
        mealSchedule: computeMealSchedule({
          mealsPerDay: effectiveCtx.mealsPerDay,
          firstMealTime: effectiveCtx.mealRhythm?.firstMealTime,
          lastMealTime: effectiveCtx.mealRhythm?.lastMealTime,
        }),
      },
      requestedVariants: requestedVariants.length > 0 ? requestedVariants : undefined,
      canonicalProductsGrouped: Object.keys(canonicalProductsGrouped).length > 0 ? canonicalProductsGrouped : undefined,
      highlyRatedRecipeNames: highlyRatedNames.length > 0 ? highlyRatedNames : undefined,
      healthProducts: personalizedProducts?.health?.length
        ? personalizedProducts.health.map(h => ({ name: h.name, reason: h.reason, category: h.category }))
        : undefined,
      dislikedProducts: personalizedProducts?.disliked?.length
        ? personalizedProducts.disliked
        : undefined,
      previousDishNames: previousDishNames.length > 0 ? previousDishNames : undefined,
    }).catch((err) => {
      console.error('[pipeline] n8n trigger failed:', err instanceof Error ? err.message : err);
      return false;
    });

    timer.mark('n8n_trigger');

    // If n8n trigger failed → run fallback path inline
    if (!triggered) {
      console.warn(`[pipeline] n8n trigger failed for plan ${dietPlan.id}. Running fallback...`);
      return runFallbackPath(
        dietPlan.id, patientId, segment, adjustedTargets, policyResult, policyMetadata,
        redFlagResult, timer, triggeredAt, effectiveCtx.chronicDiseases,
        cookingTimeToMinutes(effectiveCtx.cookingTime),
        effectiveCtx.cuisinePreferences,
        effectiveCtx.mealRhythm?.firstMealTime === 'skip',
      );
    }

    // Mark HIGH flag plans
    const hasHighFlags = redFlagResult.triggered && redFlagResult.flags.some(f => f.severity === 'HIGH');
    if (hasHighFlags) {
      await prisma.dietPlan.update({
        where: { id: dietPlan.id },
        data: { status: 'MANUAL_REVIEW_REQUIRED' },
      });
    }

    timer.mark('finalization');

    const maxSeverity = redFlagResult.flags.length > 0
      ? redFlagResult.flags.some(f => f.severity === 'HIGH') ? 'HIGH' : 'MODERATE'
      : undefined;

    logAiUsage({
      patientId,
      dietPlanId: dietPlan.id,
      triggeredAt,
      durationMs: timer.totalMs,
      source: 'fallback',
      cached: false,
      n8nTriggered: true, aiTriggered: true,
      blocked: false,
      validationStatus: 'PENDING',
      autoAdjusted: false,
      policyRulesCount: policyResult.appliedRules.length,
      redFlagsCount: redFlagResult.flags.length,
      redFlagSeverity: maxSeverity,
      stepTimings: timer.steps,
      success: true,
      aiProvider: 'n8n',
      aiModel: 'pending',
    });

    return {
      dietPlanId: dietPlan.id,
      source: 'fallback', // placeholder until n8n callback
      validationStatus: 'PENDING',
      cached: false,
      n8nTriggered: true, aiTriggered: true,
      blocked: false,
      appliedRules: policyResult.appliedRules.map(r => r.ruleId),
      redFlags: redFlagResult.flags.map(f => f.flagId),
    };
  }

  // ── 9. FALLBACK PATH: n8n not configured (17.1.4) ─────────────────────────
  return runFallbackPathFromScratch(
    patientId, segment, adjustedTargets, policyResult, policyMetadata,
    redFlagResult, timer, triggeredAt, effectiveCtx.chronicDiseases,
    cookingTimeToMinutes(effectiveCtx.cookingTime),
    effectiveCtx.cuisinePreferences,
    effectiveCtx.mealRhythm?.firstMealTime === 'skip',
  );
}

// ─── Fallback: update existing AI_DRAFT plan after n8n trigger failure ───────

async function runFallbackPath(
  dietPlanId: string,
  patientId: string,
  segment: UserSegment,
  adjustedTargets: { targetKcal: number; targetProteinG: number; targetFatG: number; targetCarbsG: number },
  policyResult: ReturnType<typeof evaluatePolicies>,
  policyMetadata: Record<string, unknown>,
  redFlagResult: { triggered: boolean; flags: Array<{ flagId: string; severity: string }>; blockGeneration: boolean },
  timer: PipelineTimer,
  triggeredAt: Date,
  diseases: string[] = [],
  maxCookingTimeMinutes?: number,
  preferredCuisines?: string[],
  skipBreakfast = false,
): Promise<PipelineResult> {
  let autoAdjusted = false;

  // Build content from fallback sources
  const { content, source } = await buildFallbackContent(segment, adjustedTargets.targetKcal, policyResult, maxCookingTimeMinutes, preferredCuisines, skipBreakfast);

  // Update the existing plan with real content
  await prisma.dietPlan.update({
    where: { id: dietPlanId },
    data: {
      content: encryptJson(content as Record<string, unknown>),
      aiProvider: 'pipeline',
      aiModel: source,
    },
  });

  await createRevision(dietPlanId, content as Record<string, unknown>, 'AI_GENERATED');

  timer.mark('content_building');

  const validationResult = await validatePlan(dietPlanId);

  timer.mark('validation');

  if (validationResult.status === 'NEEDS_ADJUST') {
    const adjusted = autoAdjustContent(content, adjustedTargets.targetKcal);
    await prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: { content: encryptJson(adjusted as Record<string, unknown>) },
    });
    await createRevision(dietPlanId, adjusted as Record<string, unknown>, 'AUTO_ADJUST');
    await validatePlan(dietPlanId);
    autoAdjusted = true;
  }

  // Finalize status
  const hasHighFlags = redFlagResult.triggered && redFlagResult.flags.some(f => f.severity === 'HIGH');
  const finalStatus = hasHighFlags ? 'MANUAL_REVIEW_REQUIRED' : 'GENERATED';
  await prisma.dietPlan.update({
    where: { id: dietPlanId },
    data: { status: finalStatus },
  });

  // Save as reusable template (17.2) — fire-and-forget
  if (source !== 'fallback' && validationResult.status === 'VALID') {
    saveAsTemplate({
      dietPlanId,
      content,
      segment,
      diseases,
      kcal: adjustedTargets.targetKcal,
      proteinG: adjustedTargets.targetProteinG,
      fatG: adjustedTargets.targetFatG,
      carbsG: adjustedTargets.targetCarbsG,
      aiModel: source,
    }).catch((err) => console.error('[pipeline] Template save failed:', err instanceof Error ? err.message : err));
  }

  // Extract and save recipes (17.3.5) — fire-and-forget
  saveRecipesFromPlan(content, dietPlanId)
    .catch((err) => console.error('[pipeline] Recipe extraction failed:', err instanceof Error ? err.message : err));

  timer.mark('finalization');

  const maxSeverity = redFlagResult.flags.length > 0
    ? redFlagResult.flags.some(f => f.severity === 'HIGH') ? 'HIGH' : 'MODERATE'
    : undefined;

  logAiUsage({
    patientId,
    dietPlanId,
    triggeredAt,
    durationMs: timer.totalMs,
    source,
    cached: false,
    n8nTriggered: false, aiTriggered: false,
    blocked: false,
    validationStatus: validationResult.status,
    autoAdjusted,
    policyRulesCount: policyResult.appliedRules.length,
    redFlagsCount: redFlagResult.flags.length,
    redFlagSeverity: maxSeverity,
    stepTimings: timer.steps,
    success: true,
    aiProvider: 'pipeline',
    aiModel: source,
  });

  return {
    dietPlanId,
    source,
    validationStatus: validationResult.status,
    cached: false,
    n8nTriggered: false, aiTriggered: false,
    blocked: false,
    appliedRules: policyResult.appliedRules.map(r => r.ruleId),
    redFlags: redFlagResult.flags.map(f => f.flagId),
  };
}

// ─── Fallback: create new plan when n8n is not configured at all ─────────────

async function runFallbackPathFromScratch(
  patientId: string,
  segment: UserSegment,
  adjustedTargets: { targetKcal: number; targetProteinG: number; targetFatG: number; targetCarbsG: number },
  policyResult: ReturnType<typeof evaluatePolicies>,
  policyMetadata: Record<string, unknown>,
  redFlagResult: { triggered: boolean; flags: Array<{ flagId: string; severity: string }>; blockGeneration: boolean },
  timer: PipelineTimer,
  triggeredAt: Date,
  diseases: string[] = [],
  maxCookingTimeMinutes?: number,
  preferredCuisines?: string[],
  skipBreakfast = false,
): Promise<PipelineResult> {
  let autoAdjusted = false;

  // Cache check
  const matchKey = buildPlanMatchCacheKey(
    segment.goal,
    segment.kcalBucket,
    segment.mealCount,
    segment.dietType,
  );

  const cachedContent = await getCachedPlan<PlanContent>(matchKey);
  let content: PlanContent;
  let source: PipelineResult['source'];
  let fromCache = false;

  timer.mark('cache_check');

  if (cachedContent) {
    content = cachedContent;
    source = (cachedContent.generatedFrom as PipelineResult['source']) ?? 'template';
    fromCache = true;
  } else {
    const result = await buildFallbackContent(segment, adjustedTargets.targetKcal, policyResult, maxCookingTimeMinutes, preferredCuisines, skipBreakfast);
    content = result.content;
    source = result.source;
  }

  timer.mark('content_building');

  // Create plan
  const dietPlan = await prisma.dietPlan.create({
    data: {
      patientId,
      source: 'AI',
      status: 'AI_DRAFT',
      kcal: adjustedTargets.targetKcal,
      proteinG: adjustedTargets.targetProteinG,
      fatG: adjustedTargets.targetFatG,
      carbsG: adjustedTargets.targetCarbsG,
      aiProvider: 'pipeline',
      aiModel: source,
      content: encryptJson(content as Record<string, unknown>),
      policyMetadata: policyMetadata as unknown as import('@db').Prisma.InputJsonValue,
    },
  });

  timer.mark('draft_plan_saved');

  await createRevision(dietPlan.id, content as Record<string, unknown>, 'AI_GENERATED');

  const validationResult = await validatePlan(dietPlan.id);

  timer.mark('validation');

  if (validationResult.status === 'NEEDS_ADJUST') {
    const adjusted = autoAdjustContent(content, adjustedTargets.targetKcal);
    await prisma.dietPlan.update({
      where: { id: dietPlan.id },
      data: { content: encryptJson(adjusted as Record<string, unknown>) },
    });
    await createRevision(dietPlan.id, adjusted as Record<string, unknown>, 'AUTO_ADJUST');
    await validatePlan(dietPlan.id);
    autoAdjusted = true;
  }

  // Finalize status
  const hasHighFlags = redFlagResult.triggered && redFlagResult.flags.some(f => f.severity === 'HIGH');
  const finalStatus = hasHighFlags ? 'MANUAL_REVIEW_REQUIRED' : 'GENERATED';
  await prisma.dietPlan.update({
    where: { id: dietPlan.id },
    data: { status: finalStatus },
  });

  // Cache for future (Redis L1 + DB template L2)
  if (!fromCache && source !== 'fallback') {
    await setCachedPlan(matchKey, content);
    if (validationResult.status === 'VALID') {
      saveAsTemplate({
        dietPlanId: dietPlan.id,
        content,
        segment,
        diseases,
        kcal: adjustedTargets.targetKcal,
        proteinG: adjustedTargets.targetProteinG,
        fatG: adjustedTargets.targetFatG,
        carbsG: adjustedTargets.targetCarbsG,
        aiModel: source,
      }).catch((err) => console.error('[pipeline] Template save failed:', err instanceof Error ? err.message : err));
    }
  }

  // Extract and save recipes (17.3.5) — fire-and-forget
  saveRecipesFromPlan(content, dietPlan.id)
    .catch((err) => console.error('[pipeline] Recipe extraction failed:', err instanceof Error ? err.message : err));

  timer.mark('finalization');

  const maxSeverity = redFlagResult.flags.length > 0
    ? redFlagResult.flags.some(f => f.severity === 'HIGH') ? 'HIGH' : 'MODERATE'
    : undefined;

  logAiUsage({
    patientId,
    dietPlanId: dietPlan.id,
    triggeredAt,
    durationMs: timer.totalMs,
    source,
    cached: fromCache,
    n8nTriggered: false, aiTriggered: false,
    blocked: false,
    validationStatus: validationResult.status,
    autoAdjusted,
    policyRulesCount: policyResult.appliedRules.length,
    redFlagsCount: redFlagResult.flags.length,
    redFlagSeverity: maxSeverity,
    stepTimings: timer.steps,
    success: true,
    aiProvider: 'pipeline',
    aiModel: source,
  });

  return {
    dietPlanId: dietPlan.id,
    source,
    validationStatus: validationResult.status,
    cached: fromCache,
    n8nTriggered: false, aiTriggered: false,
    blocked: false,
    appliedRules: policyResult.appliedRules.map(r => r.ruleId),
    redFlags: redFlagResult.flags.map(f => f.flagId),
  };
}

// ─── Build content from template/candidate/fallback ──────────────────────────

async function buildFallbackContent(
  segment: UserSegment,
  targetKcal: number,
  policyResult: ReturnType<typeof evaluatePolicies>,
  maxCookingTimeMinutes?: number,
  preferredCuisines?: string[],
  skipBreakfast = false,
): Promise<{ content: PlanContent; source: PipelineResult['source'] }> {
  // Try TemplatePlan first
  const template = await findBestTemplatePlan({
    goal: segment.goal,
    kcal: segment.kcalBucket,
    mealCount: segment.mealCount,
    dietType: segment.dietType,
  });

  if (template && template.meals.length > 0) {
    let content = buildPlanFromTemplate(template);
    if (policyResult.excludeKeywords.length > 0) {
      content = filterExcludedItems(content, policyResult.excludeKeywords);
    }
    return { content, source: 'template' };
  }

  // Try candidate meals from Food DB
  const candidateContent = await buildPlanFromCandidates(segment, targetKcal, maxCookingTimeMinutes, preferredCuisines, skipBreakfast);
  if (candidateContent) {
    let content = candidateContent;
    if (policyResult.excludeKeywords.length > 0) {
      content = filterExcludedItems(content, policyResult.excludeKeywords);
    }
    return { content, source: 'candidate_meals' };
  }

  // Fallback placeholder
  return { content: buildFallbackPlan(targetKcal, segment.mealCount, skipBreakfast), source: 'fallback' };
}

// ─── Filter items by excluded keywords from policy engine ─────────────────────

function filterExcludedItems(content: PlanContent, excludeKeywords: string[]): PlanContent {
  if (excludeKeywords.length === 0) return content;

  const lowerKeywords = excludeKeywords.map(kw => kw.toLowerCase());

  const filteredDays = content.days.map(day => ({
    ...day,
    meals: day.meals.map(meal => ({
      ...meal,
      items: meal.items.filter(item => {
        const nameLower = item.name.toLowerCase();
        return !lowerKeywords.some(kw => nameLower.includes(kw));
      }),
    })),
  }));

  return { ...content, days: filteredDays };
}
