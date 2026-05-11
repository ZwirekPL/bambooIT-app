/**
 * Import script for CleanProduct database (FAZA 25, ETAP D)
 * Imports BASE products (from matched-base-products.json) and
 * RETAIL products (from cleaned-retail-products.json) into CleanProduct tables.
 *
 * Usage: node scripts/import-clean-products.js [--base-only | --retail-only]
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

// Map OFF allergen codes to our lowercase codes
const ALLERGEN_CODE_MAP = {
  GLUTEN: 'gluten',
  CRUSTACEANS: 'crustaceans',
  EGGS: 'eggs',
  FISH: 'fish',
  PEANUTS: 'peanuts',
  SOYBEANS: 'soy',
  MILK: 'milk',
  TREE_NUTS: 'nuts',
  CELERY: 'celery',
  MUSTARD: 'mustard',
  SESAME: 'sesame',
  SULPHITES: 'sulphites',
  LUPIN: 'lupin',
  MOLLUSCS: 'molluscs',
};

// Map OFF category tags to our 12 Polish categories
const CATEGORY_MAP = {
  'en:meats': 'mieso-i-wedliny',
  'en:pork': 'mieso-i-wedliny',
  'en:beef': 'mieso-i-wedliny',
  'en:poultry': 'mieso-i-wedliny',
  'en:sausages': 'mieso-i-wedliny',
  'en:chicken': 'mieso-i-wedliny',
  'en:turkey': 'mieso-i-wedliny',
  'en:cold-meats': 'mieso-i-wedliny',
  'en:dairies': 'nabial-i-jaja',
  'en:milks': 'nabial-i-jaja',
  'en:cheeses': 'nabial-i-jaja',
  'en:yogurts': 'nabial-i-jaja',
  'en:eggs': 'nabial-i-jaja',
  'en:butter': 'nabial-i-jaja',
  'en:cream': 'nabial-i-jaja',
  'en:fish': 'ryby',
  'en:fishes': 'ryby',
  'en:smoked-fishes': 'ryby',
  'en:canned-fishes': 'ryby',
  'en:seafood': 'ryby',
  'en:fruits': 'owoce',
  'en:fresh-fruits': 'owoce',
  'en:dried-fruits': 'owoce',
  'en:canned-fruits': 'owoce',
  'en:vegetables': 'warzywa',
  'en:fresh-vegetables': 'warzywa',
  'en:canned-vegetables': 'warzywa',
  'en:frozen-vegetables': 'warzywa',
  'en:legumes': 'warzywa',
  'en:breads': 'produkty-zbozowe',
  'en:cereals': 'produkty-zbozowe',
  'en:pastas': 'produkty-zbozowe',
  'en:rice': 'produkty-zbozowe',
  'en:flours': 'produkty-zbozowe',
  'en:breakfast-cereals': 'produkty-zbozowe',
  'en:nuts': 'bakalie-i-nasiona',
  'en:seeds': 'bakalie-i-nasiona',
  'en:dried-fruits-and-nuts': 'bakalie-i-nasiona',
  'en:plant-based-foods-and-beverages': 'napoje',
  'en:beverages': 'napoje',
  'en:waters': 'napoje',
  'en:juices': 'napoje',
  'en:sodas': 'napoje',
  'en:teas': 'napoje',
  'en:coffees': 'napoje',
  'en:fats': 'tluszcze',
  'en:oils': 'tluszcze',
  'en:vegetable-oils': 'tluszcze',
  'en:olive-oils': 'tluszcze',
  'en:margarines': 'tluszcze',
  'en:chocolates': 'slodycze-i-przekaski',
  'en:candies': 'slodycze-i-przekaski',
  'en:biscuits': 'slodycze-i-przekaski',
  'en:snacks': 'slodycze-i-przekaski',
  'en:sweet-snacks': 'slodycze-i-przekaski',
  'en:salty-snacks': 'slodycze-i-przekaski',
  'en:chips': 'slodycze-i-przekaski',
  'en:ice-creams': 'slodycze-i-przekaski',
  'en:meals': 'produkty-gotowe',
  'en:prepared-meals': 'produkty-gotowe',
  'en:canned-foods': 'produkty-gotowe',
  'en:frozen-foods': 'produkty-gotowe',
  'en:sauces': 'produkty-gotowe',
  'en:condiments': 'produkty-gotowe',
  'en:soups': 'produkty-gotowe',
  'en:spreads': 'produkty-gotowe',
};

/**
 * Generate a unique slug, appending -2, -3, etc. if needed
 */
function makeSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Determine category for RETAIL product from OFF category tags
 */
function categorizeRetail(categoriesTags) {
  if (!categoriesTags || categoriesTags.length === 0) return 'produkty-gotowe';

  for (const tag of categoriesTags) {
    if (CATEGORY_MAP[tag]) return CATEGORY_MAP[tag];
  }

  // Fallback: try partial matching
  for (const tag of categoriesTags) {
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
      if (tag.includes(key.replace('en:', ''))) return cat;
    }
  }

  return 'produkty-gotowe';
}

/**
 * Compute quality score for RETAIL product
 */
function retailQualityScore(product) {
  const m = product.macros;
  const hasFullMacros =
    m.kcalPer100g != null &&
    m.proteinPer100g != null &&
    m.fatPer100g != null &&
    m.carbsPer100g != null;
  const hasAllergens =
    (product.allergensEU14 && product.allergensEU14.length > 0) ||
    (product.tracesEU14 && product.tracesEU14.length > 0);

  if (hasFullMacros && hasAllergens) return 80;
  if (hasFullMacros) return 60;
  return 40;
}

// ─── Import BASE products ──────────────────────────────────────────────────

async function importBaseProducts() {
  console.log('\n=== Importing BASE products ===\n');

  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'matched-base-products.json'), 'utf-8'),
  );
  const products = raw.products || raw;

  console.log(`  Source: ${products.length} products`);

  // Collect existing slugs to handle conflicts
  const existingSlugs = new Set(
    (await prisma.cleanProduct.findMany({ select: { slug: true } })).map((p) => p.slug),
  );

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    for (const p of batch) {
      try {
        // Generate unique slug
        let slug = makeSlug(p.name);
        if (!slug) slug = `base-${i}-${Math.random().toString(36).slice(2, 8)}`;
        let slugBase = slug;
        let counter = 2;
        while (existingSlugs.has(slug)) {
          slug = `${slugBase}-${counter++}`;
        }
        existingSlugs.add(slug);

        const n = p.nutrients || {};

        await prisma.cleanProduct.create({
          data: {
            name: p.name,
            nameEn: p.nameEn || null,
            slug,
            type: 'BASE',
            category: p.category || 'produkty-gotowe',
            sourcePrimary: p.sourcePrimary || 'ILEWAZY',
            sourceSecondary: p.sourceSecondary || null,
            sourceId: p.sourceId ? String(p.sourceId) : null,
            qualityScore: p.qualityScore || 70,
            verificationStatus: 'VERIFIED',
            hasMicronutrients: p.hasMicronutrients || false,

            nutrients: {
              create: {
                kcalPer100g: n.kcalPer100g ?? 0,
                proteinPer100g: n.proteinPer100g ?? 0,
                fatPer100g: n.fatPer100g ?? 0,
                carbsPer100g: n.carbsPer100g ?? 0,
                fiberPer100g: n.fiberPer100g ?? null,
                sugarsPer100g: n.sugarsPer100g ?? null,
                saltPer100g: n.saltPer100g ?? null,
                saturatedFatPer100g: n.saturatedFatPer100g ?? null,
                // Micronutrients
                potassiumMg: n.potassiumMg ?? null,
                calciumMg: n.calciumMg ?? null,
                magnesiumMg: n.magnesiumMg ?? null,
                ironMg: n.ironMg ?? null,
                zincMg: n.zincMg ?? null,
                vitaminAUg: n.vitaminAUg ?? null,
                vitaminCMg: n.vitaminCMg ?? null,
                vitaminDUg: n.vitaminDUg ?? null,
                folateUg: n.folateMg ?? n.folateUg ?? null,
                sodiumMg: n.sodiumMg ?? null,
              },
            },

            // Portions from ilewazy
            portions:
              p.portions && p.portions.length > 0
                ? {
                    create: p.portions.map((por) => ({
                      portionName: por.portionName || por.portionKey,
                      weightG: por.weightG,
                      source: 'ILEWAZY',
                    })),
                  }
                : undefined,
          },
        });

        imported++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  [ERR] "${p.name}": ${err.message}`);
        }
      }
    }

    process.stdout.write(
      `\r  Progress: ${Math.min(i + BATCH_SIZE, products.length)}/${products.length} (imported: ${imported}, errors: ${errors})`,
    );
  }

  console.log(`\n\n  BASE import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return { imported, skipped, errors };
}

// ─── Import RETAIL products ────────────────────────────────────────────────

async function importRetailProducts() {
  console.log('\n=== Importing RETAIL products ===\n');

  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'cleaned-retail-products.json'), 'utf-8'),
  );
  const products = raw.products || raw;

  console.log(`  Source: ${products.length} products`);

  const existingSlugs = new Set(
    (await prisma.cleanProduct.findMany({ select: { slug: true } })).map((p) => p.slug),
  );

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    for (const p of batch) {
      try {
        if (!p.name || p.name.trim().length === 0) {
          skipped++;
          continue;
        }

        // Generate unique slug
        let slug = makeSlug(p.name);
        if (!slug) slug = `retail-${p.barcode || Math.random().toString(36).slice(2, 8)}`;
        let slugBase = slug;
        let counter = 2;
        while (existingSlugs.has(slug)) {
          slug = `${slugBase}-${counter++}`;
        }
        existingSlugs.add(slug);

        const m = p.macros || {};
        const category = categorizeRetail(p.categoriesTags);
        const qScore = retailQualityScore(p);

        // Build allergen records
        const allergenRecords = [];

        // CONTAINS allergens
        if (p.allergensEU14 && p.allergensEU14.length > 0) {
          for (const code of p.allergensEU14) {
            const mapped = ALLERGEN_CODE_MAP[code];
            if (mapped) {
              allergenRecords.push({
                allergenCode: mapped,
                presence: 'CONTAINS',
                source: 'SOURCE_DATA',
                confidence: 90,
              });
            }
          }
        }

        // MAY_CONTAIN traces
        if (p.tracesEU14 && p.tracesEU14.length > 0) {
          for (const code of p.tracesEU14) {
            const mapped = ALLERGEN_CODE_MAP[code];
            if (mapped) {
              // Skip if already in CONTAINS
              if (!allergenRecords.some((r) => r.allergenCode === mapped)) {
                allergenRecords.push({
                  allergenCode: mapped,
                  presence: 'MAY_CONTAIN',
                  source: 'SOURCE_DATA',
                  confidence: 70,
                });
              }
            }
          }
        }

        // Build portions
        const portionRecords = [];
        if (p.servingWeightG && p.servingWeightG > 0) {
          portionRecords.push({
            portionName: 'porcja',
            weightG: p.servingWeightG,
            source: 'OPENFOODFACTS',
          });
        }
        if (p.packageWeightG && p.packageWeightG > 0) {
          // Only add if different from serving
          if (!p.servingWeightG || p.packageWeightG !== p.servingWeightG) {
            portionRecords.push({
              portionName: 'opakowanie',
              weightG: p.packageWeightG,
              source: 'OPENFOODFACTS',
            });
          }
        }

        await prisma.cleanProduct.create({
          data: {
            name: p.name.trim(),
            slug,
            type: 'RETAIL',
            brand: p.brands || null,
            barcode: p.barcode || null,
            category,
            sourcePrimary: 'OPENFOODFACTS',
            sourceId: p.barcode || null,
            qualityScore: qScore,
            verificationStatus: 'UNVERIFIED',
            hasMicronutrients: false,
            packageWeightG: p.packageWeightG || null,
            servingWeightG: p.servingWeightG || null,

            nutrients: {
              create: {
                kcalPer100g: m.kcalPer100g ?? 0,
                proteinPer100g: m.proteinPer100g ?? 0,
                fatPer100g: m.fatPer100g ?? 0,
                carbsPer100g: m.carbsPer100g ?? 0,
                fiberPer100g: m.fiberPer100g ?? null,
                sugarsPer100g: m.sugarsPer100g ?? null,
                saltPer100g: m.saltPer100g ?? null,
                saturatedFatPer100g: m.saturatedFatPer100g ?? null,
              },
            },

            allergens:
              allergenRecords.length > 0 ? { create: allergenRecords } : undefined,

            portions:
              portionRecords.length > 0 ? { create: portionRecords } : undefined,
          },
        });

        imported++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  [ERR] "${p.name}": ${err.message}`);
        }
      }
    }

    process.stdout.write(
      `\r  Progress: ${Math.min(i + BATCH_SIZE, products.length)}/${products.length} (imported: ${imported}, errors: ${errors})`,
    );
  }

  console.log(`\n\n  RETAIL import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return { imported, skipped, errors };
}

// ─── Verification report ───────────────────────────────────────────────────

async function verifyImport() {
  console.log('\n=== VERIFICATION REPORT ===\n');

  const baseCount = await prisma.cleanProduct.count({ where: { type: 'BASE' } });
  const retailCount = await prisma.cleanProduct.count({ where: { type: 'RETAIL' } });
  const totalCount = baseCount + retailCount;

  console.log(`  Total CleanProducts: ${totalCount}`);
  console.log(`    BASE: ${baseCount}`);
  console.log(`    RETAIL: ${retailCount}`);

  // Nutrients
  const withNutrients = await prisma.cleanProductNutrients.count();
  console.log(`  With nutrients: ${withNutrients}`);

  // Micronutrients
  const withMicro = await prisma.cleanProduct.count({ where: { hasMicronutrients: true } });
  console.log(`  With micronutrients: ${withMicro}`);

  // Portions
  const portionCount = await prisma.cleanProductPortion.count();
  const productsWithPortions = await prisma.cleanProduct.count({
    where: { portions: { some: {} } },
  });
  console.log(`  Products with portions: ${productsWithPortions} (${portionCount} total portions)`);

  // Allergens
  const allergenCount = await prisma.cleanProductAllergen.count();
  const productsWithAllergens = await prisma.cleanProduct.count({
    where: { allergens: { some: {} } },
  });
  console.log(`  Products with allergens: ${productsWithAllergens} (${allergenCount} total allergen records)`);

  // Categories
  const categories = await prisma.cleanProduct.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });
  console.log(`\n  Categories:`);
  for (const c of categories) {
    console.log(`    ${c.category}: ${c._count}`);
  }

  // Quality scores
  const verified = await prisma.cleanProduct.count({ where: { verificationStatus: 'VERIFIED' } });
  const unverified = await prisma.cleanProduct.count({ where: { verificationStatus: 'UNVERIFIED' } });
  console.log(`\n  Verification: ${verified} VERIFIED, ${unverified} UNVERIFIED`);

  // Spot check: 5 random BASE
  console.log('\n  Spot check (5 random BASE products):');
  const randomBase = await prisma.cleanProduct.findMany({
    where: { type: 'BASE' },
    include: { nutrients: true, portions: true },
    take: 5,
    skip: Math.floor(Math.random() * Math.max(1, baseCount - 5)),
  });
  for (const p of randomBase) {
    const n = p.nutrients;
    const portions = p.portions.map((po) => `${po.portionName}=${po.weightG}g`).join(', ');
    console.log(
      `    ${p.name} [${p.category}] — ${n?.kcalPer100g}kcal, B:${n?.proteinPer100g}g, T:${n?.fatPer100g}g, W:${n?.carbsPer100g}g | ${portions || 'no portions'}`,
    );
  }

  // Spot check: 5 random RETAIL
  console.log('\n  Spot check (5 random RETAIL products):');
  const randomRetail = await prisma.cleanProduct.findMany({
    where: { type: 'RETAIL' },
    include: { nutrients: true, allergens: true, portions: true },
    take: 5,
    skip: Math.floor(Math.random() * Math.max(1, retailCount - 5)),
  });
  for (const p of randomRetail) {
    const n = p.nutrients;
    const allergens = p.allergens.map((a) => `${a.allergenCode}:${a.presence}`).join(', ');
    console.log(
      `    ${p.name} [${p.brand || 'no brand'}] — ${n?.kcalPer100g}kcal | allergens: ${allergens || 'none'}`,
    );
  }

  console.log('\n=== Done ===');
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const baseOnly = args.includes('--base-only');
  const retailOnly = args.includes('--retail-only');

  console.log('=== CleanProduct Import (FAZA 25, ETAP D) ===');

  // Check current state
  const existing = await prisma.cleanProduct.count();
  if (existing > 0) {
    console.log(`\n  WARNING: ${existing} CleanProducts already exist in DB.`);
    console.log('  Clearing existing data before import...\n');
    await prisma.cleanProductDietFlag.deleteMany();
    await prisma.cleanProductAllergen.deleteMany();
    await prisma.cleanProductPortion.deleteMany();
    await prisma.cleanProductNutrients.deleteMany();
    await prisma.cleanProduct.deleteMany();
    console.log('  Cleared.');
  }

  if (!retailOnly) {
    await importBaseProducts();
  }

  if (!baseOnly) {
    await importRetailProducts();
  }

  await verifyImport();
}

main()
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
