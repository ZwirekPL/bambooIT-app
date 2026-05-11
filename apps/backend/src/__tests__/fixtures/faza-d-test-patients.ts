/**
 * Faza D Phase 0 Task #10 — test patient fixtures.
 *
 * 11 patient profiles covering D1-D8 patient inputs + 4 meal-count models (3/4/5/6).
 * Used by gold standard snapshot tests (Task #1) and post-refactor regression tests.
 *
 * Mix: 8 synthetic (designed for specific D1-D8 coverage) + 3 real-DB extracts
 * (anonymized — but our dev DB has only fictitious test patients, so this is
 * just a strip of the patient short-id from full cuid). Realistic clinical
 * combinations the synthetic set wouldn't try to invent.
 *
 * Coverage matrix:
 *   Meal-count: 3-meal=2, 4-meal=3, 5-meal=4, 6-meal=2 → ≥2 per model.
 *   D-coverage: D1 D3 D4 D5 D6 D7 D8 + control + clinical wildcards.
 *   D2 (dislikedFoods/preferredFoods) is implicit in nearly every fixture.
 *
 * Convention: fixtures are POSITIONAL inputs to seed Patient + Interview +
 * NutritionTargets in a test transaction. They do NOT include DB-generated
 * fields (id, createdAt). The test harness creates these with cuid() and
 * passes them to the pipeline.
 */

export interface FazaDTestPatient {
  /** Stable identifier used in snapshot file names */
  id: string;
  description: string;
  source: 'synthetic' | 'real-fictitious-db';
  /** Tags for what this fixture exercises — used to assert coverage in tests */
  expectedCoverage: string[];
  patient: {
    sex: 'M' | 'F';
    birthYear: number;
    heightCm: number;
    weightKg: number;
  };
  nutritionTargets: {
    targetKcal: number;
    targetProteinG: number;
    targetFatG: number;
    targetCarbsG: number;
    goal: 'lose_weight' | 'maintain' | 'gain_weight';
  };
  interview: {
    /** The same shape that policy-engine.buildPatientContext() consumes */
    answers: Record<string, unknown>;
  };
}

// ─── Helper builders ─────────────────────────────────────────────────────────

const BASE_ANSWERS = {
  digestiveIssues: ['none'],
  intolerances: ['none'],
  alcoholFrequency: 'none',
  mainMealAt: 'home',
  pregnancyStatus: 'none',
  cookingTime: 'medium',
  budget: 'medium',
  stressLevel: 'moderate',
  sleepHours: '7_8',
  supplements: ['none_supp'],
  medications: ['none'],
};

// ─── 8 synthetic fixtures (D1-D8 + control) ──────────────────────────────────

const SYNTHETIC: FazaDTestPatient[] = [
  {
    id: 's-control',
    description: 'Standard 30yo M, no special flags, 3-meal model (covers minimal meal count + RDA baseline)',
    source: 'synthetic',
    expectedCoverage: ['control', 'mealCount:3'],
    patient: { sex: 'M', birthYear: 1996, heightCm: 178, weightKg: 75 },
    nutritionTargets: {
      targetKcal: 2200, targetProteinG: 120, targetFatG: 75, targetCarbsG: 250, goal: 'maintain',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'maintain',
        timeline: '6_months',
        activityLevel: 'moderate',
        activityTypes: ['walking', 'gym'],
        workoutsPerWeek: 3,
        workoutDurationMin: 45,
        chronicDiseases: ['none'],
        allergies: ['none'],
        dietType: 'omnivore',
        cuisinePreferences: ['any'],
        dislikedFoods: [],
        preferredFoods: [],
        mealsPerDay: 3,
        workType: 'office',
        firstMealTime: '7_9',
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        hormonalIssues: ['none'],
      },
    },
  },
  {
    id: 's-d1-vegan-polish',
    description: '28yo F vegan + polish cuisine only — D1 hard cuisine filter test',
    source: 'synthetic',
    expectedCoverage: ['D1', 'mealCount:5'],
    patient: { sex: 'F', birthYear: 1998, heightCm: 168, weightKg: 62 },
    nutritionTargets: {
      targetKcal: 1900, targetProteinG: 95, targetFatG: 65, targetCarbsG: 220, goal: 'maintain',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'maintain',
        timeline: 'long_term',
        activityLevel: 'moderate',
        activityTypes: ['running', 'yoga'],
        workoutsPerWeek: 4,
        workoutDurationMin: 50,
        chronicDiseases: ['none'],
        allergies: ['none'],
        dietType: 'vegan',
        cuisinePreferences: ['polish'],
        dislikedFoods: [],
        preferredFoods: ['legumes', 'cooked_veg', 'oatmeal', 'nuts_seeds'],
        mealsPerDay: 5,
        supplements: ['vit_b12', 'vit_d', 'omega3_algae'],
        workType: 'office',
        firstMealTime: '7_9',
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        hormonalIssues: ['none'],
      },
    },
  },
  {
    id: 's-d3-no-night',
    description: '45yo M, eatsAtNight=false + 6-meal model — D3 dinner kcal cap',
    source: 'synthetic',
    expectedCoverage: ['D3', 'mealCount:6'],
    patient: { sex: 'M', birthYear: 1981, heightCm: 180, weightKg: 88 },
    nutritionTargets: {
      targetKcal: 2400, targetProteinG: 145, targetFatG: 80, targetCarbsG: 270, goal: 'maintain',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'maintain',
        timeline: 'long_term',
        activityLevel: 'moderate',
        activityTypes: ['cycling_recreational', 'gym'],
        workoutsPerWeek: 4,
        workoutDurationMin: 60,
        chronicDiseases: ['none'],
        allergies: ['none'],
        dietType: 'omnivore',
        cuisinePreferences: ['polish', 'mediterranean'],
        dislikedFoods: ['offal'],
        preferredFoods: ['poultry', 'fish', 'cooked_veg'],
        mealsPerDay: 6,
        workType: 'office',
        firstMealTime: 'before_7',
        lastMealTime: '18_20',
        eatsAtNight: 'no',  // D3 — explicit no night eating
        hormonalIssues: ['none'],
      },
    },
  },
  {
    id: 's-d4-skip-breakfast',
    description: '35yo F, firstMealTime=skip + mealsPerDay=4 — D4 breakfast skip distribution',
    source: 'synthetic',
    expectedCoverage: ['D4', 'mealCount:4'],
    patient: { sex: 'F', birthYear: 1991, heightCm: 165, weightKg: 68 },
    nutritionTargets: {
      targetKcal: 1700, targetProteinG: 110, targetFatG: 60, targetCarbsG: 180, goal: 'lose_weight',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'lose_weight',
        targetWeightKg: 62,
        timeline: '6_months',
        activityLevel: 'moderate',
        activityTypes: ['gym', 'pilates'],
        workoutsPerWeek: 4,
        workoutDurationMin: 45,
        chronicDiseases: ['none'],
        allergies: ['none'],
        dietType: 'omnivore',
        cuisinePreferences: ['mediterranean', 'asian_general'],
        dislikedFoods: ['offal'],
        preferredFoods: ['fish', 'poultry', 'cooked_veg', 'fruits'],
        mealsPerDay: 4,
        workType: 'office',
        firstMealTime: 'skip',  // D4 — skip breakfast
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        hormonalIssues: ['none'],
      },
    },
  },
  {
    id: 's-d5-eats-before-18',
    description: '65yo F (post-menopausal), lastMealTime=before_18 — D5 early dinner + RDA postmenopausal tier',
    source: 'synthetic',
    expectedCoverage: ['D5', 'mealCount:5', 'postmenopausal-rda'],
    patient: { sex: 'F', birthYear: 1961, heightCm: 162, weightKg: 70 },
    nutritionTargets: {
      targetKcal: 1700, targetProteinG: 95, targetFatG: 60, targetCarbsG: 200, goal: 'maintain',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'maintain',
        timeline: 'long_term',
        activityLevel: 'light',
        activityTypes: ['walking'],
        workoutsPerWeek: 3,
        workoutDurationMin: 30,
        chronicDiseases: ['none'],
        allergies: ['none'],
        dietType: 'omnivore',
        cuisinePreferences: ['polish'],
        dislikedFoods: ['spicy_food'],
        preferredFoods: ['fish', 'cooked_veg', 'fruits', 'oatmeal'],
        mealsPerDay: 5,
        workType: 'retired',
        firstMealTime: '7_9',
        lastMealTime: 'before_18',  // D5 — eats before 18
        eatsAtNight: 'no',
        hormonalIssues: ['menopause'],  // For postmenopausal RDA tier
      },
    },
  },
  {
    id: 's-d6-ckd3',
    description: '60yo M, ckdStadium=3 + 6 meals — D6 protein/phosphorus tier constraints',
    source: 'synthetic',
    expectedCoverage: ['D6', 'mealCount:6', 'ckd-stage-3'],
    patient: { sex: 'M', birthYear: 1966, heightCm: 175, weightKg: 82 },
    nutritionTargets: {
      // D6 stage 3: protein cap ~0.8 g/kg = 66g for 82kg patient
      targetKcal: 2000, targetProteinG: 66, targetFatG: 70, targetCarbsG: 270, goal: 'maintain',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'maintain',
        timeline: 'long_term',
        activityLevel: 'light',
        activityTypes: ['walking'],
        workoutsPerWeek: 4,
        workoutDurationMin: 30,
        chronicDiseases: ['ckd', 'hypertension'],
        medications: ['ace_inhibitors'],
        allergies: ['none'],
        dietType: 'omnivore',
        cuisinePreferences: ['polish'],
        dislikedFoods: [],
        preferredFoods: ['poultry', 'cooked_veg', 'rice_groats'],
        mealsPerDay: 6,
        ckdStadium: 3,  // D6 — explicit stadium tier
        workType: 'office',
        firstMealTime: '7_9',
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        hormonalIssues: ['none'],
        additionalNotes: 'CKD stadium 3 (eGFR 40-50). Protein restriction 0.8 g/kg, phosphorus ≤1000mg/d.',
      },
    },
  },
  {
    id: 's-d7-night-shift',
    description: '32yo M, workType=shift_night + 4 meals — D7 cycle shifted ~6h',
    source: 'synthetic',
    expectedCoverage: ['D7', 'mealCount:4'],
    patient: { sex: 'M', birthYear: 1994, heightCm: 182, weightKg: 80 },
    nutritionTargets: {
      targetKcal: 2400, targetProteinG: 140, targetFatG: 80, targetCarbsG: 280, goal: 'maintain',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'maintain',
        timeline: 'long_term',
        activityLevel: 'moderate',
        activityTypes: ['gym'],
        workoutsPerWeek: 3,
        workoutDurationMin: 50,
        chronicDiseases: ['none'],
        allergies: ['none'],
        dietType: 'omnivore',
        cuisinePreferences: ['polish', 'asian_general'],
        dislikedFoods: [],
        preferredFoods: ['poultry', 'rice_groats', 'eggs'],
        mealsPerDay: 4,
        workType: 'shift_night',  // D7 — night shift cycle
        mainMealAt: 'work',
        firstMealTime: 'after_9',  // Wake-up "morning" is afternoon for night shift
        lastMealTime: 'after_20',
        eatsAtNight: 'yes',
        sleepHours: 'lt_6',
        hormonalIssues: ['none'],
      },
    },
  },
  {
    id: 's-d9-mexican-rare',
    description: '32yo M, omnivore + RARE single cuisine ["mexican"] — SC22 stress test (only ~47 mexican recipes in DB across all meal types)',
    source: 'synthetic',
    expectedCoverage: ['SC22-rare-cuisine', 'mealCount:4'],
    patient: { sex: 'M', birthYear: 1994, heightCm: 176, weightKg: 78 },
    nutritionTargets: {
      targetKcal: 2200, targetProteinG: 130, targetFatG: 70, targetCarbsG: 260, goal: 'maintain',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'maintain',
        timeline: 'long_term',
        activityLevel: 'moderate',
        activityTypes: ['gym'],
        workoutsPerWeek: 3,
        workoutDurationMin: 45,
        chronicDiseases: ['none'],
        allergies: ['none'],
        dietType: 'omnivore',
        // RARE: only mexican (`meksykańska` ≈ 47 recipes total in DB) and
        // not "any" — exercises the SC22 shortfall pathway. Without the
        // soft-constraint refactor this fixture would produce INFEASIBLE
        // (the previous hard filter wiped every candidate slot pool).
        cuisinePreferences: ['mexican'],
        dislikedFoods: [],
        preferredFoods: ['beans', 'rice_groats', 'corn', 'poultry'],
        mealsPerDay: 4,
        workType: 'office',
        firstMealTime: '7_9',
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        hormonalIssues: ['none'],
        additionalNotes: 'Faza D D1 stress test: jedna rzadka kuchnia. Solver powinien preferować meksykańskie tam gdzie dostępne i NIE failować całego planu.',
      },
    },
  },
  {
    id: 's-d8-pcos',
    description: '28yo F, hormonalIssues=pcos — D8 low-GI + evening carb cap',
    source: 'synthetic',
    expectedCoverage: ['D8', 'mealCount:5'],
    patient: { sex: 'F', birthYear: 1998, heightCm: 167, weightKg: 75 },
    nutritionTargets: {
      targetKcal: 1700, targetProteinG: 115, targetFatG: 65, targetCarbsG: 165, goal: 'lose_weight',
    },
    interview: {
      answers: {
        ...BASE_ANSWERS,
        mainGoal: 'lose_weight',
        targetWeightKg: 65,
        timeline: '6_months',
        activityLevel: 'moderate',
        activityTypes: ['gym', 'walking'],
        workoutsPerWeek: 4,
        workoutDurationMin: 45,
        chronicDiseases: ['insulin_resistance'],
        allergies: ['none'],
        dietType: 'omnivore',
        cuisinePreferences: ['mediterranean'],
        dislikedFoods: [],
        preferredFoods: ['fish', 'cooked_veg', 'eggs', 'legumes'],
        mealsPerDay: 5,
        workType: 'office',
        firstMealTime: '7_9',
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        hormonalIssues: ['pcos'],  // D8 — explicit PCOS
        additionalNotes: 'PCOS z insulinoopornością. Niski IG <70, omega-3, dieta śródziemnomorska.',
      },
    },
  },
];

// ─── 3 real-fictitious-DB fixtures (clinical wildcards) ─────────────────────

const REAL: FazaDTestPatient[] = [
  {
    id: 'r-hypertension-dash',
    description: '50yo M, hypertension + DASH diet (real DB cmoes5kw...ime9bykx) — clinical hypertension wildcard',
    source: 'real-fictitious-db',
    expectedCoverage: ['mealCount:4', 'clinical:hypertension+dash'],
    patient: { sex: 'M', birthYear: 1976, heightCm: 178, weightKg: 95 },
    nutritionTargets: {
      targetKcal: 1999, targetProteinG: 171, targetFatG: 67, targetCarbsG: 178, goal: 'lose_weight',
    },
    interview: {
      answers: {
        mainGoal: 'lose_weight',
        currentWeightKg: '95',
        targetWeightKg: '85',
        timeline: '6_months',
        activityLevel: 'light',
        activityTypes: ['walking', 'cycling_recreational'],
        workoutsPerWeek: '3',
        workoutDurationMin: '45',
        chronicDiseases: ['hypertension', 'nadciśnienie'],
        medications: ['ace_inhibitors'],
        digestiveIssues: ['none'],
        allergies: ['none'],
        intolerances: ['none'],
        dietType: 'dash',
        cuisinePreferences: ['polish', 'mediterranean'],
        dislikedFoods: ['offal'],
        preferredFoods: ['poultry', 'fish', 'legumes', 'cooked_veg', 'fruits', 'nuts_seeds', 'oatmeal'],
        mealsPerDay: '4',
        supplements: ['vit_d', 'magnesium', 'omega3'],
        cookingTime: 'medium',
        budget: 'medium',
        alcoholFrequency: 'none',
        workType: 'office',
        mainMealAt: 'home',
        stressLevel: 'moderate',
        sleepHours: '7_8',
        firstMealTime: '7_9',
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        hormonalIssues: ['none'],
        additionalNotes: 'Nadciśnienie tętnicze leczone inhibitorem ACE. Test solvera: sód <2000mg/d, dieta DASH.',
      },
    },
  },
  {
    id: 'r-multi-condition',
    description: '30yo M, T1 diabetes + NAFLD + shellfish allergy + lactose (real DB cmmrzhb4u...fv8bl8k5) — multi-condition wildcard',
    source: 'real-fictitious-db',
    expectedCoverage: ['mealCount:5', 'clinical:t1-diabetes+nafld+multi-allergen'],
    patient: { sex: 'M', birthYear: 1996, heightCm: 173, weightKg: 120 },
    nutritionTargets: {
      targetKcal: 2538, targetProteinG: 240, targetFatG: 71, targetCarbsG: 235, goal: 'lose_weight',
    },
    interview: {
      answers: {
        mainGoal: 'lose_weight',
        timeline: '6_months',
        activityLevel: 'moderate',
        activityTypes: ['gym', 'yoga'],
        chronicDiseases: ['diabetes_t1', 'nafld'],
        digestiveIssues: ['none'],
        allergies: ['shellfish'],
        intolerances: ['lactose_intolerance'],
        dislikedFoods: [],
        preferredFoods: ['eggs', 'beef_pork', 'poultry', 'oatmeal', 'potatoes', 'rice_groats'],
        dietType: 'omnivore',
        cuisinePreferences: ['any'],
        mealsPerDay: 5,
        cookingTime: 'long',
        budget: 'low',
        medications: ['none'],
        supplements: ['none_supp'],
        currentWeightKg: 120,
        targetWeightKg: 80,
        workoutsPerWeek: 2,
        workoutDurationMin: 45,
        firstMealTime: 'before_7',
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        alcoholFrequency: 'occasional',
        workType: 'physical',
        mainMealAt: 'work',
        pregnancyStatus: 'none',
        hormonalIssues: ['none'],
        stressLevel: 'moderate',
        sleepHours: '6_7',
      },
    },
  },
  {
    id: 'r-3-meals',
    description: '29yo M, 3 meals + 4 disliked foods + lactose (real DB cmmpc5p0h...gpnq42sc) — 3-meal model wildcard',
    source: 'real-fictitious-db',
    expectedCoverage: ['mealCount:3', 'multi-disliked'],
    patient: { sex: 'M', birthYear: 1997, heightCm: 173, weightKg: 64 },
    nutritionTargets: {
      targetKcal: 1532, targetProteinG: 128, targetFatG: 43, targetCarbsG: 158, goal: 'lose_weight',
    },
    interview: {
      answers: {
        mainGoal: 'lose_weight',
        timeline: '3_months',
        activityLevel: 'light',
        activityTypes: ['walking'],
        chronicDiseases: ['none'],
        digestiveIssues: ['none'],
        allergies: [],
        intolerances: ['lactose_intolerance'],
        dislikedFoods: ['seafood', 'brocoli_cauliflower', 'tofu_tempeh', 'offal'],
        dietType: 'omnivore',
        cuisinePreferences: ['any'],
        mealsPerDay: 3,
        cookingTime: 'quick',
        budget: 'low',
        medications: ['none'],
        supplements: ['none_supp'],
        currentWeightKg: 64,
        targetWeightKg: 58,
        workoutsPerWeek: 1,
        workoutDurationMin: 30,
        firstMealTime: '7_9',
        lastMealTime: '18_20',
        eatsAtNight: 'no',
        alcoholFrequency: 'none',
        workType: 'physical',
        mainMealAt: 'work',
        pregnancyStatus: 'none',
        hormonalIssues: ['none'],
        stressLevel: 'high',
        sleepHours: '6_7',
      },
    },
  },
];

// ─── Combined export ─────────────────────────────────────────────────────────

export const FAZA_D_TEST_PATIENTS: FazaDTestPatient[] = [...SYNTHETIC, ...REAL];

// ─── Coverage assertions (sanity check at module load) ───────────────────────

const BY_MEAL_COUNT: Record<number, number> = {};
const COVERED_TAGS = new Set<string>();
for (const p of FAZA_D_TEST_PATIENTS) {
  const mc = (p.interview.answers.mealsPerDay as number | string);
  const n = typeof mc === 'string' ? Number(mc) : mc;
  BY_MEAL_COUNT[n] = (BY_MEAL_COUNT[n] ?? 0) + 1;
  for (const tag of p.expectedCoverage) COVERED_TAGS.add(tag);
}

// Required: each meal-count model (3/4/5/6) has ≥2 patients
for (const m of [3, 4, 5, 6]) {
  if ((BY_MEAL_COUNT[m] ?? 0) < 2) {
    throw new Error(`[FAZA_D_TEST_PATIENTS] meal-count ${m} has only ${BY_MEAL_COUNT[m] ?? 0} patient(s); need ≥2.`);
  }
}

// Required: D1-D8 + control all covered
for (const d of ['control', 'D1', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']) {
  if (!COVERED_TAGS.has(d)) {
    throw new Error(`[FAZA_D_TEST_PATIENTS] tag "${d}" not covered.`);
  }
}
