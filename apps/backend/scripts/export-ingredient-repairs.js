// Export deduped (oldDisplayName → newDisplayName) mappings from
// IngredientRepairLog. Source for replaying BUG-3 repair on prod.
//
// Usage: node apps/backend/scripts/export-ingredient-repairs.js [batchId] [outPath]

/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv/config');

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const batchId = process.argv[2] ?? '458d99a7-a946-4140-adc3-423074ca6c94';
  const outPath = process.argv[3] ?? 'c:/tmp/dev-ingredient-repairs.json';

  const rows = await prisma.ingredientRepairLog.findMany({
    where: { batchId },
    select: {
      oldDisplayName: true,
      newDisplayName: true,
      reason: true,
      confidence: true,
    },
  });

  // Dedupe — same (old → new) pair counted once
  const seen = new Map();
  for (const r of rows) {
    if (!r.oldDisplayName || !r.newDisplayName) continue;
    const key = `${r.oldDisplayName}|${r.newDisplayName}`;
    if (!seen.has(key)) {
      seen.set(key, {
        old: r.oldDisplayName,
        new: r.newDisplayName,
        reason: r.reason,
        confidence: r.confidence,
      });
    }
  }

  const mappings = [...seen.values()];
  fs.writeFileSync(outPath, JSON.stringify({ batchId, mappings }, null, 2));
  console.log(`Exported batch ${batchId}`);
  console.log(`  Source rows:   ${rows.length}`);
  console.log(`  Unique pairs:  ${mappings.length}`);
  console.log(`  Written to:    ${outPath}`);
  console.log(`  Size:          ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
