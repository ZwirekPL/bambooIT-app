/**
 * BUG-5 verification: render a diet-plan PDF from DB to disk for visual inspection.
 *
 * Usage:
 *   cd apps/backend
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register \
 *     scripts/render-test-pdf.ts <planId> [outputPath]
 *
 * Default output: c:/tmp/test-plan-<planId>-<timestamp>.pdf
 */

import 'dotenv/config';
import { prisma } from '@db';
import { createWriteStream } from 'fs';
import { generateDietPlanPdf } from '../src/pdf';
import { decryptJson } from '../src/utils/encryption';

async function main(): Promise<void> {
  const planId = process.argv[2];
  if (!planId) {
    console.error('Usage: ts-node render-test-pdf.ts <planId> [outputPath]');
    process.exit(1);
  }
  const outPath = process.argv[3]
    ?? `c:/tmp/test-plan-${planId.slice(-8)}-${Date.now()}.pdf`;

  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    include: {
      patient: { select: { user: { select: { email: true } } } },
    },
  });

  if (!plan) {
    console.error(`Plan ${planId} not found`);
    process.exit(1);
  }

  const content = decryptJson(plan.content as string);

  const doc = await generateDietPlanPdf({
    id: plan.id,
    content: content as Record<string, unknown>,
    kcal: plan.kcal,
    proteinG: plan.proteinG ? Number(plan.proteinG) : null,
    fatG: plan.fatG ? Number(plan.fatG) : null,
    carbsG: plan.carbsG ? Number(plan.carbsG) : null,
    createdAt: plan.createdAt,
    watermarkText: plan.patient?.user?.email ?? null,
  });

  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(outPath);
    doc.pipe(out);
    out.on('finish', () => resolve());
    out.on('error', reject);
  });

  console.log(`PDF written to: ${outPath}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
