/**
 * Scoring Context Service (Faza 73/75C)
 *
 * Computes patient-specific scoring context for recipe candidate queries:
 * - microDeficits: which micronutrients the patient is likely missing
 * - patientDropRate: how often the patient abandons complex recipes
 *
 * Used by dbPlanAssembly and weekSolver to pass context to recipeCandidate scoring.
 */

import { prisma, Prisma } from '@db';
import { getNormsForPatient, getTarget } from './dietaryNorms';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MicroDeficit {
  nutrient: string;   // e.g. "iron", "calcium", "vitamin_c"
  gapPct: number;     // 0-100: how far below target (higher = worse)
}

export interface PatientDropRate {
  highTime: number;        // 0-1: fraction of >45min recipes dropped/rated poorly
  highIngredient: number;  // 0-1: fraction of >8-ingredient recipes dropped/rated poorly
}

// ─── Micro nutrient key mapping ─────────────────────────────────────────────

/** Map from our scoring nutrient names to dietaryNorms keys */
const MICRO_NORM_KEYS: Record<string, string> = {
  iron: 'iron',
  calcium: 'calcium',
  magnesium: 'magnesium',
  zinc: 'zinc',
  potassium: 'potassium',
  vitamin_c: 'vitaminC',
  vitamin_d: 'vitaminD',
  vitamin_b12: 'vitaminB12',
  folate: 'folate',
  omega3: 'omega3',
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute micronutrient deficits for a patient based on their demographic norms.
 *
 * Since we don't have actual intake tracking yet, we estimate deficits based on:
 * 1. Patient demographics (sex, age) → dietary norms (RDA/AI)
 * 2. Common population-level deficits for the patient's profile
 *
 * Returns top 5 deficits sorted by priority (highest gap first).
 */
export async function computeMicroDeficits(patientId: string): Promise<MicroDeficit[]> {
  // Load patient data for demographic norms
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      sex: true,
      birthDate: true,
      user: { select: { role: true } },
    },
  });

  if (!patient) return [];

  const age = patient.birthDate
    ? Math.floor((Date.now() - patient.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 30;

  const sex = patient.sex ?? 'F';
  const norms = getNormsForPatient(sex, age);

  // Build deficits based on population-level risk factors
  // Higher gapPct = more important to optimize for
  const deficits: MicroDeficit[] = [];

  for (const [scoringKey, normKey] of Object.entries(MICRO_NORM_KEYS)) {
    const norm = norms.nutrients.find((n) => n.nutrientKey === normKey);
    if (!norm) continue;

    const target = getTarget(norm);
    if (!target || target <= 0) continue;

    // Base gap: population-level risk estimate
    // In the future, replace with actual intake from previous plan analysis
    let gapPct = 20; // default: moderate gap assumption

    // Women have higher iron needs
    if (scoringKey === 'iron' && sex === 'F' && age >= 15 && age <= 50) {
      gapPct = 45; // menstruating women commonly deficient
    }

    // Vitamin D is commonly deficient in Poland (high latitude)
    if (scoringKey === 'vitamin_d') {
      gapPct = 50; // most Poles are deficient
    }

    // Calcium often suboptimal
    if (scoringKey === 'calcium') {
      gapPct = 35;
    }

    // Folate important for women of childbearing age
    if (scoringKey === 'folate' && sex === 'F' && age >= 18 && age <= 45) {
      gapPct = 40;
    }

    // Omega-3 commonly low in non-fish-eaters
    if (scoringKey === 'omega3') {
      gapPct = 30;
    }

    deficits.push({ nutrient: scoringKey, gapPct });
  }

  // Sort by gap (highest priority first) and take top 5
  return deficits
    .sort((a, b) => b.gapPct - a.gapPct)
    .slice(0, 5);
}

/**
 * Compute patient's drop rate for complex recipes.
 *
 * Analyzes CheckIn data and RecipeRating to determine how often
 * the patient fails to follow through on:
 * - Long recipes (>45 min cooking time)
 * - Complex recipes (>8 ingredients)
 *
 * Returns rates as 0-1 fractions (0 = never drops, 1 = always drops).
 */
export async function computeDropRate(patientId: string): Promise<PatientDropRate> {
  // Check if patient has enough check-in history
  const checkInCount = await prisma.checkIn.count({
    where: { patientId },
  });

  if (checkInCount < 3) {
    // Not enough data — return neutral defaults
    return { highTime: 0.15, highIngredient: 0.1 };
  }

  // Get average compliance from recent check-ins
  const recentCheckIns = await prisma.checkIn.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { compliance: true },
  });

  const avgCompliance = recentCheckIns.length > 0
    ? recentCheckIns.reduce((s, c) => s + (c.compliance ?? 80), 0) / recentCheckIns.length
    : 80;

  // Get low ratings (1-2 stars) count
  const lowRatings = await prisma.recipeRating.count({
    where: {
      patientId,
      rating: { lte: 2 },
    },
  });

  const totalRatings = await prisma.recipeRating.count({
    where: { patientId },
  });

  // Estimate drop rates from compliance and ratings
  // Low compliance → higher drop rates
  // Many low ratings → higher drop rates
  const complianceFactor = Math.max(0, (100 - avgCompliance) / 100); // 0-1
  const ratingFactor = totalRatings > 0 ? lowRatings / totalRatings : 0; // 0-1

  return {
    highTime: Math.min(1, complianceFactor * 0.6 + ratingFactor * 0.4),
    highIngredient: Math.min(1, complianceFactor * 0.5 + ratingFactor * 0.3),
  };
}
