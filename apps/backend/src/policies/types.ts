// ─── Policy Engine Types ─────────────────────────────────────────────────────

/**
 * Patient context extracted from interview answers, nutrition targets,
 * and patient profile. Used by policy rules to evaluate conditions.
 */
export interface PatientContext {
  patientId: string;

  // From interview answers
  chronicDiseases: string[];
  digestiveIssues: string[];
  allergies: string[];
  dietType: string;
  medications: string;
  mealsPerDay: number;

  // PRO interview fields
  pregnancyStatus?: string;
  /** Pregnancy trimester: 1 | 2 | 3 — affects caloric and micronutrient RDA (IW-14) */
  pregnancyTrimester?: number;
  hormonalIssues?: string[];
  stressLevel?: string;
  sleepHours?: string;

  // From NutritionTargets
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;

  // From patient profile
  sex: string;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  goal: string;

  // Extended context (Phase 27)
  /** Disease stage, e.g. "remission", "flare", "stage3", "decompensated" */
  stage?: string;
  /** Specific medications list (parsed from interview or manual entry) */
  medicationsList?: string[];
  /** Surgery history, e.g. ["bariatric", "gastrectomy"] */
  surgeryHistory?: string[];

  // Extended context (Phase 28.0.PRE)
  cuisinePreferences?: string[];
  dislikedFoods?: string[];
  /** Free-text disliked products from textarea (comma-separated) */
  dislikedFoodsOther?: string;
  preferredFoods?: string[];
  /** Free-text preferred products from textarea (comma-separated) */
  preferredFoodsOther?: string;
  cookingTime?: string;
  budget?: string;
  /** Sanitized free-text notes (PII stripped) */
  additionalNotes?: string;
  supplements?: string[];
  mealRhythm?: {
    firstMealTime?: string;
    lastMealTime?: string;
    skipsMeals?: boolean;
    eatsAtNight?: boolean;
  };
  alcoholFrequency?: string;
  workType?: string;
  /** Where the patient eats their main meal: 'home' | 'restaurant' | 'work' */
  mainMealAt?: string;
  /** CKD stage 1–5 (IW-13) */
  ckdStadium?: number;
  activityTypes?: string[];
  workoutsPerWeek?: number;
  workoutDurationMin?: number;
  intolerances?: string[];
  targetWeightKg?: number;
}

// ─── Policy Effects ────────────────────────────────────────────────────────

export type NutrientKey =
  | 'kcal' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'sugar' | 'salt'
  | 'saturatedFat' | 'sodium' | 'cholesterol' | 'potassium' | 'purines'
  | 'phosphorus'
  | 'calcium';

/** Modify nutrition targets (e.g., cap carbs for diabetes) */
export interface ModifyTargetsEffect {
  type: 'MODIFY_TARGETS';
  field: 'targetKcal' | 'targetProteinG' | 'targetFatG' | 'targetCarbsG';
  operation: 'SET' | 'MULTIPLY' | 'ADD' | 'MAX' | 'MIN';
  value: number;
}

/** Per-meal nutrient distribution rule (e.g., even carb distribution for IR) */
export interface MealDistributionEffect {
  type: 'MEAL_DISTRIBUTION';
  nutrient: NutrientKey;
  maxPerMealPct: number; // max % of daily total per single meal
}

/** Nutrient limit checked during validation (per 100g or daily total) */
export interface NutrientLimitEffect {
  type: 'NUTRIENT_LIMIT';
  nutrient: NutrientKey;
  scope: 'DAILY_TOTAL' | 'PER_100G';
  min?: number;
  max?: number;
}

/** Exclude products with specific diet flags or tags */
export interface ExcludeProductsEffect {
  type: 'EXCLUDE_PRODUCTS';
  flagKey: string; // FoodProductDietFlag key (e.g., 'ketoCompatible')
  flagValue: boolean; // exclude products where flag == this value
}

/** Prefer products with specific diet flags */
export interface PreferProductsEffect {
  type: 'PREFER_PRODUCTS';
  flagKey: string;
  flagValue: boolean;
}

/** Exclude products by keyword in name (e.g., 'alkohol', 'soda') */
export interface ExcludeKeywordsEffect {
  type: 'EXCLUDE_KEYWORDS';
  keywords: string[];
}

/** Add a clinical note to the plan explanation */
export interface ClinicalNoteEffect {
  type: 'CLINICAL_NOTE';
  note: string;
  category: 'RESTRICTION' | 'RECOMMENDATION' | 'WARNING' | 'INFO';
}

/** Suggest a supplement (Phase 27) */
export interface SuggestSupplementEffect {
  type: 'SUGGEST_SUPPLEMENT';
  name: string;        // e.g. "Vitamin D3"
  dose: string;        // e.g. "800-2000 IU/d"
  reason: string;      // e.g. "Deficiency prevention in CKD"
  conditionalOnAge?: { minAge?: number; maxAge?: number }; // age-gated dosing
}

/** Age-conditional effect: different effects for different age ranges (Phase 27) */
export interface AgeConditionalEffect {
  type: 'AGE_CONDITIONAL';
  ageRanges: Array<{
    minAge?: number;
    maxAge?: number;
    effects: PolicyEffect[];
  }>;
}

export type PolicyEffect =
  | ModifyTargetsEffect
  | MealDistributionEffect
  | NutrientLimitEffect
  | ExcludeProductsEffect
  | PreferProductsEffect
  | ExcludeKeywordsEffect
  | ClinicalNoteEffect
  | SuggestSupplementEffect
  | AgeConditionalEffect;

// ─── Policy Rule ───────────────────────────────────────────────────────────

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  /** Priority: higher = evaluated first (for conflicting effects) */
  priority: number;
  /** Condition: should this rule activate for this patient? */
  condition: (ctx: PatientContext) => boolean;
  /** Effects produced when condition is true */
  effects: PolicyEffect[];
  /** Version for audit trail (Phase 27) */
  version?: string;
  /** Names of rules that conflict with this one (Phase 27) */
  conflictsWith?: string[];
}

// ─── Policy Evaluation Result ──────────────────────────────────────────────

export interface AppliedRule {
  ruleId: string;
  ruleName: string;
  description: string;
  effects: PolicyEffect[];
}

export interface PolicyResult {
  /** Rules that matched this patient */
  appliedRules: AppliedRule[];

  /** Aggregated target modifications */
  targetModifications: ModifyTargetsEffect[];

  /** Aggregated meal distribution rules */
  mealDistributions: MealDistributionEffect[];

  /** Aggregated nutrient limits for validation */
  nutrientLimits: NutrientLimitEffect[];

  /** Product flags to exclude */
  excludeFlags: ExcludeProductsEffect[];

  /** Product flags to prefer */
  preferFlags: PreferProductsEffect[];

  /** Keywords to exclude from product names */
  excludeKeywords: string[];

  /** Clinical notes for explainability */
  clinicalNotes: ClinicalNoteEffect[];

  /** Suggested supplements (Phase 27) */
  supplements: SuggestSupplementEffect[];

  /** Detected rule conflicts (Phase 27) */
  conflicts: RuleConflict[];
}

/** Conflict between two rules detected via conflictsWith (Phase 27) */
export interface RuleConflict {
  ruleA: string; // rule name
  ruleB: string; // rule name
  description: string;
}

// ─── Red Flags ─────────────────────────────────────────────────────────────

export interface RedFlag {
  id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  /** Condition: does this red flag apply? */
  condition: (ctx: PatientContext) => boolean;
  /** Message shown to dietitian */
  message: string;
}

export interface RedFlagResult {
  triggered: boolean;
  flags: TriggeredRedFlag[];
  /** If any CRITICAL flag → block auto-generation */
  blockGeneration: boolean;
}

export interface TriggeredRedFlag {
  flagId: string;
  name: string;
  severity: RedFlag['severity'];
  message: string;
}

// ─── Explainability ────────────────────────────────────────────────────────

export interface PlanExplanation {
  /** Why these calories/macros? */
  targetReasoning: string;

  /** What restrictions were applied? */
  restrictions: ExplanationEntry[];

  /** What recommendations were followed? */
  recommendations: ExplanationEntry[];

  /** Any warnings or special notes */
  warnings: string[];
}

export interface ExplanationEntry {
  ruleId: string;
  ruleName: string;
  description: string;
}
