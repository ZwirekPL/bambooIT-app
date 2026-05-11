// ─── Seed Protocol Triggers (30.5.1) ─────────────────────────────────────────
//
// Maps interview answer field+value to NutritionProtocol by name.
// Priority: 1=CRITICAL (diseases), 2=HIGH (allergies/intolerances), 3=NORMAL (preferences/goals)
//
// Run: npx ts-node -r tsconfig-paths/register src/policies/seed-protocol-triggers.ts

import { prisma } from '@db';

interface TriggerSeed {
  interviewField: string;
  interviewValue: string;
  protocolName: string;
  priority: number;
}

// ─── Priority 1: Chronic Diseases → Protocol ─────────────────────────────────

const DISEASE_TRIGGERS: TriggerSeed[] = [
  // Metabolic
  { interviewField: 'chronicDiseases', interviewValue: 'diabetes_t2', protocolName: 'Cukrzyca typ 2 / Insulinooporność', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'insulin_resistance', protocolName: 'Cukrzyca typ 2 / Insulinooporność', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'diabetes_t1', protocolName: 'Cukrzyca typ 2 / Insulinooporność', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'obesity', protocolName: 'Redukcja masy ciała', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'metabolic_syndrome', protocolName: 'Cukrzyca typ 2 / Insulinooporność', priority: 1 },

  // Cardiovascular
  { interviewField: 'chronicDiseases', interviewValue: 'hypertension', protocolName: 'Choroby sercowo-naczyniowe (DASH)', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'chd', protocolName: 'Choroby sercowo-naczyniowe (DASH)', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'heart_failure', protocolName: 'Choroby sercowo-naczyniowe (DASH)', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'hypercholesterolemia', protocolName: 'Hipercholesterolemia', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'atherosclerosis', protocolName: 'Choroby sercowo-naczyniowe (DASH)', priority: 1 },

  // Endocrine
  { interviewField: 'chronicDiseases', interviewValue: 'hypothyroidism', protocolName: 'Hashimoto / Niedoczynność tarczycy', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'hashimoto', protocolName: 'Hashimoto / Niedoczynność tarczycy', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'pcos', protocolName: 'Cukrzyca typ 2 / Insulinooporność', priority: 1 },

  // Hepatic
  { interviewField: 'chronicDiseases', interviewValue: 'nafld', protocolName: 'NAFLD / Stłuszczenie wątroby', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'liver_cirrhosis', protocolName: 'NAFLD / Stłuszczenie wątroby', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'hepatitis_chronic', protocolName: 'NAFLD / Stłuszczenie wątroby', priority: 1 },

  // Renal
  { interviewField: 'chronicDiseases', interviewValue: 'ckd_stage_1_3', protocolName: 'Standard WHO', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'ckd_stage_4_5', protocolName: 'Standard WHO', priority: 1 },

  // Musculoskeletal
  { interviewField: 'chronicDiseases', interviewValue: 'osteoporosis', protocolName: 'Osteoporoza', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'gout', protocolName: 'Dna moczanowa', priority: 1 },

  // Oncology
  { interviewField: 'chronicDiseases', interviewValue: 'cancer_active', protocolName: 'Onkologia — wsparcie żywieniowe', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'cancer_remission', protocolName: 'Onkologia — wsparcie żywieniowe', priority: 1 },

  // Eating disorders
  { interviewField: 'chronicDiseases', interviewValue: 'anorexia_nervosa', protocolName: 'Niedowaga / Wzrost masy ciała', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'bulimia_nervosa', protocolName: 'Standard WHO', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'binge_eating', protocolName: 'Redukcja masy ciała', priority: 1 },

  // Other
  { interviewField: 'chronicDiseases', interviewValue: 'anemia', protocolName: 'Niedokrwistość z niedoboru żelaza', priority: 1 },
  { interviewField: 'chronicDiseases', interviewValue: 'copd', protocolName: 'Standard WHO', priority: 1 },

  // Digestive issues (priority 1 — these are medical conditions)
  { interviewField: 'digestiveIssues', interviewValue: 'celiac', protocolName: 'Standard WHO', priority: 1 },
  { interviewField: 'digestiveIssues', interviewValue: 'crohn', protocolName: 'IBD — Choroba Leśniowskiego-Crohna / WZJG', priority: 1 },
  { interviewField: 'digestiveIssues', interviewValue: 'uc', protocolName: 'IBD — Choroba Leśniowskiego-Crohna / WZJG', priority: 1 },
  { interviewField: 'digestiveIssues', interviewValue: 'ibs_c', protocolName: 'IBS — Dieta Low-FODMAP', priority: 1 },
  { interviewField: 'digestiveIssues', interviewValue: 'ibs_d', protocolName: 'IBS — Dieta Low-FODMAP', priority: 1 },
  { interviewField: 'digestiveIssues', interviewValue: 'ibs_m', protocolName: 'IBS — Dieta Low-FODMAP', priority: 1 },
  { interviewField: 'digestiveIssues', interviewValue: 'sibo', protocolName: 'IBS — Dieta Low-FODMAP', priority: 1 },
];

// ─── Priority 2: Allergies & Intolerances → Protocol ─────────────────────────

const ALLERGY_TRIGGERS: TriggerSeed[] = [
  { interviewField: 'allergies', interviewValue: 'gluten', protocolName: 'Standard WHO', priority: 2 },
  { interviewField: 'allergies', interviewValue: 'milk', protocolName: 'Standard WHO', priority: 2 },
  // EU 14 allergens — most map to clinical rules, not distinct protocols
  // Gluten and milk are the most impactful for protocol selection

  { interviewField: 'intolerances', interviewValue: 'lactose_intolerance', protocolName: 'Standard WHO', priority: 2 },
  { interviewField: 'intolerances', interviewValue: 'fructose_intolerance', protocolName: 'Standard WHO', priority: 2 },
  { interviewField: 'intolerances', interviewValue: 'histamine_intolerance', protocolName: 'Standard WHO', priority: 2 },
  { interviewField: 'intolerances', interviewValue: 'ncgs', protocolName: 'Standard WHO', priority: 2 },
];

// ─── Priority 3: Goals & Diet Preferences → Protocol ─────────────────────────

const GOAL_TRIGGERS: TriggerSeed[] = [
  // Main goals
  { interviewField: 'mainGoal', interviewValue: 'lose_weight', protocolName: 'Redukcja masy ciała', priority: 3 },
  { interviewField: 'mainGoal', interviewValue: 'gain_muscle', protocolName: 'Masa mięśniowa / Sportowiec', priority: 3 },
  { interviewField: 'mainGoal', interviewValue: 'maintain_weight', protocolName: 'Standard WHO', priority: 3 },
  { interviewField: 'mainGoal', interviewValue: 'improve_health', protocolName: 'Standard WHO', priority: 3 },

  // Diet type
  { interviewField: 'dietType', interviewValue: 'keto', protocolName: 'Keto terapeutyczne', priority: 3 },
  { interviewField: 'dietType', interviewValue: 'low_fodmap', protocolName: 'IBS — Dieta Low-FODMAP', priority: 3 },
  { interviewField: 'dietType', interviewValue: 'mediterranean', protocolName: 'Dieta śródziemnomorska', priority: 3 },
  { interviewField: 'dietType', interviewValue: 'dash', protocolName: 'Choroby sercowo-naczyniowe (DASH)', priority: 3 },

  // Pregnancy (from PRO interview)
  { interviewField: 'pregnancyStatus', interviewValue: 'pregnant', protocolName: 'Ciąża', priority: 1 },
  { interviewField: 'pregnancyStatus', interviewValue: 'breastfeeding', protocolName: 'Ciąża', priority: 1 },
];

// ─── All seeds combined ──────────────────────────────────────────────────────

const ALL_TRIGGERS: TriggerSeed[] = [
  ...DISEASE_TRIGGERS,
  ...ALLERGY_TRIGGERS,
  ...GOAL_TRIGGERS,
];

// ─── Seed runner ─────────────────────────────────────────────────────────────

async function seedProtocolTriggers(): Promise<void> {
  console.log('[seed] Starting protocol trigger seeding...');

  // Fetch all active protocols for name → id mapping
  const protocols = await prisma.nutritionProtocol.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const nameToId = new Map(protocols.map((p) => [p.name, p.id]));

  let created = 0;
  let skipped = 0;
  let missing = 0;

  for (const seed of ALL_TRIGGERS) {
    const protocolId = nameToId.get(seed.protocolName);
    if (!protocolId) {
      console.warn(`[seed] Protocol not found: "${seed.protocolName}" — skipping trigger ${seed.interviewField}=${seed.interviewValue}`);
      missing++;
      continue;
    }

    try {
      await prisma.protocolTrigger.upsert({
        where: {
          interviewField_interviewValue_protocolId: {
            interviewField: seed.interviewField,
            interviewValue: seed.interviewValue,
            protocolId,
          },
        },
        update: {
          priority: seed.priority,
          isActive: true,
        },
        create: {
          interviewField: seed.interviewField,
          interviewValue: seed.interviewValue,
          protocolId,
          priority: seed.priority,
          score: 1.0,
          isActive: true,
        },
      });
      created++;
    } catch (err) {
      console.error(`[seed] Error upserting trigger ${seed.interviewField}=${seed.interviewValue}:`, err);
    }
  }

  console.log(`[seed] Protocol triggers: ${created} upserted, ${skipped} skipped, ${missing} missing protocols`);
  console.log('[seed] Done.');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

seedProtocolTriggers()
  .catch((err) => {
    console.error('[seed] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
