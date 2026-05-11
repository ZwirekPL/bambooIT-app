// ─── Seed Protocol Conflicts (30.5.2) ────────────────────────────────────────
//
// Defines dangerous combinations of interview answers that conflict.
// BLOCK = AI generation is not possible, user must choose.
// WARN = AI can generate but with strong warning.
//
// Run: npx ts-node -r tsconfig-paths/register src/policies/seed-protocol-conflicts.ts

import { prisma } from '@db';

interface ConflictSeed {
  triggerAField: string;
  triggerAValue: string;
  triggerBField: string;
  triggerBValue: string;
  severity: 'BLOCK' | 'WARN';
  messageKey: string;
  winnerSide: string; // "B" = side B (disease/safety) always wins
}

// ─── BLOCK conflicts — AI cannot safely generate ─────────────────────────────

const BLOCK_CONFLICTS: ConflictSeed[] = [
  // BUILD_MUSCLE + CKD 4-5: high protein contraindicated with severe renal failure
  {
    triggerAField: 'mainGoal', triggerAValue: 'gain_muscle',
    triggerBField: 'chronicDiseases', triggerBValue: 'ckd_stage_4_5',
    severity: 'BLOCK', messageKey: 'conflicts.muscle_renal', winnerSide: 'B',
  },
  // BUILD_MUSCLE + anorexia: eating disorder requires specialist supervision
  {
    triggerAField: 'mainGoal', triggerAValue: 'gain_muscle',
    triggerBField: 'chronicDiseases', triggerBValue: 'anorexia_nervosa',
    severity: 'BLOCK', messageKey: 'conflicts.muscle_anorexia', winnerSide: 'B',
  },
  // KETO + CKD 3+: ketosis with impaired kidneys is dangerous
  {
    triggerAField: 'dietType', triggerAValue: 'keto',
    triggerBField: 'chronicDiseases', triggerBValue: 'ckd_stage_1_3',
    severity: 'BLOCK', messageKey: 'conflicts.keto_renal', winnerSide: 'B',
  },
  {
    triggerAField: 'dietType', triggerAValue: 'keto',
    triggerBField: 'chronicDiseases', triggerBValue: 'ckd_stage_4_5',
    severity: 'BLOCK', messageKey: 'conflicts.keto_renal', winnerSide: 'B',
  },
  // KETO + liver cirrhosis: ketosis with liver disease is dangerous
  {
    triggerAField: 'dietType', triggerAValue: 'keto',
    triggerBField: 'chronicDiseases', triggerBValue: 'liver_cirrhosis',
    severity: 'BLOCK', messageKey: 'conflicts.keto_liver', winnerSide: 'B',
  },
  // Weight loss + pregnancy: caloric restriction during pregnancy
  {
    triggerAField: 'mainGoal', triggerAValue: 'lose_weight',
    triggerBField: 'pregnancyStatus', triggerBValue: 'pregnant',
    severity: 'BLOCK', messageKey: 'conflicts.reduce_pregnancy', winnerSide: 'B',
  },
  // Weight loss + anorexia: caloric restriction with eating disorder
  {
    triggerAField: 'mainGoal', triggerAValue: 'lose_weight',
    triggerBField: 'chronicDiseases', triggerBValue: 'anorexia_nervosa',
    severity: 'BLOCK', messageKey: 'conflicts.reduce_anorexia', winnerSide: 'B',
  },
  // Weight loss + muscle gain: contradictory caloric goals
  {
    triggerAField: 'mainGoal', triggerAValue: 'lose_weight',
    triggerBField: 'mainGoal', triggerBValue: 'gain_muscle',
    severity: 'BLOCK', messageKey: 'conflicts.reduce_vs_gain', winnerSide: 'A',
  },
  // LOW CARB + diabetes T1: hypoglycemia risk without supervision
  {
    triggerAField: 'dietType', triggerAValue: 'low_carb',
    triggerBField: 'chronicDiseases', triggerBValue: 'diabetes_t1',
    severity: 'BLOCK', messageKey: 'conflicts.lowcarb_diabetes_t1', winnerSide: 'B',
  },
  // KETO + diabetes T1: ketoacidosis risk
  {
    triggerAField: 'dietType', triggerAValue: 'keto',
    triggerBField: 'chronicDiseases', triggerBValue: 'diabetes_t1',
    severity: 'BLOCK', messageKey: 'conflicts.keto_diabetes_t1', winnerSide: 'B',
  },
];

// ─── WARN conflicts — AI can generate but with strong warning ────────────────

const WARN_CONFLICTS: ConflictSeed[] = [
  // BUILD_MUSCLE + diabetes T2: possible but needs careful macro balance
  {
    triggerAField: 'mainGoal', triggerAValue: 'gain_muscle',
    triggerBField: 'chronicDiseases', triggerBValue: 'diabetes_t2',
    severity: 'WARN', messageKey: 'conflicts.muscle_diabetes', winnerSide: 'B',
  },
  // BUILD_MUSCLE + heart failure: moderate exercise + controlled sodium
  {
    triggerAField: 'mainGoal', triggerAValue: 'gain_muscle',
    triggerBField: 'chronicDiseases', triggerBValue: 'heart_failure',
    severity: 'WARN', messageKey: 'conflicts.muscle_cardiac', winnerSide: 'B',
  },
  // KETO + diabetes T2: possible under medical supervision
  {
    triggerAField: 'dietType', triggerAValue: 'keto',
    triggerBField: 'chronicDiseases', triggerBValue: 'diabetes_t2',
    severity: 'WARN', messageKey: 'conflicts.keto_diabetes', winnerSide: 'B',
  },
  // BUILD_MUSCLE + CKD 1-3: moderate concern (protein needs monitoring)
  {
    triggerAField: 'mainGoal', triggerAValue: 'gain_muscle',
    triggerBField: 'chronicDiseases', triggerBValue: 'ckd_stage_1_3',
    severity: 'WARN', messageKey: 'conflicts.muscle_renal_mild', winnerSide: 'B',
  },
  // Weight loss + breastfeeding: possible but needs higher caloric floor
  {
    triggerAField: 'mainGoal', triggerAValue: 'lose_weight',
    triggerBField: 'pregnancyStatus', triggerBValue: 'breastfeeding',
    severity: 'WARN', messageKey: 'conflicts.reduce_breastfeeding', winnerSide: 'B',
  },
];

// ─── All conflicts ───────────────────────────────────────────────────────────

const ALL_CONFLICTS: ConflictSeed[] = [...BLOCK_CONFLICTS, ...WARN_CONFLICTS];

// ─── Seed runner ─────────────────────────────────────────────────────────────

async function seedProtocolConflicts(): Promise<void> {
  console.log('[seed] Starting protocol conflict seeding...');

  let created = 0;

  for (const seed of ALL_CONFLICTS) {
    try {
      await prisma.protocolConflict.upsert({
        where: {
          triggerAField_triggerAValue_triggerBField_triggerBValue: {
            triggerAField: seed.triggerAField,
            triggerAValue: seed.triggerAValue,
            triggerBField: seed.triggerBField,
            triggerBValue: seed.triggerBValue,
          },
        },
        update: {
          severity: seed.severity,
          messageKey: seed.messageKey,
          winnerSide: seed.winnerSide,
          isActive: true,
        },
        create: {
          triggerAField: seed.triggerAField,
          triggerAValue: seed.triggerAValue,
          triggerBField: seed.triggerBField,
          triggerBValue: seed.triggerBValue,
          severity: seed.severity,
          messageKey: seed.messageKey,
          winnerSide: seed.winnerSide,
          isActive: true,
        },
      });
      created++;
    } catch (err) {
      console.error(`[seed] Error upserting conflict ${seed.triggerAValue} vs ${seed.triggerBValue}:`, err);
    }
  }

  console.log(`[seed] Protocol conflicts: ${created} upserted (${BLOCK_CONFLICTS.length} BLOCK, ${WARN_CONFLICTS.length} WARN)`);
  console.log('[seed] Done.');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

seedProtocolConflicts()
  .catch((err) => {
    console.error('[seed] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
