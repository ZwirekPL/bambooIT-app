/**
 * BUG-3 Session 3: apply repair proposals from ingredient-repairs.json to DB.
 *
 * Reads the JSON produced by `suggest-ingredient-repairs.ts`. Supports:
 *
 *   --dry-run                       (default — shows diff, nothing written)
 *   --apply                         (commits changes inside a transaction)
 *   --revert <batchId>              (undoes all mutations with this batchId)
 *   --confidence=high|medium|all    (which proposals to act on; default: high)
 *   --max=N                         (cap the number of proposals applied)
 *
 * Every mutation is written to IngredientRepairLog (batchId, old/new value,
 * action, reason, confidence). Apply is atomic — if any update fails the
 * whole batch is rolled back.
 *
 * Rollback (full restore): use the DB backup from Etap 0.
 * Revert (this batch only): `--revert <batchId>`.
 */

import 'dotenv/config';
import { prisma } from '@db';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

type Confidence = 'high' | 'medium' | 'low';
type Action = 'update' | 'split' | 'keep-manual-review';

interface Proposal {
  id: string;
  currentDisplayName: string;
  uses: number;
  affectsRecipeCount: number;
  sampleRecipes: string[];
  confidence: Confidence;
  pattern: string;
  action: Action;
  newDisplayName: string | null;
  splitInto: string[] | null;
  rationale: string;
  approved: null | true | false | 'edit';
}

interface ProposalBundle {
  batchId: string;
  generatedAt: string;
  totalAnalyzed: number;
  stats: Record<Confidence, number>;
  proposals: Proposal[];
}

// ─── CLI parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const REVERT_ARG = args.find((a) => a.startsWith('--revert='));
const CONFIDENCE_ARG = args.find((a) => a.startsWith('--confidence='));
const CONFIDENCE = (CONFIDENCE_ARG ? CONFIDENCE_ARG.split('=')[1] : 'high') as 'high' | 'medium' | 'all';
const MAX_ARG = args.find((a) => a.startsWith('--max='));
const MAX_PROPOSALS = MAX_ARG ? parseInt(MAX_ARG.split('=')[1], 10) : Infinity;

function shouldInclude(p: Proposal): boolean {
  if (p.action === 'keep-manual-review') return false;
  if (p.action === 'split') return false;  // split not yet implemented — session 4
  if (CONFIDENCE === 'all') return true;
  if (CONFIDENCE === 'medium') return p.confidence === 'high' || p.confidence === 'medium';
  return p.confidence === 'high';
}

// ─── Revert mode ─────────────────────────────────────────────────────────────

async function revertBatch(batchId: string): Promise<void> {
  console.log(`Reverting batch ${batchId}…\n`);
  const logs = await prisma.$queryRaw<Array<{
    recipeIngredientId: string | null;
    oldDisplayName: string | null;
    action: string;
  }>>`
    SELECT "recipeIngredientId", "oldDisplayName", "action"
    FROM "IngredientRepairLog"
    WHERE "batchId" = ${batchId}
    ORDER BY "createdAt" DESC
  `;

  if (logs.length === 0) {
    console.log(`No log rows for batch ${batchId}. Nothing to revert.`);
    return;
  }

  let reverted = 0;
  await prisma.$transaction(async (tx) => {
    for (const l of logs) {
      if (l.action === 'update' && l.recipeIngredientId) {
        await tx.$executeRaw`
          UPDATE "RecipeIngredient"
          SET "displayName" = ${l.oldDisplayName}
          WHERE id = ${l.recipeIngredientId}
        `;
        reverted += 1;
      }
    }
    await tx.$executeRaw`
      DELETE FROM "IngredientRepairLog" WHERE "batchId" = ${batchId}
    `;
  });

  console.log(`Reverted ${reverted} RecipeIngredient rows from batch ${batchId}.`);
}

// ─── Apply mode ──────────────────────────────────────────────────────────────

async function applyProposals(bundle: ProposalBundle): Promise<void> {
  const candidates = bundle.proposals.filter(shouldInclude).slice(0, MAX_PROPOSALS);

  console.log(`Filter: confidence=${CONFIDENCE}, max=${MAX_PROPOSALS === Infinity ? '∞' : MAX_PROPOSALS}`);
  console.log(`Eligible proposals: ${candidates.length} / ${bundle.proposals.length} total`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no DB writes)' : 'APPLY (committing to DB)'}`);
  console.log();

  if (candidates.length === 0) {
    console.log('Nothing to apply.');
    return;
  }

  const applyBatchId = randomUUID();
  let totalUpdated = 0;
  let totalLogRows = 0;
  const perPatternCount: Record<string, number> = {};

  // For dry-run: just count what would change
  if (DRY_RUN) {
    for (const p of candidates) {
      const rows = await prisma.recipeIngredient.findMany({
        where: { displayName: p.currentDisplayName },
        select: { id: true, recipeId: true },
      });
      totalUpdated += rows.length;
      perPatternCount[p.pattern] = (perPatternCount[p.pattern] ?? 0) + rows.length;
    }

    console.log(`=== DRY-RUN summary ===`);
    console.log(`Would update ${totalUpdated} RecipeIngredient rows across ${candidates.length} unique displayName values`);
    console.log(`Breakdown per pattern:`);
    for (const [pattern, count] of Object.entries(perPatternCount).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(5)}  ${pattern}`);
    }
    console.log(`\nTo apply:  npx ... apply-ingredient-repairs.ts --apply --confidence=${CONFIDENCE}`);
    return;
  }

  // APPLY: atomic transaction, all-or-nothing
  console.log(`Applying with batchId=${applyBatchId}…`);
  await prisma.$transaction(async (tx) => {
    for (const p of candidates) {
      if (!p.newDisplayName) continue;

      // Fetch affected rows first (need their IDs for audit log)
      const rows = await tx.recipeIngredient.findMany({
        where: { displayName: p.currentDisplayName },
        select: { id: true, recipeId: true, grams: true },
      });
      if (rows.length === 0) continue;

      // Update all matching rows in one go
      await tx.recipeIngredient.updateMany({
        where: { displayName: p.currentDisplayName },
        data: { displayName: p.newDisplayName },
      });

      // Per-row audit log via raw INSERT (avoids Prisma Client regeneration dependency)
      for (const r of rows) {
        await tx.$executeRaw`
          INSERT INTO "IngredientRepairLog"
            (id, "batchId", "recipeIngredientId", "recipeId",
             "oldDisplayName", "newDisplayName",
             action, reason, confidence, "createdAt")
          VALUES
            (${randomUUID()}, ${applyBatchId}, ${r.id}, ${r.recipeId},
             ${p.currentDisplayName}, ${p.newDisplayName},
             ${p.action}, ${p.pattern}, ${p.confidence}, NOW())
        `;
        totalLogRows += 1;
      }
      totalUpdated += rows.length;
      perPatternCount[p.pattern] = (perPatternCount[p.pattern] ?? 0) + rows.length;
    }
  }, { timeout: 60_000 });  // 60s transaction timeout

  console.log(`\n=== APPLIED ===`);
  console.log(`Batch ID:              ${applyBatchId}`);
  console.log(`RecipeIngredient rows: ${totalUpdated}`);
  console.log(`Audit log rows:        ${totalLogRows}`);
  console.log(`Per pattern:`);
  for (const [pattern, count] of Object.entries(perPatternCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(5)}  ${pattern}`);
  }
  console.log(`\nTo revert:  npx ... apply-ingredient-repairs.ts --revert=${applyBatchId}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (REVERT_ARG) {
    const batchId = REVERT_ARG.split('=')[1];
    await revertBatch(batchId);
    await prisma.$disconnect();
    return;
  }

  const jsonPath = path.join(__dirname, 'data', 'ingredient-repairs.json');
  try {
    await fs.access(jsonPath);
  } catch {
    console.error(`ERROR: ${jsonPath} not found. Run 'npm run suggest:ingredient-repairs' first.`);
    process.exit(1);
  }
  const raw = await fs.readFile(jsonPath, 'utf8');
  const bundle = JSON.parse(raw) as ProposalBundle;

  console.log(`Loaded bundle: ${bundle.batchId} (generated ${bundle.generatedAt})`);
  console.log(`Total proposals: ${bundle.proposals.length} (HIGH: ${bundle.stats.high}, MEDIUM: ${bundle.stats.medium}, LOW: ${bundle.stats.low})\n`);

  await applyProposals(bundle);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
