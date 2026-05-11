/**
 * 38.1 — IŻŻ 2020 Dietary Reference Intakes for Poland.
 *
 * Sources:
 * - "Normy żywienia dla populacji Polski i ich zastosowanie" (IŻŻ, Warszawa 2020)
 * - Selected values for adults 19-75+ years, pregnancy, lactation.
 *
 * Norm types:
 * - EAR  = Estimated Average Requirement (covers 50% of population)
 * - RDA  = Recommended Dietary Allowance (covers 97.5%)
 * - AI   = Adequate Intake (used when EAR cannot be established)
 * - UL   = Tolerable Upper Intake Level (max safe daily intake)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type Sex = 'M' | 'F';
export type AgeGroup = '19-30' | '31-50' | '51-65' | '66-75' | '75+';
export type SpecialState = 'pregnancy' | 'lactation' | null;

export interface NutrientNorm {
  nutrientKey: string;
  label: string;
  unit: string;
  ear?: number | null;  // Estimated Average Requirement
  rda?: number | null;  // Recommended Dietary Allowance
  ai?: number | null;   // Adequate Intake (when EAR unavailable)
  ul?: number | null;   // Tolerable Upper Intake Level
}

export interface PatientNorms {
  sex: Sex;
  ageGroup: AgeGroup;
  specialState: SpecialState;
  nutrients: NutrientNorm[];
}

// ─── Demographic key ────────────────────────────────────────────────────────

type DemoKey = `${Sex}_${AgeGroup}` | 'pregnancy' | 'lactation';

function getDemoKey(sex: Sex, ageGroup: AgeGroup, specialState: SpecialState): DemoKey {
  if (specialState === 'pregnancy') return 'pregnancy';
  if (specialState === 'lactation') return 'lactation';
  return `${sex}_${ageGroup}`;
}

function getAgeGroup(age: number): AgeGroup {
  if (age <= 30) return '19-30';
  if (age <= 50) return '31-50';
  if (age <= 65) return '51-65';
  if (age <= 75) return '66-75';
  return '75+';
}

// ─── Norms data (IŻŻ 2020) ─────────────────────────────────────────────────
// Format: [EAR, RDA, AI, UL] — null means not established

interface NormValues { ear?: number | null; rda?: number | null; ai?: number | null; ul?: number | null }

type NormEntry = {
  key: string;
  label: string;
  unit: string;
  values: Record<DemoKey, NormValues>;
};

// Helper to reduce repetition
function v(ear: number | null, rda: number | null, ai: number | null, ul: number | null): NormValues {
  return { ear, rda, ai, ul };
}

const NORMS: NormEntry[] = [
  // ─── Vitamins ───
  {
    key: 'vitaminDUg', label: 'Witamina D', unit: 'µg',
    values: {
      'M_19-30': v(null, null, 15, 100), 'M_31-50': v(null, null, 15, 100),
      'M_51-65': v(null, null, 15, 100), 'M_66-75': v(null, null, 15, 100), 'M_75+': v(null, null, 15, 100),
      'F_19-30': v(null, null, 15, 100), 'F_31-50': v(null, null, 15, 100),
      'F_51-65': v(null, null, 15, 100), 'F_66-75': v(null, null, 15, 100), 'F_75+': v(null, null, 15, 100),
      pregnancy: v(null, null, 15, 100), lactation: v(null, null, 15, 100),
    },
  },
  {
    key: 'vitaminCMg', label: 'Witamina C', unit: 'mg',
    values: {
      'M_19-30': v(75, 90, null, 2000), 'M_31-50': v(75, 90, null, 2000),
      'M_51-65': v(75, 90, null, 2000), 'M_66-75': v(75, 90, null, 2000), 'M_75+': v(75, 90, null, 2000),
      'F_19-30': v(60, 75, null, 2000), 'F_31-50': v(60, 75, null, 2000),
      'F_51-65': v(60, 75, null, 2000), 'F_66-75': v(60, 75, null, 2000), 'F_75+': v(60, 75, null, 2000),
      pregnancy: v(70, 85, null, 2000), lactation: v(100, 120, null, 2000),
    },
  },
  {
    key: 'vitaminAUg', label: 'Witamina A (RE)', unit: 'µg',
    values: {
      'M_19-30': v(625, 900, null, 3000), 'M_31-50': v(625, 900, null, 3000),
      'M_51-65': v(625, 900, null, 3000), 'M_66-75': v(625, 900, null, 3000), 'M_75+': v(625, 900, null, 3000),
      'F_19-30': v(500, 700, null, 3000), 'F_31-50': v(500, 700, null, 3000),
      'F_51-65': v(500, 700, null, 3000), 'F_66-75': v(500, 700, null, 3000), 'F_75+': v(500, 700, null, 3000),
      pregnancy: v(550, 770, null, 3000), lactation: v(900, 1300, null, 3000),
    },
  },
  {
    key: 'vitaminEMg', label: 'Witamina E', unit: 'mg',
    values: {
      'M_19-30': v(null, null, 10, 300), 'M_31-50': v(null, null, 10, 300),
      'M_51-65': v(null, null, 10, 300), 'M_66-75': v(null, null, 10, 300), 'M_75+': v(null, null, 10, 300),
      'F_19-30': v(null, null, 8, 300), 'F_31-50': v(null, null, 8, 300),
      'F_51-65': v(null, null, 8, 300), 'F_66-75': v(null, null, 8, 300), 'F_75+': v(null, null, 8, 300),
      pregnancy: v(null, null, 10, 300), lactation: v(null, null, 11, 300),
    },
  },
  {
    key: 'vitaminKUg', label: 'Witamina K', unit: 'µg',
    values: {
      'M_19-30': v(null, null, 65, null), 'M_31-50': v(null, null, 65, null),
      'M_51-65': v(null, null, 65, null), 'M_66-75': v(null, null, 65, null), 'M_75+': v(null, null, 65, null),
      'F_19-30': v(null, null, 55, null), 'F_31-50': v(null, null, 55, null),
      'F_51-65': v(null, null, 55, null), 'F_66-75': v(null, null, 55, null), 'F_75+': v(null, null, 55, null),
      pregnancy: v(null, null, 55, null), lactation: v(null, null, 55, null),
    },
  },
  {
    key: 'folateUg', label: 'Folian', unit: 'µg DFE',
    values: {
      'M_19-30': v(320, 400, null, 1000), 'M_31-50': v(320, 400, null, 1000),
      'M_51-65': v(320, 400, null, 1000), 'M_66-75': v(320, 400, null, 1000), 'M_75+': v(320, 400, null, 1000),
      'F_19-30': v(320, 400, null, 1000), 'F_31-50': v(320, 400, null, 1000),
      'F_51-65': v(320, 400, null, 1000), 'F_66-75': v(320, 400, null, 1000), 'F_75+': v(320, 400, null, 1000),
      pregnancy: v(520, 600, null, 1000), lactation: v(450, 500, null, 1000),
    },
  },
  {
    key: 'vitaminB12Ug', label: 'Witamina B12', unit: 'µg',
    values: {
      'M_19-30': v(2.0, 2.4, null, null), 'M_31-50': v(2.0, 2.4, null, null),
      'M_51-65': v(2.0, 2.4, null, null), 'M_66-75': v(2.0, 2.4, null, null), 'M_75+': v(2.0, 2.4, null, null),
      'F_19-30': v(2.0, 2.4, null, null), 'F_31-50': v(2.0, 2.4, null, null),
      'F_51-65': v(2.0, 2.4, null, null), 'F_66-75': v(2.0, 2.4, null, null), 'F_75+': v(2.0, 2.4, null, null),
      pregnancy: v(2.2, 2.6, null, null), lactation: v(2.4, 2.8, null, null),
    },
  },
  // ─── Minerals ───
  {
    key: 'calciumMg', label: 'Wapń (Ca)', unit: 'mg',
    values: {
      'M_19-30': v(800, 1000, null, 2500), 'M_31-50': v(800, 1000, null, 2500),
      'M_51-65': v(800, 1000, null, 2500), 'M_66-75': v(1000, 1200, null, 2500), 'M_75+': v(1000, 1200, null, 2500),
      'F_19-30': v(800, 1000, null, 2500), 'F_31-50': v(800, 1000, null, 2500),
      'F_51-65': v(1000, 1200, null, 2500), 'F_66-75': v(1000, 1200, null, 2500), 'F_75+': v(1000, 1200, null, 2500),
      pregnancy: v(800, 1000, null, 2500), lactation: v(800, 1000, null, 2500),
    },
  },
  {
    key: 'magnesiumMg', label: 'Magnez (Mg)', unit: 'mg',
    values: {
      'M_19-30': v(330, 400, null, 350), 'M_31-50': v(350, 420, null, 350),
      'M_51-65': v(350, 420, null, 350), 'M_66-75': v(350, 420, null, 350), 'M_75+': v(350, 420, null, 350),
      'F_19-30': v(255, 310, null, 350), 'F_31-50': v(265, 320, null, 350),
      'F_51-65': v(265, 320, null, 350), 'F_66-75': v(265, 320, null, 350), 'F_75+': v(265, 320, null, 350),
      pregnancy: v(290, 360, null, 350), lactation: v(255, 320, null, 350),
    },
  },
  {
    key: 'ironMg', label: 'Żelazo (Fe)', unit: 'mg',
    values: {
      'M_19-30': v(6, 10, null, 45), 'M_31-50': v(6, 10, null, 45),
      'M_51-65': v(6, 10, null, 45), 'M_66-75': v(6, 10, null, 45), 'M_75+': v(6, 10, null, 45),
      'F_19-30': v(8, 18, null, 45), 'F_31-50': v(8, 18, null, 45),
      'F_51-65': v(6, 10, null, 45), 'F_66-75': v(6, 10, null, 45), 'F_75+': v(6, 10, null, 45),
      pregnancy: v(23, 27, null, 45), lactation: v(7, 10, null, 45),
    },
  },
  {
    key: 'zincMg', label: 'Cynk (Zn)', unit: 'mg',
    values: {
      'M_19-30': v(9.4, 11, null, 25), 'M_31-50': v(9.4, 11, null, 25),
      'M_51-65': v(9.4, 11, null, 25), 'M_66-75': v(9.4, 11, null, 25), 'M_75+': v(9.4, 11, null, 25),
      'F_19-30': v(6.8, 8, null, 25), 'F_31-50': v(6.8, 8, null, 25),
      'F_51-65': v(6.8, 8, null, 25), 'F_66-75': v(6.8, 8, null, 25), 'F_75+': v(6.8, 8, null, 25),
      pregnancy: v(9.5, 11, null, 25), lactation: v(10.4, 12, null, 25),
    },
  },
  {
    key: 'potassiumMg', label: 'Potas (K)', unit: 'mg',
    values: {
      'M_19-30': v(null, null, 3500, null), 'M_31-50': v(null, null, 3500, null),
      'M_51-65': v(null, null, 3500, null), 'M_66-75': v(null, null, 3500, null), 'M_75+': v(null, null, 3500, null),
      'F_19-30': v(null, null, 3500, null), 'F_31-50': v(null, null, 3500, null),
      'F_51-65': v(null, null, 3500, null), 'F_66-75': v(null, null, 3500, null), 'F_75+': v(null, null, 3500, null),
      pregnancy: v(null, null, 3500, null), lactation: v(null, null, 3500, null),
    },
  },
  {
    key: 'iodineUg', label: 'Jod (I)', unit: 'µg',
    values: {
      'M_19-30': v(95, 150, null, 600), 'M_31-50': v(95, 150, null, 600),
      'M_51-65': v(95, 150, null, 600), 'M_66-75': v(95, 150, null, 600), 'M_75+': v(95, 150, null, 600),
      'F_19-30': v(95, 150, null, 600), 'F_31-50': v(95, 150, null, 600),
      'F_51-65': v(95, 150, null, 600), 'F_66-75': v(95, 150, null, 600), 'F_75+': v(95, 150, null, 600),
      pregnancy: v(160, 220, null, 600), lactation: v(209, 290, null, 600),
    },
  },
  {
    key: 'seleniumUg', label: 'Selen (Se)', unit: 'µg',
    values: {
      'M_19-30': v(45, 55, null, 300), 'M_31-50': v(45, 55, null, 300),
      'M_51-65': v(45, 55, null, 300), 'M_66-75': v(45, 55, null, 300), 'M_75+': v(45, 55, null, 300),
      'F_19-30': v(45, 55, null, 300), 'F_31-50': v(45, 55, null, 300),
      'F_51-65': v(45, 55, null, 300), 'F_66-75': v(45, 55, null, 300), 'F_75+': v(45, 55, null, 300),
      pregnancy: v(49, 60, null, 300), lactation: v(59, 70, null, 300),
    },
  },
  {
    key: 'phosphorusMg', label: 'Fosfor (P)', unit: 'mg',
    values: {
      'M_19-30': v(580, 700, null, 4000), 'M_31-50': v(580, 700, null, 4000),
      'M_51-65': v(580, 700, null, 4000), 'M_66-75': v(580, 700, null, 3000), 'M_75+': v(580, 700, null, 3000),
      'F_19-30': v(580, 700, null, 4000), 'F_31-50': v(580, 700, null, 4000),
      'F_51-65': v(580, 700, null, 4000), 'F_66-75': v(580, 700, null, 3000), 'F_75+': v(580, 700, null, 3000),
      pregnancy: v(580, 700, null, 3500), lactation: v(580, 700, null, 4000),
    },
  },
  {
    key: 'sodiumMg', label: 'Sód (Na)', unit: 'mg',
    values: {
      'M_19-30': v(null, null, 1500, 2300), 'M_31-50': v(null, null, 1500, 2300),
      'M_51-65': v(null, null, 1500, 2300), 'M_66-75': v(null, null, 1500, 2300), 'M_75+': v(null, null, 1500, 2300),
      'F_19-30': v(null, null, 1500, 2300), 'F_31-50': v(null, null, 1500, 2300),
      'F_51-65': v(null, null, 1500, 2300), 'F_66-75': v(null, null, 1500, 2300), 'F_75+': v(null, null, 1500, 2300),
      pregnancy: v(null, null, 1500, 2300), lactation: v(null, null, 1500, 2300),
    },
  },
  // ─── Other ───
  {
    key: 'omega3Per100g', label: 'Omega-3 (ALA+EPA+DHA)', unit: 'g',
    values: {
      'M_19-30': v(null, null, 1.6, null), 'M_31-50': v(null, null, 1.6, null),
      'M_51-65': v(null, null, 1.6, null), 'M_66-75': v(null, null, 1.6, null), 'M_75+': v(null, null, 1.6, null),
      'F_19-30': v(null, null, 1.1, null), 'F_31-50': v(null, null, 1.1, null),
      'F_51-65': v(null, null, 1.1, null), 'F_66-75': v(null, null, 1.1, null), 'F_75+': v(null, null, 1.1, null),
      pregnancy: v(null, null, 1.4, null), lactation: v(null, null, 1.3, null),
    },
  },
  {
    key: 'fiberPer100g', label: 'Błonnik', unit: 'g',
    values: {
      'M_19-30': v(null, null, 25, null), 'M_31-50': v(null, null, 25, null),
      'M_51-65': v(null, null, 25, null), 'M_66-75': v(null, null, 25, null), 'M_75+': v(null, null, 25, null),
      'F_19-30': v(null, null, 25, null), 'F_31-50': v(null, null, 25, null),
      'F_51-65': v(null, null, 25, null), 'F_66-75': v(null, null, 25, null), 'F_75+': v(null, null, 25, null),
      pregnancy: v(null, null, 28, null), lactation: v(null, null, 29, null),
    },
  },
];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get dietary norms for a patient based on sex, age, and special state.
 */
export function getNormsForPatient(
  sex: string | null,
  age: number | null,
  pregnancy?: boolean,
  lactation?: boolean,
): PatientNorms {
  const normalizedSex: Sex = sex?.toUpperCase() === 'M' ? 'M' : 'F';
  const ageGroup = getAgeGroup(age ?? 30);
  const specialState: SpecialState = lactation ? 'lactation' : pregnancy ? 'pregnancy' : null;
  const demoKey = getDemoKey(normalizedSex, ageGroup, specialState);

  const nutrients: NutrientNorm[] = NORMS.map((norm) => {
    const vals = norm.values[demoKey] ?? norm.values[`${normalizedSex}_${ageGroup}`];
    return {
      nutrientKey: norm.key,
      label: norm.label,
      unit: norm.unit,
      ear: vals?.ear ?? null,
      rda: vals?.rda ?? null,
      ai: vals?.ai ?? null,
      ul: vals?.ul ?? null,
    };
  });

  return { sex: normalizedSex, ageGroup, specialState, nutrients };
}

/**
 * Get the target value for a nutrient (RDA preferred, then AI).
 */
export function getTarget(norm: NutrientNorm): number | null {
  return norm.rda ?? norm.ai ?? null;
}

/**
 * Assess intake status for a single nutrient.
 */
export type NutrientStatus = 'DEFICIENT' | 'SUBOPTIMAL' | 'ADEQUATE' | 'EXCESSIVE';

export function assessNutrientStatus(intake: number, norm: NutrientNorm): NutrientStatus {
  if (norm.ul != null && intake > norm.ul) return 'EXCESSIVE';
  if (norm.rda != null) {
    if (intake >= norm.rda) return 'ADEQUATE';
    if (norm.ear != null && intake < norm.ear) return 'DEFICIENT';
    return 'SUBOPTIMAL';
  }
  if (norm.ai != null) {
    return intake >= norm.ai ? 'ADEQUATE' : 'SUBOPTIMAL';
  }
  return 'ADEQUATE';
}

/**
 * Get all norm entries (for export/display).
 */
export function getAllNormEntries(): NormEntry[] {
  return NORMS;
}
