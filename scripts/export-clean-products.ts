/**
 * Export CleanProduct + related data to JSON for production migration.
 *
 * Usage:
 *   npm run db:export:products
 *
 * Output: scripts/data/clean-products-export.json
 *
 * Run BEFORE import-recipes (FK dependency).
 */
import { prisma } from '../packages/database/dist/index.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Exporting clean products...');

  const total = await prisma.cleanProduct.count({ where: { isActive: true } });
  console.log(`Found ${total} active clean products — fetching...`);

  const products = await prisma.cleanProduct.findMany({
    where: { isActive: true },
    include: {
      nutrients: true,
      allergens: true,
      dietFlags: true,
      portions: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const outDir = path.join(process.cwd(), 'scripts', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'clean-products-export.json');
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2));

  const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`\nDone: ${products.length} products exported`);
  console.log(`Output: ${outPath} (${sizeMb} MB)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
