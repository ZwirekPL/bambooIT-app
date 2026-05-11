/**
 * Nutrient retention-factor computer (S-11 follow-up).
 *
 * When food is cooked, some nutrients (vitamins, some minerals) degrade.
 * Conservative USDA retention tables give a factor (0-1) to multiply
 * per-nutrient by. Factors depend on the cooking method.
 *
 * This module:
 *   1. Classifies a cooking step into one method (raw/steam/boil/bake/fry/...).
 *   2. Returns a per-nutrient-class retention factor table.
 *   3. Aggregates across a recipe's steps by picking the most-destructive method
 *      observed (conservative — we don't want to over-claim vitamin content).
 *
 * Returns structured data; does NOT persist anything. Schema-layer integration
 * (new RecipeInstructionStep.retentionFactor column) is a separate task.
 */

// ─── Cooking methods ───────────────────────────────────────────────────────────

export type CookingMethod =
  | 'raw'       // no heat — salads, dressings
  | 'marinate'  // chemical "cooking" — ceviche, pickled
  | 'steam'     // gentlest heat method
  | 'boil'      // water-soluble vitamins leach out
  | 'simmer'    // lower temperature than boil
  | 'poach'
  | 'sous_vide' // low-temp bath, very high retention
  | 'braise'    // long, moist heat
  | 'stew'      // similar to braise
  | 'bake'      // dry oven heat
  | 'roast'     // high dry heat
  | 'grill'     // direct high heat
  | 'broil'     // similar to grill
  | 'fry'       // oil medium-high temp
  | 'deep_fry'  // submerged
  | 'saute'     // short, high
  | 'stir_fry'  // very short, very high
  | 'microwave' // typically shorter than oven; moderate loss
  | 'unknown';

// Patterns run after normalizeProductName (lowercase + NFD strip).
// Listed in precedence order — more specific first so "smaz w glebokim"
// resolves to deep_fry before plain fry.
const METHOD_PATTERNS: Array<{ method: CookingMethod; re: RegExp }> = [
  { method: 'deep_fry', re: /\bglebok\S*\s+olej|frytownic|\bw\s+gleb\S*\s+olej/ },
  { method: 'stir_fry', re: /\bstir[- ]?fry|\bna woku\b|\bwok\b|stirfry/ },
  { method: 'sous_vide', re: /\bsous[- ]?vide/ },
  { method: 'marinate', re: /\bmaryn/ },
  { method: 'microwave', re: /mikrofal/ },
  { method: 'saute',    re: /\bpodsmaz|\bpodpraz/ },
  { method: 'grill',    re: /\bgrill|\bna ruszc/ },
  { method: 'broil',    re: /\bbroil/ },
  { method: 'roast',    re: /\bpiec\S*\s+w\s+piekarnik|\bupiec\S*\s+w\s+piekarnik|\bopiekaj/ },
  { method: 'bake',     re: /\bpiec\S*|\bupiec\S*|piekarnik/ },
  { method: 'stew',     re: /\bdus\S*|gulasz/ },
  { method: 'braise',   re: /\bdus\S*\s+pod\s+przykry/ },
  { method: 'poach',    re: /\bposzet|\bpoch\S*\s+w\s+wodzie|\bgotuj\S*\s+delikatn/ },
  { method: 'steam',    re: /\bna\s+parze\b|\bparowac|\bgotuj\S*\s+na\s+parze/ },
  { method: 'simmer',   re: /\bgotuj\S*\s+na\s+(wolnym|malym)\s+ogn|\bzagotuj\S*\s+i\s+zmniejsz/ },
  { method: 'boil',     re: /\bgotuj\S*\s+w\s+(wodzie|osolonej)|\bzagotuj\S*|\bal\s+dente/ },
  { method: 'fry',      re: /\bsmaz\S*|\bpraz\S*/ },
  { method: 'raw',      re: /\bna\s+surowo\b|\bsurowy\b|\bsurowa\b|\bsurowe\b|\bbez\s+gotowan/ },
];

// Pre-normalization reuse would import productMatcher here. Keep the
// dependency light and inline the normalization locally.
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

export function classifyCookingMethod(stepText: string): CookingMethod {
  if (!stepText) return 'unknown';
  const t = normalizeForMatching(stepText);
  for (const { method, re } of METHOD_PATTERNS) {
    if (re.test(t)) return method;
  }
  return 'unknown';
}

// ─── Retention tables ──────────────────────────────────────────────────────────

export type NutrientClass =
  | 'vitC'         // water-soluble, heat-sensitive
  | 'vitB1'        // thiamin — heat-sensitive, water-soluble
  | 'vitB9'        // folate — heat-sensitive, water-soluble
  | 'vitB12'       // moderate
  | 'vitA'         // fat-soluble, heat-stable
  | 'vitD'
  | 'vitE'
  | 'vitK'
  | 'minerals'     // Na/K/Ca/Fe/Zn etc — mostly preserved, some leach into cooking water
  | 'protein'      // stable; minor denaturation doesn't reduce g-per-serving
  | 'fat'
  | 'carbs'
  | 'fiber'
  | 'omega3';      // oxidation-sensitive at high heat

/**
 * Retention factors from USDA Table 13 (Retention Factors for Cooked Foods)
 * averaged where necessary. Represents fraction of nutrient *retained per 100 g
 * edible portion* after typical cooking. Numbers are intentionally conservative.
 */
const RETENTION: Record<CookingMethod, Partial<Record<NutrientClass, number>>> = {
  raw:        {},
  marinate:   { vitC: 0.95, vitB1: 0.95, vitB9: 0.95, omega3: 1.0 },
  sous_vide:  { vitC: 0.85, vitB1: 0.90, vitB9: 0.90, vitB12: 0.95, minerals: 0.95, omega3: 1.0 },
  steam:      { vitC: 0.80, vitB1: 0.85, vitB9: 0.85, vitB12: 0.90, minerals: 0.90, omega3: 1.0 },
  poach:      { vitC: 0.70, vitB1: 0.80, vitB9: 0.75, vitB12: 0.85, minerals: 0.85, omega3: 0.95 },
  microwave:  { vitC: 0.75, vitB1: 0.85, vitB9: 0.80, vitB12: 0.90, minerals: 0.90, omega3: 0.95 },
  simmer:     { vitC: 0.55, vitB1: 0.70, vitB9: 0.60, vitB12: 0.80, minerals: 0.75, omega3: 0.90 },
  boil:       { vitC: 0.50, vitB1: 0.65, vitB9: 0.55, vitB12: 0.75, minerals: 0.70, omega3: 0.85 },
  braise:     { vitC: 0.40, vitB1: 0.65, vitB9: 0.55, vitB12: 0.75, minerals: 0.75, omega3: 0.85 },
  stew:       { vitC: 0.40, vitB1: 0.65, vitB9: 0.55, vitB12: 0.75, minerals: 0.75, omega3: 0.85 },
  bake:       { vitC: 0.60, vitB1: 0.70, vitB9: 0.70, vitB12: 0.80, vitA: 0.90, minerals: 0.85, omega3: 0.80 },
  roast:      { vitC: 0.55, vitB1: 0.65, vitB9: 0.70, vitB12: 0.80, vitA: 0.90, minerals: 0.85, omega3: 0.75 },
  grill:      { vitC: 0.60, vitB1: 0.65, vitB9: 0.70, vitB12: 0.80, vitA: 0.85, minerals: 0.85, omega3: 0.70 },
  broil:      { vitC: 0.60, vitB1: 0.65, vitB9: 0.70, vitB12: 0.80, vitA: 0.85, minerals: 0.85, omega3: 0.70 },
  stir_fry:   { vitC: 0.70, vitB1: 0.80, vitB9: 0.75, vitB12: 0.85, vitA: 0.90, minerals: 0.90, omega3: 0.80 },
  saute:      { vitC: 0.70, vitB1: 0.80, vitB9: 0.75, vitB12: 0.85, minerals: 0.90, omega3: 0.80 },
  fry:        { vitC: 0.60, vitB1: 0.70, vitB9: 0.65, vitB12: 0.80, minerals: 0.85, omega3: 0.70 },
  deep_fry:   { vitC: 0.50, vitB1: 0.60, vitB9: 0.55, vitB12: 0.75, minerals: 0.80, omega3: 0.55 },
  unknown:    { vitC: 0.75, vitB1: 0.80, vitB9: 0.80, vitB12: 0.85, minerals: 0.85, omega3: 0.85 }, // gentle default
};

/**
 * Retention for a single nutrient class given a method. Returns 1 (no loss)
 * when the method/class combination isn't modelled — the assumption is that
 * the nutrient is stable (e.g. protein / fat / carbs / fiber).
 */
export function retentionFor(method: CookingMethod, nutrient: NutrientClass): number {
  const table = RETENTION[method] ?? {};
  const v = table[nutrient];
  return v == null ? 1.0 : v;
}

// ─── Recipe-level aggregation ──────────────────────────────────────────────────

export interface RetentionReport {
  methods: CookingMethod[];                       // detected per step in order
  primaryMethod: CookingMethod;                   // the most-destructive method
  perNutrient: Record<NutrientClass, number>;     // 0-1 factor
}

/** Ordering of methods from most → least destructive for vitamin C.
 *  Used to pick the "primary" method across a multi-step recipe. */
const DESTRUCTIVENESS: CookingMethod[] = [
  'deep_fry', 'boil', 'simmer', 'braise', 'stew', 'roast', 'grill', 'broil',
  'fry', 'bake', 'saute', 'stir_fry', 'microwave', 'poach', 'steam',
  'sous_vide', 'marinate', 'raw', 'unknown',
];
const DESTRUCTIVENESS_RANK = new Map(DESTRUCTIVENESS.map((m, i) => [m, i]));

const ALL_NUTRIENTS: NutrientClass[] = [
  'vitC', 'vitB1', 'vitB9', 'vitB12', 'vitA', 'vitD', 'vitE', 'vitK',
  'minerals', 'protein', 'fat', 'carbs', 'fiber', 'omega3',
];

/**
 * Aggregate retention across recipe steps. Primary method = most destructive
 * method detected. Per-nutrient factor = retentionFor(primaryMethod).
 *
 * This is a conservative approximation: a real pipeline would track
 * ingredient-specific cooking (raw tomato in a cooked sauce stays raw for
 * its vit C) but that requires ingredient-to-step mapping which we don't
 * yet have on scraped recipes.
 */
export function aggregateRetention(stepTexts: string[]): RetentionReport {
  const methods = stepTexts.map(classifyCookingMethod);
  let primary: CookingMethod = 'unknown';
  let bestRank = Number.NEGATIVE_INFINITY;

  for (const m of methods) {
    if (m === 'unknown') continue;
    const rank = DESTRUCTIVENESS.length - (DESTRUCTIVENESS_RANK.get(m) ?? DESTRUCTIVENESS.length);
    if (rank > bestRank) {
      bestRank = rank;
      primary = m;
    }
  }

  // If no method was classified, fall back to 'raw' — nothing is cooked per
  // what we could parse.
  if (primary === 'unknown' && !methods.some((m) => m !== 'unknown')) {
    primary = 'raw';
  }

  const perNutrient = {} as Record<NutrientClass, number>;
  for (const n of ALL_NUTRIENTS) perNutrient[n] = retentionFor(primary, n);

  return { methods, primaryMethod: primary, perNutrient };
}
