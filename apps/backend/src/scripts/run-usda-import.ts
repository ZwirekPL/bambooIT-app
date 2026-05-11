/**
 * CLI script to import USDA FoodData Central JSON files into the database.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/run-usda-import.ts
 */

import { importUsdaFile } from '../import/usda-importer';
import { computeAllergensForAllProducts } from '../import/allergen-engine';
import { computeDietFlagsForAllProducts } from '../import/diet-flag-engine';

async function main() {
  const dataDir = 'c:/Users/wirig/Desktop/DietetykDEV/data/usda';

  console.log('=== USDA Import ===\n');

  // 1. SR Legacy
  console.log('[1/4] Importing SR Legacy (~7800 products)...');
  const sr = await importUsdaFile(
    `${dataDir}/FoodData_Central_sr_legacy_food_json_2018-04.json`,
    'sr_legacy',
  );
  console.log(`  Done: ${sr.imported} imported, ${sr.skipped} skipped, ${sr.errors} errors\n`);

  // 2. Foundation Foods
  console.log('[2/4] Importing Foundation Foods (~2100 products)...');
  const ff = await importUsdaFile(
    `${dataDir}/FoodData_Central_foundation_food_json_2025-12-18.json`,
    'foundation',
  );
  console.log(`  Done: ${ff.imported} imported, ${ff.skipped} skipped, ${ff.errors} errors\n`);

  // 3. Compute allergens
  console.log('[3/4] Computing allergens (EU 14)...');
  const allergens = await computeAllergensForAllProducts({ onlyUnprocessed: true });
  console.log(`  Done: ${JSON.stringify(allergens)}\n`);

  // 4. Compute diet flags
  console.log('[4/4] Computing diet flags...');
  const flags = await computeDietFlagsForAllProducts({ onlyUnprocessed: true });
  console.log(`  Done: ${JSON.stringify(flags)}\n`);

  console.log('=== Import complete ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
