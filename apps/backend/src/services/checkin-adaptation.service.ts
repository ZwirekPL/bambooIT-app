import { prisma } from '@db';
import { getCheckInTrends, type CheckInTrends } from './checkin-trends.service';
import { getNutritionTargets } from './nutrition.service';
import { autoAdjustContent, type PlanContent } from './planValidation.service';
import { createRevision } from './revision.service';
import { decryptJson, encryptJson } from '../utils/encryption';
import type { Prisma } from '@db';
import { AppError } from '../utils/errors';

// ── Types ──────────────────────────────────────────────────────

export type AdaptationType =
  | 'PLATEAU_DEFICIT'
  | 'RAPID_LOSS_INCREASE'
  | 'HIGH_HUNGER_REDISTRIBUTE'
  | 'NONE';

export interface AdaptationResult {
  adapted: boolean;
  type: AdaptationType;
  kcalDelta: number;
  previousKcal: number;
  newKcal: number;
  reason: string;
  dietPlanId: string | null;
}

// ── Constants ──────────────────────────────────────────────────

// #13: Progressive caloric changes — smaller steps per check-in, applied repeatedly
// Old: -150/+100/+75 one-shot. New: -50/+50/+25 per check-in (gradual adaptation)
const PLATEAU_KCAL_REDUCTION = -50;
const RAPID_LOSS_KCAL_INCREASE = 50;
const HIGH_HUNGER_KCAL_INCREASE = 25;

const MIN_COMPLIANCE_FOR_PLATEAU_ADJUST = 70; // need ≥70% compliance to trust plateau signal
const HIGH_HUNGER_THRESHOLD = 7; // hunger ≥7 out of 10
const MIN_CHECKINS_FOR_ADAPTATION = 3; // need at least 3 check-ins before adapting
const MIN_KCAL_FLOOR = 1200; // never reduce below 1200 kcal
const MAX_KCAL_CEILING = 5000; // safety ceiling

// ── Main evaluation ─────────────────────────────────────────────

/**
 * Evaluates whether a patient's plan should be adapted based on check-in trends.
 * If adaptation is needed, updates NutritionTargets + creates new DietPlanRevision.
 * Returns adaptation result (even if no change was made).
 */
export async function evaluateAdaptation(patientId: string): Promise<AdaptationResult> {
  const noChange: AdaptationResult = {
    adapted: false,
    type: 'NONE',
    kcalDelta: 0,
    previousKcal: 0,
    newKcal: 0,
    reason: 'No adaptation needed',
    dietPlanId: null,
  };

  // 1. Get trends
  const trends = await getCheckInTrends(patientId);

  if (trends.totalCheckIns < MIN_CHECKINS_FOR_ADAPTATION) {
    return { ...noChange, reason: `Insufficient check-ins (${trends.totalCheckIns}/${MIN_CHECKINS_FOR_ADAPTATION})` };
  }

  // 2. Get current nutrition targets
  const targets = await getNutritionTargets(patientId);
  if (!targets) {
    return { ...noChange, reason: 'No nutrition targets found' };
  }

  const currentKcal = targets.targetKcal;

  // 3. Evaluate rules (priority order: rapid loss > plateau > hunger)
  const decision = evaluateRules(trends, currentKcal);

  if (decision.type === 'NONE') {
    return { ...noChange, previousKcal: currentKcal, newKcal: currentKcal };
  }

  // 4. Apply kcal adjustment to NutritionTargets
  const newKcal = clampKcal(currentKcal + decision.kcalDelta);

  if (newKcal === currentKcal) {
    return { ...noChange, previousKcal: currentKcal, newKcal: currentKcal, reason: 'Adjustment clamped to same value' };
  }

  // Recalculate macros proportionally
  const scale = newKcal / currentKcal;
  const newProteinG = Math.round(targets.targetProteinG * scale);
  const newFatG = Math.round(targets.targetFatG * scale);
  const newCarbsG = Math.round(targets.targetCarbsG * scale);

  await prisma.nutritionTargets.update({
    where: { patientId },
    data: {
      targetKcal: newKcal,
      targetProteinG: newProteinG,
      targetFatG: newFatG,
      targetCarbsG: newCarbsG,
    },
  });

  // 5. Adjust active diet plan (if exists)
  const dietPlanId = await adjustActivePlan(patientId, newKcal);

  return {
    adapted: true,
    type: decision.type,
    kcalDelta: newKcal - currentKcal,
    previousKcal: currentKcal,
    newKcal,
    reason: decision.reason,
    dietPlanId,
  };
}

// ── Rule evaluation ─────────────────────────────────────────────

interface RuleDecision {
  type: AdaptationType;
  kcalDelta: number;
  reason: string;
}

function evaluateRules(trends: CheckInTrends, currentKcal: number): RuleDecision {
  const none: RuleDecision = { type: 'NONE', kcalDelta: 0, reason: '' };

  // Rule 1: Rapid loss — safety first (highest priority)
  if (trends.rapidLoss.isRapidLoss) {
    return {
      type: 'RAPID_LOSS_INCREASE',
      kcalDelta: RAPID_LOSS_KCAL_INCREASE,
      reason: `Rapid weight loss detected (${trends.rapidLoss.weeklyLossKg} kg/week). Progressive increase: +${RAPID_LOSS_KCAL_INCREASE} kcal this week.`,
    };
  }

  // Rule 2: Plateau + good compliance → reduce kcal to break plateau
  if (trends.plateau.isPlateauDetected) {
    const recentCompliance = trends.recentAverages.compliance;
    if (recentCompliance !== null && recentCompliance >= MIN_COMPLIANCE_FOR_PLATEAU_ADJUST) {
      return {
        type: 'PLATEAU_DEFICIT',
        kcalDelta: PLATEAU_KCAL_REDUCTION,
        reason: `Plateau detected (${trends.plateau.plateauWeeks} weeks), compliance ${recentCompliance}%. Progressive reduction: ${PLATEAU_KCAL_REDUCTION} kcal this week.`,
      };
    }
  }

  // Rule 3: High hunger → slight kcal increase
  const recentHunger = trends.recentAverages.hunger;
  if (recentHunger !== null && recentHunger >= HIGH_HUNGER_THRESHOLD) {
    return {
      type: 'HIGH_HUNGER_REDISTRIBUTE',
      kcalDelta: HIGH_HUNGER_KCAL_INCREASE,
      reason: `High hunger (avg ${recentHunger}/10). Progressive increase: +${HIGH_HUNGER_KCAL_INCREASE} kcal this week.`,
    };
  }

  return none;
}

// ── Helpers ──────────────────────────────────────────────────────

function clampKcal(kcal: number): number {
  return Math.max(MIN_KCAL_FLOOR, Math.min(MAX_KCAL_CEILING, Math.round(kcal)));
}

/**
 * Finds the most recent active diet plan for a patient and adjusts its content
 * to match the new kcal target. Creates a CHECKIN_ADJUSTMENT revision.
 * Returns the plan ID if adjusted, null otherwise.
 */
async function adjustActivePlan(patientId: string, newKcal: number): Promise<string | null> {
  // Find the latest active plan (GENERATED, REVIEWED, PUBLISHED, or AI_DRAFT)
  const plan = await prisma.dietPlan.findFirst({
    where: {
      patientId,
      status: { in: ['GENERATED', 'REVIEWED', 'PUBLISHED', 'AI_DRAFT'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!plan) return null;

  const content = decryptJson(plan.content) as PlanContent;
  if (!content?.days || content.days.length === 0) return null;

  // Auto-adjust content to new kcal target
  const adjustedContent = autoAdjustContent(content, newKcal);

  // Update plan macros and content
  const scale = newKcal / (plan.kcal ?? newKcal);
  await prisma.dietPlan.update({
    where: { id: plan.id },
    data: {
      kcal: newKcal,
      proteinG: plan.proteinG ? Math.round(plan.proteinG * scale) : null,
      fatG: plan.fatG ? Math.round(plan.fatG * scale) : null,
      carbsG: plan.carbsG ? Math.round(plan.carbsG * scale) : null,
      content: encryptJson(adjustedContent as Record<string, unknown>) as unknown as Prisma.InputJsonObject,
    },
  });

  // Create revision
  await createRevision(
    plan.id,
    adjustedContent as Record<string, unknown>,
    'CHECKIN_ADJUSTMENT',
  );

  return plan.id;
}
