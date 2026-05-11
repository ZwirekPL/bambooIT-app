/**
 * Seed script for testing features 38.4, 38.8, 38.9, 38.10, 39.2, 39.5.1, 39.7
 *
 * Creates:
 *  - ADMIN user (admin@test.pl)
 *  - DIETITIAN user (dietetyk@test.pl) + DietitianProfile code "TEST123"
 *  - PATIENT #1 (pacjent@test.pl) — published plan with deficient micronutrients
 *  - PATIENT #2 (pacjent2@test.pl) — plan awaiting review (GENERATED)
 *  - Interview, NutritionTargets, DietPlan with 7-day content
 *  - DeviceFingerprint entries (3 from same device)
 *  - AuditLog entries (failed logins, suspicious activity)
 *
 * Usage: cd packages/database && node ../../scripts/seed-test-data.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ── Encryption (mirrors apps/backend/src/utils/encryption.ts) ────
const ENCRYPTION_KEY = 'a2b59fad6278c836eb837a4270267ee8a39c9ef4e64ac0ec91ced9cee6424918';

function encryptJson(data) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

// ── Password hash ─────────────────────────────────────────────────
const PASSWORD = 'Test1234test';
const HASH_ROUNDS = 12;

// ── 7-day diet plan content (intentionally low in vitamin D, calcium, iodine, omega-3, folate → triggers ≥3 deficiencies) ──
// Uses product names that exist in CleanProduct DB (matched by `contains` insensitive)
// Includes recipe steps with cooking verbs ("gotuj", "smaż") for retention factor testing (38.4)
function buildPlanContent() {
  const days = [
    'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek',
    'Piątek', 'Sobota', 'Niedziela',
  ];

  return {
    days: days.map((dayName) => ({
      day: dayName,
      meals: [
        {
          name: 'Śniadanie',
          items: [
            {
              name: 'Owsianka z bananem',
              grams: 350,
              kcal: 320,
              protein: 10,
              fat: 6,
              carbs: 58,
              ingredients: [
                { name: 'płatki owsiane', grams: 60 },
                { name: 'banan', grams: 120 },
                { name: 'mleko', grams: 150 },
              ],
              recipe: {
                prepTimeMin: 10,
                steps: [
                  'Wlej mleko do garnka i zagotuj.',
                  'Dodaj płatki owsiane i gotuj na małym ogniu 5 minut.',
                  'Pokrój banana w plasterki i ułóż na owsiance.',
                ],
              },
            },
          ],
        },
        {
          name: 'Drugie śniadanie',
          items: [
            {
              name: 'Kanapka z jajkiem',
              grams: 200,
              kcal: 250,
              protein: 14,
              fat: 10,
              carbs: 28,
              ingredients: [
                { name: 'chleb żytni', grams: 60 },
                { name: 'jajko', grams: 60 },
                { name: 'ogórek', grams: 50 },
              ],
              recipe: {
                prepTimeMin: 8,
                steps: [
                  'Jajko gotuj w wodzie przez 8 minut na twardo.',
                  'Pokrój jajko w plasterki.',
                  'Ułóż na chlebie z ogórkiem.',
                ],
              },
            },
          ],
        },
        {
          name: 'Obiad',
          items: [
            {
              name: 'Pierś z kurczaka z ryżem i brokułami',
              grams: 550,
              kcal: 520,
              protein: 42,
              fat: 12,
              carbs: 60,
              ingredients: [
                { name: 'pierś z kurczaka', grams: 150 },
                { name: 'ryż', grams: 80 },
                { name: 'brokuł', grams: 120 },
                { name: 'olej rzepakowy', grams: 10 },
              ],
              recipe: {
                prepTimeMin: 35,
                steps: [
                  'Ryż ugotuj w osolonej wodzie przez 12 minut.',
                  'Brokuły gotuj na parze przez 8 minut.',
                  'Pierś z kurczaka pokrój w paski i smaż na oleju 6 minut z każdej strony.',
                  'Podawaj ryż z brokułami i kurczakiem.',
                ],
              },
            },
          ],
        },
        {
          name: 'Podwieczorek',
          items: [
            {
              name: 'Jabłko',
              grams: 180,
              kcal: 95,
              protein: 0.5,
              fat: 0.3,
              carbs: 22,
              ingredients: [
                { name: 'jabłko', grams: 180 },
              ],
            },
          ],
        },
        {
          name: 'Kolacja',
          items: [
            {
              name: 'Makaron z pomidorami',
              grams: 400,
              kcal: 380,
              protein: 12,
              fat: 8,
              carbs: 65,
              ingredients: [
                { name: 'makaron', grams: 80 },
                { name: 'pomidor', grams: 150 },
                { name: 'cebula', grams: 30 },
                { name: 'olej', grams: 10 },
              ],
              recipe: {
                prepTimeMin: 20,
                steps: [
                  'Makaron ugotuj al dente w osolonej wodzie.',
                  'Cebulę pokrój w kostkę i smaż na oleju do zeszklenia.',
                  'Dodaj pomidory i duś 10 minut.',
                  'Wymieszaj sos z makaronem.',
                ],
              },
            },
          ],
        },
      ],
    })),
  };
}

// ── Interview answers ─────────────────────────────────────────────
function buildInterviewAnswers() {
  return {
    // Basic info
    sex: 'female',
    birthYear: 1993,
    heightCm: 165,
    weightKg: 72,
    goal: 'REDUCE',
    goalWeightKg: 62,

    // Activity
    activityLevel: 'moderate',
    workType: 'sedentary',
    sportTypes: ['jogging', 'yoga'],
    sportFrequency: '3x/week',

    // Dietary
    dietType: 'STANDARD',
    allergies: [],
    foodIntolerances: [],
    dislikedFoods: 'kalafior, szparagi',
    preferredCuisines: ['polska', 'włoska'],
    cookingTime: 'medium',

    // Medical (triggering some clinical rules)
    diseases: ['niedoczynność tarczycy', 'niedobór witaminy D'],
    medications: ['Euthyrox 50mcg', 'witamina D3 2000IU'],
    supplements: ['witamina D3', 'magnez'],

    // Lifestyle
    sleepHours: 7,
    stressLevel: 'moderate',
    waterIntake: '1.5L',
    mealsPerDay: 5,
    mealSchedule: {
      breakfast: '07:30',
      lunch: '12:30',
      dinner: '18:00',
    },
    skipBreakfast: false,
  };
}

// ── Main seed function ────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting test data seed...\n');

  const passwordHash = await bcrypt.hash(PASSWORD, HASH_ROUNDS);

  // ── 1. ADMIN ──
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.pl' },
    update: { passwordHash, role: 'ADMIN', emailVerified: new Date() },
    create: {
      email: 'admin@test.pl',
      passwordHash,
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });
  console.log(`✅ ADMIN: admin@test.pl (id: ${admin.id})`);

  // ── 2. DIETITIAN + Profile ──
  const dietitian = await prisma.user.upsert({
    where: { email: 'dietetyk@test.pl' },
    update: { passwordHash, role: 'DIETITIAN', emailVerified: new Date() },
    create: {
      email: 'dietetyk@test.pl',
      passwordHash,
      role: 'DIETITIAN',
      emailVerified: new Date(),
    },
  });

  await prisma.dietitianProfile.upsert({
    where: { userId: dietitian.id },
    update: { code: 'TEST123', firstName: 'Anna', lastName: 'Kowalska' },
    create: {
      userId: dietitian.id,
      code: 'TEST123',
      firstName: 'Anna',
      lastName: 'Kowalska',
    },
  });
  console.log(`✅ DIETITIAN: dietetyk@test.pl / code: TEST123 (id: ${dietitian.id})`);

  // ── 3. PATIENT #1 (main test patient — published plan with deficiencies) ──
  const patient1User = await prisma.user.upsert({
    where: { email: 'pacjent@test.pl' },
    update: { passwordHash, role: 'PATIENT', emailVerified: new Date() },
    create: {
      email: 'pacjent@test.pl',
      passwordHash,
      role: 'PATIENT',
      emailVerified: new Date(),
    },
  });

  const patient1 = await prisma.patient.upsert({
    where: { userId: patient1User.id },
    update: {
      dietitianId: dietitian.id,
      firstName: 'Maria',
      lastName: 'Nowak',
      sex: 'female',
      birthYear: 1993,
      birthDate: new Date('1993-06-15'),
      heightCm: 165,
      weightKg: 72.0,
    },
    create: {
      userId: patient1User.id,
      dietitianId: dietitian.id,
      firstName: 'Maria',
      lastName: 'Nowak',
      sex: 'female',
      birthYear: 1993,
      birthDate: new Date('1993-06-15'),
      heightCm: 165,
      weightKg: 72.0,
    },
  });
  console.log(`✅ PATIENT #1: pacjent@test.pl / Maria Nowak (id: ${patient1.id})`);

  // Interview for patient 1
  const interviewAnswers = buildInterviewAnswers();
  await prisma.interview.deleteMany({ where: { patientId: patient1.id } });
  await prisma.interview.create({
    data: {
      patientId: patient1.id,
      type: 'PRO',
      answers: encryptJson(interviewAnswers),
      medicalFlags: encryptJson({
        diseases: ['niedoczynność tarczycy', 'niedobór witaminy D'],
        medications: ['Euthyrox 50mcg'],
        allergies: [],
        redFlags: [],
      }),
      profileSnapshot: encryptJson({
        sex: 'female',
        age: 32,
        heightCm: 165,
        weightKg: 72,
        bmi: 26.4,
        goal: 'REDUCE',
      }),
    },
  });
  console.log('  ✅ Interview (PRO) created');

  // NutritionTargets for patient 1
  await prisma.nutritionTargets.upsert({
    where: { patientId: patient1.id },
    update: {
      bmr: 1480, tdee: 2072, targetKcal: 1600,
      targetProteinG: 100, targetFatG: 53, targetCarbsG: 180,
      activityLevel: 'moderate', goal: 'REDUCE',
      ageYears: 32, weightKg: 72.0, heightCm: 165,
    },
    create: {
      patientId: patient1.id,
      bmr: 1480, tdee: 2072, targetKcal: 1600,
      targetProteinG: 100, targetFatG: 53, targetCarbsG: 180,
      activityLevel: 'moderate', goal: 'REDUCE',
      ageYears: 32, weightKg: 72.0, heightCm: 165,
    },
  });
  console.log('  ✅ NutritionTargets created');

  // DietPlan GENERATED for patient 1 (main — awaiting dietitian review)
  // Delete old plans to avoid clutter
  await prisma.dietPlan.deleteMany({ where: { patientId: patient1.id } });
  const plan1 = await prisma.dietPlan.create({
    data: {
      patientId: patient1.id,
      source: 'AI',
      status: 'GENERATED',
      kcal: 1565,
      proteinG: 79,
      fatG: 36,
      carbsG: 233,
      content: encryptJson(buildPlanContent()),
      aiProvider: 'openai',
      aiModel: 'gpt-4.1-mini',
      validated: true,
      validationStatus: 'VALID',
      policyMetadata: {
        appliedRules: ['hypothyroidism_iodine', 'vitamin_d_deficiency'],
        redFlags: [],
        explanation: 'Uwzględniono niedoczynność tarczycy i niedobór witaminy D.',
        excludeKeywords: [],
      },
    },
  });
  console.log(`  ✅ DietPlan GENERATED — do akceptacji (id: ${plan1.id})`);

  // ── 4. PATIENT #2 (plan awaiting review — GENERATED) ──
  const patient2User = await prisma.user.upsert({
    where: { email: 'pacjent2@test.pl' },
    update: { passwordHash, role: 'PATIENT', emailVerified: new Date() },
    create: {
      email: 'pacjent2@test.pl',
      passwordHash,
      role: 'PATIENT',
      emailVerified: new Date(),
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { userId: patient2User.id },
    update: {
      dietitianId: dietitian.id,
      firstName: 'Jan',
      lastName: 'Wiśniewski',
      sex: 'male',
      birthYear: 1988,
      heightCm: 180,
      weightKg: 95.0,
    },
    create: {
      userId: patient2User.id,
      dietitianId: dietitian.id,
      firstName: 'Jan',
      lastName: 'Wiśniewski',
      sex: 'male',
      birthYear: 1988,
      heightCm: 180,
      weightKg: 95.0,
    },
  });
  console.log(`✅ PATIENT #2: pacjent2@test.pl / Jan Wiśniewski (id: ${patient2.id})`);

  await prisma.dietPlan.deleteMany({ where: { patientId: patient2.id } });
  await prisma.dietPlan.create({
    data: {
      patientId: patient2.id,
      source: 'AI',
      status: 'GENERATED',
      kcal: 2200,
      proteinG: 140,
      fatG: 73,
      carbsG: 240,
      content: encryptJson(buildPlanContent()),
      validated: true,
      validationStatus: 'VALID',
    },
  });
  console.log('  ✅ DietPlan GENERATED (awaiting review)');

  // ── 5. DeviceFingerprint entries (3 from same fingerprint → 4th will be blocked) ──
  const testFingerprint = 'test_fp_' + crypto.randomBytes(8).toString('hex');
  // Clean up old test fingerprints
  await prisma.deviceFingerprint.deleteMany({
    where: { fingerprint: { startsWith: 'test_fp_' } },
  });
  // Create 3 entries (different users) for the same fingerprint
  for (const user of [admin, dietitian, patient1User]) {
    await prisma.deviceFingerprint.create({
      data: {
        fingerprint: testFingerprint,
        userId: user.id,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Test Browser',
        ip: '192.168.1.100',
      },
    });
  }
  console.log(`✅ DeviceFingerprint: 3 entries for fingerprint ${testFingerprint}`);

  // ── 6. AuditLog entries (failed logins + suspicious activity for security monitoring) ──
  const now = new Date();
  const auditEntries = [];

  // Failed logins (last 24h)
  for (let i = 0; i < 8; i++) {
    auditEntries.push({
      action: 'LOGIN_FAILED',
      ip: `192.168.1.${50 + i}`,
      metadata: { email: `hacker${i}@test.pl`, reason: 'invalid_password' },
      createdAt: new Date(now.getTime() - (i + 1) * 3600000),
    });
  }

  // Successful logins
  auditEntries.push({
    userId: patient1User.id,
    action: 'LOGIN',
    ip: '192.168.1.100',
    metadata: { email: 'pacjent@test.pl' },
    createdAt: new Date(now.getTime() - 2 * 3600000),
  });

  auditEntries.push({
    userId: dietitian.id,
    action: 'LOGIN',
    ip: '192.168.1.101',
    metadata: { email: 'dietetyk@test.pl' },
    createdAt: new Date(now.getTime() - 1 * 3600000),
  });

  // Registration events
  for (let i = 0; i < 5; i++) {
    auditEntries.push({
      action: 'REGISTER',
      ip: '10.0.0.1',
      metadata: { email: `newuser${i}@test.pl` },
      createdAt: new Date(now.getTime() - i * 7200000),
    });
  }

  await prisma.auditLog.createMany({ data: auditEntries });
  console.log(`✅ AuditLog: ${auditEntries.length} entries (8 failed logins, 2 logins, 5 registrations)`);

  // ── 7. Second published plan for patient 1 (older — for history view testing 38.9) ──
  await prisma.dietPlan.create({
    data: {
      patientId: patient1.id,
      source: 'AI',
      status: 'PUBLISHED',
      kcal: 1700,
      proteinG: 85,
      fatG: 57,
      carbsG: 195,
      content: encryptJson(buildPlanContent()),
      validated: true,
      validationStatus: 'VALID',
      createdAt: new Date(now.getTime() - 14 * 24 * 3600000), // 2 weeks ago
    },
  });
  console.log('  ✅ Second DietPlan PUBLISHED (2 weeks ago — for history)');

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📋 TEST ACCOUNTS SUMMARY');
  console.log('═'.repeat(60));
  console.log(`
  🔑 Password for ALL accounts: ${PASSWORD}

  👤 ADMIN:     admin@test.pl
  👩‍⚕️ DIETITIAN:  dietetyk@test.pl  (code: TEST123)
  👩 PATIENT #1: pacjent@test.pl   (Maria Nowak, female, 32y)
  👨 PATIENT #2: pacjent2@test.pl  (Jan Wiśniewski, male, 38y)

  📊 DATA CREATED:
  • Interview PRO for Maria Nowak
  • NutritionTargets (1600 kcal, REDUCE)
  • 1× DietPlan GENERATED for Maria (do akceptacji dietetyka!)
  • 1× DietPlan PUBLISHED for Maria (sprzed 2 tygodni — historia)
  • 1× DietPlan GENERATED for Jan (do akceptacji)
  • 3× DeviceFingerprint (same device, 3 users)
  • 15× AuditLog (8 failed logins, 2 logins, 5 registrations)

  ⚠️  DeviceFingerprint test: next registration from browser
      will be the 4th account → should trigger DEVICE_ABUSE
  `);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  prisma.$disconnect();
  process.exit(1);
});
