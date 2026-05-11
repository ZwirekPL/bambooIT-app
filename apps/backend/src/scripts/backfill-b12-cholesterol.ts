/**
 * P-0 fix: Backfill vitaminB12Ug + cholesterolMg on CleanProductNutrients
 *
 * Root cause: populate-clean-extended-nutrients.ts (FAZA 26) omitted these two fields
 * in FPNutrients interface + mapNutrients(). Source data exists in FoodProductNutrients
 * (6142 B12, 6318 cholesterol out of 6602), but only 22/23 rows in CleanProductNutrients
 * are populated — all MANUAL, none from USDA matching.
 *
 * Rerunning the original script would be blocked by the `!cp.nutrients.vitaminKUg` guard
 * at line 282, since vitaminKUg is already populated. This narrow script updates only
 * vitaminB12Ug + cholesterolMg, only where they are currently NULL, preserving all other
 * fields and all existing non-null values.
 *
 * Match strategy: CleanProduct.nameEn ↔ FoodProduct.nameEn (case-insensitive trim).
 * Same strategy the original FAZA 26 script used, so match set is identical.
 *
 * Safe to rerun: idempotent via `IS NULL` guards on target fields.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-b12-cholesterol.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-b12-cholesterol.ts
 *   node -r tsconfig-paths/register dist/scripts/backfill-b12-cholesterol.js   # in prod container
 */

import { prisma, Prisma } from '@db';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : undefined;
const BATCH_SIZE = 500;

// Plausibility ranges per 100g
const B12_MAX_UG = 1000;     // highest natural food ~80 µg (liver); 1000 is generous cap for errors
const CHOL_MAX_MG = 3000;    // egg yolk ~1085 mg; 3000 is generous cap

interface FpRow {
  foodProductId: string;
  vitaminB12_ug: Prisma.Decimal | null;
  cholesterol_mg: Prisma.Decimal | null;
}

function toValid(value: Prisma.Decimal | null, max: number, field: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  if (isNaN(num) || num < 0) return undefined;
  if (num > max) {
    console.warn(`  ⚠ Out of range: ${field} = ${num} (max ${max})`);
    return undefined;
  }
  return num;
}

async function buildFpNutrientsIndex(): Promise<Map<string, FpRow>> {
  console.log('Building FoodProduct → nutrients index (by nameEn)...');

  const rows = await prisma.$queryRaw<Array<{
    nameEn: string;
    foodProductId: string;
    vitaminB12_ug: Prisma.Decimal | null;
    cholesterol_mg: Prisma.Decimal | null;
  }>>(Prisma.sql`
    SELECT fp."nameEn", fpn."foodProductId", fpn."vitaminB12_ug", fpn."cholesterol_mg"
    FROM "FoodProduct" fp
    JOIN "FoodProductNutrients" fpn ON fpn."foodProductId" = fp.id
    WHERE fp."nameEn" IS NOT NULL
      AND (fpn."vitaminB12_ug" IS NOT NULL OR fpn."cholesterol_mg" IS NOT NULL)
  `);

  const index = new Map<string, FpRow>();
  for (const r of rows) {
    const key = r.nameEn.toLowerCase().trim();
    if (!index.has(key)) {
      index.set(key, {
        foodProductId: r.foodProductId,
        vitaminB12_ug: r.vitaminB12_ug,
        cholesterol_mg: r.cholesterol_mg,
      });
    }
  }
  console.log(`  Index built: ${index.size} unique nameEn entries`);
  return index;
}

async function main() {
  console.log('\n=== P-0: Backfill vitaminB12Ug + cholesterolMg ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT} products`);
  console.log('');

  const fpIndex = await buildFpNutrientsIndex();

  let cursor: string | undefined;
  let scanned = 0;
  let matched = 0;
  let b12Updated = 0;
  let cholUpdated = 0;
  let bothUpdated = 0;
  let skippedAlreadyPopulated = 0;
  let skippedNoMatch = 0;
  let skippedNoFpData = 0;

  while (true) {
    if (LIMIT && scanned >= LIMIT) break;

    const take = LIMIT ? Math.min(BATCH_SIZE, LIMIT - scanned) : BATCH_SIZE;

    const cleanProducts = await prisma.cleanProduct.findMany({
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: { nameEn: { not: null } },
      select: {
        id: true,
        nameEn: true,
        nutrients: { select: { vitaminB12Ug: true, cholesterolMg: true } },
      },
      orderBy: { id: 'asc' },
    });

    if (cleanProducts.length === 0) break;

    for (const cp of cleanProducts) {
      scanned++;

      if (!cp.nameEn || !cp.nutrients) continue;

      const fp = fpIndex.get(cp.nameEn.toLowerCase().trim());
      if (!fp) {
        skippedNoMatch++;
        continue;
      }

      matched++;

      const needB12 = cp.nutrients.vitaminB12Ug === null;
      const needChol = cp.nutrients.cholesterolMg === null;

      if (!needB12 && !needChol) {
        skippedAlreadyPopulated++;
        continue;
      }

      const b12 = needB12 ? toValid(fp.vitaminB12_ug, B12_MAX_UG, 'vitaminB12Ug') : undefined;
      const chol = needChol ? toValid(fp.cholesterol_mg, CHOL_MAX_MG, 'cholesterolMg') : undefined;

      if (b12 === undefined && chol === undefined) {
        skippedNoFpData++;
        continue;
      }

      const data: Record<string, number> = {};
      if (b12 !== undefined) data.vitaminB12Ug = b12;
      if (chol !== undefined) data.cholesterolMg = chol;

      if (!DRY_RUN) {
        await prisma.cleanProductNutrients.update({
          where: { cleanProductId: cp.id },
          data,
        });
      }

      if (b12 !== undefined) b12Updated++;
      if (chol !== undefined) cholUpdated++;
      if (b12 !== undefined && chol !== undefined) bothUpdated++;
    }

    cursor = cleanProducts[cleanProducts.length - 1].id;

    if (scanned % 2000 === 0) {
      console.log(`  Progress: scanned=${scanned} matched=${matched} b12=${b12Updated} chol=${cholUpdated}`);
    }
  }

  console.log('\n=== Results ===');
  console.log(`CleanProducts scanned:         ${scanned}`);
  console.log(`Matched by nameEn:             ${matched}`);
  console.log(`Skipped (no match):            ${skippedNoMatch}`);
  console.log(`Skipped (already populated):   ${skippedAlreadyPopulated}`);
  console.log(`Skipped (no FP B12/chol data): ${skippedNoFpData}`);
  console.log(`B12 updated:                   ${b12Updated}`);
  console.log(`Cholesterol updated:           ${cholUpdated}`);
  console.log(`Both updated (same row):       ${bothUpdated}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
