// ─── Meal Distribution Solver ────────────────────────────────────────────────
//
// Resolves daily nutrition targets into per-meal-slot targets.
// Consumes: NutritionTargets, Interview answers, NutritionProtocol, Policy effects.
// Produces: MealSlotTarget[] with kcal + macro targets per meal.

import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { AppError } from '../utils/errors';
import type { MealDistributionEffect } from '../policies/types';

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** A single meal slot with its nutrient targets */
export interface MealSlotTarget {
  slotIndex: number;
  mealName: string;
  mealType: string;
  pctOfDaily: number;
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
  maxProteinPct?: number;
  maxCarbsPct?: number;
  maxFatPct?: number;
}

/** Daily nutrition targets (input) */
export interface DailyTargets {
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
}

/** Protocol meal distribution (optional override) */
export interface ProtocolMealSlot {
  mealName: string;
  pct: number;
}

/** Full input for computing meal distribution */
export interface MealDistributionInput {
  dailyTargets: DailyTargets;
  mealsPerDay: number;
  protocolMealDistribution?: ProtocolMealSlot[];
  policyEffects?: MealDistributionEffect[];
  mealSchedule?: Array<{ label: string; time: string }>;
  // ── Faza D Phase 1 W2-Wed: distribution variants ────────────────────────
  /**
   * Gate flag for D4 / D7 distribution variants. When false (legacy /
   * compose_meals=false), `skipBreakfast` and `nightShift` are ignored —
   * the standard DEFAULT_DISTRIBUTIONS apply unchanged. This keeps
   * `compose_meals=false` bit-equal with pre-Faza-D snapshots even when a
   * patient's interview answers already carry the underlying flags.
   */
  composeMeals?: boolean;
  /**
   * D4: patient's first meal time = 'skip' → drop the BREAKFAST slot and
   * proportionally renormalize the remaining slots' pct to sum to 100.
   * Loader derives this from `Interview.answers.firstMealTime`.
   */
  skipBreakfast?: boolean;
  /**
   * D7: patient works night shifts → use NIGHT_SHIFT_DISTRIBUTIONS, which
   * bumps the post-wake meal pct and trims the pre-sleep one to mirror
   * the +6h time-cycle shift. Loader derives this from
   * `Interview.answers.workType === 'shift_night'`.
   */
  nightShift?: boolean;
}

/** Output of the solver */
export interface MealDistributionResult {
  slots: MealSlotTarget[];
  totalKcal: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum % of daily kcal any single slot can receive */
const MIN_SLOT_PCT = 5;

/** Maximum % of daily kcal any single slot can receive */
const MAX_SLOT_PCT = 50;

// ─── Meal Name → Meal Type Mapping ───────────────────────────────────────────

const MEAL_TYPE_MAP: Record<string, string> = {
  'śniadanie': 'BREAKFAST',
  'drugie śniadanie': 'SECOND_BREAKFAST',
  'ii śniadanie': 'SECOND_BREAKFAST',
  'obiad': 'LUNCH',
  'podwieczorek': 'SUPPER',
  'kolacja': 'DINNER',
  'przekąska': 'SNACK',
  'snack': 'SNACK',
};

/**
 * Maps a Polish meal name to a RecipeMealType enum value.
 * Case-insensitive. Falls back to SNACK for unrecognized names.
 */
function mapMealNameToType(mealName: string): string {
  const normalized = mealName.trim().toLowerCase();
  return MEAL_TYPE_MAP[normalized] ?? 'SNACK';
}

// ─── Default Distributions ───────────────────────────────────────────────────

const DEFAULT_DISTRIBUTIONS: Record<number, ProtocolMealSlot[]> = {
  2: [
    { mealName: 'Obiad', pct: 55 },
    { mealName: 'Kolacja', pct: 45 },
  ],
  3: [
    { mealName: 'Śniadanie', pct: 30 },
    { mealName: 'Obiad', pct: 45 },
    { mealName: 'Kolacja', pct: 25 },
  ],
  4: [
    { mealName: 'Śniadanie', pct: 25 },
    { mealName: 'Drugie śniadanie', pct: 15 },
    { mealName: 'Obiad', pct: 40 },
    { mealName: 'Kolacja', pct: 20 },
  ],
  5: [
    { mealName: 'Śniadanie', pct: 25 },
    { mealName: 'Drugie śniadanie', pct: 10 },
    { mealName: 'Obiad', pct: 35 },
    { mealName: 'Podwieczorek', pct: 10 },
    { mealName: 'Kolacja', pct: 20 },
  ],
  6: [
    { mealName: 'Śniadanie', pct: 20 },
    { mealName: 'Drugie śniadanie', pct: 10 },
    { mealName: 'Obiad', pct: 30 },
    { mealName: 'Podwieczorek', pct: 10 },
    { mealName: 'Kolacja', pct: 20 },
    { mealName: 'Przekąska', pct: 10 },
  ],
};

/**
 * Returns the default meal distribution for a given number of meals per day.
 * Supports 2–6 meals. Clamps to 2 or 6 for out-of-range values.
 */
export function getDefaultDistribution(mealsPerDay: number): ProtocolMealSlot[] {
  const clamped = Math.min(Math.max(Math.round(mealsPerDay), 2), 6);
  return DEFAULT_DISTRIBUTIONS[clamped];
}

// ─── Night-shift distributions (Faza D Phase 1 W2-Wed — D7) ─────────────────
//
// Night-shift patients eat their "śniadanie" at ~18:00 (post-wake) and their
// "kolacja" at ~06:00 (pre-sleep). Same kcal pcts that mainstream defaults
// use don't fit: a 25/35/20 pattern over a 6h-shifted clock means the patient
// eats their lightest meal right before sleeping (which is fine) but their
// largest meal is still mid-cycle. We bump the first meal up +5pp and trim
// the last meal -5pp so the post-wake meal carries the most energy and the
// pre-sleep meal stays small.
//
// `mealName` strings stay identical so meal-type mapping (and downstream
// solver constraints like BONUS_BREAKFAST_PROTEIN) keep working — the
// labels match the patient's perceived meal-of-day, not the wall clock.
const NIGHT_SHIFT_DISTRIBUTIONS: Record<number, ProtocolMealSlot[]> = {
  2: [
    { mealName: 'Obiad', pct: 60 },
    { mealName: 'Kolacja', pct: 40 },
  ],
  3: [
    { mealName: 'Śniadanie', pct: 35 },
    { mealName: 'Obiad', pct: 45 },
    { mealName: 'Kolacja', pct: 20 },
  ],
  4: [
    { mealName: 'Śniadanie', pct: 30 },
    { mealName: 'Drugie śniadanie', pct: 15 },
    { mealName: 'Obiad', pct: 40 },
    { mealName: 'Kolacja', pct: 15 },
  ],
  5: [
    // Sn +5 / SB +5 / Obiad -5 / Kolacja -5 — keeps Obiad ≤ MAX_SLOT_PCT after
    // skip-breakfast renormalization (D4+D7 combined scenario).
    { mealName: 'Śniadanie', pct: 30 },
    { mealName: 'Drugie śniadanie', pct: 15 },
    { mealName: 'Obiad', pct: 30 },
    { mealName: 'Podwieczorek', pct: 10 },
    { mealName: 'Kolacja', pct: 15 },
  ],
  6: [
    // Sn +5 / Obiad -5 — Obiad stays at 25 to leave headroom under MAX_SLOT_PCT
    // when D4 (skip breakfast) renormalizes the remaining slots.
    { mealName: 'Śniadanie', pct: 25 },
    { mealName: 'Drugie śniadanie', pct: 10 },
    { mealName: 'Obiad', pct: 25 },
    { mealName: 'Podwieczorek', pct: 10 },
    { mealName: 'Kolacja', pct: 20 },
    { mealName: 'Przekąska', pct: 10 },
  ],
};

/** Returns the night-shift distribution for `mealsPerDay` (clamped 2–6). */
export function getNightShiftDistribution(mealsPerDay: number): ProtocolMealSlot[] {
  const clamped = Math.min(Math.max(Math.round(mealsPerDay), 2), 6);
  return NIGHT_SHIFT_DISTRIBUTIONS[clamped];
}

// ─── Skip-breakfast renormalization (Faza D Phase 1 W2-Wed — D4) ────────────

/**
 * Drops any "Śniadanie" entry from a distribution and proportionally rescales
 * the remaining slots' pct values to sum to 100 (with rounding remainder
 * absorbed by the largest slot). Returns the input unchanged when the
 * distribution doesn't include breakfast (defensive — protocol overrides
 * already without breakfast pass through cleanly).
 */
export function applySkipBreakfast(slots: ProtocolMealSlot[]): ProtocolMealSlot[] {
  const filtered = slots.filter((s) => s.mealName.trim().toLowerCase() !== 'śniadanie');
  if (filtered.length === slots.length || filtered.length === 0) return slots;

  const totalPct = filtered.reduce((sum, s) => sum + s.pct, 0);
  if (totalPct === 0) return filtered;

  let assigned = 0;
  const scaled = filtered.map((s) => {
    const newPct = Math.round((s.pct * 100) / totalPct);
    assigned += newPct;
    return { ...s, pct: newPct };
  });
  const remainder = 100 - assigned;
  if (remainder !== 0 && scaled.length > 0) {
    const largest = scaled.reduce((max, s) => (s.pct > max.pct ? s : max), scaled[0]!);
    largest.pct += remainder;
  }
  return scaled;
}

// ─── Core Solver ─────────────────────────────────────────────────────────────

/**
 * Computes per-meal-slot nutrition targets from a daily target.
 *
 * Steps:
 * 1. Determine meal slots (protocol override or defaults)
 * 2. Map Polish meal names to RecipeMealType
 * 3. Distribute kcal proportionally with rounding correction
 * 4. Distribute macros, applying policy MEAL_DISTRIBUTION constraints
 * 5. Validate totals
 */
export function computeMealDistribution(input: MealDistributionInput): MealDistributionResult {
  const { dailyTargets, mealsPerDay, protocolMealDistribution, policyEffects } = input;

  // 1. Determine meal slots
  // Protocol overrides distribution only when its slot count matches the patient's preference.
  // If count differs, ignore the protocol and use defaults — patient preference wins.
  //
  // Faza D Phase 1 W2-Wed: when composeMeals=true, swap the default table for
  // NIGHT_SHIFT_DISTRIBUTIONS when nightShift flag is set. composeMeals=false
  // keeps the standard tables so legacy / gold-standard runs stay bit-equal.
  const useNightShiftBaseline = input.composeMeals === true && input.nightShift === true;
  const protocolMatches =
    protocolMealDistribution &&
    protocolMealDistribution.length > 0 &&
    protocolMealDistribution.length === mealsPerDay;

  let rawSlots = protocolMatches
    ? protocolMealDistribution
    : useNightShiftBaseline
      ? getNightShiftDistribution(mealsPerDay)
      : getDefaultDistribution(mealsPerDay);

  // Faza D Phase 1 W2-Wed: D4 skip-breakfast — drop the Śniadanie slot and
  // proportionally rescale the rest. Gated on composeMeals so legacy stays
  // bit-equal even for patients whose interview already says firstMealTime=skip.
  if (input.composeMeals === true && input.skipBreakfast === true) {
    rawSlots = applySkipBreakfast(rawSlots);
  }

  // Validate pct sum
  const pctSum = rawSlots.reduce((sum, s) => sum + s.pct, 0);
  if (Math.abs(pctSum - 100) > 1) {
    throw new AppError(400, 'INVALID_DISTRIBUTION', `Meal distribution percentages sum to ${pctSum}, expected 100`);
  }

  // 2. Build initial slot targets with kcal distribution
  const slots: MealSlotTarget[] = rawSlots.map((raw, index) => ({
    slotIndex: index,
    mealName: raw.mealName,
    mealType: mapMealNameToType(raw.mealName),
    pctOfDaily: raw.pct,
    targetKcal: 0,
    targetProteinG: 0,
    targetFatG: 0,
    targetCarbsG: 0,
  }));

  // 3. Distribute kcal with rounding correction
  distributeWithRounding(slots, dailyTargets.targetKcal, 'targetKcal');

  // 4. Distribute macros (default: proportional to kcal %)
  distributeMacro(slots, dailyTargets.targetProteinG, 'targetProteinG', 'protein', policyEffects);
  distributeMacro(slots, dailyTargets.targetFatG, 'targetFatG', 'fat', policyEffects);
  distributeMacro(slots, dailyTargets.targetCarbsG, 'targetCarbsG', 'carbs', policyEffects);

  // Attach policy constraint metadata to slots
  attachPolicyConstraints(slots, policyEffects);

  // 5. Validate
  validateSlots(slots, dailyTargets);

  // Build result
  const totalKcal = slots.reduce((s, sl) => s + sl.targetKcal, 0);
  const totalProteinG = slots.reduce((s, sl) => s + sl.targetProteinG, 0);
  const totalFatG = slots.reduce((s, sl) => s + sl.targetFatG, 0);
  const totalCarbsG = slots.reduce((s, sl) => s + sl.targetCarbsG, 0);

  return { slots, totalKcal, totalProteinG, totalFatG, totalCarbsG };
}

// ─── Distribution Helpers ────────────────────────────────────────────────────

/**
 * Distributes a daily total across slots proportionally to pctOfDaily.
 * Assigns rounding remainder to the largest slot (highest pct).
 */
function distributeWithRounding(
  slots: MealSlotTarget[],
  dailyTotal: number,
  field: 'targetKcal' | 'targetProteinG' | 'targetFatG' | 'targetCarbsG',
): void {
  let assigned = 0;

  for (const slot of slots) {
    slot[field] = Math.round(dailyTotal * slot.pctOfDaily / 100);
    assigned += slot[field];
  }

  // Distribute rounding remainder to the largest slot
  const remainder = dailyTotal - assigned;
  if (remainder !== 0) {
    const largestSlot = slots.reduce((max, s) => (s.pctOfDaily > max.pctOfDaily ? s : max), slots[0]);
    largestSlot[field] += remainder;
  }
}

/**
 * Distributes a macro (protein/fat/carbs) across slots.
 *
 * Default: proportional to each slot's pctOfDaily.
 * If a MEAL_DISTRIBUTION policy effect caps the macro, any slot exceeding
 * maxPerMealPct is capped and excess is redistributed evenly to other slots.
 */
function distributeMacro(
  slots: MealSlotTarget[],
  dailyTotal: number,
  field: 'targetProteinG' | 'targetFatG' | 'targetCarbsG',
  nutrientKey: string,
  policyEffects?: MealDistributionEffect[],
): void {
  // Start with proportional distribution
  distributeWithRounding(slots, dailyTotal, field);

  // Find applicable MEAL_DISTRIBUTION constraint
  const constraint = policyEffects?.find(
    (e) => e.type === 'MEAL_DISTRIBUTION' && e.nutrient === nutrientKey,
  );

  if (!constraint) return;

  const maxPct = constraint.maxPerMealPct;
  const maxGrams = Math.round(dailyTotal * maxPct / 100);

  // Iterative redistribution (max 10 passes to prevent infinite loops)
  for (let pass = 0; pass < 10; pass++) {
    let excess = 0;
    const uncappedSlots: MealSlotTarget[] = [];

    for (const slot of slots) {
      if (slot[field] > maxGrams) {
        excess += slot[field] - maxGrams;
        slot[field] = maxGrams;
      } else {
        uncappedSlots.push(slot);
      }
    }

    if (excess === 0 || uncappedSlots.length === 0) break;

    // Distribute excess evenly among uncapped slots
    const perSlot = Math.floor(excess / uncappedSlots.length);
    let leftover = excess - perSlot * uncappedSlots.length;

    for (const slot of uncappedSlots) {
      slot[field] += perSlot;
      if (leftover > 0) {
        slot[field] += 1;
        leftover--;
      }
    }
  }

  // Final rounding correction
  const currentSum = slots.reduce((s, sl) => s + sl[field], 0);
  const finalRemainder = dailyTotal - currentSum;
  if (finalRemainder !== 0) {
    const largestSlot = slots.reduce((max, s) => (s.pctOfDaily > max.pctOfDaily ? s : max), slots[0]);
    largestSlot[field] += finalRemainder;
  }
}

/**
 * Attaches policy constraint metadata (maxProteinPct, maxCarbsPct, maxFatPct)
 * to each slot for downstream consumers.
 */
function attachPolicyConstraints(
  slots: MealSlotTarget[],
  policyEffects?: MealDistributionEffect[],
): void {
  if (!policyEffects || policyEffects.length === 0) return;

  const fieldMap: Record<string, 'maxProteinPct' | 'maxCarbsPct' | 'maxFatPct'> = {
    protein: 'maxProteinPct',
    carbs: 'maxCarbsPct',
    fat: 'maxFatPct',
  };

  for (const effect of policyEffects) {
    if (effect.type !== 'MEAL_DISTRIBUTION') continue;
    const slotField = fieldMap[effect.nutrient];
    if (!slotField) continue;

    for (const slot of slots) {
      slot[slotField] = effect.maxPerMealPct;
    }
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates the computed meal distribution:
 * - Sum of slot kcal equals daily target (±1 tolerance for rounding)
 * - Each slot has at least MIN_SLOT_PCT of daily kcal
 * - No slot exceeds MAX_SLOT_PCT of daily kcal
 */
function validateSlots(slots: MealSlotTarget[], dailyTargets: DailyTargets): void {
  const totalKcal = slots.reduce((s, sl) => s + sl.targetKcal, 0);
  if (Math.abs(totalKcal - dailyTargets.targetKcal) > 1) {
    throw new AppError(
      500,
      'DISTRIBUTION_MISMATCH',
      `Slot kcal sum (${totalKcal}) differs from daily target (${dailyTargets.targetKcal}) by more than 1`,
    );
  }

  for (const slot of slots) {
    const pct = (slot.targetKcal / dailyTargets.targetKcal) * 100;
    if (pct < MIN_SLOT_PCT) {
      throw new AppError(
        400,
        'SLOT_TOO_SMALL',
        `Slot "${slot.mealName}" gets ${pct.toFixed(1)}% of daily kcal, minimum is ${MIN_SLOT_PCT}%`,
      );
    }
    if (pct > MAX_SLOT_PCT) {
      throw new AppError(
        400,
        'SLOT_TOO_LARGE',
        `Slot "${slot.mealName}" gets ${pct.toFixed(1)}% of daily kcal, maximum is ${MAX_SLOT_PCT}%`,
      );
    }
  }
}

// ─── Patient Data Loader ─────────────────────────────────────────────────────

/**
 * Loads all data needed to compute meal distribution for a patient:
 * 1. NutritionTargets (kcal, macros)
 * 2. Latest Interview (mealsPerDay, mealSchedule)
 * 3. Active NutritionProtocol (mealDistribution override) via dietitian access
 *
 * @param patientId - CUID of the patient
 * @returns Assembled MealDistributionInput ready for computeMealDistribution()
 * @throws AppError if NutritionTargets or Interview not found
 */
export async function loadPatientMealDistribution(patientId: string): Promise<MealDistributionInput> {
  // 1. Fetch NutritionTargets
  const targets = await prisma.nutritionTargets.findUnique({
    where: { patientId },
  });

  if (!targets) {
    throw new AppError(404, 'TARGETS_NOT_FOUND', `NutritionTargets not found for patient ${patientId}`);
  }

  // 2. Fetch latest Interview
  const interview = await prisma.interview.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });

  if (!interview) {
    throw new AppError(404, 'INTERVIEW_NOT_FOUND', `No interview found for patient ${patientId}`);
  }

  // Decrypt interview answers
  const answers = decryptJson(interview.answers) as Record<string, unknown>;
  const mealsPerDay = typeof answers.mealsPerDay === 'number'
    ? answers.mealsPerDay
    : typeof answers.mealsPerDay === 'string' && !isNaN(Number(answers.mealsPerDay))
      ? Number(answers.mealsPerDay)
      : typeof answers.posilkiDziennie === 'number'
        ? answers.posilkiDziennie
        : 5; // Default to 5 meals

  const mealSchedule = Array.isArray(answers.mealSchedule)
    ? (answers.mealSchedule as Array<{ label: string; time: string }>)
    : undefined;

  // Faza D Phase 1 W2-Wed: derive D4 / D7 distribution flags from the same
  // interview answers that policy-engine.ts:buildPatientContext reads (so
  // both layers stay in sync). composeMeals stays unset here — caller
  // decides whether to apply the variants based on its own feature-flag
  // context (typically AssemblyInput.composeMeals from the env flag).
  const skipBreakfast = answers.firstMealTime === 'skip';
  const nightShift = answers.workType === 'shift_night';

  // 3. Fetch protocol via patient's dietitian
  const protocolMealDistribution = await loadProtocolDistribution(patientId);

  return {
    dailyTargets: {
      targetKcal: targets.targetKcal,
      targetProteinG: targets.targetProteinG,
      targetFatG: targets.targetFatG,
      targetCarbsG: targets.targetCarbsG,
    },
    mealsPerDay,
    protocolMealDistribution,
    mealSchedule,
    skipBreakfast,
    nightShift,
  };
}

/**
 * Loads meal distribution from the patient's dietitian's active protocol.
 * Falls back to the default protocol if no dietitian-specific one is found.
 */
async function loadProtocolDistribution(patientId: string): Promise<ProtocolMealSlot[] | undefined> {
  // Look up patient's dietitian
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { dietitianId: true },
  });

  if (patient?.dietitianId) {
    // Find the dietitian's active protocol
    const access = await prisma.dietitianProtocolAccess.findFirst({
      where: {
        dietitianId: patient.dietitianId,
        isActive: true,
        protocol: { isActive: true },
      },
      select: {
        protocol: {
          select: { mealDistribution: true },
        },
      },
    });

    if (access?.protocol?.mealDistribution) {
      const dist = access.protocol.mealDistribution as unknown;
      if (Array.isArray(dist) && dist.length > 0) {
        return dist as ProtocolMealSlot[];
      }
    }
  }

  // Fallback: default protocol
  const defaultProtocol = await prisma.nutritionProtocol.findFirst({
    where: { isDefault: true, isActive: true },
    select: { mealDistribution: true },
  });

  if (defaultProtocol?.mealDistribution) {
    const dist = defaultProtocol.mealDistribution as unknown;
    if (Array.isArray(dist) && dist.length > 0) {
      return dist as ProtocolMealSlot[];
    }
  }

  return undefined;
}
