/**
 * Recipe-level diet flag computer (S-11 follow-up).
 *
 * Fixes the pipeline/06-detect-flags.ts failure mode where flags like
 * pregnancyFriendly/goutFriendly end up TRUE for 93% of recipes because they
 * only check absence of rare ingredients. Clinically useless: a dietitian
 * can't filter "pregnancy-safe recipes" when the filter matches 9 in 10.
 *
 * This module:
 *   - tightens nutrition thresholds (e.g. lowSodium < 400mg, not < 600)
 *   - requires positive signals, not just absence (highProtein must also be
 *     protein-dense by share of kcal)
 *   - emits per-flag `value + confidence + reasons[]` so a reviewer can
 *     inspect why a flag fired
 *
 * Inputs are decoupled from DB models so callers can pass scraped data too.
 */

import { classifyIngredient, type ProteinSource } from './proteinSource';
import { normalizeProductName } from './productMatcher';

// ─── Input & output ────────────────────────────────────────────────────────────

export interface DietFlagInput {
  ingredientNames: string[];            // canonical or display strings
  /** Macro / micro snapshot per serving. All optional; flags downgrade when missing. */
  nutrition?: {
    calories?: number | null;
    protein?: number | null;
    fat?: number | null;
    saturatedFat?: number | null;
    carbs?: number | null;
    sugar?: number | null;
    fiber?: number | null;
    sodium?: number | null;             // mg
    cholesterol?: number | null;        // mg
  } | null;
}

export type DietFlagCode =
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'glutenFree'
  | 'lactoseFree'
  | 'lowSodium'
  | 'lowSugar'
  | 'lowCarb'
  | 'lowFat'
  | 'highProtein'
  | 'highFiber'
  | 'ketoCompatible'
  | 'diabeticFriendly'
  | 'heartFriendly'
  | 'liverFriendly'
  | 'ibsFriendly'
  | 'renalFriendly'
  | 'goutFriendly'
  | 'pregnancyFriendly';

export interface DietFlagResult {
  code: DietFlagCode;
  value: boolean;
  confidence: number;       // 0-1
  reasons: string[];
}

// ─── Keyword sets (normalized lowercase; check via String.includes) ────────────

// All keyword stems are in diacritic-stripped lowercase (normalizeProductName
// applies NFD + strip). No need to duplicate pl/ascii variants.
// Stems are matched against diacritic-stripped lowercase ingredient names.
// Pick stems broad enough to cover all PL inflections, e.g. 'cielec' covers
// cieleci/cielecina/cielecy/cieleca/cielece (calf adjective + noun forms),
// where the narrower 'cieleci' missed 'cielecy' (e.g. "Bulion cielęcy").
const MEAT_WORDS = [
  'miesa', 'mieso', 'kurczak', 'drob', 'indyk',
  'wieprzow', 'wolowin', 'cielec', 'jagniec',
  'baranin', 'kaczk', 'gesi', 'krolik', 'dziczyzn',
  'szynk', 'boczek', 'kielbas', 'salami', 'parowk',
  'kabanos', 'mortadel', 'paszt', 'schab', 'poledwic',
  'mielone', 'watrob', 'zoladki', 'serca', 'podroby',
  'skrzydel', 'udko', 'zeberk',
];
const FISH_WORDS = ['losos', 'dorsz', 'tunczyk', 'makrel', 'sledz', 'pstrag', 'halibut', 'mintaj', 'ryb'];
const SHELLFISH_WORDS = ['krewet', 'krab', 'homar', 'malze', 'ostryg', 'kalmar'];
const DAIRY_WORDS = ['mleko', 'smietan', 'jogurt', 'ser ', 'serek', 'twarog', 'kefir', 'maslo', 'serwatk', 'mozzarell', 'feta', 'ricott', 'parmezan'];
const EGG_WORDS = ['jajk', 'jajec', 'jajo', 'jaja', 'zoltk', 'bialk'];
const HONEY_WORDS = ['miod'];
const GLUTEN_WORDS = ['pszenic', 'zyto', 'jeczmien', 'orkisz', 'maka ', 'makaron', 'chleb', 'bulk', 'kuskus', 'kasza manna', 'croissant', 'rogal'];
const ALCOHOL_WORDS = ['piwo', 'wino', 'wodk', 'whisky', 'rum', 'likier', 'alkohol', 'koniak', 'brandy'];
const ORGAN_WORDS = ['watrob', 'watrob', 'zoladk', 'serca', 'podroby', 'nerki', 'ozorki', 'ozor'];
const RAW_FISH_WORDS = ['sushi', 'sashimi', 'tatar z losos', 'surowy losos', 'surowa ryb'];
const RAW_EGG_WORDS = ['surowe jajk', 'tiramisu', 'kogel', 'majonez domow'];
const HIGH_MERCURY_WORDS = ['tunczyk', 'makrel', 'miecznik', 'rekin'];
const HIGH_FODMAP_WORDS = ['cebul', 'czosnek', 'pszenic', 'jablk', 'gruszk', 'mango', 'arbuz', 'karczoch', 'szparag', 'grzyb', 'kapust'];

function matchAny(name: string, words: string[]): boolean {
  const normalized = normalizeProductName(name);
  return words.some((w) => normalized.includes(w));
}

function anyIngredientMatches(ingredientNames: string[], words: string[]): boolean {
  return ingredientNames.some((n) => matchAny(n, words));
}

// ─── Individual rules ──────────────────────────────────────────────────────────

interface RuleContext {
  names: string[];                       // lowercased ingredient names
  nutrition: NonNullable<DietFlagInput['nutrition']>;
  hasMeat: boolean;
  hasFish: boolean;
  hasShellfish: boolean;
  hasDairy: boolean;
  hasEggs: boolean;
  hasHoney: boolean;
  hasGluten: boolean;
  hasAlcohol: boolean;
  hasOrgan: boolean;
  hasRawFish: boolean;
  hasRawEggs: boolean;
  hasHighMercury: boolean;
  hasHighFodmap: boolean;
  proteinSources: Set<ProteinSource>;
}

function buildContext(input: DietFlagInput): RuleContext {
  const names = input.ingredientNames.map((n) => n.toLowerCase());
  const proteinSources = new Set<ProteinSource>();
  for (const n of input.ingredientNames) proteinSources.add(classifyIngredient(n));

  return {
    names,
    nutrition: input.nutrition ?? {},
    hasMeat: anyIngredientMatches(names, MEAT_WORDS),
    hasFish: anyIngredientMatches(names, FISH_WORDS),
    hasShellfish: anyIngredientMatches(names, SHELLFISH_WORDS),
    hasDairy: anyIngredientMatches(names, DAIRY_WORDS),
    hasEggs: anyIngredientMatches(names, EGG_WORDS),
    hasHoney: anyIngredientMatches(names, HONEY_WORDS),
    hasGluten: anyIngredientMatches(names, GLUTEN_WORDS),
    hasAlcohol: anyIngredientMatches(names, ALCOHOL_WORDS),
    hasOrgan: anyIngredientMatches(names, ORGAN_WORDS),
    hasRawFish: anyIngredientMatches(names, RAW_FISH_WORDS),
    hasRawEggs: anyIngredientMatches(names, RAW_EGG_WORDS),
    hasHighMercury: anyIngredientMatches(names, HIGH_MERCURY_WORDS),
    hasHighFodmap: anyIngredientMatches(names, HIGH_FODMAP_WORDS),
    proteinSources,
  };
}

function mkResult(code: DietFlagCode, value: boolean, confidence: number, reasons: string[]): DietFlagResult {
  return { code, value, confidence, reasons };
}

// ─── Rule helpers ──────────────────────────────────────────────────────────────

function computeVegetarian(ctx: RuleContext): DietFlagResult {
  const value = !ctx.hasMeat && !ctx.hasFish && !ctx.hasShellfish;
  const reasons = value ? ['no meat/fish/shellfish'] : ['contains meat/fish/shellfish'];
  return mkResult('vegetarian', value, 0.9, reasons);
}

function computeVegan(ctx: RuleContext, vegetarian: boolean): DietFlagResult {
  const value = vegetarian && !ctx.hasDairy && !ctx.hasEggs && !ctx.hasHoney;
  const reasons: string[] = [];
  if (!vegetarian) reasons.push('not vegetarian');
  if (ctx.hasDairy) reasons.push('dairy present');
  if (ctx.hasEggs) reasons.push('eggs present');
  if (ctx.hasHoney) reasons.push('honey present');
  if (value) reasons.push('no animal products detected');
  return mkResult('vegan', value, 0.85, reasons);
}

function computePescatarian(ctx: RuleContext): DietFlagResult {
  // Fish OK, meat and shellfish-only would be strict pescatarian;
  // we allow shellfish too (common Polish pescatarian definition).
  const value = !ctx.hasMeat;
  const reasons = value ? ['no meat'] : ['contains meat'];
  return mkResult('pescatarian', value, 0.9, reasons);
}

function computeGlutenFree(ctx: RuleContext): DietFlagResult {
  const value = !ctx.hasGluten;
  const reasons = value ? ['no wheat/rye/barley/spelt'] : ['gluten-containing grain present'];
  return mkResult('glutenFree', value, 0.9, reasons);
}

function computeLactoseFree(ctx: RuleContext): DietFlagResult {
  const value = !ctx.hasDairy;
  const reasons = value ? ['no dairy'] : ['dairy present'];
  return mkResult('lactoseFree', value, 0.9, reasons);
}

function computeLowSodium(ctx: RuleContext): DietFlagResult {
  const sodium = ctx.nutrition.sodium;
  if (sodium == null) return mkResult('lowSodium', false, 0.2, ['sodium unknown']);
  const value = sodium < 400;
  return mkResult('lowSodium', value, 0.85, [`${sodium} mg sodium${value ? ' (< 400)' : ' (≥ 400)'}`]);
}

function computeLowSugar(ctx: RuleContext): DietFlagResult {
  const sugar = ctx.nutrition.sugar;
  if (sugar == null) return mkResult('lowSugar', false, 0.2, ['sugar unknown']);
  const value = sugar < 5;
  return mkResult('lowSugar', value, 0.85, [`${sugar} g sugar${value ? ' (< 5)' : ' (≥ 5)'}`]);
}

function computeLowCarb(ctx: RuleContext): DietFlagResult {
  const carbs = ctx.nutrition.carbs;
  if (carbs == null) return mkResult('lowCarb', false, 0.2, ['carbs unknown']);
  const value = carbs < 20;
  return mkResult('lowCarb', value, 0.9, [`${carbs} g carbs${value ? ' (< 20)' : ' (≥ 20)'}`]);
}

function computeLowFat(ctx: RuleContext): DietFlagResult {
  const fat = ctx.nutrition.fat;
  if (fat == null) return mkResult('lowFat', false, 0.2, ['fat unknown']);
  const value = fat < 10;
  return mkResult('lowFat', value, 0.9, [`${fat} g fat${value ? ' (< 10)' : ' (≥ 10)'}`]);
}

function computeHighProtein(ctx: RuleContext): DietFlagResult {
  const protein = ctx.nutrition.protein;
  const kcal = ctx.nutrition.calories;
  if (protein == null) return mkResult('highProtein', false, 0.2, ['protein unknown']);
  // Both absolute and share matter. Share guard stops low-kcal snack with 15g
  // protein being called "high protein".
  const proteinKcal = protein * 4;
  const proteinShare = kcal && kcal > 0 ? proteinKcal / kcal : 0;
  const value = protein >= 20 && (kcal == null || proteinShare >= 0.2);
  return mkResult('highProtein', value, 0.9, [
    `${protein} g protein${value ? ' (≥ 20 and ≥ 20% kcal)' : ''}`,
  ]);
}

function computeHighFiber(ctx: RuleContext): DietFlagResult {
  const fiber = ctx.nutrition.fiber;
  if (fiber == null) return mkResult('highFiber', false, 0.2, ['fiber unknown']);
  const value = fiber >= 6;
  return mkResult('highFiber', value, 0.9, [`${fiber} g fiber${value ? ' (≥ 6)' : ''}`]);
}

function computeKetoCompatible(ctx: RuleContext): DietFlagResult {
  const { fat, carbs, protein, calories } = ctx.nutrition;
  if (fat == null || carbs == null || calories == null || calories <= 0) {
    return mkResult('ketoCompatible', false, 0.2, ['macros/kcal unknown']);
  }
  const fatShare = (fat * 9) / calories;
  const carbsG = carbs;
  const proteinG = protein ?? 0;
  const value = fatShare >= 0.6 && carbsG <= 10 && proteinG >= 15 && proteinG <= 40;
  return mkResult('ketoCompatible', value, 0.85, [
    `fat share ${Math.round(fatShare * 100)}%, carbs ${carbsG} g, protein ${proteinG} g`,
  ]);
}

function computeDiabeticFriendly(ctx: RuleContext): DietFlagResult {
  const { carbs, sugar, fiber } = ctx.nutrition;
  if (carbs == null || sugar == null) {
    return mkResult('diabeticFriendly', false, 0.2, ['carbs/sugar unknown']);
  }
  // Tighter than the original: requires carbs < 40g AND sugar < 10g AND
  // either fiber ≥ 4g (slows GI) OR no sugar added beyond 5g.
  const hasFiberBoost = (fiber ?? 0) >= 4;
  const value = carbs < 40 && sugar < 10 && (hasFiberBoost || sugar < 5);
  return mkResult('diabeticFriendly', value, 0.75, [
    `carbs ${carbs} g, sugar ${sugar} g${hasFiberBoost ? ', fiber supports' : ''}`,
  ]);
}

function computeHeartFriendly(ctx: RuleContext): DietFlagResult {
  const { sodium, saturatedFat, fiber } = ctx.nutrition;
  if (sodium == null || saturatedFat == null) {
    return mkResult('heartFriendly', false, 0.2, ['sodium/sat fat unknown']);
  }
  // Stricter: sodium < 400 AND satFat < 3g AND fiber ≥ 4g (positive signal).
  const value = sodium < 400 && saturatedFat < 3 && (fiber ?? 0) >= 4;
  return mkResult('heartFriendly', value, 0.75, [
    `sodium ${sodium}, satFat ${saturatedFat}, fiber ${fiber ?? '-'}`,
  ]);
}

function computeLiverFriendly(ctx: RuleContext): DietFlagResult {
  const { fat, saturatedFat } = ctx.nutrition;
  if (fat == null) return mkResult('liverFriendly', false, 0.2, ['fat unknown']);
  // Stricter than original: no alcohol + fat < 15g + satFat < 5g
  const value = !ctx.hasAlcohol && fat < 15 && (saturatedFat == null || saturatedFat < 5);
  const reasons: string[] = [];
  if (ctx.hasAlcohol) reasons.push('alcohol present');
  reasons.push(`fat ${fat} g, satFat ${saturatedFat ?? '-'}`);
  return mkResult('liverFriendly', value, 0.7, reasons);
}

function computeIbsFriendly(ctx: RuleContext): DietFlagResult {
  // Low-FODMAP (approximation): no high-FODMAP trigger foods + no dairy
  // + no alcohol. Conservative — intended to narrow the population rather
  // than over-flag.
  const value = !ctx.hasHighFodmap && !ctx.hasDairy && !ctx.hasAlcohol;
  const reasons: string[] = [];
  if (ctx.hasHighFodmap) reasons.push('high-FODMAP ingredient');
  if (ctx.hasDairy) reasons.push('dairy present');
  if (ctx.hasAlcohol) reasons.push('alcohol present');
  if (value) reasons.push('no common FODMAP triggers');
  return mkResult('ibsFriendly', value, 0.6, reasons);
}

function computeRenalFriendly(ctx: RuleContext): DietFlagResult {
  const { sodium, protein } = ctx.nutrition;
  if (sodium == null || protein == null) {
    return mkResult('renalFriendly', false, 0.2, ['sodium/protein unknown']);
  }
  // Renal diet: low protein, low sodium, limit nuts / dairy (high K/P).
  const NUT_OR_SEED = anyIngredientMatches(ctx.names, ['orzech', 'migdal', 'migdał', 'pistacj', 'nerkowc', 'pekan']);
  const BANANA_CHOCOLATE = anyIngredientMatches(ctx.names, ['banan', 'czekolad', 'kakao']);
  const value = sodium < 400 && protein < 20 && !ctx.hasDairy && !NUT_OR_SEED && !BANANA_CHOCOLATE;
  return mkResult('renalFriendly', value, 0.6, [
    `sodium ${sodium}, protein ${protein}${ctx.hasDairy ? ', dairy' : ''}${NUT_OR_SEED ? ', nuts' : ''}${BANANA_CHOCOLATE ? ', banana/cocoa' : ''}`,
  ]);
}

function computeGoutFriendly(ctx: RuleContext): DietFlagResult {
  // High-purine red meat / organ / seafood / beer bad for gout.
  // Keywords are matched against diacritic-stripped names, so ASCII stems only.
  const redMeat = anyIngredientMatches(ctx.names, ['wolowin', 'wieprzow', 'jagniec', 'baranin', 'cielec']);
  const value = !ctx.hasOrgan && !redMeat && !ctx.hasShellfish && !ctx.hasAlcohol;
  const reasons: string[] = [];
  if (ctx.hasOrgan) reasons.push('organ meats');
  if (redMeat) reasons.push('red meat');
  if (ctx.hasShellfish) reasons.push('shellfish');
  if (ctx.hasAlcohol) reasons.push('alcohol');
  if (value) reasons.push('no high-purine triggers');
  return mkResult('goutFriendly', value, 0.7, reasons);
}

function computePregnancyFriendly(ctx: RuleContext): DietFlagResult {
  // Require safety (no raw fish/eggs/alcohol/high-mercury) AND at least one
  // positive nutritional signal (iron-rich, folate-rich, calcium-rich).
  const risky = ctx.hasRawFish || ctx.hasRawEggs || ctx.hasAlcohol || ctx.hasHighMercury;
  const hasIronSource = ctx.proteinSources.has('beef') || ctx.proteinSources.has('poultry')
    || ctx.proteinSources.has('legume') || anyIngredientMatches(ctx.names, ['szpinak', 'jarmuz', 'jarmuż', 'buraki']);
  const hasFolateSource = anyIngredientMatches(ctx.names, ['szpinak', 'brokul', 'brokuł', 'fasol', 'soczewic', 'bobu', 'bob ', 'awokado', 'pomarancz', 'pomarańcz']);
  const hasCalciumSource = ctx.hasDairy || anyIngredientMatches(ctx.names, ['tahini', 'migdal', 'migdał', 'brokul', 'brokuł', 'sardynk', 'tofu']);
  const positive = hasIronSource || hasFolateSource || hasCalciumSource;
  const value = !risky && positive;
  const reasons: string[] = [];
  if (risky) reasons.push('risky ingredient (raw fish/egg/alcohol/mercury)');
  if (!positive) reasons.push('no iron/folate/calcium source');
  if (value) {
    if (hasIronSource) reasons.push('iron source');
    if (hasFolateSource) reasons.push('folate source');
    if (hasCalciumSource) reasons.push('calcium source');
  }
  return mkResult('pregnancyFriendly', value, 0.65, reasons);
}

// ─── Main entry ────────────────────────────────────────────────────────────────

export function computeDietFlags(input: DietFlagInput): DietFlagResult[] {
  const ctx = buildContext(input);
  const vegetarian = computeVegetarian(ctx);

  return [
    vegetarian,
    computeVegan(ctx, vegetarian.value),
    computePescatarian(ctx),
    computeGlutenFree(ctx),
    computeLactoseFree(ctx),
    computeLowSodium(ctx),
    computeLowSugar(ctx),
    computeLowCarb(ctx),
    computeLowFat(ctx),
    computeHighProtein(ctx),
    computeHighFiber(ctx),
    computeKetoCompatible(ctx),
    computeDiabeticFriendly(ctx),
    computeHeartFriendly(ctx),
    computeLiverFriendly(ctx),
    computeIbsFriendly(ctx),
    computeRenalFriendly(ctx),
    computeGoutFriendly(ctx),
    computePregnancyFriendly(ctx),
  ];
}
