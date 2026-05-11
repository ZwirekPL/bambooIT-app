/**
 * Solver test patients — fixtures dla manualnych testów regeneracji planów.
 *
 * Tworzy 5 pacjentów z czytelnymi nazwami (firstName/lastName), każdy
 * odpowiada jednemu scenariuszowi testowemu solvera:
 *
 *   1. Test Healthy            — zdrowy CORE, brak chorób              (sanity check)
 *   2. Test Cukrzyca           — diabetes_t2 + metformin + hba1c       (P-5 GL ≤ 80, P-7.1 fiber ≥ 30g)
 *   3. Test Ciezarna T2        — pregnancyStatus=pregnant, trimester=2 (P-4 asymetryczny kcal)
 *   4. Test Senior55           — wiek 60                                (P-2 wapń 1200mg)
 *   5. Test Nadcisnienie       — hypertension + ace_inhibitors          (FAZA 77.5 sód <2000mg)
 *
 * Wszystkie pola wywiadu są wypełnione realistycznie zgodnie z formularzem
 * frontendowym (apps/web/src/components/dashboard/InterviewForm.tsx) — tymi
 * samymi kodami enum, które wysyła UI.
 *
 * Idempotentny: upsert po email — bezpieczny do wielokrotnego uruchamiania.
 *
 * Usage:
 *   set -a && source apps/backend/.env && set +a && node scripts/seed-solver-test-patients.js
 *
 * Env (opcjonalne):
 *   SEED_DIETITIAN_EMAIL  (default: dietetyk@test.pl)
 *   SEED_PATIENT_PASSWORD (default: SolverTest1234!)
 *   ENCRYPTION_KEY        (musi się zgadzać z apps/backend/.env)
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

const DIETITIAN_EMAIL    = process.env.SEED_DIETITIAN_EMAIL    || 'dietetyk@test.pl';
const PATIENT_PASSWORD   = process.env.SEED_PATIENT_PASSWORD   || 'SolverTest1234!';
const ENCRYPTION_KEY     = process.env.ENCRYPTION_KEY          || 'a'.repeat(64);
const HASH_ROUNDS        = 10;

// Encryption — mirrors apps/backend/src/utils/encryption.ts (AES-256-GCM)
function encryptJson(data) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { v: 1, iv: iv.toString('hex'), tag: authTag.toString('hex'), data: encrypted.toString('hex') };
}

// ── BMR / TDEE / targetKcal — Mifflin-St Jeor + activity factor + goal adj. ──
// Endpoint POST /diet-plans/generate/:patientId (triggerGenerate) NIE przekazuje
// activityLevel/mainGoal do pipeline'u — pipeline policzy NutritionTargets tylko
// jeśli już istnieją lub dostanie parametry. Normalnie liczy je interview.service.
// W seedzie liczymy je sami od razu, żeby triggerGenerate zadziałał bez owijaczy.
const ACTIVITY_FACTORS = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};
function computeNutritionTargets({ sex, ageYears, weightKg, heightCm, activityLevel, mainGoal }) {
  const sexNorm = (sex || '').toLowerCase().startsWith('f') ? 'female' : 'male';
  const bmr = sexNorm === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  const factor = ACTIVITY_FACTORS[activityLevel] ?? 1.375;
  const tdee = bmr * factor;
  const goalAdj = mainGoal === 'lose_weight' ? -500
                : mainGoal === 'gain_muscle' ? 300
                : 0;
  const targetKcal = Math.round(tdee + goalAdj);
  // Macros: 1.8 g protein/kg, 30% fat from kcal, reszta węgle
  const targetProteinG = Math.round(weightKg * 1.8);
  const targetFatG     = Math.round((targetKcal * 0.30) / 9);
  const targetCarbsG   = Math.round((targetKcal - targetProteinG * 4 - targetFatG * 9) / 4);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetKcal,
    targetProteinG,
    targetFatG,
    targetCarbsG,
    activityLevel,
    goal: mainGoal,
    ageYears,
    weightKg,
    heightCm,
  };
}

const NOW_YEAR = new Date().getFullYear();

// ── Wspólne pola — typowe dla "kompletnego" wywiadu ──────────────────────────
// (Frontend wysyła wartości jako stringi gdzie ma <select>, więc trzymamy się
//  tej konwencji nawet dla liczb — policy-engine i tak robi Number().)
const COMMON_LIFESTYLE = {
  cookingTime: 'medium',          // quick | medium | long
  budget: 'medium',                // low | medium | high
  alcoholFrequency: 'occasional',  // none | occasional | 1_2_week | daily
  workType: 'office',              // office | physical | shift_night
  mainMealAt: 'home',              // home | restaurant | work
  stressLevel: 'moderate',         // low | moderate | high | very_high
  sleepHours: '7_8',               // under_6 | 6_7 | 7_8 | over_8
  firstMealTime: '7_9',            // before_7 | 7_9 | after_9 | skip
  lastMealTime: '18_20',           // before_18 | 18_20 | after_20
  eatsAtNight: 'no',
};

// ── 5 pacjentów testowych ─────────────────────────────────────────────────────
const PATIENTS = [
  // ─── 1. ZDROWY ─────────────────────────────────────────────────────────────
  {
    email: 'test-healthy@solver.test',
    firstName: 'Test',
    lastName: 'Healthy CORE',
    sex: 'M',
    birthYear: NOW_YEAR - 30,
    heightCm: 180,
    weightKg: 78,
    answers: {
      // STEP 1 — cele i waga
      mainGoal: 'maintain_weight',
      currentWeightKg: '78',
      timeline: 'no_deadline',

      // STEP 2 — aktywność
      activityLevel: 'moderate',
      activityTypes: ['gym', 'running'],
      workoutsPerWeek: '3',
      workoutDurationMin: '60',

      // STEP 3 — choroby/leki/trawienie
      chronicDiseases: ['none'],
      medications: ['none'],
      digestiveIssues: ['none'],

      // STEP 4 — alergie / dieta / preferencje
      allergies: ['none'],
      intolerances: ['none'],
      dietType: 'omnivore',
      cuisinePreferences: ['polish', 'italian', 'mediterranean'],
      dislikedFoods: ['offal'],
      preferredFoods: ['poultry', 'fish', 'eggs', 'rice_groats', 'cooked_veg', 'fruits'],

      // STEP 5 — posiłki / styl życia / suplementy
      mealsPerDay: '4',
      supplements: ['vit_d'],
      ...COMMON_LIFESTYLE,
      additionalNotes: 'Pacjent testowy — sanity check solvera (brak chorób).',

      // STEP 6 — PRO (mężczyzna, więc tylko stress/sleep)
      hormonalIssues: ['none'],
    },
  },

  // ─── 2. CUKRZYK T2 ─────────────────────────────────────────────────────────
  {
    email: 'test-diabetes@solver.test',
    firstName: 'Test',
    lastName: 'Cukrzyca T2',
    sex: 'M',
    birthYear: NOW_YEAR - 55,
    heightCm: 175,
    weightKg: 92,
    answers: {
      mainGoal: 'lose_weight',
      currentWeightKg: '92',
      targetWeightKg: '82',
      timeline: '6_months',

      activityLevel: 'light',
      activityTypes: ['walking'],
      workoutsPerWeek: '4',
      workoutDurationMin: '30',

      // diabetes_t2 = kod frontendowy (DB rules) + 'diabetes', 'cukrzyca' = legacy
      // aliasy hardcoded clinical-rules — żeby pokryć obie ścieżki
      chronicDiseases: ['diabetes_t2', 'diabetes', 'cukrzyca'],
      chronicDiseasesOther: '',
      hba1c: '7.2',
      medications: ['metformin'],
      digestiveIssues: ['none'],

      allergies: ['none'],
      intolerances: ['none'],
      dietType: 'omnivore',
      cuisinePreferences: ['polish', 'mediterranean'],
      dislikedFoods: ['offal', 'spicy_food'],
      preferredFoods: ['poultry', 'fish', 'legumes', 'cooked_veg', 'oatmeal'],

      mealsPerDay: '5',
      supplements: ['vit_d', 'magnesium', 'omega3'],
      ...COMMON_LIFESTYLE,
      alcoholFrequency: 'none',  // diabetes — bez alkoholu
      additionalNotes: 'Pacjent z cukrzycą typu 2, leczony metforminą. Test solvera: niski IG, GL≤80, błonnik ≥30g.',

      hormonalIssues: ['none'],
    },
  },

  // ─── 3. CIĘŻARNA — II TRYMESTR ─────────────────────────────────────────────
  {
    email: 'test-pregnant@solver.test',
    firstName: 'Test',
    lastName: 'Ciezarna T2',
    sex: 'F',
    birthYear: NOW_YEAR - 30,
    heightCm: 168,
    weightKg: 68,
    answers: {
      mainGoal: 'maintain_weight',
      currentWeightKg: '68',
      timeline: 'no_deadline',

      activityLevel: 'light',
      activityTypes: ['yoga', 'walking'],
      workoutsPerWeek: '3',
      workoutDurationMin: '30',

      chronicDiseases: ['none'],
      medications: ['none'],
      digestiveIssues: ['none'],

      allergies: ['none'],
      intolerances: ['none'],
      dietType: 'omnivore',
      cuisinePreferences: ['polish', 'mediterranean', 'italian'],
      dislikedFoods: ['fish_general'],  // ciężarna — często wstręt do ryb
      preferredFoods: ['poultry', 'eggs', 'dairy', 'fruits', 'cooked_veg', 'oatmeal', 'nuts_seeds'],

      mealsPerDay: '5',
      supplements: ['folic_acid', 'iron', 'vit_d', 'omega3', 'b12'],
      ...COMMON_LIFESTYLE,
      alcoholFrequency: 'none',  // ciąża

      // PRO — kluczowe pola
      pregnancyStatus: 'pregnant',
      pregnancyTrimester: '2',
      hormonalIssues: ['none'],

      additionalNotes: 'Ciąża, II trymestr — test P-4: kcal asymetryczny (+200 OK, -200 NIE).',
    },
  },

  // ─── 4. SENIOR ≥51 ──────────────────────────────────────────────────────────
  {
    email: 'test-senior@solver.test',
    firstName: 'Test',
    lastName: 'Senior55+',
    sex: 'F',
    birthYear: NOW_YEAR - 60,
    heightCm: 162,
    weightKg: 70,
    answers: {
      mainGoal: 'maintain_weight',
      currentWeightKg: '70',
      timeline: 'no_deadline',

      activityLevel: 'light',
      activityTypes: ['walking', 'yoga'],
      workoutsPerWeek: '4',
      workoutDurationMin: '45',

      chronicDiseases: ['none'],
      medications: ['none'],
      digestiveIssues: ['none'],

      allergies: ['none'],
      intolerances: ['none'],
      dietType: 'omnivore',
      cuisinePreferences: ['polish', 'mediterranean'],
      dislikedFoods: ['offal', 'spicy_food'],
      preferredFoods: ['poultry', 'fish', 'eggs', 'dairy', 'cooked_veg', 'fruits', 'oatmeal'],

      mealsPerDay: '4',
      supplements: ['vit_d', 'b12', 'omega3'],
      ...COMMON_LIFESTYLE,

      hormonalIssues: ['menopause'],  // realistycznie dla 60-letniej kobiety

      additionalNotes: 'Pacjent w wieku 60 lat — test P-2 (RDA wapnia 1200mg dla wieku ≥51).',
    },
  },

  // ─── 5. NADCIŚNIENIE ────────────────────────────────────────────────────────
  {
    email: 'test-hypertension@solver.test',
    firstName: 'Test',
    lastName: 'Nadcisnienie',
    sex: 'M',
    birthYear: NOW_YEAR - 50,
    heightCm: 178,
    weightKg: 95,
    answers: {
      mainGoal: 'lose_weight',
      currentWeightKg: '95',
      targetWeightKg: '85',
      timeline: '6_months',

      activityLevel: 'light',
      activityTypes: ['walking', 'cycling_recreational'],
      workoutsPerWeek: '3',
      workoutDurationMin: '45',

      chronicDiseases: ['hypertension', 'nadciśnienie'],  // kod FE + alias legacy
      medications: ['ace_inhibitors'],  // ramipril → kod 'ace_inhibitors'
      digestiveIssues: ['none'],

      allergies: ['none'],
      intolerances: ['none'],
      dietType: 'dash',  // realistycznie — DASH dla nadciśnienia
      cuisinePreferences: ['polish', 'mediterranean'],
      dislikedFoods: ['offal'],
      preferredFoods: ['poultry', 'fish', 'legumes', 'cooked_veg', 'fruits', 'nuts_seeds', 'oatmeal'],

      mealsPerDay: '4',
      supplements: ['vit_d', 'magnesium', 'omega3'],
      ...COMMON_LIFESTYLE,
      alcoholFrequency: 'none',  // nadciśnienie — alkohol odradzany

      hormonalIssues: ['none'],

      additionalNotes: 'Nadciśnienie tętnicze leczone inhibitorem ACE. Test solvera: sód <2000mg/d, dieta DASH.',
    },
  },
];

async function main() {
  console.log('[seed] Solver test patients — start');

  const dietitian = await prisma.user.findUnique({
    where: { email: DIETITIAN_EMAIL },
    select: { id: true, email: true, role: true },
  });

  if (!dietitian) {
    console.error(`[seed] BŁĄD: nie znaleziono dietetyka ${DIETITIAN_EMAIL}`);
    console.error('[seed] Dostępni dietetycy: uruchom `node scripts/check-dietitians.js`');
    console.error('[seed] Możesz nadpisać: SEED_DIETITIAN_EMAIL=inny@email.pl node scripts/seed-solver-test-patients.js');
    process.exit(1);
  }

  if (dietitian.role !== 'DIETITIAN' && dietitian.role !== 'ADMIN') {
    console.error(`[seed] BŁĄD: ${DIETITIAN_EMAIL} ma rolę ${dietitian.role}, oczekiwano DIETITIAN/ADMIN`);
    process.exit(1);
  }

  console.log(`[seed] Dietetyk-opiekun: ${dietitian.email} (${dietitian.id})`);

  const passwordHash = await bcrypt.hash(PATIENT_PASSWORD, HASH_ROUNDS);

  for (const def of PATIENTS) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: { passwordHash, role: 'PATIENT' },
      create: {
        email: def.email,
        passwordHash,
        role: 'PATIENT',
        emailVerified: new Date(),
      },
    });

    const patient = await prisma.patient.upsert({
      where: { userId: user.id },
      update: {
        dietitianId: dietitian.id,
        firstName: def.firstName,
        lastName: def.lastName,
        sex: def.sex,
        birthYear: def.birthYear,
        heightCm: def.heightCm,
        weightKg: def.weightKg,
      },
      create: {
        userId: user.id,
        dietitianId: dietitian.id,
        firstName: def.firstName,
        lastName: def.lastName,
        sex: def.sex,
        birthYear: def.birthYear,
        heightCm: def.heightCm,
        weightKg: def.weightKg,
      },
    });

    // Interview od nowa — żeby answers były zawsze aktualne
    await prisma.interview.deleteMany({ where: { patientId: patient.id } });
    await prisma.interview.create({
      data: {
        patientId: patient.id,
        answers: encryptJson(def.answers),
      },
    });

    // NutritionTargets — liczymy od razu (Mifflin-St Jeor) i upsert,
    // żeby triggerGenerate (POST /diet-plans/generate/:patientId) miał z czego ruszyć.
    const targets = computeNutritionTargets({
      sex: def.sex,
      ageYears: NOW_YEAR - def.birthYear,
      weightKg: def.weightKg,
      heightCm: def.heightCm,
      activityLevel: def.answers.activityLevel,
      mainGoal: def.answers.mainGoal,
    });
    await prisma.nutritionTargets.upsert({
      where:  { patientId: patient.id },
      update: targets,
      create: { patientId: patient.id, ...targets },
    });

    // Stare plany pacjenta też kasujemy (czysty start dla testu solvera)
    await prisma.dietPlan.deleteMany({ where: { patientId: patient.id } });

    console.log(
      `[seed] ✓ ${def.firstName} ${def.lastName.padEnd(15)} ` +
      `→ patientId=${patient.id} userId=${user.id}`,
    );
  }

  console.log('');
  console.log('[seed] Gotowe.');
  console.log('');
  console.log(`  Hasło wszystkich pacjentów: ${PATIENT_PASSWORD}`);
  console.log(`  Opiekun (DIETITIAN): ${dietitian.email}`);
  console.log('');
  console.log('  Następny krok — wygeneruj plany dla wszystkich 5:');
  console.log('    node scripts/generate-solver-test-plans.js');
  console.log('  (wymaga uruchomionego backendu: `npm run dev:api`)');
}

main()
  .catch((e) => { console.error('[seed] Błąd:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
