/**
 * 38.2 — Micronutrient Analysis Service.
 *
 * Analyzes a 7-day diet plan for micronutrient adequacy against IŻŻ 2020 norms.
 * Computes daily averages from ingredient-level nutrition data, compares with
 * patient-specific EAR/RDA/AI/UL values, and generates a report with recommendations.
 */

import { prisma } from '@db';
import {
  getNormsForPatient,
  assessNutrientStatus,
  getTarget,
  type NutrientNorm,
  type NutrientStatus,
  type PatientNorms,
} from './dietaryNorms';
import { applyRetention, detectCookingMethod, type CookingMethod } from './retentionFactors';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NutrientAssessment {
  nutrientKey: string;
  label: string;
  unit: string;
  dailyAvgIntake: number;
  target: number | null;   // RDA or AI
  ear: number | null;
  ul: number | null;
  status: NutrientStatus;
  percentOfTarget: number | null; // e.g. 85 means 85% of RDA
}

export interface SupplementRecommendation {
  nutrientKey: string;
  label: string;
  suggestedDose: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MicronutrientReport {
  patientNorms: PatientNorms;
  assessments: NutrientAssessment[];
  deficiencies: NutrientAssessment[];      // DEFICIENT status
  suboptimal: NutrientAssessment[];        // SUBOPTIMAL status
  excessive: NutrientAssessment[];         // EXCESSIVE status
  supplementRecommendations: SupplementRecommendation[];
  overallScore: number;                    // 0-100, % of nutrients at ADEQUATE level
  analyzedDays: number;
  unmatchedIngredients: string[];
}

// ─── Nutrient keys we can analyze (matching CleanProductNutrients fields) ───

const ANALYZABLE_KEYS: Record<string, string> = {
  vitaminDUg: 'vitaminDUg',
  vitaminCMg: 'vitaminCMg',
  vitaminAUg: 'vitaminAUg',
  vitaminEMg: 'vitaminEMg',
  vitaminKUg: 'vitaminKUg',
  folateUg: 'folateUg',
  vitaminB12Ug: 'vitaminB12Ug',
  calciumMg: 'calciumMg',
  magnesiumMg: 'magnesiumMg',
  ironMg: 'ironMg',
  zincMg: 'zincMg',
  potassiumMg: 'potassiumMg',
  iodineUg: 'iodineUg',
  seleniumUg: 'seleniumUg',
  phosphorusMg: 'phosphorusMg',
  sodiumMg: 'sodiumMg',
  omega3Per100g: 'omega3Per100g',
  fiberPer100g: 'fiberPer100g',
};

// ─── Core analysis ──────────────────────────────────────────────────────────

interface PlanIngredient {
  name: string;
  grams: number;
  cookingMethod?: CookingMethod;
}

interface PlanDay {
  day: string;
  meals: Array<{
    name: string;
    items: Array<{
      name: string;
      grams?: number;
      ingredients?: Array<{ name: string; grams: number }>;
      recipe?: { steps?: string[] };
    }>;
  }>;
}

/**
 * Extract all ingredients with grams from plan content.
 */
function extractIngredients(days: PlanDay[]): { perDay: PlanIngredient[][]; allNames: string[] } {
  const perDay: PlanIngredient[][] = [];
  const allNames = new Set<string>();

  for (const day of days) {
    const dayIngredients: PlanIngredient[] = [];
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        // Detect cooking method from recipe steps (38.4 retention)
        const cookingMethod = item.recipe?.steps?.length
          ? detectCookingMethod(item.recipe.steps)
          : undefined;

        if (item.ingredients?.length) {
          for (const ing of item.ingredients) {
            dayIngredients.push({ name: ing.name, grams: ing.grams, cookingMethod });
            allNames.add(ing.name.toLowerCase().trim());
          }
        } else if (item.grams && item.name) {
          dayIngredients.push({ name: item.name, grams: item.grams, cookingMethod });
          allNames.add(item.name.toLowerCase().trim());
        }
      }
    }
    perDay.push(dayIngredients);
  }

  return { perDay, allNames: [...allNames] };
}

/**
 * Look up nutrient data for ingredient names from CleanProduct DB.
 */
async function lookupNutrients(names: string[]): Promise<Map<string, Record<string, number>>> {
  if (names.length === 0) return new Map();

  const products = await prisma.cleanProduct.findMany({
    where: {
      OR: names.map((n) => ({ name: { contains: n, mode: 'insensitive' as const } })),
    },
    select: {
      name: true,
      nutrients: {
        select: {
          vitaminDUg: true, vitaminCMg: true, vitaminAUg: true, vitaminEMg: true, vitaminKUg: true,
          folateUg: true, vitaminB12Ug: true,
          calciumMg: true, magnesiumMg: true, ironMg: true, zincMg: true,
          potassiumMg: true, iodineUg: true, seleniumUg: true, phosphorusMg: true, sodiumMg: true,
          omega3Per100g: true, fiberPer100g: true,
        },
      },
    },
    take: 500,
  });

  const map = new Map<string, Record<string, number>>();
  for (const p of products) {
    if (!p.nutrients) continue;
    const key = p.name.toLowerCase().trim();
    const values: Record<string, number> = {};
    for (const [field, dbField] of Object.entries(ANALYZABLE_KEYS)) {
      const raw = (p.nutrients as unknown as Record<string, unknown>)[dbField];
      if (raw != null) values[field] = Number(raw);
    }
    map.set(key, values);
  }

  return map;
}

/**
 * Compute daily micronutrient totals from ingredients.
 */
function computeDailyTotals(
  dayIngredients: PlanIngredient[],
  nutrientMap: Map<string, Record<string, number>>,
): { totals: Record<string, number>; unmatched: string[] } {
  const totals: Record<string, number> = {};
  const unmatched: string[] = [];

  for (const ing of dayIngredients) {
    const key = ing.name.toLowerCase().trim();

    // Find best match
    let nutrients: Record<string, number> | undefined;
    if (nutrientMap.has(key)) {
      nutrients = nutrientMap.get(key);
    } else {
      // Try partial match
      for (const [mapKey, mapVal] of nutrientMap) {
        if (mapKey.includes(key) || key.includes(mapKey)) {
          nutrients = mapVal;
          break;
        }
      }
    }

    if (!nutrients) {
      unmatched.push(ing.name);
      continue;
    }

    // 38.4: Apply retention factors based on cooking method
    const adjustedNutrients = ing.cookingMethod
      ? applyRetention(nutrients, ing.cookingMethod)
      : nutrients;

    const factor = ing.grams / 100;
    for (const [field, per100g] of Object.entries(adjustedNutrients)) {
      totals[field] = (totals[field] ?? 0) + per100g * factor;
    }
  }

  return { totals, unmatched };
}

// ─── Supplement recommendations ─────────────────────────────────────────────

const SUPPLEMENT_RULES: Array<{
  key: string;
  label: string;
  condition: (status: NutrientStatus, intake: number, norm: NutrientNorm) => boolean;
  dose: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}> = [
  {
    key: 'vitaminDUg', label: 'Witamina D3',
    condition: (s) => s === 'DEFICIENT' || s === 'SUBOPTIMAL',
    dose: '2000-4000 IU/dzień',
    reason: 'Niedobór wit. D — szczególnie w okresie X-III w Polsce',
    priority: 'HIGH',
  },
  {
    key: 'magnesiumMg', label: 'Magnez',
    condition: (s) => s === 'DEFICIENT' || s === 'SUBOPTIMAL',
    dose: '150-300 mg/dzień (cytrynian lub bisgliycnat)',
    reason: 'Niedobór magnezu — wpływa na mięśnie, sen, stres',
    priority: 'MEDIUM',
  },
  {
    key: 'ironMg', label: 'Żelazo',
    condition: (s) => s === 'DEFICIENT',
    dose: '20-30 mg/dzień + wit. C (ułatwia wchłanianie)',
    reason: 'Niedobór żelaza — ryzyko anemii',
    priority: 'HIGH',
  },
  {
    key: 'vitaminB12Ug', label: 'Witamina B12',
    condition: (s) => s === 'DEFICIENT' || s === 'SUBOPTIMAL',
    dose: '1000 µg/dzień (metylokobalamina)',
    reason: 'Niedobór B12 — szczególnie ważne przy diecie roślinnej',
    priority: 'HIGH',
  },
  {
    key: 'folateUg', label: 'Kwas foliowy',
    condition: (s, _i, n) => (s === 'DEFICIENT' || s === 'SUBOPTIMAL') && (n.rda ?? 0) >= 600,
    dose: '400-800 µg/dzień (5-MTHF)',
    reason: 'Niedobór folianu — krytyczny w ciąży',
    priority: 'HIGH',
  },
  {
    key: 'calciumMg', label: 'Wapń',
    condition: (s) => s === 'DEFICIENT',
    dose: '500-1000 mg/dzień (cytrynian, nie z posiłkiem bogatym w żelazo)',
    reason: 'Niedobór wapnia — ryzyko osteoporozy',
    priority: 'MEDIUM',
  },
  {
    key: 'omega3Per100g', label: 'Omega-3 (EPA+DHA)',
    condition: (s) => s === 'DEFICIENT' || s === 'SUBOPTIMAL',
    dose: '500-1000 mg EPA+DHA/dzień',
    reason: 'Niedobór omega-3 — zdrowie serca i mózgu',
    priority: 'MEDIUM',
  },
  {
    key: 'iodineUg', label: 'Jod',
    condition: (s) => s === 'DEFICIENT',
    dose: '150-200 µg/dzień',
    reason: 'Niedobór jodu — funkcja tarczycy',
    priority: 'MEDIUM',
  },
  {
    key: 'seleniumUg', label: 'Selen',
    condition: (s) => s === 'DEFICIENT',
    dose: '55-100 µg/dzień (selenometionina)',
    reason: 'Niedobór selenu — ochrona antyoksydacyjna',
    priority: 'LOW',
  },
  {
    key: 'zincMg', label: 'Cynk',
    condition: (s) => s === 'DEFICIENT',
    dose: '15-25 mg/dzień (bisgliycnat)',
    reason: 'Niedobór cynku — odporność, gojenie',
    priority: 'MEDIUM',
  },
];

// ─── Main analysis function ─────────────────────────────────────────────────

export async function analyzePlanMicronutrients(
  planContent: { days?: PlanDay[] },
  patientSex: string | null,
  patientAge: number | null,
  pregnancy?: boolean,
  lactation?: boolean,
  patientSupplements?: string[],
): Promise<MicronutrientReport> {
  const days = planContent.days ?? [];
  if (days.length === 0) {
    const norms = getNormsForPatient(patientSex, patientAge, pregnancy, lactation);
    return {
      patientNorms: norms,
      assessments: [],
      deficiencies: [],
      suboptimal: [],
      excessive: [],
      supplementRecommendations: [],
      overallScore: 0,
      analyzedDays: 0,
      unmatchedIngredients: [],
    };
  }

  // 1. Extract ingredients per day
  const { perDay, allNames } = extractIngredients(days);

  // 2. Lookup nutrient data from DB
  const nutrientMap = await lookupNutrients(allNames);

  // 3. Compute daily totals and average
  const allUnmatched = new Set<string>();
  const dailyTotals: Record<string, number>[] = [];

  for (const dayIngredients of perDay) {
    const { totals, unmatched } = computeDailyTotals(dayIngredients, nutrientMap);
    dailyTotals.push(totals);
    unmatched.forEach((u) => allUnmatched.add(u));
  }

  // Average across days
  const avgIntake: Record<string, number> = {};
  const numDays = dailyTotals.length;
  for (const dt of dailyTotals) {
    for (const [key, val] of Object.entries(dt)) {
      avgIntake[key] = (avgIntake[key] ?? 0) + val / numDays;
    }
  }

  // 4. Get patient norms
  const norms = getNormsForPatient(patientSex, patientAge, pregnancy, lactation);

  // 5. Assess each nutrient
  const assessments: NutrientAssessment[] = norms.nutrients.map((norm) => {
    const intake = avgIntake[norm.nutrientKey] ?? 0;
    const target = getTarget(norm);
    const status = assessNutrientStatus(intake, norm);
    const percentOfTarget = target ? Math.round((intake / target) * 100) : null;

    return {
      nutrientKey: norm.nutrientKey,
      label: norm.label,
      unit: norm.unit,
      dailyAvgIntake: Math.round(intake * 10) / 10,
      target,
      ear: norm.ear ?? null,
      ul: norm.ul ?? null,
      status,
      percentOfTarget,
    };
  });

  const deficiencies = assessments.filter((a) => a.status === 'DEFICIENT');
  const suboptimal = assessments.filter((a) => a.status === 'SUBOPTIMAL');
  const excessive = assessments.filter((a) => a.status === 'EXCESSIVE');

  // 6. Generate supplement recommendations
  const supplementsLower = (patientSupplements ?? []).map((s) => s.toLowerCase());
  const supplementRecommendations: SupplementRecommendation[] = [];

  for (const rule of SUPPLEMENT_RULES) {
    const assessment = assessments.find((a) => a.nutrientKey === rule.key);
    if (!assessment) continue;

    const norm = norms.nutrients.find((n) => n.nutrientKey === rule.key);
    if (!norm) continue;

    // Skip if patient already takes this supplement
    const alreadyTaking = supplementsLower.some(
      (s) => s.includes(rule.label.toLowerCase()) || rule.label.toLowerCase().includes(s)
    );
    if (alreadyTaking) continue;

    if (rule.condition(assessment.status, assessment.dailyAvgIntake, norm)) {
      supplementRecommendations.push({
        nutrientKey: rule.key,
        label: rule.label,
        suggestedDose: rule.dose,
        reason: rule.reason,
        priority: rule.priority,
      });
    }
  }

  // 7. Overall score
  const adequateCount = assessments.filter((a) => a.status === 'ADEQUATE').length;
  const overallScore = assessments.length > 0
    ? Math.round((adequateCount / assessments.length) * 100)
    : 0;

  return {
    patientNorms: norms,
    assessments,
    deficiencies,
    suboptimal,
    excessive,
    supplementRecommendations,
    overallScore,
    analyzedDays: numDays,
    unmatchedIngredients: [...allUnmatched],
  };
}
