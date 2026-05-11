/**
 * Import CleanProducts from JSON export (upsert by slug).
 *
 * Usage:
 *   npm run db:import:products
 *   npm run db:import:products -- --dry-run
 *
 * Input: scripts/data/clean-products-export.json
 *
 * IMPORTANT: Run BEFORE import-recipes.ts (RecipeIngredient.cleanProductId FK).
 *
 * Behaviour:
 *   - Slug already exists → UPSERT scalar fields + re-sync nutrients/allergens/flags/portions
 *   - Slug not found     → CREATE
 *   - --dry-run          → report only, no writes
 */
import { prisma } from '../packages/database/dist/index.js';
import fs from 'fs';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');

interface NutrientsData {
  id: string;
  cleanProductId: string;
  [key: string]: unknown;
}

interface AllergenData {
  id: string;
  cleanProductId: string;
  [key: string]: unknown;
}

interface DietFlagData {
  id: string;
  cleanProductId: string;
  [key: string]: unknown;
}

interface PortionData {
  id: string;
  cleanProductId: string;
  [key: string]: unknown;
}

interface ProductExport {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nutrients: NutrientsData | null;
  allergens: AllergenData[];
  dietFlags: DietFlagData[];
  portions: PortionData[];
  [key: string]: unknown;
}

function progress(current: number, total: number, label: string) {
  const pct = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r  [${bar}] ${pct}% (${current}/${total}) ${label}   `);
}

async function main() {
  const inPath = path.join(process.cwd(), 'scripts', 'data', 'clean-products-export.json');
  if (!fs.existsSync(inPath)) {
    console.error(`File not found: ${inPath}`);
    console.error('Run npm run db:export:products first.');
    process.exit(1);
  }

  const products: ProductExport[] = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  const total = products.length;
  console.log(`Importing ${total} clean products... ${DRY_RUN ? '(DRY RUN — no writes)' : ''}`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    progress(i + 1, total, product.slug.slice(0, 30));

    if (DRY_RUN) {
      const existing = await prisma.cleanProduct.findUnique({ where: { slug: product.slug } });
      existing ? updated++ : created++;
      continue;
    }

    try {
      const {
        id,
        nutrients,
        allergens,
        dietFlags,
        portions,
        createdAt,
        updatedAt,
        ...productData
      } = product;

      const existing = await prisma.cleanProduct.findUnique({ where: { slug: product.slug } });

      let productId: string;

      if (existing) {
        await prisma.cleanProduct.update({
          where: { slug: product.slug },
          data: { ...productData },
        });
        productId = existing.id;

        // Re-sync relations
        await prisma.$transaction([
          prisma.cleanProductAllergen.deleteMany({ where: { cleanProductId: productId } }),
          prisma.cleanProductDietFlag.deleteMany({ where: { cleanProductId: productId } }),
          prisma.cleanProductPortion.deleteMany({ where: { cleanProductId: productId } }),
        ]);
        updated++;
      } else {
        const p = await prisma.cleanProduct.create({ data: { ...productData } });
        productId = p.id;
        created++;
      }

      // Nutrients: upsert (single record per product)
      if (nutrients) {
        const { id: _id, cleanProductId: _cpid, ...nutData } = nutrients;
        await prisma.cleanProductNutrients.upsert({
          where: { cleanProductId: productId },
          create: { cleanProductId: productId, ...nutData },
          update: { ...nutData },
        });
      }

      // Allergens
      if (allergens.length > 0) {
        await prisma.cleanProductAllergen.createMany({
          data: allergens.map(({ id: _id, cleanProductId: _cpid, ...a }) => ({
            ...a,
            cleanProductId: productId,
          })),
        });
      }

      // Diet flags
      if (dietFlags.length > 0) {
        await prisma.cleanProductDietFlag.createMany({
          data: dietFlags.map(({ id: _id, cleanProductId: _cpid, ...f }) => ({
            ...f,
            cleanProductId: productId,
          })),
        });
      }

      // Portions
      if (portions.length > 0) {
        await prisma.cleanProductPortion.createMany({
          data: portions.map(({ id: _id, cleanProductId: _cpid, ...p }) => ({
            ...p,
            cleanProductId: productId,
          })),
        });
      }
    } catch (err) {
      failed++;
      console.error(`\n  ERROR on ${product.slug}: ${(err as Error).message}`);
    }
  }

  console.log(`\n\nDone${DRY_RUN ? ' (dry run)' : ''}:`);
  console.log(`  Created : ${created}`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Failed  : ${failed}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
