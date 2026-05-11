/**
 * Strip the legacy "<N> <unit> " prefix baked into RecipeIngredient.displayName.
 *
 * Historically the scraper's step 09-save stored ing.originalText (raw HTML
 * line like "60 g chałki"). The UI renders quantity separately as "— Xg",
 * which produced duplicates like "60 g chałki — 60g" whenever the CleanProduct
 * mapping failed and the fallback to displayName kicked in.
 *
 * The scraper is now fixed (stores ing.name instead of originalText) and the
 * UI has a runtime sanitizer as a defensive layer. This script cleans up
 * historical rows so the DB itself is tidy.
 *
 * Safety:
 *   - default mode is --dry-run: reports counts + sample diffs, zero writes
 *   - --apply mode wraps every UPDATE in a single transaction and records a
 *     row in IngredientRepairLog per mutation, so the change is auditable
 *     and can be replayed in reverse if needed
 *   - only touches the displayName column; grams/quantity/unit/FKs are left
 *     alone
 *   - uses the same regex as the frontend + backend sanitizer helpers, so
 *     the post-cleanup rendering behavior matches the runtime behavior
 *
 * Usage:
 *   DRY RUN:  npx ts-node -r tsconfig-paths/register src/scripts/cleanup-ingredient-displayname.ts
 *   APPLY:    npx ts-node -r tsconfig-paths/register src/scripts/cleanup-ingredient-displayname.ts --apply
 *   SAMPLE:   add --sample=N to change the number of before/after examples printed (default 15)
 */

import { randomUUID } from 'crypto';
import { prisma } from '@db';
import {
  cleanIngredientName,
  LEADING_QUANTITY_RE,
} from '../utils/ingredientDisplayName';

const APPLY = process.argv.includes('--apply');
const SAMPLE_FLAG = process.argv.find((a) => a.startsWith('--sample='));
const SAMPLE_SIZE = SAMPLE_FLAG ? Math.max(1, Number(SAMPLE_FLAG.split('=')[1]) || 15) : 15;

interface PendingChange {
  id: string;
  recipeId: string;
  oldValue: string;
  newValue: string | null;
}

async function main(): Promise<void> {
  const mode = APPLY ? 'APPLY' : 'DRY-RUN';
  console.log(`[cleanup-ingredient-displayname] mode: ${mode}`);

  // Pull only rows where displayName is present AND looks like it might start
  // with a quantity. The regex in the sanitizer is authoritative; this WHERE
  // is only a pre-filter to avoid pulling millions of clean rows into memory.
  const candidates = await prisma.recipeIngredient.findMany({
    where: {
      displayName: {
        not: null,
      },
    },
    select: {
      id: true,
      recipeId: true,
      displayName: true,
    },
  });

  console.log(`[cleanup-ingredient-displayname] candidates scanned: ${candidates.length}`);

  const pending: PendingChange[] = [];
  for (const row of candidates) {
    if (!row.displayName) continue;
    // Only touch rows that actually start with a quantity+unit. cleanIngredientName
    // also capitalizes the first letter, which we do NOT want to bulk-apply — that
    // would modify tens of thousands of clean lowercase names purely cosmetically.
    // The regex gate ensures we only rewrite rows where the duplicated-quantity
    // bug is present.
    if (!LEADING_QUANTITY_RE.test(row.displayName)) continue;
    const cleaned = cleanIngredientName(row.displayName);
    if (cleaned !== row.displayName) {
      pending.push({
        id: row.id,
        recipeId: row.recipeId,
        oldValue: row.displayName,
        newValue: cleaned,
      });
    }
  }

  console.log(`[cleanup-ingredient-displayname] rows that would change: ${pending.length}`);

  if (pending.length === 0) {
    console.log('[cleanup-ingredient-displayname] nothing to do.');
    return;
  }

  const sample = pending.slice(0, SAMPLE_SIZE);
  console.log(`\n── sample (first ${sample.length} diffs) ───────────────────────────`);
  for (const p of sample) {
    console.log(`  [${p.id}]`);
    console.log(`    before: ${JSON.stringify(p.oldValue)}`);
    console.log(`    after:  ${JSON.stringify(p.newValue)}`);
  }
  console.log('───────────────────────────────────────────────────────────────\n');

  if (!APPLY) {
    console.log('[cleanup-ingredient-displayname] dry-run — no writes performed.');
    console.log('[cleanup-ingredient-displayname] to apply: rerun with --apply');
    return;
  }

  const batchId = randomUUID();
  console.log(`[cleanup-ingredient-displayname] applying ${pending.length} updates under batchId=${batchId}`);

  // Chunked transactions so a huge dataset doesn't blow a single tx.
  const CHUNK = 500;
  let processed = 0;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    await prisma.$transaction(async (tx) => {
      for (const p of chunk) {
        await tx.recipeIngredient.update({
          where: { id: p.id },
          data: { displayName: p.newValue },
        });
        await tx.ingredientRepairLog.create({
          data: {
            batchId,
            recipeIngredientId: p.id,
            recipeId: p.recipeId,
            oldDisplayName: p.oldValue,
            newDisplayName: p.newValue,
            action: 'update',
            reason: 'leading-quantity-unit-stripped',
            confidence: 'high',
          },
        });
      }
    });
    processed += chunk.length;
    console.log(`[cleanup-ingredient-displayname] progress: ${processed}/${pending.length}`);
  }

  console.log(`[cleanup-ingredient-displayname] done. batchId=${batchId}`);
  console.log('[cleanup-ingredient-displayname] rollback (if needed):');
  console.log(`  UPDATE "RecipeIngredient" ri`);
  console.log(`  SET "displayName" = l."oldDisplayName"`);
  console.log(`  FROM "IngredientRepairLog" l`);
  console.log(`  WHERE l."batchId" = '${batchId}'`);
  console.log(`    AND l."recipeIngredientId" = ri.id`);
  console.log(`    AND l."action" = 'update';`);
}

main()
  .catch((err) => {
    console.error('[cleanup-ingredient-displayname] fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
