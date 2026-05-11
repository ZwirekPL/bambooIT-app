// ─── Seed clinical rules and red flags into DB ──────────────────────────────
//
// Run: npx ts-node -r tsconfig-paths/register src/policies/seed-rules.ts
//
// Converts hardcoded rules from clinical-rules.ts and red-flags.ts
// into DB records with declarative JSON conditions.

import { prisma } from '@db';

// Re-export the shared RuleSeed interface
export type { RuleSeed } from './seed-data/types';
import type { RuleSeed } from './seed-data/types';

// ─── Import seed data from category files ────────────────────────────────────

import { ALLERGEN_SEEDS } from './seed-data/allergen-seeds';
import { METABOLIC_SEEDS } from './seed-data/metabolic-seeds';
import { CARDIO_SEEDS } from './seed-data/cardio-seeds';
import { DIGESTIVE_SEEDS } from './seed-data/digestive-seeds';
import { LIVER_SEEDS } from './seed-data/liver-seeds';
import { KIDNEY_SEEDS } from './seed-data/kidney-seeds';
import { INTOLERANCE_SEEDS } from './seed-data/intolerance-seeds';
import { ENDOCRINE_SEEDS } from './seed-data/endocrine-seeds';
import { BONE_SEEDS } from './seed-data/bone-seeds';
import { ONCOLOGY_SEEDS } from './seed-data/oncology-seeds';
import { DEFICIENCY_SEEDS } from './seed-data/deficiency-seeds';
import { EATING_DISORDER_SEEDS } from './seed-data/eating-disorder-seeds';
import { DRUG_INTERACTION_SEEDS } from './seed-data/drug-interaction-seeds';
import { RED_FLAG_SEEDS } from './seed-data/red-flag-seeds';
import { LIFESTYLE_SEEDS } from './seed-data/lifestyle-seeds';

// ─── Combine all seeds ──────────────────────────────────────────────────────

const allSeeds: RuleSeed[] = [
  ...ALLERGEN_SEEDS,
  ...INTOLERANCE_SEEDS,
  ...METABOLIC_SEEDS,
  ...CARDIO_SEEDS,
  ...LIVER_SEEDS,
  ...KIDNEY_SEEDS,
  ...DIGESTIVE_SEEDS,
  ...ENDOCRINE_SEEDS,
  ...BONE_SEEDS,
  ...ONCOLOGY_SEEDS,
  ...DEFICIENCY_SEEDS,
  ...EATING_DISORDER_SEEDS,
  ...DRUG_INTERACTION_SEEDS,
  ...RED_FLAG_SEEDS,
  ...LIFESTYLE_SEEDS,
];

// ─── Main seed function ─────────────────────────────────────────────────────

async function seedRules() {
  console.log(`Seeding ${allSeeds.length} clinical rules...`);

  let created = 0;
  let skipped = 0;

  for (const seed of allSeeds) {
    const existing = await prisma.clinicalRule.findFirst({
      where: { name: seed.name, isDefault: true },
    });

    if (existing) {
      // Update category, version and other metadata on existing rules
      await prisma.clinicalRule.update({
        where: { id: existing.id },
        data: {
          category: seed.category ?? null,
          version: seed.version ?? '1.0',
          description: seed.description,
          severity: seed.severity,
          priority: seed.priority,
          sources: seed.sources ? JSON.parse(JSON.stringify(seed.sources)) : undefined,
          conflictsWith: seed.conflictsWith ?? [],
        },
      });
      skipped++;
      continue;
    }

    await prisma.clinicalRule.create({
      data: {
        name: seed.name,
        description: seed.description,
        type: seed.type,
        severity: seed.severity,
        priority: seed.priority,
        conditions: JSON.parse(JSON.stringify(seed.conditions)),
        effects: JSON.parse(JSON.stringify(seed.effects)),
        source: seed.source ?? null,
        version: seed.version ?? '1.0',
        category: seed.category ?? null,
        sources: seed.sources ? JSON.parse(JSON.stringify(seed.sources)) : undefined,
        conflictsWith: seed.conflictsWith ?? [],
        isActive: true,
        isDefault: true,
      },
    });
    created++;
  }

  console.log(`Done: ${created} created, ${skipped} skipped (already exist)`);
}

// Run if called directly
seedRules()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
