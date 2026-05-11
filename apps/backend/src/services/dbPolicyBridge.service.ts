/**
 * DB-first Diet Generation — Policy Engine Bridge (Phase E)
 *
 * Translates PolicyResult effects into RecipeCandidateQuery filters
 * and assembly constraints for the DB-first pipeline.
 *
 * This bridges the existing clinical Policy Engine (designed for AI prompts)
 * with the database-first assembly engine.
 */

import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { evaluatePolicies } from '../policies/policy-engine';
import {
  buildPatientContext,
  mapDislikedFoodsToKeywords,
  mapPreferredFoodsToKeywords,
} from '../policies/policy-engine';
import { loadPolicyRules } from '../policies/rule-store';
import type {
  PolicyResult,
  ExcludeProductsEffect,
  PreferProductsEffect,
  NutrientLimitEffect,
  ClinicalNoteEffect,
  SuggestSupplementEffect,
  MealDistributionEffect,
} from '../policies/types';
import type { AssemblyInput } from './dbPlanAssembly.service';

// ─── Output: constraints for DB-first pipeline ───────────────────────────────

/** Constraints derived from PolicyResult for the DB assembly pipeline */
export interface DbPolicyConstraints {
  /** Allergen codes to hard-exclude from recipe candidates */
  excludeAllergens: string[];

  /** Required diet flags (e.g., 'glutenFree', 'lactoseFree') */
  requiredDietFlags: string[];

  /** Keywords to exclude from ingredient names (e.g., 'alkohol', 'kawa') */
  excludeKeywords: string[];

  /** Meal distribution effects for macro capping per meal */
  mealDistributions: MealDistributionEffect[];

  /** Nutrient limits for validation (daily or per-100g) */
  nutrientLimits: NutrientLimitEffect[];

  /** Clinical notes for plan metadata / explanation */
  clinicalNotes: string[];

  /** Suggested supplements (added as notes in the plan) */
  supplements: string[];

  /** Number of applied policy rules */
  appliedRulesCount: number;

  /** Applied rule names (for audit/metadata) */
  appliedRuleNames: string[];

  // ── Faza D: Patient context fields previously dropped at this layer ──────
  // The `buildPatientContext` decrypts these from the interview but they
  // never reached AssemblyInput → SolverRequest. Faza D Phase 1 closes the
  // gap so D1 (cuisine), per-patient RDA (P-2), and condition modules (P-7)
  // can act on real patient data instead of solver-side defaults.
  /** Cuisine preferences from interview (D1 HARD filter) */
  cuisinePreferences?: string[];
  /** Patient sex from DB → drives life-stage RDA in the solver */
  sex?: 'M' | 'F' | null;
  /** Patient age in years → RDA bucketing */
  ageYears?: number | null;
  /** Pregnancy trimester (1-3) → asymmetric kcal band (P-4) */
  pregnancyTrimester?: number | null;
  /** Lactating flag → kcal/macro adjustments */
  lactating?: boolean;
  // ── Faza D Phase 1 W2-Tue: D3-D8 derived condition flags ────────────────
  /**
   * Additional condition flags derived from PatientContext fields beyond
   * rule-name detection. Currently sourced from interview answers:
   *   * 'pcos'              — D8 (hormonalIssues includes 'pcos')
   *   * 'no_night_eating'   — D3 (mealRhythm.eatsAtNight === false)
   *   * 'eats_before_18'    — D5 (mealRhythm.lastMealTime === 'before_18')
   *   * 'shift_night'       — D7 (workType === 'shift_night')
   *   * 'ckd_stage_3' / 'ckd_stage_4' / 'ckd_stage_5' — D6 stage tier
   * Solver consumes via `condition_flags`; today only `pcos` activates a
   * constraint (in domain.kcal_bounds.INSULIN_SENSITIVE_CONDITIONS).
   * The rest are echoed to logs for traceability — W2-Fri / W2-Wed will
   * wire dedicated constraints / distribution variants.
   */
  derivedConditionFlags?: string[];
  /** CKD stadium 1-5 from interview answers — drives D6 nutrient_limits tier. */
  ckdStadium?: number;
  // ── P1.4 / P1.5 / P1.7 (Recipe Overhaul Master Plan): SC30 inputs ────────
  /**
   * Canonical 8-bucket protein subset that the patient picked in
   * `preferredFoods` AFTER vegan/vegetarian guard filtering. Drives the
   * per-week PREFERRED_BONUS_DECAY in the solver's SC30 constraint.
   */
  preferredProteinBuckets?: string[];
  /**
   * 'vegan' | 'vegetarian' | 'pescatarian' (or undefined for omnivore).
   * Drives PROTEIN_WEEKLY_MINS skip for fish_total minimum.
   */
  dietaryPattern?: string | null;
}

// ─── Mapping: ExcludeProductsEffect → requiredDietFlags ──────────────────────

/**
 * Map ExcludeProducts effects to diet flag requirements.
 * e.g., exclude products where glutenFree=false → require glutenFree=true
 */
function mapExcludeFlagsToRequired(effects: ExcludeProductsEffect[]): string[] {
  const flags: string[] = [];
  for (const e of effects) {
    // If we exclude products where flag=false, we REQUIRE flag=true
    if (!e.flagValue) {
      flags.push(e.flagKey);
    }
  }
  return flags;
}

// ─── Mapping: interview allergens → allergen codes ───────────────────────────

const ALLERGEN_CODE_MAP: Record<string, string> = {
  // Polish allergy names → standard allergen codes
  'gluten': 'gluten',
  'laktoza': 'lactose',
  'mleko': 'milk',
  'nabiał': 'milk',
  'jaja': 'eggs',
  'jajka': 'eggs',
  'orzechy': 'tree_nuts',
  'orzechy ziemne': 'peanuts',
  'orzeszki ziemne': 'peanuts',
  'soja': 'soy',
  'ryby': 'fish',
  'skorupiaki': 'crustaceans',
  'mięczaki': 'molluscs',
  'sezam': 'sesame',
  'seler': 'celery',
  'gorczyca': 'mustard',
  'łubin': 'lupin',
  'dwutlenek siarki': 'sulphites',
  'siarka': 'sulphites',
};

function mapAllergyNames(allergies: string[]): string[] {
  const codes = new Set<string>();
  for (const allergy of allergies) {
    const lower = allergy.toLowerCase().trim();
    const code = ALLERGEN_CODE_MAP[lower];
    if (code) {
      codes.add(code);
    } else {
      // Try partial match
      for (const [key, val] of Object.entries(ALLERGEN_CODE_MAP)) {
        if (lower.includes(key) || key.includes(lower)) {
          codes.add(val);
        }
      }
    }
  }
  return Array.from(codes);
}

// ─── Main: build constraints for a patient ───────────────────────────────────

/**
 * Evaluate all policy rules for a patient and translate into DB-first
 * pipeline constraints.
 *
 * @param patientId - Patient ID
 * @returns DbPolicyConstraints ready for use in assembleDbPlan
 */
export async function buildDbPolicyConstraints(patientId: string): Promise<DbPolicyConstraints> {
  // Build patient context (same as AI pipeline)
  const ctx = await buildPatientContext(patientId);

  if (!ctx) {
    // No patient data — return empty constraints
    return {
      excludeAllergens: [],
      requiredDietFlags: [],
      excludeKeywords: [],
      mealDistributions: [],
      nutrientLimits: [],
      clinicalNotes: [],
      supplements: [],
      appliedRulesCount: 0,
      appliedRuleNames: [],
    };
  }

  // Load all policy rules (DB + hardcoded)
  const rules = await loadPolicyRules();

  // Evaluate policies
  const result: PolicyResult = evaluatePolicies(rules, ctx);

  // Map allergens from interview
  const interviewAllergens = mapAllergyNames(ctx.allergies ?? []);

  // Map exclude flags to required diet flags
  const flagsFromPolicy = mapExcludeFlagsToRequired(result.excludeFlags);

  // Map diet type to diet flags
  const dietTypeFlags: string[] = [];
  if (ctx.dietType) {
    const dt = ctx.dietType.toLowerCase();
    if (dt.includes('wegetarian')) dietTypeFlags.push('vegetarian');
    if (dt.includes('wegan')) dietTypeFlags.push('vegan');
    if (dt.includes('peskatar') || dt.includes('pescatar')) dietTypeFlags.push('pescatarian');
    if (dt.includes('keto')) dietTypeFlags.push('ketoCompatible');
  }

  // Combine clinical notes
  const clinicalNotes = result.clinicalNotes.map(
    (n: ClinicalNoteEffect) => `[${n.category}] ${n.note}`
  );

  // Combine supplements
  const supplements = result.supplements.map(
    (s: SuggestSupplementEffect) => `${s.name}: ${s.reason}${s.dose ? ` (${s.dose})` : ''}`
  );

  // ── Faza D Phase 1 W2-Tue: D3-D8 derivations ──────────────────────────────
  // Pull boolean / categorical flags + stage tiers off the PatientContext
  // (decrypted in policy-engine.ts:buildPatientContext) and feed them through
  // as derivedConditionFlags + nutrientLimits. Solver-side constraint hooks
  // for each are scheduled per master plan timeline (W2-Fri).
  const derivedConditionFlags: string[] = [];

  // D8: PCOS — ctx.hormonalIssues is a free-text array; match case-insensitively.
  if (ctx.hormonalIssues?.some((h) => h.toLowerCase().includes('pcos'))) {
    derivedConditionFlags.push('pcos');
  }

  // D3: Patient explicitly said they don't eat at night → tighten dinner rules.
  if (ctx.mealRhythm?.eatsAtNight === false) {
    derivedConditionFlags.push('no_night_eating');
  }

  // D5: Last meal time = 'before_18' → no late SNACK + earlier dinner.
  if (ctx.mealRhythm?.lastMealTime === 'before_18') {
    derivedConditionFlags.push('eats_before_18');
  }

  // D7: Night-shift work → cycle-shifted meal distribution (Wednesday wires
  // up the actual variant in mealDistribution.service.ts).
  if (ctx.workType === 'shift_night') {
    derivedConditionFlags.push('shift_night');
  }

  // D6: CKD stadium tiered protein / phosphorus / potassium limits per
  //   * stage 3 → protein 0.8 g/kg/day, phosphorus ≤ 1000 mg
  //   * stage 4 → protein 0.6 g/kg/day, phosphorus ≤ 900 mg
  //   * stage 5 → protein 0.6 g/kg/day, phosphorus ≤ 800 mg, potassium ≤ 2500 mg
  // (KDOQI 2020 + Polish Nephrology Society guidance). Stages 1-2 = no special
  // capping; weightKg defaults to 70 when missing so at least the absolute
  // mineral caps fire.
  const stadium = ctx.ckdStadium;
  const tieredCkdNutrientLimits: NutrientLimitEffect[] = [];
  if (stadium && stadium >= 3 && stadium <= 5) {
    derivedConditionFlags.push(`ckd_stage_${stadium}`);
    const weightKg = ctx.weightKg > 0 ? ctx.weightKg : 70;
    const proteinPerKg = stadium === 3 ? 0.8 : 0.6;
    const phosphorusMax = stadium === 3 ? 1000 : stadium === 4 ? 900 : 800;
    tieredCkdNutrientLimits.push(
      {
        type: 'NUTRIENT_LIMIT',
        nutrient: 'protein',
        scope: 'DAILY_TOTAL',
        max: Math.round(proteinPerKg * weightKg * 10) / 10,
      },
      {
        type: 'NUTRIENT_LIMIT',
        nutrient: 'phosphorus',
        scope: 'DAILY_TOTAL',
        max: phosphorusMax,
      },
    );
    if (stadium === 5) {
      tieredCkdNutrientLimits.push({
        type: 'NUTRIENT_LIMIT',
        nutrient: 'potassium',
        scope: 'DAILY_TOTAL',
        max: 2500,
      });
    }
  }

  // P1.2 / P1.8: project preferredFoods → lexical keywords + canonical buckets,
  // filtering out diet-incompatible codes (vegan + fish, etc.).
  const preferredMapping = mapPreferredFoodsToKeywords(ctx.preferredFoods, ctx.dietType);
  // P1.7: derive dietary_pattern marker for SC30 minimum-skip logic. We map
  // Polish dietType strings to canonical English markers using the same
  // detection style as `dietTypeFlags` above.
  let dietaryPattern: 'vegan' | 'vegetarian' | 'pescatarian' | undefined;
  if (ctx.dietType) {
    const dt = ctx.dietType.toLowerCase();
    if (dt.includes('wegan')) dietaryPattern = 'vegan';
    else if (dt.includes('wegetarian')) dietaryPattern = 'vegetarian';
    else if (dt.includes('peskatar') || dt.includes('pescatar')) dietaryPattern = 'pescatarian';
  }

  return {
    excludeAllergens: interviewAllergens,
    requiredDietFlags: [...new Set([...flagsFromPolicy, ...dietTypeFlags])],
    excludeKeywords: [
      ...result.excludeKeywords,
      // 84.2: Add disliked food keywords for solver penalty
      ...(ctx.dislikedFoods ? mapDislikedFoodsToKeywords(ctx.dislikedFoods) : []),
    ],
    mealDistributions: result.mealDistributions,
    // Faza D W2-Tue: append CKD-stage tier limits to the generic policy-engine
    // ones. Both flow through scope=DAILY_TOTAL filter in mergeConstraintsIntoInput.
    nutrientLimits: [...result.nutrientLimits, ...tieredCkdNutrientLimits],
    clinicalNotes,
    supplements,
    appliedRulesCount: result.appliedRules.length,
    appliedRuleNames: result.appliedRules.map(r => r.ruleName),
    // ── Faza D: pass-through patient context that previously got dropped ──
    cuisinePreferences: ctx.cuisinePreferences,
    sex: (ctx.sex === 'M' || ctx.sex === 'F') ? ctx.sex : null,
    ageYears: ctx.ageYears > 0 ? ctx.ageYears : null,
    pregnancyTrimester: ctx.pregnancyTrimester ?? null,
    // Lactation isn't a first-class field in PatientContext; derive from
    // pregnancyStatus prose (Polish: "karmienie" / "laktacja"). W2-Tue's
    // policy-engine extension will surface this as a typed boolean field.
    lactating: /(karmi|lacta)/i.test(ctx.pregnancyStatus ?? ''),
    // ── Faza D Phase 1 W2-Tue: D3-D8 derived flags ─────────────────────────
    derivedConditionFlags: derivedConditionFlags.length > 0 ? derivedConditionFlags : undefined,
    ckdStadium: stadium,
    // ── P1.4 / P1.5 / P1.7 SC30 inputs ──────────────────────────────────────
    preferredProteinBuckets: preferredMapping.canonicalBuckets.length > 0
      ? preferredMapping.canonicalBuckets
      : undefined,
    dietaryPattern,
  };
}

/**
 * Merge policy constraints into an AssemblyInput, enriching it with
 * allergen/diet flag filters derived from clinical rules.
 */
export function mergeConstraintsIntoInput(
  input: AssemblyInput,
  constraints: DbPolicyConstraints,
): AssemblyInput {
  // Derive clinical condition flags from nutrient limits and applied rules
  const conditionFlags: string[] = [...(input.conditionFlags ?? [])];
  const ruleNames = constraints.appliedRuleNames.map((n) => n.toLowerCase());
  const hasNutrientMax = (nutrient: string) =>
    constraints.nutrientLimits.some((l) => l.nutrient === nutrient && l.max != null);

  if (hasNutrientMax('sodium') || ruleNames.some((n) => n.includes('hypertension') || n.includes('nadciśnienie'))) {
    conditionFlags.push('hypertension');
  }
  if (ruleNames.some((n) => n.includes('diabetes') || n.includes('cukrzyca') || n.includes('insulin'))) {
    conditionFlags.push('diabetes');
  }
  if (ruleNames.some((n) => n.includes('ckd') || n.includes('kidney') || n.includes('nerk'))) {
    conditionFlags.push('ckd');
  }
  if (ruleNames.some((n) => n.includes('ibs') || n.includes('crohn') || n.includes('fodmap') || n.includes('jelito drażliwe'))) {
    conditionFlags.push('ibs');
  }

  // Faza D Phase 1 W2-Tue: append D3-D8 derived flags. Solver-side
  // activation hooks for each flag come per master plan timeline (W2-Fri
  // for PCOS module + nutrient_limits enforcement; W2-Wed for the
  // distribution variants driven by 'shift_night' / 'eats_before_18').
  if (constraints.derivedConditionFlags) {
    conditionFlags.push(...constraints.derivedConditionFlags);
  }

  return {
    ...input,
    excludeAllergens: [
      ...new Set([...(input.excludeAllergens ?? []), ...constraints.excludeAllergens]),
    ],
    requiredDietFlags: [
      ...new Set([...(input.requiredDietFlags ?? []), ...constraints.requiredDietFlags]),
    ],
    conditionFlags: [...new Set(conditionFlags)],
    // #4: Pass daily nutrient limits to solver
    nutrientLimits: constraints.nutrientLimits
      .filter((l) => l.scope === 'DAILY_TOTAL')
      .map((l) => ({ nutrient: l.nutrient, min: l.min, max: l.max })),
    // 84.2: Exclude keywords (from dislikes + policy exclusions) for solver penalty
    excludeKeywords: constraints.excludeKeywords.length > 0 ? constraints.excludeKeywords : undefined,
    // ── Faza D: patient context fields previously dropped at this layer ──
    // Caller-supplied AssemblyInput values take precedence (?? fallback) so
    // explicit overrides survive. Cuisine preferences only flow through when
    // the policy bridge actually decoded them — empty/undefined arrays stay
    // undefined, leaving recipeCandidate's cuisine filter inactive.
    cuisinePreferences: input.cuisinePreferences
      ?? (constraints.cuisinePreferences && constraints.cuisinePreferences.length > 0
            ? constraints.cuisinePreferences
            : undefined),
    sex: input.sex ?? constraints.sex ?? undefined,
    ageYears: input.ageYears ?? constraints.ageYears ?? undefined,
    pregnancyTrimester: input.pregnancyTrimester ?? constraints.pregnancyTrimester ?? undefined,
    lactating: input.lactating ?? constraints.lactating ?? false,
    // P1.4 / P1.5 / P1.7: SC30 protein buckets — pass through unless caller
    // already supplied a value (caller override wins, same convention as
    // cuisinePreferences above).
    preferredProteinBuckets: input.preferredProteinBuckets
      ?? (constraints.preferredProteinBuckets && constraints.preferredProteinBuckets.length > 0
            ? constraints.preferredProteinBuckets
            : undefined),
    dietaryPattern: input.dietaryPattern ?? constraints.dietaryPattern ?? undefined,
  };
}
