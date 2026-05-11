import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { sanitizePii } from '../utils/pii';
import type {
  PatientContext,
  PolicyRule,
  PolicyResult,
  PolicyEffect,
  AppliedRule,
  ModifyTargetsEffect,
  MealDistributionEffect,
  NutrientLimitEffect,
  ExcludeProductsEffect,
  PreferProductsEffect,
  ClinicalNoteEffect,
  SuggestSupplementEffect,
  RuleConflict,
} from './types';

// ─── Build Patient Context ────────────────────────────────────────────────────

/**
 * Extracts full patient context from DB (profile + interview + nutrition targets).
 * Returns null if insufficient data.
 */
export async function buildPatientContext(patientId: string): Promise<PatientContext | null> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      nutritionTargets: true,
      user: { select: { id: true } },
      interviews: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { answers: true },
      },
    },
  });

  if (!patient) return null;
  if (!patient.nutritionTargets) return null;
  if (patient.interviews.length === 0) return null;

  const answers = decryptJson(patient.interviews[0].answers) as Record<string, unknown>;

  // Extract interview fields
  const chronicDiseases = extractStringArray(answers, ['chronicDiseases', 'chorobyPrzewlekle']);
  const digestiveIssues = extractStringArray(answers, ['digestiveIssues', 'problemyTrawienne']);
  const allergies = extractStringArray(answers, ['allergies', 'alergie']).filter(a => a !== 'none');
  const dietType = extractString(answers, ['dietType', 'typDiety']) ?? '';
  const medications = extractString(answers, ['medications', 'leki']) ?? '';
  const mealsPerDay = Number(answers.mealsPerDay ?? answers.posilkiDziennie ?? 5);

  // PRO interview fields
  const pregnancyStatus = extractString(answers, ['pregnancyStatus', 'statusCiazy']);
  const hormonalIssues = extractStringArray(answers, ['hormonalIssues', 'problemyHormonalne']);
  const stressLevel = extractString(answers, ['stressLevel', 'poziomStresu']);
  const sleepHours = extractString(answers, ['sleepHours']) ?? undefined;

  // Extended context (Phase 27)
  const stage = extractString(answers, ['diseaseStage', 'fazaChoroby', 'stage']);
  const surgeryHistory = extractStringArray(answers, ['surgeryHistory', 'historiaOperacji']);
  // Parse medications — support both new string[] format and old free-text string (backward compat)
  const medicationsRaw = answers.medications ?? answers.leki;
  const medicationsList: string[] = Array.isArray(medicationsRaw)
    ? (medicationsRaw as string[])
    : medications
      ? medications.split(/[,;]+/).map(m => m.trim()).filter(m => m.length > 0)
      : [];

  // Extended context (Phase 28.0.PRE)
  const cuisinePreferences = extractStringArray(answers, ['cuisinePreferences']);
  const dislikedFoods = extractStringArray(answers, ['dislikedFoods', 'dislikes']);
  const dislikedFoodsOther = sanitizePii(extractString(answers, ['dislikedFoodsOther'])) || undefined;
  const preferredFoods = extractStringArray(answers, ['preferredFoods']);
  const preferredFoodsOther = sanitizePii(extractString(answers, ['preferredFoodsOther'])) || undefined;
  const cookingTime = extractString(answers, ['cookingTime']) ?? undefined;
  const budget = extractString(answers, ['budget']) ?? undefined;
  const additionalNotes = sanitizePii(extractString(answers, ['additionalNotes'])) || undefined;
  const supplements = extractStringArray(answers, ['supplements']);
  const alcoholFrequency = extractString(answers, ['alcoholFrequency']) ?? undefined;
  const workType = extractString(answers, ['workType']) ?? undefined;
  const mainMealAt = extractString(answers, ['mainMealAt']) ?? undefined;
  const pregnancyTrimester = answers.pregnancyTrimester != null ? Number(answers.pregnancyTrimester) : undefined;
  const ckdStadium = answers.ckdStadium != null ? Number(answers.ckdStadium) : undefined;
  const activityTypes = extractStringArray(answers, ['activityTypes']);
  const workoutsPerWeek = answers.workoutsPerWeek != null ? Number(answers.workoutsPerWeek) : undefined;
  const workoutDurationMin = answers.workoutDurationMin != null ? Number(answers.workoutDurationMin) : undefined;
  const intolerances = extractStringArray(answers, ['intolerances']);
  const targetWeightKg = answers.targetWeightKg != null ? Number(answers.targetWeightKg) : undefined;

  // Meal rhythm
  const mealRhythm = (answers.firstMealTime || answers.lastMealTime || answers.skipsMeals != null || answers.eatsAtNight != null)
    ? {
        firstMealTime: extractString(answers, ['firstMealTime']) ?? undefined,
        lastMealTime: extractString(answers, ['lastMealTime']) ?? undefined,
        skipsMeals: answers.skipsMeals != null ? Boolean(answers.skipsMeals) : undefined,
        eatsAtNight: answers.eatsAtNight != null ? Boolean(answers.eatsAtNight) : undefined,
      }
    : undefined;

  // Age calculation
  const birthYear = patient.birthYear ?? (patient.birthDate ? new Date(patient.birthDate).getFullYear() : null);
  const ageYears = birthYear ? new Date().getFullYear() - birthYear : 0;

  return {
    patientId,
    chronicDiseases,
    digestiveIssues,
    allergies,
    dietType,
    medications,
    mealsPerDay,
    pregnancyStatus: pregnancyStatus ?? undefined,
    hormonalIssues: hormonalIssues.length > 0 ? hormonalIssues : undefined,
    stressLevel: stressLevel ?? undefined,
    sleepHours,
    targetKcal: patient.nutritionTargets.targetKcal,
    targetProteinG: patient.nutritionTargets.targetProteinG,
    targetFatG: patient.nutritionTargets.targetFatG,
    targetCarbsG: patient.nutritionTargets.targetCarbsG,
    sex: patient.sex ?? '',
    weightKg: Number(patient.weightKg ?? 0),
    heightCm: patient.heightCm ?? 0,
    ageYears,
    goal: patient.nutritionTargets.goal ?? '',
    stage: stage ?? undefined,
    medicationsList: medicationsList.length > 0 ? medicationsList : undefined,
    surgeryHistory: surgeryHistory.length > 0 ? surgeryHistory : undefined,
    cuisinePreferences: cuisinePreferences.length > 0 ? cuisinePreferences : undefined,
    dislikedFoods: dislikedFoods.length > 0 ? dislikedFoods : undefined,
    dislikedFoodsOther,
    preferredFoods: preferredFoods.length > 0 ? preferredFoods : undefined,
    preferredFoodsOther,
    cookingTime,
    budget,
    additionalNotes,
    supplements: supplements.length > 0 ? supplements : undefined,
    mealRhythm,
    alcoholFrequency,
    workType,
    mainMealAt,
    pregnancyTrimester,
    ckdStadium,
    activityTypes: activityTypes.length > 0 ? activityTypes : undefined,
    workoutsPerWeek,
    workoutDurationMin,
    intolerances: intolerances.length > 0 ? intolerances : undefined,
    targetWeightKg,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) return val.map(String);
  }
  return [];
}

function extractString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return undefined;
}

// ─── Disliked Foods → Exclude Keywords ───────────────────────────────────────

/**
 * Maps dislikedFoods codes (from InterviewForm) to Polish keywords
 * that the AI must exclude from generated diet plans.
 */
const DISLIKED_FOOD_KEYWORDS: Record<string, string[]> = {
  seafood: [
    'owoce morza', 'krewetki', 'krewetka', 'małże', 'małż', 'krab', 'kraby',
    'langustynki', 'ośmiornica', 'kalmary', 'kałamarnica', 'homar', 'ostrygi',
    'przegrzebki', 'mule', 'rak', 'raki',
  ],
  fish_general: [
    'ryba', 'ryby', 'łosoś', 'dorsz', 'tuńczyk', 'pstrąg', 'makrela',
    'śledź', 'halibut', 'sandacz', 'okoń', 'karp', 'tilapia', 'morszczuk',
    'mintaj', 'sum', 'szczupak', 'sardynka', 'sardynki', 'anchois',
  ],
  offal: [
    'podroby', 'wątróbka', 'wątroba', 'żołądki', 'serce', 'nerki',
    'ozorki', 'flaki', 'kaszanka',
  ],
  mushrooms: [
    'grzyby', 'pieczarki', 'pieczarka', 'borowiki', 'kurki', 'shimeji',
    'shiitake', 'boczniaki', 'boczniak', 'maślaki',
  ],
  onion_garlic: [
    'cebula', 'czosnek', 'por', 'szalotka', 'dymka', 'szczypiorek',
  ],
  beets: [
    'burak', 'buraki', 'barszcz',
  ],
  cabbage: [
    'kapusta', 'kapusta kiszona', 'kapusta pekińska', 'brukselka',
    'kalafior', 'brokuł', 'brokuły', 'jarmuż', 'bok choy',
  ],
  brocoli_cauliflower: [
    'brokuł', 'brokuły', 'kalafior',
  ],
  cottage_cheese: [
    'twaróg', 'serek wiejski', 'twarożek', 'ser biały',
  ],
  tofu_tempeh: [
    'tofu', 'tempeh',
  ],
  eggs: [
    'jajko', 'jajka', 'jaja', 'jajecznica', 'omlet',
  ],
  spicy_food: [
    'ostra papryka', 'chili', 'jalapeño', 'habanero', 'tabasco', 'wasabi',
    'sriracha', 'cayenne',
  ],
  quinoa_amaranth: [
    'quinoa', 'komosa ryżowa', 'amarantus',
  ],
  avocado: [
    'awokado',
  ],
  raw_spinach: [
    'surowy szpinak', 'szpinak surowy',
  ],
};

export function mapDislikedFoodsToKeywords(dislikedFoods: string[]): string[] {
  const keywords: string[] = [];
  for (const code of dislikedFoods) {
    const kws = DISLIKED_FOOD_KEYWORDS[code];
    if (kws) {
      keywords.push(...kws);
    } else {
      // Unknown code — pass as-is (might be a custom entry)
      keywords.push(code);
    }
  }
  return keywords;
}

// ─── Preferred Foods → Keywords + Canonical Buckets (P1.2 / P1.8) ─────────────

/**
 * Lexical keywords per `preferredFoods` interview code. Mirror of the disliked
 * map above but used as a *positive* signal (per-recipe lexical bonus when the
 * recipe title or tags carry the keyword). The eight protein buckets that feed
 * SC30 caps + decay are surfaced separately via `mapPreferredFoodsToCanonical`.
 */
const PREFERRED_FOOD_KEYWORDS: Record<string, string[]> = {
  poultry: ['kurczak', 'indyk', 'kaczka', 'gęś', 'drób', 'pierś', 'udko', 'skrzydło'],
  beef_pork: [
    'wołowina', 'wołowy', 'wołowa', 'wieprzowina', 'wieprzowy', 'schab',
    'karkówka', 'boczek', 'szynka', 'kotlet schabowy', 'rolada wołowa',
  ],
  fish: [
    'łosoś', 'dorsz', 'tuńczyk', 'pstrąg', 'makrela', 'śledź', 'halibut',
    'mintaj', 'sandacz', 'morszczuk', 'sardynki', 'ryba', 'ryby',
  ],
  seafood: [
    'krewetki', 'małże', 'kalmary', 'ośmiornica', 'ostrygi', 'krab',
    'homar', 'przegrzebki',
  ],
  eggs: ['jajko', 'jajka', 'jajecznica', 'omlet', 'jajo'],
  legumes: [
    'ciecierzyca', 'soczewica', 'fasola', 'groch', 'bób', 'edamame',
    'hummus', 'fasolka',
  ],
  tofu_tempeh: ['tofu', 'tempeh'],
  rice_groats: ['ryż', 'kasza', 'jaglana', 'gryczana', 'jęczmienna', 'pęczak', 'bulgur', 'kuskus'],
  pasta: ['makaron', 'spaghetti', 'penne', 'lasagne', 'tagliatelle'],
  potatoes: ['ziemniak', 'ziemniaki', 'pyry', 'puree'],
  bread: ['chleb', 'bułka', 'pieczywo', 'tost', 'kanapka'],
  oatmeal: ['owsianka', 'płatki owsiane', 'overnight oats', 'muesli', 'granola'],
  salads_raw: ['sałatka', 'sałatki', 'surówka', 'surówki'],
  cooked_veg: [
    'duszone', 'pieczone warzywa', 'gotowane warzywa', 'pieczona dynia',
    'pieczona marchew', 'warzywa na parze',
  ],
  fruits: ['owoce', 'jabłko', 'gruszka', 'banan', 'truskawki', 'maliny', 'borówki', 'śliwki'],
  dairy: ['twaróg', 'jogurt', 'kefir', 'mleko', 'serek', 'ser biały', 'ricotta'],
  nuts_seeds: [
    'orzechy', 'migdały', 'orzechy włoskie', 'orzechy laskowe', 'pestki',
    'siemię', 'sezam', 'chia', 'słonecznik',
  ],
  smoothies: ['smoothie', 'koktajl owocowy'],
  soups: ['zupa', 'krem', 'rosół', 'zupa krem'],
};

/**
 * Eight canonical protein buckets for SC30 caps / minimums / decay.
 * `null` entries mean the interview code does not project onto a protein
 * bucket (carb, veg, dairy, etc.) — only its lexical keywords feed scoring.
 */
export type ProteinCanonicalBucket =
  | 'fish_fatty'
  | 'fish_white'
  | 'seafood'
  | 'poultry'
  | 'red_meat'
  | 'eggs'
  | 'legumes'
  | 'tofu';

const PREFERRED_TO_CANONICAL: Record<string, ProteinCanonicalBucket[] | null> = {
  poultry: ['poultry'],
  beef_pork: ['red_meat'],
  // Patient picks `fish` without distinguishing fatty vs white — the bonus
  // applies to both buckets, the cap engine still tracks them separately.
  fish: ['fish_fatty', 'fish_white'],
  seafood: ['seafood'],
  eggs: ['eggs'],
  legumes: ['legumes'],
  tofu_tempeh: ['tofu'],
  // Codes below carry lexical keywords but no SC30 protein bucket impact.
  dairy: null,
  nuts_seeds: null,
  rice_groats: null,
  pasta: null,
  potatoes: null,
  bread: null,
  oatmeal: null,
  salads_raw: null,
  cooked_veg: null,
  fruits: null,
  smoothies: null,
  soups: null,
};

/**
 * Diet-type → allowed `preferredFoods` codes. Codes outside the allowlist are
 * filtered before solver scoring fires (`mapPreferredFoodsToKeywords` returns
 * the filtered list); the dietitian-spec doc explains the clinical rationale.
 *
 * Falsy / unknown `dietType` values mean omnivore — all 19 codes pass.
 */
const DIET_TYPE_ALLOWED_PREFERRED: Record<string, ReadonlySet<string>> = {
  vegan: new Set([
    'legumes', 'tofu_tempeh', 'nuts_seeds',
    'rice_groats', 'pasta', 'potatoes', 'bread', 'oatmeal',
    'salads_raw', 'cooked_veg', 'fruits',
    'smoothies', 'soups',
  ]),
  vegetarian: new Set([
    'eggs', 'dairy',
    'legumes', 'tofu_tempeh', 'nuts_seeds',
    'rice_groats', 'pasta', 'potatoes', 'bread', 'oatmeal',
    'salads_raw', 'cooked_veg', 'fruits',
    'smoothies', 'soups',
  ]),
  pescatarian: new Set([
    'fish', 'seafood',
    'eggs', 'dairy',
    'legumes', 'tofu_tempeh', 'nuts_seeds',
    'rice_groats', 'pasta', 'potatoes', 'bread', 'oatmeal',
    'salads_raw', 'cooked_veg', 'fruits',
    'smoothies', 'soups',
  ]),
};

export interface PreferredFoodsMappingResult {
  /** Lexical keywords for per-recipe positive scoring (analog of disliked). */
  keywords: string[];
  /** Canonical protein buckets in scope for SC30 (deduped). */
  canonicalBuckets: ProteinCanonicalBucket[];
  /** Codes the patient picked that conflict with their declared dietType. */
  filteredCodes: string[];
}

/**
 * Filter incompatible `preferredFoods` codes against the patient's dietType,
 * then return both lexical keywords (positive scoring) and canonical
 * protein buckets (SC30 caps/decay). Always idempotent and order-stable.
 *
 * Example: `dietType='vegan'` + `['legumes', 'fish', 'tofu_tempeh']` →
 * filteredCodes=['fish'], keywords=[…legumes…, …tofu_tempeh…],
 * canonicalBuckets=['legumes', 'tofu'].
 */
export function mapPreferredFoodsToKeywords(
  preferredFoods: string[] | null | undefined,
  dietType?: string | null,
): PreferredFoodsMappingResult {
  if (!preferredFoods || preferredFoods.length === 0) {
    return { keywords: [], canonicalBuckets: [], filteredCodes: [] };
  }

  const allowed = dietType ? DIET_TYPE_ALLOWED_PREFERRED[dietType.toLowerCase().trim()] : undefined;
  const keptCodes: string[] = [];
  const filteredCodes: string[] = [];

  for (const code of preferredFoods) {
    if (allowed && !allowed.has(code)) {
      filteredCodes.push(code);
      continue;
    }
    keptCodes.push(code);
  }

  const keywords: string[] = [];
  const bucketSet = new Set<ProteinCanonicalBucket>();

  for (const code of keptCodes) {
    const kws = PREFERRED_FOOD_KEYWORDS[code];
    if (kws) keywords.push(...kws);
    // For unknown codes (custom interview entries) we pass the raw code as a
    // keyword — same fallback as `mapDislikedFoodsToKeywords`.
    else keywords.push(code);

    const buckets = PREFERRED_TO_CANONICAL[code];
    if (buckets) for (const b of buckets) bucketSet.add(b);
  }

  return {
    keywords,
    canonicalBuckets: [...bucketSet].sort(),
    filteredCodes,
  };
}

// ─── Policy Engine ────────────────────────────────────────────────────────────

/**
 * Evaluates all policy rules against a patient context.
 * Returns aggregated effects sorted by priority.
 */
export function evaluatePolicies(rules: PolicyRule[], ctx: PatientContext): PolicyResult {
  // Sort by priority descending (highest priority first)
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  const appliedRules: AppliedRule[] = [];
  const targetModifications: ModifyTargetsEffect[] = [];
  const mealDistributions: MealDistributionEffect[] = [];
  const nutrientLimits: NutrientLimitEffect[] = [];
  const excludeFlags: ExcludeProductsEffect[] = [];
  const preferFlags: PreferProductsEffect[] = [];
  const excludeKeywords: string[] = [];
  const clinicalNotes: ClinicalNoteEffect[] = [];
  const supplements: SuggestSupplementEffect[] = [];

  for (const rule of sorted) {
    if (!rule.condition(ctx)) continue;

    appliedRules.push({
      ruleId: rule.id,
      ruleName: rule.name,
      description: rule.description,
      effects: rule.effects,
    });

    for (const effect of rule.effects) {
      categorizeEffect(effect, ctx, {
        targetModifications,
        mealDistributions,
        nutrientLimits,
        excludeFlags,
        preferFlags,
        excludeKeywords,
        clinicalNotes,
        supplements,
      });
    }
  }

  // Map disliked foods to exclude keywords so AI never uses them
  if (ctx.dislikedFoods?.length) {
    const dislikedKeywords = mapDislikedFoodsToKeywords(ctx.dislikedFoods);
    for (const kw of dislikedKeywords) {
      if (!excludeKeywords.includes(kw)) {
        excludeKeywords.push(kw);
      }
    }
  }

  // Detect conflicts between applied rules (Phase 27)
  const conflicts = detectConflicts(appliedRules, sorted);

  return {
    appliedRules,
    targetModifications,
    mealDistributions,
    nutrientLimits,
    excludeFlags,
    preferFlags,
    excludeKeywords,
    clinicalNotes,
    supplements,
    conflicts,
  };
}

function categorizeEffect(
  effect: PolicyEffect,
  ctx: PatientContext,
  buckets: {
    targetModifications: ModifyTargetsEffect[];
    mealDistributions: MealDistributionEffect[];
    nutrientLimits: NutrientLimitEffect[];
    excludeFlags: ExcludeProductsEffect[];
    preferFlags: PreferProductsEffect[];
    excludeKeywords: string[];
    clinicalNotes: ClinicalNoteEffect[];
    supplements: SuggestSupplementEffect[];
  },
) {
  switch (effect.type) {
    case 'MODIFY_TARGETS':
      buckets.targetModifications.push(effect);
      break;
    case 'MEAL_DISTRIBUTION':
      buckets.mealDistributions.push(effect);
      break;
    case 'NUTRIENT_LIMIT':
      buckets.nutrientLimits.push(effect);
      break;
    case 'EXCLUDE_PRODUCTS':
      buckets.excludeFlags.push(effect);
      break;
    case 'PREFER_PRODUCTS':
      buckets.preferFlags.push(effect);
      break;
    case 'EXCLUDE_KEYWORDS':
      for (const kw of effect.keywords) {
        if (!buckets.excludeKeywords.includes(kw)) {
          buckets.excludeKeywords.push(kw);
        }
      }
      break;
    case 'CLINICAL_NOTE':
      buckets.clinicalNotes.push(effect);
      break;
    case 'SUGGEST_SUPPLEMENT': {
      // Check age-gating if specified
      if (effect.conditionalOnAge) {
        const age = ctx.ageYears;
        const { minAge, maxAge } = effect.conditionalOnAge;
        if ((minAge != null && age < minAge) || (maxAge != null && age > maxAge)) {
          break; // Skip supplement — patient outside age range
        }
      }
      buckets.supplements.push(effect);
      break;
    }
    case 'AGE_CONDITIONAL': {
      // Find matching age range and apply its effects
      const age = ctx.ageYears;
      for (const range of effect.ageRanges) {
        const aboveMin = range.minAge == null || age >= range.minAge;
        const belowMax = range.maxAge == null || age <= range.maxAge;
        if (aboveMin && belowMax) {
          for (const subEffect of range.effects) {
            categorizeEffect(subEffect, ctx, buckets);
          }
          break; // Use first matching range
        }
      }
      break;
    }
  }
}

// ─── Conflict Detection ──────────────────────────────────────────────────────

/**
 * Detects conflicts between applied rules based on their conflictsWith field.
 * When two active rules declare mutual or one-sided conflicts, a RuleConflict
 * is generated and a WARNING clinical note is added.
 */
function detectConflicts(appliedRules: AppliedRule[], allRules: PolicyRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const appliedNames = new Set(appliedRules.map(r => r.ruleName));
  const ruleMap = new Map(allRules.map(r => [r.name, r]));

  const seen = new Set<string>();

  for (const applied of appliedRules) {
    const rule = ruleMap.get(applied.ruleName);
    if (!rule?.conflictsWith?.length) continue;

    for (const conflictName of rule.conflictsWith) {
      if (!appliedNames.has(conflictName)) continue;

      // Deduplicate: A↔B same as B↔A
      const key = [applied.ruleName, conflictName].sort().join('↔');
      if (seen.has(key)) continue;
      seen.add(key);

      conflicts.push({
        ruleA: applied.ruleName,
        ruleB: conflictName,
        description: `Conflict between "${applied.ruleName}" and "${conflictName}" — requires manual review`,
      });
    }
  }

  return conflicts;
}

// ─── Apply Target Modifications ───────────────────────────────────────────────

export interface AdjustedTargets {
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
}

/**
 * Applies all target modifications in priority order.
 * Returns adjusted nutrition targets.
 */
export function applyTargetModifications(
  base: AdjustedTargets,
  modifications: ModifyTargetsEffect[],
): AdjustedTargets {
  const result = { ...base };

  for (const mod of modifications) {
    const current = result[mod.field];
    switch (mod.operation) {
      case 'SET':
        result[mod.field] = Math.round(mod.value);
        break;
      case 'MULTIPLY':
        result[mod.field] = Math.round(current * mod.value);
        break;
      case 'ADD':
        result[mod.field] = Math.round(current + mod.value);
        break;
      case 'MAX':
        // MAX = "ensure at least this value" → take the larger
        result[mod.field] = Math.round(Math.max(current, mod.value));
        break;
      case 'MIN':
        // MIN = "cap at this value" → take the smaller
        result[mod.field] = Math.round(Math.min(current, mod.value));
        break;
    }
  }

  return result;
}
