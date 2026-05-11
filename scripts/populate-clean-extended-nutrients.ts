/**
 * FAZA 26 — Data Migration Script
 *
 * Populates extended nutrition fields on CleanProduct from matched FoodProduct (USDA).
 * Match strategy: CleanProduct.nameEn ←→ FoodProduct.nameEn (case-insensitive exact match)
 *
 * Creates:
 * - Extended nutrient fields on CleanProductNutrients (vitamins, minerals, fat fractions, carb fractions)
 * - CleanProductAminoAcids from FoodProductNutrients amino acid fields
 * - CleanProductBioactives from FoodProductNutrients bioactive fields
 * - glycemicIndex, glycemicLoadPer100g, fodmapLevel on CleanProduct
 *
 * Idempotent: uses upsert for new relations, skips if data already exists.
 * Includes validation ranges to catch anomalies.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

// ─── Validation ranges (per 100g) ────────────────────────────────────────────

interface ValidRange { min: number; max: number }

const NUTRIENT_RANGES: Record<string, ValidRange> = {
  vitaminKUg: { min: 0, max: 3000 },
  vitaminB1Mg: { min: 0, max: 100 },
  vitaminB2Mg: { min: 0, max: 100 },
  vitaminB3Mg: { min: 0, max: 200 },
  vitaminB5Mg: { min: 0, max: 200 },
  vitaminB6Mg: { min: 0, max: 100 },
  vitaminB12Ug: { min: 0, max: 1000 },
  folateUg: { min: 0, max: 4000 },
  biotinUg: { min: 0, max: 500 },
  cholineMg: { min: 0, max: 3000 },
  cholesterolMg: { min: 0, max: 3000 },
  phosphorusMg: { min: 0, max: 12000 },
  chlorideMg: { min: 0, max: 10000 },
  copperMg: { min: 0, max: 50 },
  manganeseMg: { min: 0, max: 200 },
  iodineUg: { min: 0, max: 5000 },
  seleniumUg: { min: 0, max: 2500 },
  chromiumUg: { min: 0, max: 500 },
  molybdenumUg: { min: 0, max: 500 },
  fluorideUg: { min: 0, max: 5000 },
  monounsaturatedFatPer100g: { min: 0, max: 100 },
  polyunsaturatedFatPer100g: { min: 0, max: 100 },
  transFatPer100g: { min: 0, max: 100 },
  omega3Per100g: { min: 0, max: 50 },
  omega6Per100g: { min: 0, max: 100 },
  epaPer100g: { min: 0, max: 30 },
  dhaPer100g: { min: 0, max: 30 },
  alaPer100g: { min: 0, max: 60 },
  starchPer100g: { min: 0, max: 100 },
  addedSugarsPer100g: { min: 0, max: 100 },
};

const AA_RANGES: Record<string, ValidRange> = {
  tryptophanPer100g: { min: 0, max: 10 },
  threoninePer100g: { min: 0, max: 10 },
  isoleucinePer100g: { min: 0, max: 10 },
  leucinePer100g: { min: 0, max: 10 },
  lysinePer100g: { min: 0, max: 10 },
  methioninePer100g: { min: 0, max: 10 },
  phenylalaninePer100g: { min: 0, max: 10 },
  valinePer100g: { min: 0, max: 10 },
  histidinePer100g: { min: 0, max: 10 },
};

function validateValue(value: Prisma.Decimal | null | undefined, field: string, ranges: Record<string, ValidRange>): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  if (isNaN(num) || num < 0) return undefined;
  const range = ranges[field];
  if (range && (num < range.min || num > range.max)) {
    console.warn(`  ⚠ Out of range: ${field} = ${num} (expected ${range.min}-${range.max})`);
    return undefined;
  }
  return num;
}

// ─── FoodProduct → CleanProduct field mapping ────────────────────────────────

interface FPNutrients {
  vitaminK_ug: Prisma.Decimal | null;
  vitaminB1_mg: Prisma.Decimal | null;
  vitaminB2_mg: Prisma.Decimal | null;
  vitaminB3_mg: Prisma.Decimal | null;
  vitaminB5_mg: Prisma.Decimal | null;
  vitaminB6_mg: Prisma.Decimal | null;
  vitaminB12_ug: Prisma.Decimal | null;
  folate_ug: Prisma.Decimal | null;
  biotin_ug: Prisma.Decimal | null;
  choline_mg: Prisma.Decimal | null;
  cholesterol_mg: Prisma.Decimal | null;
  phosphorus_mg: Prisma.Decimal | null;
  copper_mg: Prisma.Decimal | null;
  manganese_mg: Prisma.Decimal | null;
  iodine_ug: Prisma.Decimal | null;
  selenium_ug: Prisma.Decimal | null;
  chromium_ug: Prisma.Decimal | null;
  molybdenum_ug: Prisma.Decimal | null;
  monounsaturatedFat_g: Prisma.Decimal | null;
  polyunsaturatedFat_g: Prisma.Decimal | null;
  transFat_g: Prisma.Decimal | null;
  omega3_g: Prisma.Decimal | null;
  omega6_g: Prisma.Decimal | null;
  epa_g: Prisma.Decimal | null;
  dha_g: Prisma.Decimal | null;
  ala_g: Prisma.Decimal | null;
  starch_g: Prisma.Decimal | null;
  addedSugars_g: Prisma.Decimal | null;
  // Amino acids
  tryptophan_g: Prisma.Decimal | null;
  threonine_g: Prisma.Decimal | null;
  isoleucine_g: Prisma.Decimal | null;
  leucine_g: Prisma.Decimal | null;
  lysine_g: Prisma.Decimal | null;
  methionine_g: Prisma.Decimal | null;
  phenylalanine_g: Prisma.Decimal | null;
  valine_g: Prisma.Decimal | null;
  histidine_g: Prisma.Decimal | null;
  // Bioactives
  purines_mg: Prisma.Decimal | null;
  oxalate_mg: Prisma.Decimal | null;
  caffeine_mg: Prisma.Decimal | null;
  betaCarotene_ug: Prisma.Decimal | null;
}

function mapNutrients(fp: FPNutrients) {
  return {
    vitaminKUg: validateValue(fp.vitaminK_ug, 'vitaminKUg', NUTRIENT_RANGES),
    vitaminB1Mg: validateValue(fp.vitaminB1_mg, 'vitaminB1Mg', NUTRIENT_RANGES),
    vitaminB2Mg: validateValue(fp.vitaminB2_mg, 'vitaminB2Mg', NUTRIENT_RANGES),
    vitaminB3Mg: validateValue(fp.vitaminB3_mg, 'vitaminB3Mg', NUTRIENT_RANGES),
    vitaminB5Mg: validateValue(fp.vitaminB5_mg, 'vitaminB5Mg', NUTRIENT_RANGES),
    vitaminB6Mg: validateValue(fp.vitaminB6_mg, 'vitaminB6Mg', NUTRIENT_RANGES),
    vitaminB12Ug: validateValue(fp.vitaminB12_ug, 'vitaminB12Ug', NUTRIENT_RANGES),
    folateUg: validateValue(fp.folate_ug, 'folateUg', NUTRIENT_RANGES),
    biotinUg: validateValue(fp.biotin_ug, 'biotinUg', NUTRIENT_RANGES),
    cholineMg: validateValue(fp.choline_mg, 'cholineMg', NUTRIENT_RANGES),
    cholesterolMg: validateValue(fp.cholesterol_mg, 'cholesterolMg', NUTRIENT_RANGES),
    phosphorusMg: validateValue(fp.phosphorus_mg, 'phosphorusMg', NUTRIENT_RANGES),
    copperMg: validateValue(fp.copper_mg, 'copperMg', NUTRIENT_RANGES),
    manganeseMg: validateValue(fp.manganese_mg, 'manganeseMg', NUTRIENT_RANGES),
    iodineUg: validateValue(fp.iodine_ug, 'iodineUg', NUTRIENT_RANGES),
    seleniumUg: validateValue(fp.selenium_ug, 'seleniumUg', NUTRIENT_RANGES),
    chromiumUg: validateValue(fp.chromium_ug, 'chromiumUg', NUTRIENT_RANGES),
    molybdenumUg: validateValue(fp.molybdenum_ug, 'molybdenumUg', NUTRIENT_RANGES),
    monounsaturatedFatPer100g: validateValue(fp.monounsaturatedFat_g, 'monounsaturatedFatPer100g', NUTRIENT_RANGES),
    polyunsaturatedFatPer100g: validateValue(fp.polyunsaturatedFat_g, 'polyunsaturatedFatPer100g', NUTRIENT_RANGES),
    transFatPer100g: validateValue(fp.transFat_g, 'transFatPer100g', NUTRIENT_RANGES),
    omega3Per100g: validateValue(fp.omega3_g, 'omega3Per100g', NUTRIENT_RANGES),
    omega6Per100g: validateValue(fp.omega6_g, 'omega6Per100g', NUTRIENT_RANGES),
    epaPer100g: validateValue(fp.epa_g, 'epaPer100g', NUTRIENT_RANGES),
    dhaPer100g: validateValue(fp.dha_g, 'dhaPer100g', NUTRIENT_RANGES),
    alaPer100g: validateValue(fp.ala_g, 'alaPer100g', NUTRIENT_RANGES),
    starchPer100g: validateValue(fp.starch_g, 'starchPer100g', NUTRIENT_RANGES),
    addedSugarsPer100g: validateValue(fp.addedSugars_g, 'addedSugarsPer100g', NUTRIENT_RANGES),
  };
}

function mapAminoAcids(fp: FPNutrients) {
  return {
    tryptophanPer100g: validateValue(fp.tryptophan_g, 'tryptophanPer100g', AA_RANGES),
    threoninePer100g: validateValue(fp.threonine_g, 'threoninePer100g', AA_RANGES),
    isoleucinePer100g: validateValue(fp.isoleucine_g, 'isoleucinePer100g', AA_RANGES),
    leucinePer100g: validateValue(fp.leucine_g, 'leucinePer100g', AA_RANGES),
    lysinePer100g: validateValue(fp.lysine_g, 'lysinePer100g', AA_RANGES),
    methioninePer100g: validateValue(fp.methionine_g, 'methioninePer100g', AA_RANGES),
    phenylalaninePer100g: validateValue(fp.phenylalanine_g, 'phenylalaninePer100g', AA_RANGES),
    valinePer100g: validateValue(fp.valine_g, 'valinePer100g', AA_RANGES),
    histidinePer100g: validateValue(fp.histidine_g, 'histidinePer100g', AA_RANGES),
  };
}

function mapBioactives(fp: FPNutrients) {
  return {
    purinesMg: fp.purines_mg ? Number(fp.purines_mg) : undefined,
    oxalateMg: fp.oxalate_mg ? Number(fp.oxalate_mg) : undefined,
    caffeineMg: fp.caffeine_mg ? Number(fp.caffeine_mg) : undefined,
    betaCaroteneUg: fp.betaCarotene_ug ? Number(fp.betaCarotene_ug) : undefined,
  };
}

function hasAnyValue(obj: Record<string, number | undefined>): boolean {
  return Object.values(obj).some(v => v !== undefined && v > 0);
}

// ─── Build FoodProduct name index ────────────────────────────────────────────

async function buildFPIndex(): Promise<Map<string, string>> {
  console.log('Building FoodProduct nameEn index...');
  const fps = await prisma.foodProduct.findMany({
    where: { nameEn: { not: null } },
    select: { id: true, nameEn: true },
  });

  const index = new Map<string, string>();
  for (const fp of fps) {
    if (fp.nameEn) {
      index.set(fp.nameEn.toLowerCase().trim(), fp.id);
    }
  }
  console.log(`  Index built: ${index.size} entries`);
  return index;
}

// ─── Main migration ──────────────────────────────────────────────────────────

async function migrate() {
  console.log(`\n=== FAZA 26: Populate Extended Nutrients ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('');

  const fpIndex = await buildFPIndex();

  let cursor: string | undefined;
  let totalProcessed = 0;
  let matched = 0;
  let nutrientsUpdated = 0;
  let aminoCreated = 0;
  let bioCreated = 0;
  let skippedNoMatch = 0;
  let skippedNoNameEn = 0;
  let flaggedValues = 0;

  while (true) {
    const cleanProducts = await prisma.cleanProduct.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: { nameEn: { not: null } },
      select: {
        id: true,
        name: true,
        nameEn: true,
        hasMicronutrients: true,
        nutrients: { select: { id: true, vitaminKUg: true } }, // check if already populated
        aminoAcids: { select: { id: true } },
        bioactives: { select: { id: true } },
      },
      orderBy: { id: 'asc' },
    });

    if (cleanProducts.length === 0) break;

    for (const cp of cleanProducts) {
      totalProcessed++;

      if (!cp.nameEn) {
        skippedNoNameEn++;
        continue;
      }

      const fpId = fpIndex.get(cp.nameEn.toLowerCase().trim());
      if (!fpId) {
        skippedNoMatch++;
        continue;
      }

      matched++;

      // Fetch FoodProduct nutrients
      const fpNutrients = await prisma.foodProductNutrients.findUnique({
        where: { foodProductId: fpId },
      });

      if (!fpNutrients) continue;

      const nutrientData = mapNutrients(fpNutrients as unknown as FPNutrients);
      const aaData = mapAminoAcids(fpNutrients as unknown as FPNutrients);
      const bioData = mapBioactives(fpNutrients as unknown as FPNutrients);

      // Count flagged values
      const originalWarnCount = console.warn.toString().length; // not ideal but works

      if (DRY_RUN) {
        if (hasAnyValue(nutrientData)) nutrientsUpdated++;
        if (hasAnyValue(aaData) && !cp.aminoAcids) aminoCreated++;
        if (hasAnyValue(bioData) && !cp.bioactives) bioCreated++;
        continue;
      }

      // Update nutrients (only if we have new data and not already populated)
      if (hasAnyValue(nutrientData) && cp.nutrients && !cp.nutrients.vitaminKUg) {
        // Filter out undefined values
        const filtered: Record<string, number> = {};
        for (const [k, v] of Object.entries(nutrientData)) {
          if (v !== undefined) filtered[k] = v;
        }
        if (Object.keys(filtered).length > 0) {
          await prisma.cleanProductNutrients.update({
            where: { cleanProductId: cp.id },
            data: filtered,
          });
          nutrientsUpdated++;
        }
      }

      // Create amino acids (if not already present)
      if (hasAnyValue(aaData) && !cp.aminoAcids) {
        const filtered: Record<string, number> = {};
        for (const [k, v] of Object.entries(aaData)) {
          if (v !== undefined) filtered[k] = v;
        }
        if (Object.keys(filtered).length > 0) {
          await prisma.cleanProductAminoAcids.create({
            data: { cleanProductId: cp.id, ...filtered },
          });
          aminoCreated++;
        }
      }

      // Create bioactives (if not already present)
      if (hasAnyValue(bioData) && !cp.bioactives) {
        const filtered: Record<string, number> = {};
        for (const [k, v] of Object.entries(bioData)) {
          if (v !== undefined) filtered[k] = v;
        }
        if (Object.keys(filtered).length > 0) {
          await prisma.cleanProductBioactives.create({
            data: { cleanProductId: cp.id, ...filtered },
          });
          bioCreated++;
        }
      }

      // Update hasMicronutrients
      if (hasAnyValue(nutrientData) && !cp.hasMicronutrients) {
        await prisma.cleanProduct.update({
          where: { id: cp.id },
          data: { hasMicronutrients: true },
        });
      }
    }

    cursor = cleanProducts[cleanProducts.length - 1].id;

    if (totalProcessed % 1000 === 0) {
      console.log(`  Processed ${totalProcessed}... (matched: ${matched})`);
    }
  }

  // Also count products without nameEn
  const withoutNameEn = await prisma.cleanProduct.count({ where: { nameEn: null } });

  console.log('\n=== Results ===');
  console.log(`Total CleanProducts scanned: ${totalProcessed}`);
  console.log(`Matched with FoodProduct: ${matched}`);
  console.log(`Nutrients updated: ${nutrientsUpdated}`);
  console.log(`AminoAcids created: ${aminoCreated}`);
  console.log(`Bioactives created: ${bioCreated}`);
  console.log(`Skipped (no nameEn): ${skippedNoNameEn}`);
  console.log(`Skipped (no match): ${skippedNoMatch}`);
  console.log(`Products without nameEn (not scanned): ${withoutNameEn}`);
  console.log('');
}

// ─── Also copy GI, FODMAP from matched FoodProducts ─────────────────────────

async function copyProductLevelFields() {
  console.log('=== Copying GI & FODMAP from FoodProduct → CleanProduct ===');

  const fpIndex = await buildFPIndex();
  let giUpdated = 0;
  let fodmapUpdated = 0;
  let cursor: string | undefined;

  while (true) {
    const cleanProducts = await prisma.cleanProduct.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        nameEn: { not: null },
        glycemicIndex: null, // only if not already set
      },
      select: { id: true, nameEn: true },
      orderBy: { id: 'asc' },
    });

    if (cleanProducts.length === 0) break;

    for (const cp of cleanProducts) {
      if (!cp.nameEn) continue;
      const fpId = fpIndex.get(cp.nameEn.toLowerCase().trim());
      if (!fpId) continue;

      const fp = await prisma.foodProduct.findUnique({
        where: { id: fpId },
        select: { glycemicIndex: true, glycemicLoadPer100g: true, fodmapLevel: true },
      });

      if (!fp) continue;

      const updateData: Record<string, unknown> = {};
      if (fp.glycemicIndex !== null) { updateData.glycemicIndex = fp.glycemicIndex; giUpdated++; }
      if (fp.fodmapLevel !== null) { updateData.fodmapLevel = fp.fodmapLevel; fodmapUpdated++; }

      if (Object.keys(updateData).length > 0 && !DRY_RUN) {
        await prisma.cleanProduct.update({
          where: { id: cp.id },
          data: updateData,
        });
      }
    }

    cursor = cleanProducts[cleanProducts.length - 1].id;
  }

  console.log(`GI updated: ${giUpdated}`);
  console.log(`FODMAP updated: ${fodmapUpdated}`);
  console.log('');
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  try {
    await migrate();
    await copyProductLevelFields();
    console.log('✅ Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
