/**
 * Soft Validation Service (Faza 74)
 *
 * Post-assembly validation of diet plan quality metrics:
 * - Vegetables ≥ 400g/day
 * - Fruits ≥ 200g/day
 * - Saturated fat < 10% energy
 * - Sodium < 2000mg/day
 * - Fiber ≥ 25g/day
 *
 * Also computes Plan Quality Score (A-E grade).
 */

import { prisma, Prisma } from '@db';
import type { PlanContent } from './planValidation.service';
import type { CoverageReport } from './dbPlanAssembly.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SoftValidationStatus = 'OK' | 'WARNING' | 'FAIL';

export interface SoftValidation {
  metric: string;
  label: string;
  target: number;
  actual: number;
  unit: string;
  status: SoftValidationStatus;
}

export type PlanQualityGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface PlanQualityResult {
  grade: PlanQualityGrade;
  score: number; // 0-100
  softValidations: SoftValidation[][];  // per-day array
  weeklyMetrics: WeeklyMetrics;
}

export interface WeeklyMetrics {
  avgKcalPerDay: number;
  proteinSourceCount: number;
  fishMealsCount: number;
  legumeMealsCount: number;
  recipeRepeatCount: number;
  avgSodiumMg: number;
  avgFiberG: number;
  avgVegetablesG: number;
  avgFruitsG: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** CleanProduct category slugs that count as vegetables */
const VEGETABLE_CATEGORIES = new Set(['warzywa']);

/** CleanProduct category slugs that count as fruits */
const FRUIT_CATEGORIES = new Set(['owoce']);

/** Protein source detection patterns (Polish) */
const PROTEIN_PATTERNS: Record<string, RegExp> = {
  poultry: /kurczak|indyk|drob|pierś|udko/i,
  fish:    /łosoś|dorsz|tuńczyk|pstrąg|makrela|ryb|krewet|śledź/i,
  beef:    /wołowin|cielęc|polędwic/i,
  pork:    /wieprzow|szynk|schab/i,
  legumes: /soczewic|ciecierzyc|fasol|groch|bób\b/i,
  tofu:    /tofu|tempeh|seitan/i,
  eggs:    /jaj/i,
  dairy:   /twaróg|jogurt|kefir|ser\b|skyr/i,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

/**
 * For a given plan, load all recipe ingredients with their product categories
 * and nutrition data to compute per-day vegetable/fruit grams and nutrient totals.
 */
async function loadPlanNutritionDetails(plan: PlanContent) {
  // Collect all unique ingredient names from the plan
  const dayDetails: Array<{
    vegetablesG: number;
    fruitsG: number;
    fiberG: number;
    sodiumMg: number;
    saturatedFatG: number;
    totalKcal: number;
    mealNames: string[];
  }> = [];

  for (const day of plan.days) {
    let dayVegetablesG = 0;
    let dayFruitsG = 0;
    let dayFiberG = 0;
    let daySodiumMg = 0;
    let daySaturatedFatG = 0;
    let dayKcal = 0;
    const mealNames: string[] = [];

    for (const meal of day.meals) {
      mealNames.push(meal.name);
      for (const item of meal.items) {
        dayKcal += item.kcal ?? 0;

        // Try to find the product in CleanProduct DB by name
        if (item.ingredients && item.ingredients.length > 0) {
          for (const ing of item.ingredients) {
            const product = await prisma.cleanProduct.findFirst({
              where: {
                OR: [
                  { name: { contains: ing.name, mode: 'insensitive' } },
                  { slug: { contains: ing.name.toLowerCase().replace(/\s+/g, '-') } },
                ],
              },
              select: {
                category: true,
                nutrients: {
                  select: {
                    fiberPer100g: true,
                    sodiumMg: true,
                    saturatedFatPer100g: true,
                  },
                },
              },
            });

            if (product) {
              const grams = ing.grams ?? 0;

              // Classify by category
              if (VEGETABLE_CATEGORIES.has(product.category)) {
                dayVegetablesG += grams;
              } else if (FRUIT_CATEGORIES.has(product.category)) {
                dayFruitsG += grams;
              }

              // Compute nutrients from product data
              const nutrients = product.nutrients;
              if (nutrients) {
                const factor = grams / 100;
                dayFiberG += toNum(nutrients.fiberPer100g) * factor;
                daySodiumMg += toNum(nutrients.sodiumMg) * factor;
                daySaturatedFatG += toNum(nutrients.saturatedFatPer100g) * factor;
              }
            }
          }
        }
      }
    }

    dayDetails.push({
      vegetablesG: Math.round(dayVegetablesG),
      fruitsG: Math.round(dayFruitsG),
      fiberG: Math.round(dayFiberG * 10) / 10,
      sodiumMg: Math.round(daySodiumMg),
      saturatedFatG: Math.round(daySaturatedFatG * 10) / 10,
      totalKcal: Math.round(dayKcal),
      mealNames,
    });
  }

  return dayDetails;
}

// ─── Main Functions ──────────────────────────────────────────────────────────

/**
 * Run soft validations on a diet plan and compute quality metrics.
 * This is a post-assembly check — it does NOT block plan creation.
 */
export async function runSoftValidations(
  plan: PlanContent,
  coverage?: CoverageReport,
): Promise<PlanQualityResult> {
  const dayDetails = await loadPlanNutritionDetails(plan);
  const numDays = dayDetails.length;

  // ── Per-day soft validations ──────────────────────────────────────────
  const perDayValidations: SoftValidation[][] = dayDetails.map((day) => {
    const validations: SoftValidation[] = [];

    // Vegetables ≥ 400g/day
    validations.push({
      metric: 'vegetables',
      label: 'Warzywa',
      target: 400,
      actual: day.vegetablesG,
      unit: 'g',
      status: day.vegetablesG >= 400 ? 'OK' : day.vegetablesG >= 300 ? 'WARNING' : 'FAIL',
    });

    // Fruits ≥ 200g/day
    validations.push({
      metric: 'fruits',
      label: 'Owoce',
      target: 200,
      actual: day.fruitsG,
      unit: 'g',
      status: day.fruitsG >= 200 ? 'OK' : day.fruitsG >= 100 ? 'WARNING' : 'FAIL',
    });

    // Fiber ≥ 25g/day
    validations.push({
      metric: 'fiber',
      label: 'Błonnik',
      target: 25,
      actual: day.fiberG,
      unit: 'g',
      status: day.fiberG >= 25 ? 'OK' : day.fiberG >= 20 ? 'WARNING' : 'FAIL',
    });

    // Sodium < 2000mg/day
    validations.push({
      metric: 'sodium',
      label: 'Sód',
      target: 2000,
      actual: day.sodiumMg,
      unit: 'mg',
      status: day.sodiumMg <= 2000 ? 'OK' : day.sodiumMg <= 2500 ? 'WARNING' : 'FAIL',
    });

    // Saturated fat < 10% of energy
    const satFatPct = day.totalKcal > 0
      ? (day.saturatedFatG * 9 / day.totalKcal) * 100
      : 0;
    validations.push({
      metric: 'saturatedFat',
      label: 'Tłuszcze nasycone',
      target: 10,
      actual: Math.round(satFatPct * 10) / 10,
      unit: '% energii',
      status: satFatPct <= 10 ? 'OK' : satFatPct <= 13 ? 'WARNING' : 'FAIL',
    });

    // 82.4: Daily Glycemic Load (only if coverage has GL data)
    if (coverage?.dailyGlycemicLoad) {
      const dayIdx = dayDetails.indexOf(day);
      const gl = coverage.dailyGlycemicLoad[dayIdx] ?? 0;
      if (gl > 0) {
        validations.push({
          metric: 'glycemicLoad',
          label: 'Ładunek glikemiczny',
          target: 100,
          actual: gl,
          unit: 'GL',
          status: gl <= 100 ? 'OK' : gl <= 130 ? 'WARNING' : 'FAIL',
        });
      }
    }

    return validations;
  });

  // ── Weekly metrics ────────────────────────────────────────────────────
  const allMealNames = dayDetails.flatMap((d) => d.mealNames);

  // Count unique protein sources
  const proteinSourcesFound = new Set<string>();
  let fishCount = 0;
  let legumeCount = 0;
  for (const name of allMealNames) {
    for (const [source, pattern] of Object.entries(PROTEIN_PATTERNS)) {
      if (pattern.test(name)) {
        proteinSourcesFound.add(source);
        if (source === 'fish') fishCount++;
        if (source === 'legumes') legumeCount++;
      }
    }
  }

  // Count recipe repeats (approximate — by meal name)
  const nameCountMap = new Map<string, number>();
  for (const name of allMealNames) {
    const normalized = name.toLowerCase().trim();
    nameCountMap.set(normalized, (nameCountMap.get(normalized) ?? 0) + 1);
  }
  const repeatCount = [...nameCountMap.values()].filter((c) => c > 1).reduce((s, c) => s + c - 1, 0);

  const weeklyMetrics: WeeklyMetrics = {
    avgKcalPerDay: numDays > 0 ? Math.round(dayDetails.reduce((s, d) => s + d.totalKcal, 0) / numDays) : 0,
    proteinSourceCount: proteinSourcesFound.size,
    fishMealsCount: fishCount,
    legumeMealsCount: legumeCount,
    recipeRepeatCount: repeatCount,
    avgSodiumMg: numDays > 0 ? Math.round(dayDetails.reduce((s, d) => s + d.sodiumMg, 0) / numDays) : 0,
    avgFiberG: numDays > 0 ? Math.round(dayDetails.reduce((s, d) => s + d.fiberG, 0) / numDays * 10) / 10 : 0,
    avgVegetablesG: numDays > 0 ? Math.round(dayDetails.reduce((s, d) => s + d.vegetablesG, 0) / numDays) : 0,
    avgFruitsG: numDays > 0 ? Math.round(dayDetails.reduce((s, d) => s + d.fruitsG, 0) / numDays) : 0,
  };

  // ── Plan Quality Score (A-E) ──────────────────────────────────────────
  const allValidations = perDayValidations.flat();
  const totalValidations = allValidations.length;
  const failCount = allValidations.filter((v) => v.status === 'FAIL').length;
  const warnCount = allValidations.filter((v) => v.status === 'WARNING').length;
  const violationScore = totalValidations > 0
    ? Math.max(0, 100 - (failCount * 15 + warnCount * 5))
    : 100;

  const diversityScore = coverage?.diversityScore != null
    ? coverage.diversityScore * 100
    : 70;

  const avgFitScore = coverage?.avgFitScore ?? 70;

  const vegetableCoverage = weeklyMetrics.avgVegetablesG >= 400
    ? 100
    : Math.round((weeklyMetrics.avgVegetablesG / 400) * 100);

  const fiberCoverage = weeklyMetrics.avgFiberG >= 25
    ? 100
    : Math.round((weeklyMetrics.avgFiberG / 25) * 100);

  const qualityScore = Math.round(
    avgFitScore * 0.3 +
    diversityScore * 0.2 +
    violationScore * 0.2 +
    vegetableCoverage * 0.15 +
    fiberCoverage * 0.15,
  );

  let grade: PlanQualityGrade;
  if (qualityScore >= 90) grade = 'A';
  else if (qualityScore >= 75) grade = 'B';
  else if (qualityScore >= 60) grade = 'C';
  else if (qualityScore >= 40) grade = 'D';
  else grade = 'E';

  return {
    grade,
    score: qualityScore,
    softValidations: perDayValidations,
    weeklyMetrics,
  };
}
