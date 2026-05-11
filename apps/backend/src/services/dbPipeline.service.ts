/**
 * DB-first Diet Generation Pipeline (Phase D)
 *
 * The main entry point for generating diet plans from the recipe database.
 * Orchestrates: Policy Engine → Meal Distribution → Plan Assembly → Validation.
 *
 * DB-first is the DEFAULT generation method. AI is used only as fallback
 * when coverage < 80%.
 *
 * Integration points:
 * - Called by planPipeline.service.ts (replaces AI as primary source)
 * - Output is standard PlanContent (compatible with existing validation/storage)
 * - Metadata stored in DietPlan.policyMetadata
 */

import { prisma } from '@db';
import { encryptJson } from '../utils/encryption';
import { AppError } from '../utils/errors';
import { logAudit } from './audit.service';
import { logAiUsage, PipelineTimer } from './aiUsage.service';
import {
  validatePlan,
  autoAdjustContent,
  type PlanContent,
} from './planValidation.service';
import { assembleDbPlan, type AssemblyInput, type AssemblyResult } from './dbPlanAssembly.service';
import { buildDbPolicyConstraints, mergeConstraintsIntoInput, type DbPolicyConstraints } from './dbPolicyBridge.service';
import { createRevision } from './revision.service';
import { isComposeMealsEnabledFor } from '../utils/composeMealsFlag';
import { getGreyListWindow, getGreyListRecipeIds } from './dietitianSettings.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type GenerationSource = 'database' | 'database_ai_hybrid' | 'ai';

export interface DbPipelineInput {
  patientId: string;
  /** Who triggered the generation */
  triggeredBy?: string;
  /** Number of days (default 7) */
  days?: number;
  /** Max cooking time preference from interview */
  maxCookingTimeMinutes?: number;
  /** Prefer meal-prep friendly recipes */
  preferMealPrep?: boolean;
  /** Budget preference */
  maxCost?: 'BUDGET' | 'STANDARD' | 'PREMIUM';
  /** Force AI fallback (skip DB-first) */
  forceAi?: boolean;
}

export interface DbPipelineResult {
  dietPlanId: string;
  source: GenerationSource;
  coveragePct: number;
  validationStatus: string;
  appliedRules: string[];
  clinicalNotes: string[];
  supplements: string[];
  durationMs: number;
  /** true if coverage was too low and AI fallback is needed */
  needsAiFallback: boolean;
}

// ─── Coverage threshold ──────────────────────────────────────────────────────

/** Minimum coverage % to accept a DB-generated plan without AI fallback */
const MIN_COVERAGE_PCT = 80;

// ─── Main pipeline ───────────────────────────────────────────────────────────

/**
 * Generate a diet plan using the DB-first approach.
 *
 * Flow:
 * 1. Build policy constraints (allergens, diet flags, clinical rules)
 * 2. Assemble plan from recipe database
 * 3. Validate and auto-adjust
 * 4. Save to DietPlan with metadata
 * 5. Return result (or flag for AI fallback if coverage < 80%)
 */
export async function generateDbPlan(input: DbPipelineInput): Promise<DbPipelineResult> {
  const timer = new PipelineTimer();
  const startMs = Date.now();

  // 0. Verify patient exists and has nutrition targets
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: {
      id: true,
      userId: true,
      dietitianId: true,
      nutritionTargets: { select: { targetKcal: true } },
    },
  });

  if (!patient) {
    throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  }
  if (!patient.nutritionTargets) {
    throw new AppError(400, 'NO_NUTRITION_TARGETS', 'Patient has no nutrition targets. Complete the interview first.');
  }

  // 1. Build policy constraints
  const constraints: DbPolicyConstraints = await buildDbPolicyConstraints(input.patientId);

  // 2. Build assembly input
  // Z1: grey-list lookup. Pulled here (not in dbPlanAssembly) so the
  // window/profile resolution stays a pipeline concern; assembleDbPlan
  // just consumes the resulting Set. Errors are downgraded to "no grey
  // list" rather than failing generation.
  let greyListRecipeIds: Set<string> | undefined;
  try {
    const window = await getGreyListWindow(patient.dietitianId ?? null);
    if (window > 0) {
      greyListRecipeIds = await getGreyListRecipeIds(input.patientId, window);
      if (greyListRecipeIds.size === 0) {
        greyListRecipeIds = undefined;
      } else {
        console.log(
          `[dbPipeline] grey list window=${window} → ${greyListRecipeIds.size} recipe ID(s) penalised`,
        );
      }
    }
  } catch (err) {
    console.warn('[dbPipeline] grey list lookup failed (continuing without):', (err as Error).message);
  }

  const baseInput: AssemblyInput = {
    patientId: input.patientId,
    days: input.days ?? 7,
    maxCookingTimeMinutes: input.maxCookingTimeMinutes,
    preferMealPrep: input.preferMealPrep,
    maxCost: input.maxCost,
    // Faza D Phase 2 prep: per-patient compose-meals gating via the
    // env-based allowlist. Resolves to true when EITHER the global env
    // flag is on OR this patientId is in COMPOSE_MEALS_PATIENT_IDS.
    composeMeals: isComposeMealsEnabledFor(input.patientId),
    greyListRecipeIds,
  };

  const enrichedInput = mergeConstraintsIntoInput(baseInput, constraints);

  // 3. Assemble plan from DB
  let assembly: AssemblyResult;
  try {
    assembly = await assembleDbPlan(enrichedInput);
  } catch (err) {
    // If assembly fails entirely, signal AI fallback
    console.error('[dbPipeline] Assembly failed:', (err as Error).message);
    return {
      dietPlanId: '',
      source: 'database',
      coveragePct: 0,
      validationStatus: 'GENERATION_FAILED',
      appliedRules: constraints.appliedRuleNames,
      clinicalNotes: constraints.clinicalNotes,
      supplements: constraints.supplements,
      durationMs: Date.now() - startMs,
      needsAiFallback: true,
    };
  }

  // 4. Check coverage and determine source
  const coveragePct = assembly.coverage.filledFromDbPct;
  const needsAiFallback = coveragePct < MIN_COVERAGE_PCT;
  const source: GenerationSource = needsAiFallback ? 'database_ai_hybrid' : 'database';

  if (needsAiFallback) {
    console.warn(`[dbPipeline] Low coverage: ${coveragePct.toFixed(1)}% (min: ${MIN_COVERAGE_PCT}%). AI fallback needed.`);
  }

  // 5. Save initial plan so validatePlan can look it up by ID
  const encryptedContentInit = encryptJson(assembly.plan);
  const dietPlanInit = await prisma.dietPlan.create({
    data: {
      patientId: input.patientId,
      tenantId: null,
      source: 'AI',
      status: needsAiFallback ? 'AI_DRAFT' : 'GENERATED',
      content: encryptedContentInit,
      kcal: patient.nutritionTargets.targetKcal,
      policyMetadata: JSON.parse(JSON.stringify({
        generationMethod: source,
        coverageReport: assembly.coverage,
        recipeIds: assembly.recipeIds,
        appliedRules: constraints.appliedRuleNames,
        clinicalNotes: constraints.clinicalNotes,
        supplements: constraints.supplements,
        durationMs: assembly.durationMs,
      })),
    },
  });

  // 5b. Validate (validatePlan takes planId)
  const validation = await validatePlan(dietPlanInit.id);
  let finalPlan = assembly.plan;

  if (validation.status === 'NEEDS_ADJUST') {
    finalPlan = autoAdjustContent(assembly.plan, patient.nutritionTargets.targetKcal);
    // Update with adjusted content
    const encryptedAdjusted = encryptJson(finalPlan);
    await prisma.dietPlan.update({
      where: { id: dietPlanInit.id },
      data: { content: encryptedAdjusted },
    });
  }

  // 6. Create revision
  await createRevision(dietPlanInit.id, encryptJson(finalPlan), 'AI_GENERATED');

  // 7. Audit log
  logAudit({
    userId: input.triggeredBy ?? patient.userId,
    action: 'GENERATE_PLAN',
    resourceType: 'DIET_PLAN',
    resourceId: dietPlanInit.id,
    metadata: {
      source,
      coveragePct: Math.round(coveragePct),
      filledSlots: assembly.coverage.filledFromDb,
      totalSlots: assembly.coverage.totalSlots,
      appliedRulesCount: constraints.appliedRulesCount,
      durationMs: assembly.durationMs,
    },
  });

  // 8. Log usage (cost = 0 for DB-first)
  logAiUsage({
    patientId: input.patientId,
    dietPlanId: dietPlanInit.id,
    triggeredAt: new Date(),
    durationMs: assembly.durationMs,
    source,
    cached: false,
    n8nTriggered: false,
    aiTriggered: false,
    blocked: false,
    autoAdjusted: validation.status === 'NEEDS_ADJUST',
    policyRulesCount: constraints.appliedRulesCount,
    redFlagsCount: 0,
    stepTimings: [],
    success: !needsAiFallback,
    aiModel: 'database',
    promptTokens: 0,
    completionTokens: 0,
    estimatedCostUsd: 0,
  });

  const durationMs = Date.now() - startMs;

  return {
    dietPlanId: dietPlanInit.id,
    source,
    coveragePct: Math.round(coveragePct * 10) / 10,
    validationStatus: validation.status,
    appliedRules: constraints.appliedRuleNames,
    clinicalNotes: constraints.clinicalNotes,
    supplements: constraints.supplements,
    durationMs,
    needsAiFallback,
  };
}
