// Apply (oldDisplayName → newDisplayName) repairs from JSON dump.
// Updates RecipeIngredient.displayName WHERE current value matches oldDisplayName.
// Logs each mutation to IngredientRepairLog with a new batchId.
//
// Usage:
//   node /app/import-ingredient-repairs.js /path/to/dev-ingredient-repairs.json [--dry-run] [--apply]
//
// --dry-run (default): show what WOULD be changed
// --apply: actually write to DB inside a transaction

/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv/config');

const fs = require('fs');
const crypto = require('crypto');
const { prisma } = require('/app/packages/database/dist/index.js');

async function main() {
  const jsonPath = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!jsonPath) {
    console.error('Usage: node import-ingredient-repairs.js <json> [--apply]');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const sourceBatchId = data.batchId;
  const mappings = data.mappings ?? [];
  console.log(`Source batch:    ${sourceBatchId}`);
  console.log(`Unique pairs:    ${mappings.length}`);
  console.log(`Mode:            ${apply ? 'APPLY' : 'DRY RUN'}`);

  // Pre-scan: count how many RecipeIngredient rows on this DB will be touched
  let totalAffected = 0;
  const previewRows = [];
  for (const m of mappings) {
    const count = await prisma.recipeIngredient.count({
      where: { displayName: m.old },
    });
    if (count > 0) {
      totalAffected += count;
      if (previewRows.length < 8) {
        previewRows.push({ count, old: m.old.slice(0, 60), new: m.new });
      }
    }
  }

  console.log('');
  console.log(`Pre-scan: ${totalAffected} RecipeIngredient rows match on this DB`);
  console.log(`Sample mappings (first 8 with matches):`);
  for (const p of previewRows) {
    console.log(`  ${String(p.count).padStart(4)}× "${p.old}…" → "${p.new}"`);
  }

  if (!apply) {
    console.log('\n(DRY RUN — no writes. Re-run with --apply to commit.)');
    return;
  }

  // ─── APPLY in a single transaction ─────────────────────────────────────
  const newBatchId = crypto.randomUUID();
  console.log(`\nApplying as new batch: ${newBatchId}`);

  let updatedRows = 0;
  let logRows = 0;

  await prisma.$transaction(async (tx) => {
    for (const m of mappings) {
      // Fetch all matching RecipeIngredient rows BEFORE updating (for audit)
      const rowsToUpdate = await tx.recipeIngredient.findMany({
        where: { displayName: m.old },
        select: { id: true, recipeId: true, grams: true, displayName: true },
      });
      if (rowsToUpdate.length === 0) continue;

      // Bulk update
      await tx.recipeIngredient.updateMany({
        where: { displayName: m.old },
        data: { displayName: m.new },
      });
      updatedRows += rowsToUpdate.length;

      // Audit log per row
      await tx.ingredientRepairLog.createMany({
        data: rowsToUpdate.map((r) => ({
          batchId: newBatchId,
          recipeIngredientId: r.id,
          recipeId: r.recipeId,
          oldDisplayName: m.old,
          newDisplayName: m.new,
          oldGrams: r.grams,
          newGrams: r.grams,
          action: 'update',
          reason: `replay-from-dev:${m.reason}`,
          confidence: m.confidence,
        })),
      });
      logRows += rowsToUpdate.length;
    }
  }, { timeout: 600000 });  // 10 min timeout for large batches

  console.log('');
  console.log(`Done.`);
  console.log(`  Updated rows:       ${updatedRows}`);
  console.log(`  Audit log rows:     ${logRows}`);
  console.log(`  New batchId:        ${newBatchId}`);
  console.log(`  Rollback command:`);
  console.log(`    UPDATE "RecipeIngredient" ri`);
  console.log(`    SET "displayName" = log."oldDisplayName"`);
  console.log(`    FROM "IngredientRepairLog" log`);
  console.log(`    WHERE log."batchId" = '${newBatchId}'`);
  console.log(`      AND ri.id = log."recipeIngredientId";`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
