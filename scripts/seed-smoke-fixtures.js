/**
 * Smoke test fixtures seed (Faza 80.5.3)
 *
 * Creates deterministic, minimal test data for API smoke tests:
 *   - 1 DIETITIAN + DietitianProfile
 *   - 3 PATIENTs (healthy, IBS+meds, vegan) + Patient + Interview + NutritionTargets
 *   - 50 Recipes + RecipeNutritionSnapshot
 *   - 100 CleanProducts + CleanProductNutrients
 *
 * Idempotent: upserts by email/slug — safe to run multiple times.
 *
 * Usage:
 *   DATABASE_URL=postgresql://dietetyk:dietetyk_test@localhost:5433/dietetyk_test?schema=public \
 *     node scripts/seed-smoke-fixtures.js
 *
 * Env vars (have defaults — override in CI via GitHub Actions env:):
 *   SMOKE_DIETITIAN_EMAIL     (default: smoke-dietetyk@test.pl)
 *   SMOKE_DIETITIAN_PASSWORD  (default: SmokeTest1234!)
 *   SMOKE_PATIENT_EMAIL       (default: smoke-pacjent@test.pl)   ← patient #1
 *   SMOKE_PATIENT_PASSWORD    (default: SmokeTest1234!)
 *   ENCRYPTION_KEY            (default: 'a'.repeat(64))
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────
const DIETITIAN_EMAIL    = process.env.SMOKE_DIETITIAN_EMAIL    || 'smoke-dietetyk@test.pl';
const DIETITIAN_PASSWORD = process.env.SMOKE_DIETITIAN_PASSWORD || 'SmokeTest1234!';
const PATIENT_EMAIL      = process.env.SMOKE_PATIENT_EMAIL      || 'smoke-pacjent@test.pl';
const PATIENT_PASSWORD   = process.env.SMOKE_PATIENT_PASSWORD   || 'SmokeTest1234!';
const ENCRYPTION_KEY     = process.env.ENCRYPTION_KEY           || 'a'.repeat(64);
const HASH_ROUNDS        = 10; // faster than 12 for test fixtures

// ── Encryption (mirrors apps/backend/src/utils/encryption.ts) ────
function encryptJson(data) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { v: 1, iv: iv.toString('hex'), tag: authTag.toString('hex'), data: encrypted.toString('hex') };
}

// ── Patient interview answers ──────────────────────────────────────

const HEALTHY_ANSWERS = {
  age: 35, sex: 'M', heightCm: 180, weightKg: 80,
  activityLevel: 'moderate', goal: 'maintenance',
  chronicDiseases: [], medications: [], allergies: [],
  dietType: 'standard', dislikedFoods: [],
  mealsPerDay: 4, cookingTime: 'medium',
};

const IBS_ANSWERS = {
  age: 40, sex: 'F', heightCm: 165, weightKg: 65,
  activityLevel: 'light', goal: 'weight_loss',
  chronicDiseases: ['IBS'], medications: ['mebeverine'],
  allergies: ['gluten'],
  dietType: 'low_fodmap', dislikedFoods: ['kapusta', 'cebula'],
  mealsPerDay: 5, cookingTime: 'short',
};

const VEGAN_ANSWERS = {
  age: 28, sex: 'F', heightCm: 170, weightKg: 55,
  activityLevel: 'active', goal: 'muscle_gain',
  chronicDiseases: [], medications: [],
  allergies: ['dairy', 'eggs'],
  dietType: 'vegan', dislikedFoods: [],
  mealsPerDay: 4, cookingTime: 'medium',
};

// ── Recipe data ────────────────────────────────────────────────────

const MEAL_TYPES = ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER', 'SNACK'];

const RECIPE_TEMPLATES = [
  // BREAKFAST (10)
  { title: 'Owsianka z owocami',            mealType: 'BREAKFAST',        kcal: 320, protein: 10, fat:  6, carbs: 58, fiber: 5.2 },
  { title: 'Jajecznica na maśle',           mealType: 'BREAKFAST',        kcal: 280, protein: 18, fat: 20, carbs:  4, fiber: 0.5 },
  { title: 'Kanapki z twarożkiem',          mealType: 'BREAKFAST',        kcal: 290, protein: 15, fat: 10, carbs: 36, fiber: 2.0 },
  { title: 'Smoothie bowl bananowe',        mealType: 'BREAKFAST',        kcal: 340, protein:  8, fat:  7, carbs: 62, fiber: 4.5 },
  { title: 'Omlet ze szpinakiem',           mealType: 'BREAKFAST',        kcal: 300, protein: 20, fat: 18, carbs:  8, fiber: 1.8 },
  { title: 'Granola z jogurtem',            mealType: 'BREAKFAST',        kcal: 380, protein: 12, fat: 14, carbs: 50, fiber: 4.0 },
  { title: 'Tost z awokado i jajkiem',      mealType: 'BREAKFAST',        kcal: 420, protein: 16, fat: 24, carbs: 38, fiber: 6.0 },
  { title: 'Kasza jaglana z jagodami',      mealType: 'BREAKFAST',        kcal: 350, protein:  9, fat:  4, carbs: 68, fiber: 3.5 },
  { title: 'Naleśniki gryczane',            mealType: 'BREAKFAST',        kcal: 360, protein: 12, fat:  8, carbs: 58, fiber: 3.0 },
  { title: 'Jogurt z orzechami',            mealType: 'BREAKFAST',        kcal: 310, protein: 14, fat: 16, carbs: 30, fiber: 2.5 },

  // SECOND_BREAKFAST (8)
  { title: 'Jabłko z masłem orzechowym',   mealType: 'SECOND_BREAKFAST', kcal: 220, protein:  6, fat: 12, carbs: 26, fiber: 3.5 },
  { title: 'Kanapka z indykiem',           mealType: 'SECOND_BREAKFAST', kcal: 260, protein: 18, fat:  8, carbs: 28, fiber: 2.0 },
  { title: 'Serek wiejski z warzywami',    mealType: 'SECOND_BREAKFAST', kcal: 180, protein: 15, fat:  4, carbs: 20, fiber: 2.5 },
  { title: 'Ryżowe wafle z hummusem',      mealType: 'SECOND_BREAKFAST', kcal: 200, protein:  7, fat:  6, carbs: 30, fiber: 3.0 },
  { title: 'Koktajl proteinowy bananowy',  mealType: 'SECOND_BREAKFAST', kcal: 280, protein: 24, fat:  4, carbs: 36, fiber: 2.0 },
  { title: 'Chipsy z jarmużu',             mealType: 'SECOND_BREAKFAST', kcal: 120, protein:  4, fat:  5, carbs: 16, fiber: 3.5 },
  { title: 'Marchew z dipem jogurtowym',   mealType: 'SECOND_BREAKFAST', kcal: 140, protein:  5, fat:  3, carbs: 22, fiber: 4.0 },
  { title: 'Migdały i suszone śliwki',     mealType: 'SECOND_BREAKFAST', kcal: 250, protein:  6, fat: 16, carbs: 24, fiber: 3.5 },

  // LUNCH (12)
  { title: 'Kurczak z ryżem i warzywami',  mealType: 'LUNCH',            kcal: 520, protein: 42, fat: 12, carbs: 60, fiber: 4.5 },
  { title: 'Makaron bolognese',            mealType: 'LUNCH',            kcal: 580, protein: 32, fat: 18, carbs: 72, fiber: 4.0 },
  { title: 'Łosoś z brokułem i kaszą',    mealType: 'LUNCH',            kcal: 540, protein: 38, fat: 22, carbs: 46, fiber: 6.0 },
  { title: 'Zupa krem z dyni',             mealType: 'LUNCH',            kcal: 280, protein:  6, fat: 12, carbs: 38, fiber: 5.5 },
  { title: 'Risotto z grzybami',           mealType: 'LUNCH',            kcal: 490, protein: 14, fat: 16, carbs: 72, fiber: 3.0 },
  { title: 'Pierś z indyka z warzywami',   mealType: 'LUNCH',            kcal: 420, protein: 44, fat:  8, carbs: 40, fiber: 6.0 },
  { title: 'Spaghetti z pesto',            mealType: 'LUNCH',            kcal: 560, protein: 16, fat: 24, carbs: 70, fiber: 4.5 },
  { title: 'Gulasz wołowy z ziemniakami',  mealType: 'LUNCH',            kcal: 550, protein: 36, fat: 18, carbs: 58, fiber: 5.0 },
  { title: 'Tofu stir-fry z ryżem',        mealType: 'LUNCH',            kcal: 460, protein: 22, fat: 14, carbs: 60, fiber: 6.5 },
  { title: 'Sałatka z tuńczykiem',         mealType: 'LUNCH',            kcal: 350, protein: 30, fat: 12, carbs: 30, fiber: 5.0 },
  { title: 'Zupa minestrone',              mealType: 'LUNCH',            kcal: 260, protein: 10, fat:  6, carbs: 40, fiber: 7.0 },
  { title: 'Kurczak tikka masala',         mealType: 'LUNCH',            kcal: 500, protein: 38, fat: 18, carbs: 48, fiber: 4.0 },

  // DINNER (10)
  { title: 'Dorsz pieczony z cytryną',     mealType: 'DINNER',           kcal: 380, protein: 36, fat: 12, carbs: 28, fiber: 3.0 },
  { title: 'Omlet z serem i szpinakiem',   mealType: 'DINNER',           kcal: 340, protein: 22, fat: 22, carbs: 12, fiber: 2.0 },
  { title: 'Zupa pomidorowa z makaronem',  mealType: 'DINNER',           kcal: 320, protein: 12, fat:  8, carbs: 52, fiber: 5.5 },
  { title: 'Grillowana pierś z pieczoną papryką', mealType: 'DINNER',   kcal: 400, protein: 40, fat: 14, carbs: 24, fiber: 4.0 },
  { title: 'Kasza gryczana z warzywami',   mealType: 'DINNER',           kcal: 360, protein: 12, fat:  8, carbs: 60, fiber: 7.5 },
  { title: 'Zupa ogórkowa',                mealType: 'DINNER',           kcal: 220, protein:  8, fat:  8, carbs: 28, fiber: 2.5 },
  { title: 'Pieczony łosoś z cytryną',     mealType: 'DINNER',           kcal: 420, protein: 36, fat: 24, carbs: 12, fiber: 1.5 },
  { title: 'Frittata z warzywami',         mealType: 'DINNER',           kcal: 310, protein: 20, fat: 18, carbs: 18, fiber: 3.5 },
  { title: 'Zupa z soczewicy',             mealType: 'DINNER',           kcal: 280, protein: 16, fat:  4, carbs: 44, fiber: 9.0 },
  { title: 'Makaron z sosem warzywnym',    mealType: 'DINNER',           kcal: 440, protein: 14, fat: 10, carbs: 76, fiber: 6.0 },

  // SUPPER (5)
  { title: 'Sałatka grecka',               mealType: 'SUPPER',           kcal: 280, protein:  8, fat: 18, carbs: 20, fiber: 4.0 },
  { title: 'Kanapki z pastą jajeczną',     mealType: 'SUPPER',           kcal: 310, protein: 14, fat: 16, carbs: 28, fiber: 2.5 },
  { title: 'Twarożek ze szczypiorkiem',    mealType: 'SUPPER',           kcal: 200, protein: 14, fat:  8, carbs: 18, fiber: 1.5 },
  { title: 'Warzywne wrapy',               mealType: 'SUPPER',           kcal: 350, protein: 12, fat: 10, carbs: 52, fiber: 5.0 },
  { title: 'Zupa krem z brokułu',          mealType: 'SUPPER',           kcal: 240, protein:  8, fat: 10, carbs: 30, fiber: 6.0 },

  // SNACK (5)
  { title: 'Baton daktylowo-orzechowy',    mealType: 'SNACK',            kcal: 180, protein:  4, fat:  8, carbs: 26, fiber: 3.0 },
  { title: 'Hummus z pita',                mealType: 'SNACK',            kcal: 220, protein:  7, fat: 10, carbs: 28, fiber: 4.0 },
  { title: 'Mix orzechów',                 mealType: 'SNACK',            kcal: 200, protein:  6, fat: 17, carbs: 10, fiber: 2.5 },
  { title: 'Owoce sezonowe',               mealType: 'SNACK',            kcal: 140, protein:  2, fat:  1, carbs: 34, fiber: 4.5 },
  { title: 'Shake proteinowy waniliowy',   mealType: 'SNACK',            kcal: 200, protein: 24, fat:  3, carbs: 20, fiber: 1.0 },
];

// ── CleanProduct data ──────────────────────────────────────────────

function buildProducts() {
  const products = [];

  // Protein sources (25)
  const proteins = [
    ['Pierś z kurczaka',     'MEAT',       'mieso-ryby-jaja',      165, 31,  3.6, 0],
    ['Udo z kurczaka',       'MEAT',       'mieso-ryby-jaja',      209, 26,  13, 0],
    ['Wołowina mielona',     'MEAT',       'mieso-ryby-jaja',      254, 26,  17, 0],
    ['Łosoś atlantycki',     'FISH',       'mieso-ryby-jaja',      208, 20,  13, 0],
    ['Dorsz świeży',         'FISH',       'mieso-ryby-jaja',       82, 18,  0.7, 0],
    ['Tuńczyk w wodzie',     'FISH',       'mieso-ryby-jaja',      116, 26,  1,  0],
    ['Makrela wędzona',      'FISH',       'mieso-ryby-jaja',      305, 19,  25, 0],
    ['Jaja kurze',           'EGGS',       'mieso-ryby-jaja',      143, 13,  10, 0.7],
    ['Tofu twarde',          'VEGETABLE',  'produkty-roślinne',     76, 8,   4.8, 1.9],
    ['Tempeh',               'VEGETABLE',  'produkty-roślinne',    193, 19,  11, 9],
    ['Soczewica czerwona',   'LEGUMES',    'strączki',             116, 9,   0.4, 28],
    ['Ciecierzyca',          'LEGUMES',    'strączki',             164, 9,   2.6, 27],
    ['Fasola czarna',        'LEGUMES',    'strączki',             132, 9,   0.5, 24],
    ['Edamame',              'LEGUMES',    'strączki',             121, 11,  5.2, 10],
    ['Pierś indyka',         'MEAT',       'mieso-ryby-jaja',      157, 30,  3.5, 0],
    ['Tuńczyk świeży',       'FISH',       'mieso-ryby-jaja',      144, 23,  4.9, 0],
    ['Krewetki',             'FISH',       'mieso-ryby-jaja',       99, 24,  0.3, 0],
    ['Wieprzowina polędwica','MEAT',       'mieso-ryby-jaja',      143, 22,  5.4, 0],
    ['Serek wiejski 0%',     'DAIRY',      'nabiał',                72, 12,  0.5, 3.4],
    ['Jajka przepiórcze',    'EGGS',       'mieso-ryby-jaja',      158, 13,  11, 0.4],
    ['Soja nasiona',         'LEGUMES',    'strączki',             446, 36,  20, 30],
    ['Groch żółty',          'LEGUMES',    'strączki',             118, 8.3, 0.4, 21],
    ['Sardynki w oleju',     'FISH',       'mieso-ryby-jaja',      208, 25,  11, 0],
    ['Mozzarella light',     'DAIRY',      'nabiał',               150, 16,  8,  4],
    ['Twaróg półtłusty',     'DAIRY',      'nabiał',                98, 12,  4,  4],
  ];

  // Grains & carbs (20)
  const grains = [
    ['Ryż brązowy',          'BASE', 'zboża-mąki-makarony', 216, 5,   1.6, 45, 3.5],
    ['Ryż biały',            'BASE', 'zboża-mąki-makarony', 130, 2.7, 0.3, 28, 0.4],
    ['Makaron pełnoziarnisty','BASE','zboża-mąki-makarony', 348, 13,  2.5, 68, 8],
    ['Makaron biały',        'BASE', 'zboża-mąki-makarony', 371, 13,  1.5, 74, 2.8],
    ['Kasza gryczana',       'BASE', 'zboża-mąki-makarony', 335, 13,  3.4, 65, 10],
    ['Kasza jaglana',        'BASE', 'zboża-mąki-makarony', 378, 11,  4.2, 73, 3.5],
    ['Kasza bulgur',         'BASE', 'zboża-mąki-makarony', 342, 12,  1.3, 72, 18],
    ['Płatki owsiane',       'BASE', 'zboża-mąki-makarony', 379, 13,  6.9, 68, 10],
    ['Chleb żytni',          'BASE', 'pieczywo',             259, 8.5, 3.3, 48, 6.2],
    ['Chleb pszenno-żytni',  'BASE', 'pieczywo',             242, 8,   2.5, 47, 4],
    ['Tortilla pszenna',     'BASE', 'pieczywo',             312, 8.4, 7.5, 52, 2.5],
    ['Ryż jaśminowy',        'BASE', 'zboża-mąki-makarony', 129, 2.7, 0.3, 28, 0.2],
    ['Quinoa',               'BASE', 'zboża-mąki-makarony', 368, 14,  6,   64, 7],
    ['Ziemniaki',            'BASE', 'warzywa',              77,  2,   0.1, 17, 2.2],
    ['Bataty',               'BASE', 'warzywa',              86,  1.6, 0.1, 20, 3],
    ['Mąka owsiana',         'BASE', 'zboża-mąki-makarony', 389, 13,  7,   66, 10],
    ['Mąka gryczana',        'BASE', 'zboża-mąki-makarony', 335, 13,  3.4, 65, 10],
    ['Chleb orkiszowy',      'BASE', 'pieczywo',             261, 10,  3,   50, 5],
    ['Kuskus',               'BASE', 'zboża-mąki-makarony', 376, 13,  1.8, 77, 5],
    ['Ryż parboiled',        'BASE', 'zboża-mąki-makarony', 346, 7.4, 0.5, 77, 1.4],
  ];

  // Vegetables (25)
  const veggies = [
    ['Brokuł',       'BASE', 'warzywa', 34,  2.8, 0.4,  7, 2.6],
    ['Szpinak',      'BASE', 'warzywa', 23,  2.9, 0.4,  3.6, 2.2],
    ['Marchew',      'BASE', 'warzywa', 41,  0.9, 0.2, 10, 2.8],
    ['Papryka czerwona','BASE','warzywa',31,  1,   0.3,  6, 2.1],
    ['Pomidory',     'BASE', 'warzywa', 18,  0.9, 0.2,  3.9, 1.2],
    ['Ogórek',       'BASE', 'warzywa', 15,  0.7, 0.1,  3.6, 0.5],
    ['Cukinia',      'BASE', 'warzywa', 17,  1.2, 0.3,  3.1, 1],
    ['Bakłażan',     'BASE', 'warzywa', 25,  1,   0.2,  5.9, 3],
    ['Kapusta biała','BASE', 'warzywa', 25,  1.3, 0.1,  5.8, 2.5],
    ['Kalafior',     'BASE', 'warzywa', 25,  1.9, 0.3,  5, 2],
    ['Bób',          'BASE', 'strączki',88,  8,   0.4, 14, 5.4],
    ['Groszek zielony','BASE','warzywa',81,  5.4, 0.4, 14, 5.5],
    ['Dynia',        'BASE', 'warzywa', 26,  1,   0.1,  6.5, 0.5],
    ['Burak',        'BASE', 'warzywa', 43,  1.6, 0.2, 10, 2.8],
    ['Seler naciowy','BASE', 'warzywa', 16,  0.7, 0.2,  3, 1.6],
    ['Por',          'BASE', 'warzywa', 61,  1.5, 0.3, 14, 1.8],
    ['Rukola',       'BASE', 'warzywa', 25,  2.6, 0.7,  3.7, 1.6],
    ['Pietruszka korzeń','BASE','warzywa',36, 1.5, 0.6, 8.1, 4.9],
    ['Czosnek',      'BASE', 'warzywa', 149, 6.4, 0.5, 33, 2.1],
    ['Cebula',       'BASE', 'warzywa', 40,  1.1, 0.1, 9.3, 1.7],
    ['Pomidory koktajlowe','BASE','warzywa',18,1,  0.2, 3.9, 1.2],
    ['Sałata lodowa','BASE', 'warzywa', 14,  0.9, 0.1,  2.9, 1.2],
    ['Awokado',      'BASE', 'owoce',  160,  2,   15,   9, 7],
    ['Jarmuż',       'BASE', 'warzywa', 49,  4.3, 0.9,  9, 3.6],
    ['Fasola szparagowa','BASE','warzywa',31, 1.8, 0.1, 6.9, 2.7],
  ];

  // Fats & dairy (10)
  const fats = [
    ['Oliwa z oliwek', 'BASE', 'tłuszcze-oleje', 884, 0,   100, 0,  0],
    ['Olej rzepakowy', 'BASE', 'tłuszcze-oleje', 884, 0,   100, 0,  0],
    ['Masło',          'BASE', 'tłuszcze-oleje', 748, 0.9, 82,  0.1, 0],
    ['Jogurt grecki 2%','BASE','nabiał',          73,  9,   2,   4,  0],
    ['Mleko 2%',       'BASE', 'nabiał',          50,  3.4, 2,   4.8, 0],
    ['Ser żółty gouda','BASE', 'nabiał',          356, 25,  27,  0.5, 0],
    ['Śmietana 12%',   'BASE', 'nabiał',          130, 2.7, 12,  3.8, 0],
    ['Masło orzechowe','BASE', 'orzechy-nasiona', 588, 25,  50,  20, 6],
    ['Orzechy włoskie','BASE', 'orzechy-nasiona', 654, 15,  65,  14, 6.7],
    ['Pestki dyni',    'BASE', 'orzechy-nasiona', 559, 30,  49,  11, 6],
  ];

  // Fruits (20 entries added via remaining product slots)
  const fruits = [
    ['Banan',         'BASE', 'owoce',  89,  1.1, 0.3, 23, 2.6],
    ['Jabłko',        'BASE', 'owoce',  52,  0.3, 0.2, 14, 2.4],
    ['Gruszka',       'BASE', 'owoce',  57,  0.4, 0.1, 15, 3.1],
    ['Pomarańcza',    'BASE', 'owoce',  47,  0.9, 0.1, 12, 2.4],
    ['Truskawki',     'BASE', 'owoce',  32,  0.7, 0.3,  7.7, 2],
    ['Borówki',       'BASE', 'owoce',  57,  0.7, 0.3, 14, 2.4],
    ['Maliny',        'BASE', 'owoce',  52,  1.2, 0.7, 12, 6.5],
    ['Mango',         'BASE', 'owoce',  60,  0.8, 0.4, 15, 1.6],
    ['Kiwi',          'BASE', 'owoce',  61,  1.1, 0.5, 15, 3],
    ['Arbuz',         'BASE', 'owoce',  30,  0.6, 0.2,  7.6, 0.4],
    ['Morele',        'BASE', 'owoce',  48,  1.4, 0.4, 11, 2],
    ['Śliwki',        'BASE', 'owoce',  46,  0.7, 0.3, 11, 1.4],
    ['Winogrona',     'BASE', 'owoce',  67,  0.6, 0.4, 17, 0.9],
    ['Grejpfrut',     'BASE', 'owoce',  42,  0.8, 0.1, 10, 1.6],
    ['Ananasy',       'BASE', 'owoce',  50,  0.5, 0.1, 13, 1.4],
    ['Brzoskwinie',   'BASE', 'owoce',  39,  0.9, 0.3,  9.5, 1.5],
    ['Daktyle suszone','BASE','owoce',  277, 1.8, 0.2, 75, 6.7],
    ['Porzeczki czarne','BASE','owoce', 63,  1.4, 0.4, 15, 4.3],
    ['Wiśnie',        'BASE', 'owoce',  63,  1,   0.3, 16, 2.1],
    ['Czarne jagody', 'BASE', 'owoce',  57,  0.7, 0.3, 14, 2.4],
  ];

  // Build product array: [name, type, category, kcal, protein, fat, carbs, fiber?]
  const allProducts = [
    ...proteins.map(([n, t, c, k, p, f, cb])        => [n, t, c, k, p, f, cb, 0]),
    ...grains.map(([n, t, c, k, p, f, cb, fi])       => [n, t, c, k, p, f, cb, fi]),
    ...veggies.map(([n, t, c, k, p, f, cb, fi])      => [n, t, c, k, p, f, cb, fi]),
    ...fats.map(([n, t, c, k, p, f, cb, fi])         => [n, t, c, k, p, f, cb, fi]),
    ...fruits.map(([n, t, c, k, p, f, cb, fi])       => [n, t, c, k, p, f, cb, fi]),
  ];

  for (const [name, type, category, kcal, protein, fat, carbs, fiber] of allProducts) {
    const slug = name
      .toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
      .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
      .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    products.push({ name, type, category, slug: `smoke-${slug}`, kcal, protein, fat, carbs, fiber });
  }

  return products;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('[seed] Starting smoke fixtures...');

  const dietitianHash = await bcrypt.hash(DIETITIAN_PASSWORD, HASH_ROUNDS);
  const patientHash   = await bcrypt.hash(PATIENT_PASSWORD,   HASH_ROUNDS);

  // ── 1. Dietitian ─────────────────────────────────────────────────
  const dietitianUser = await prisma.user.upsert({
    where:  { email: DIETITIAN_EMAIL },
    update: { passwordHash: dietitianHash },
    create: {
      email: DIETITIAN_EMAIL,
      passwordHash: dietitianHash,
      role: 'DIETITIAN',
      emailVerified: new Date(),
    },
  });

  await prisma.dietitianProfile.upsert({
    where:  { userId: dietitianUser.id },
    update: {},
    create: {
      userId:    dietitianUser.id,
      code:      'SMOKE01',
      firstName: 'Smoke',
      lastName:  'Dietetyk',
    },
  });

  console.log(`[seed] Dietitian: ${dietitianUser.email} (${dietitianUser.id})`);

  // ── 2. Patients ──────────────────────────────────────────────────
  const patientDefs = [
    {
      email:     PATIENT_EMAIL,
      firstName: 'Marek',
      lastName:  'Zdrowy',
      sex:       'M',
      birthYear: 1989,
      heightCm:  180,
      weightKg:  80,
      answers:   HEALTHY_ANSWERS,
      targets:   { bmr: 1850, tdee: 2400, targetKcal: 2400, targetProteinG: 150, targetFatG: 80, targetCarbsG: 280, activityLevel: 'moderate', goal: 'maintenance' },
    },
    {
      email:     'smoke-pacjent-ibs@test.pl',
      firstName: 'Anna',
      lastName:  'IBSowa',
      sex:       'F',
      birthYear: 1984,
      heightCm:  165,
      weightKg:  65,
      answers:   IBS_ANSWERS,
      targets:   { bmr: 1500, tdee: 1800, targetKcal: 1500, targetProteinG: 100, targetFatG: 55, targetCarbsG: 175, activityLevel: 'light', goal: 'weight_loss' },
    },
    {
      email:     'smoke-pacjent-vegan@test.pl',
      firstName: 'Katarzyna',
      lastName:  'Vegan',
      sex:       'F',
      birthYear: 1996,
      heightCm:  170,
      weightKg:  55,
      answers:   VEGAN_ANSWERS,
      targets:   { bmr: 1400, tdee: 2000, targetKcal: 2200, targetProteinG: 120, targetFatG: 65, targetCarbsG: 260, activityLevel: 'active', goal: 'muscle_gain' },
    },
  ];

  for (const def of patientDefs) {
    const isFirstPatient = def.email === PATIENT_EMAIL;
    const hash = isFirstPatient ? patientHash : await bcrypt.hash(PATIENT_PASSWORD, HASH_ROUNDS);

    const user = await prisma.user.upsert({
      where:  { email: def.email },
      update: { passwordHash: hash },
      create: {
        email: def.email,
        passwordHash: hash,
        role: 'PATIENT',
        emailVerified: new Date(),
      },
    });

    const patient = await prisma.patient.upsert({
      where:  { userId: user.id },
      update: {},
      create: {
        userId:      user.id,
        dietitianId: dietitianUser.id,
        firstName:   def.firstName,
        lastName:    def.lastName,
        sex:         def.sex,
        birthYear:   def.birthYear,
        heightCm:    def.heightCm,
        weightKg:    def.weightKg,
      },
    });

    // Interview (upsert via delete+create — no unique on patientId for interview)
    const existing = await prisma.interview.findFirst({ where: { patientId: patient.id } });
    if (!existing) {
      await prisma.interview.create({
        data: {
          patientId: patient.id,
          answers:   encryptJson(def.answers),
        },
      });
    }

    // NutritionTargets
    await prisma.nutritionTargets.upsert({
      where:  { patientId: patient.id },
      update: {},
      create: {
        patientId: patient.id,
        ageYears:  new Date().getFullYear() - def.birthYear,
        weightKg:  def.weightKg,
        heightCm:  def.heightCm,
        ...def.targets,
      },
    });

    console.log(`[seed] Patient: ${user.email} (patientId: ${patient.id})`);
  }

  // ── 3. Recipes ───────────────────────────────────────────────────
  let recipesCreated = 0;
  for (const [i, tpl] of RECIPE_TEMPLATES.entries()) {
    const slug = `smoke-${tpl.mealType.toLowerCase()}-${String(i + 1).padStart(2, '0')}`;
    const existing = await prisma.recipe.findUnique({ where: { slug } });
    if (existing) continue;

    const recipe = await prisma.recipe.create({
      data: {
        title:    tpl.title,
        slug,
        mealType: tpl.mealType,
        source:   'manual',
        servings: 1,
        servingWeightG: 350,
        prepTimeMinutes: 15,
        cookTimeMinutes: 20,
        isActive: true,
        qualityScore: 75,
        verificationStatus: 'UNVERIFIED',
      },
    });

    await prisma.recipeNutritionSnapshot.create({
      data: {
        recipeId:  recipe.id,
        kcal:      tpl.kcal,
        protein_g: tpl.protein,
        fat_g:     tpl.fat,
        carbs_g:   tpl.carbs,
        fiber_g:   tpl.fiber ?? null,
        sodium_mg: 400 + Math.floor(Math.random() * 600),
      },
    });
    recipesCreated++;
  }
  console.log(`[seed] Recipes created: ${recipesCreated} (${RECIPE_TEMPLATES.length} total, ${RECIPE_TEMPLATES.length - recipesCreated} already existed)`);

  // ── 4. CleanProducts ─────────────────────────────────────────────
  const products = buildProducts();
  let productsCreated = 0;

  for (const p of products) {
    const existing = await prisma.cleanProduct.findUnique({ where: { slug: p.slug } });
    if (existing) continue;

    const product = await prisma.cleanProduct.create({
      data: {
        name:            p.name,
        slug:            p.slug,
        type:            p.type,
        category:        p.category,
        sourcePrimary:   'MANUAL',
        qualityScore:    70,
        verificationStatus: 'UNVERIFIED',
      },
    });

    await prisma.cleanProductNutrients.create({
      data: {
        cleanProductId:  product.id,
        kcalPer100g:     p.kcal,
        proteinPer100g:  p.protein,
        fatPer100g:      p.fat,
        carbsPer100g:    p.carbs,
        fiberPer100g:    p.fiber || null,
      },
    });
    productsCreated++;
  }
  console.log(`[seed] CleanProducts created: ${productsCreated} (${products.length} total, ${products.length - productsCreated} already existed)`);

  console.log('[seed] Done.');
  console.log(`[seed] Dietitian login: ${DIETITIAN_EMAIL} / ${DIETITIAN_PASSWORD}`);
  console.log(`[seed] Patient login:   ${PATIENT_EMAIL} / ${PATIENT_PASSWORD}`);
}

main()
  .catch((e) => { console.error('[seed] Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
