/**
 * 38.4 — USDA Nutrient Retention Factors.
 *
 * Cooking causes nutrient losses. These factors (0.0–1.0) represent
 * the fraction of a nutrient retained after a cooking method.
 * Source: USDA Table of Nutrient Retention Factors, Release 6 (2007).
 *
 * We model the most common cooking methods and nutrient groups.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type CookingMethod =
  | 'raw'
  | 'boiling'
  | 'steaming'
  | 'baking'
  | 'frying'
  | 'grilling'
  | 'microwaving'
  | 'stewing'
  | 'pressure_cooking';

export type NutrientGroup =
  | 'vitaminC'
  | 'vitaminB1'
  | 'vitaminB2'
  | 'vitaminB6'
  | 'vitaminB12'
  | 'folate'
  | 'vitaminA'
  | 'vitaminD'
  | 'vitaminE'
  | 'vitaminK'
  | 'calcium'
  | 'iron'
  | 'zinc'
  | 'magnesium'
  | 'potassium'
  | 'selenium'
  | 'iodine'
  | 'phosphorus'
  | 'sodium'
  | 'omega3'
  | 'fiber'
  | 'protein'
  | 'fat'
  | 'carbs';

// ─── Retention Factor Table ─────────────────────────────────────────────────

/**
 * Retention factors per cooking method per nutrient group.
 * Values are approximate averages from USDA data for mixed food categories.
 * Missing combinations default to 1.0 (no loss).
 */
const RETENTION_TABLE: Record<CookingMethod, Partial<Record<NutrientGroup, number>>> = {
  raw: {}, // all 1.0

  boiling: {
    vitaminC:  0.50,
    vitaminB1: 0.70,
    vitaminB2: 0.80,
    vitaminB6: 0.65,
    vitaminB12: 0.70,
    folate:    0.50,
    vitaminA:  0.85,
    vitaminD:  0.90,
    vitaminE:  0.85,
    vitaminK:  0.90,
    calcium:   0.85,
    iron:      0.85,
    zinc:      0.85,
    magnesium: 0.80,
    potassium: 0.70,
    selenium:  0.85,
    iodine:    0.60,
    phosphorus: 0.85,
    sodium:    0.80,
    omega3:    0.85,
    fiber:     0.95,
    protein:   0.95,
    fat:       0.95,
    carbs:     0.90,
  },

  steaming: {
    vitaminC:  0.75,
    vitaminB1: 0.85,
    vitaminB2: 0.90,
    vitaminB6: 0.80,
    vitaminB12: 0.85,
    folate:    0.70,
    vitaminA:  0.90,
    vitaminD:  0.95,
    vitaminE:  0.90,
    vitaminK:  0.95,
    calcium:   0.95,
    iron:      0.95,
    zinc:      0.95,
    magnesium: 0.90,
    potassium: 0.85,
    selenium:  0.90,
    iodine:    0.80,
    phosphorus: 0.95,
    sodium:    0.90,
    omega3:    0.90,
    fiber:     0.97,
    protein:   0.97,
    fat:       0.97,
    carbs:     0.95,
  },

  baking: {
    vitaminC:  0.60,
    vitaminB1: 0.80,
    vitaminB2: 0.85,
    vitaminB6: 0.75,
    vitaminB12: 0.80,
    folate:    0.60,
    vitaminA:  0.85,
    vitaminD:  0.85,
    vitaminE:  0.80,
    vitaminK:  0.90,
    calcium:   0.90,
    iron:      0.90,
    zinc:      0.90,
    magnesium: 0.85,
    potassium: 0.80,
    selenium:  0.90,
    iodine:    0.70,
    phosphorus: 0.90,
    sodium:    0.85,
    omega3:    0.80,
    fiber:     0.95,
    protein:   0.95,
    fat:       0.90,
    carbs:     0.90,
  },

  frying: {
    vitaminC:  0.45,
    vitaminB1: 0.70,
    vitaminB2: 0.80,
    vitaminB6: 0.65,
    vitaminB12: 0.75,
    folate:    0.50,
    vitaminA:  0.75,
    vitaminD:  0.80,
    vitaminE:  0.70,
    vitaminK:  0.85,
    calcium:   0.90,
    iron:      0.85,
    zinc:      0.85,
    magnesium: 0.80,
    potassium: 0.75,
    selenium:  0.85,
    iodine:    0.65,
    phosphorus: 0.85,
    sodium:    0.80,
    omega3:    0.70,
    fiber:     0.95,
    protein:   0.90,
    fat:       0.90,
    carbs:     0.85,
  },

  grilling: {
    vitaminC:  0.50,
    vitaminB1: 0.75,
    vitaminB2: 0.85,
    vitaminB6: 0.70,
    vitaminB12: 0.80,
    folate:    0.55,
    vitaminA:  0.80,
    vitaminD:  0.85,
    vitaminE:  0.75,
    vitaminK:  0.85,
    calcium:   0.90,
    iron:      0.90,
    zinc:      0.90,
    magnesium: 0.85,
    potassium: 0.80,
    selenium:  0.90,
    iodine:    0.70,
    phosphorus: 0.90,
    sodium:    0.85,
    omega3:    0.75,
    fiber:     0.95,
    protein:   0.92,
    fat:       0.85,
    carbs:     0.90,
  },

  microwaving: {
    vitaminC:  0.70,
    vitaminB1: 0.85,
    vitaminB2: 0.90,
    vitaminB6: 0.80,
    vitaminB12: 0.85,
    folate:    0.70,
    vitaminA:  0.90,
    vitaminD:  0.90,
    vitaminE:  0.90,
    vitaminK:  0.95,
    calcium:   0.95,
    iron:      0.95,
    zinc:      0.95,
    magnesium: 0.90,
    potassium: 0.85,
    selenium:  0.90,
    iodine:    0.75,
    phosphorus: 0.95,
    sodium:    0.90,
    omega3:    0.85,
    fiber:     0.97,
    protein:   0.97,
    fat:       0.95,
    carbs:     0.95,
  },

  stewing: {
    vitaminC:  0.55,
    vitaminB1: 0.75,
    vitaminB2: 0.85,
    vitaminB6: 0.70,
    vitaminB12: 0.75,
    folate:    0.55,
    vitaminA:  0.85,
    vitaminD:  0.85,
    vitaminE:  0.80,
    vitaminK:  0.90,
    calcium:   0.90,
    iron:      0.90,
    zinc:      0.90,
    magnesium: 0.85,
    potassium: 0.85, // liquid is consumed
    selenium:  0.85,
    iodine:    0.65,
    phosphorus: 0.90,
    sodium:    0.90,
    omega3:    0.80,
    fiber:     0.95,
    protein:   0.95,
    fat:       0.90,
    carbs:     0.90,
  },

  pressure_cooking: {
    vitaminC:  0.55,
    vitaminB1: 0.80,
    vitaminB2: 0.85,
    vitaminB6: 0.75,
    vitaminB12: 0.80,
    folate:    0.55,
    vitaminA:  0.85,
    vitaminD:  0.90,
    vitaminE:  0.85,
    vitaminK:  0.90,
    calcium:   0.90,
    iron:      0.90,
    zinc:      0.90,
    magnesium: 0.85,
    potassium: 0.80,
    selenium:  0.90,
    iodine:    0.70,
    phosphorus: 0.90,
    sodium:    0.85,
    omega3:    0.80,
    fiber:     0.95,
    protein:   0.95,
    fat:       0.90,
    carbs:     0.90,
  },
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get retention factor for a given cooking method and nutrient.
 * Returns a number between 0 and 1 (fraction retained).
 * Returns 1.0 for raw or unknown method/nutrient combinations.
 */
export function getRetentionFactor(
  method: CookingMethod | string | undefined,
  nutrient: NutrientGroup | string,
): number {
  if (!method || method === 'raw') return 1.0;

  const methodFactors = RETENTION_TABLE[method as CookingMethod];
  if (!methodFactors) return 1.0;

  return methodFactors[nutrient as NutrientGroup] ?? 1.0;
}

/**
 * Apply retention factors to a record of nutrient values.
 * Mutates nothing — returns a new object with adjusted values.
 */
export function applyRetention(
  nutrients: Record<string, number>,
  method: CookingMethod | string | undefined,
): Record<string, number> {
  if (!method || method === 'raw') return { ...nutrients };

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(nutrients)) {
    const nutrientGroup = mapFieldToNutrientGroup(key);
    const factor = getRetentionFactor(method, nutrientGroup);
    result[key] = Math.round(value * factor * 100) / 100;
  }
  return result;
}

/**
 * Detect cooking method from recipe steps text (Polish/English keywords).
 */
export function detectCookingMethod(recipeSteps: string[]): CookingMethod {
  const text = recipeSteps.join(' ').toLowerCase();

  // Order matters — more specific patterns first
  if (/szybkowar|pressure\s*cook/i.test(text)) return 'pressure_cooking';
  if (/grill|griluj|grillowa|z grilla/i.test(text)) return 'grilling';
  if (/smaż|smażen|smaży|patel[nń]|fry|frying|pan[- ]?fry|deep[- ]?fry/i.test(text)) return 'frying';
  if (/dusz|duszon|gulasz|stew|simmer|na wolnym ogniu/i.test(text)) return 'stewing';
  if (/piecz|piec[zk]|piekarni|bake|baking|roast|zapiekaj/i.test(text)) return 'baking';
  if (/par[ąa]|na parze|steam/i.test(text)) return 'steaming';
  if (/mikrofal|microwave/i.test(text)) return 'microwaving';
  if (/gotuj|gotowa[nć]|ugotuj|warz|boil|blanszuj/i.test(text)) return 'boiling';

  return 'raw';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map DB field names (e.g. vitaminCMg, ironMg) to NutrientGroup keys.
 */
function mapFieldToNutrientGroup(field: string): NutrientGroup {
  const mapping: Record<string, NutrientGroup> = {
    vitaminCMg: 'vitaminC',
    vitaminAUg: 'vitaminA',
    vitaminDUg: 'vitaminD',
    vitaminEMg: 'vitaminE',
    vitaminKUg: 'vitaminK',
    vitaminB1Mg: 'vitaminB1',
    vitaminB2Mg: 'vitaminB2',
    vitaminB6Mg: 'vitaminB6',
    vitaminB12Ug: 'vitaminB12',
    folateUg: 'folate',
    calciumMg: 'calcium',
    ironMg: 'iron',
    zincMg: 'zinc',
    magnesiumMg: 'magnesium',
    potassiumMg: 'potassium',
    seleniumUg: 'selenium',
    iodineUg: 'iodine',
    phosphorusMg: 'phosphorus',
    sodiumMg: 'sodium',
    omega3Per100g: 'omega3',
    fiberPer100g: 'fiber',
    proteinPer100g: 'protein',
    fatPer100g: 'fat',
    carbsPer100g: 'carbs',
    kcalPer100g: 'carbs', // kcal doesn't have a retention factor per se; approximated via macros
  };

  return mapping[field] ?? 'protein'; // default: high retention
}

/**
 * Get a human-readable label for a cooking method (Polish).
 */
export function getCookingMethodLabel(method: CookingMethod): string {
  const labels: Record<CookingMethod, string> = {
    raw: 'Surowe',
    boiling: 'Gotowanie',
    steaming: 'Gotowanie na parze',
    baking: 'Pieczenie',
    frying: 'Smażenie',
    grilling: 'Grillowanie',
    microwaving: 'Mikrofalówka',
    stewing: 'Duszenie',
    pressure_cooking: 'Szybkowar',
  };
  return labels[method] ?? method;
}
