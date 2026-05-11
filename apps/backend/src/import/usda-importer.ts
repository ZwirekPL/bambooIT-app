/**
 * USDA FoodData Central Importer
 *
 * Imports food products from USDA FDC JSON downloads (SR Legacy + Foundation Foods).
 *
 * Data source: https://fdc.nal.usda.gov/download-datasets
 * License: Public domain (US government work, no copyright)
 *
 * Expected input format: USDA FDC "Full Download" JSON files
 * - SRLegacyFoods.json or FoodData_Central_sr_legacy_food_json_*.json
 * - FoundationFoods.json or FoodData_Central_foundation_food_json_*.json
 *
 * Each file contains an array of food objects under "SRLegacyFoods" or "FoundationFoods" key.
 */

import { prisma } from '@db';
import { buildNutrientLookup, USDA_CATEGORY_MAP } from './usda-nutrient-map';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsdaFoodNutrient {
  nutrient: {
    id: number;
    number: string;
    name: string;
    unitName: string;
  };
  amount?: number;
}

interface UsdaFoodPortion {
  measureUnit?: { name: string };
  portionDescription?: string;
  modifier?: string;
  gramWeight?: number;
  amount?: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  foodCategory?: { description: string };
  foodNutrients: UsdaFoodNutrient[];
  foodPortions?: UsdaFoodPortion[];
  scientificName?: string;
  ndbNumber?: number;
}

interface ImportProgress {
  jobId: string;
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  duplicates: number;
  errorLog: Array<{ fdcId: number; error: string }>;
}

// ─── Slug helper ──────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

// ─── Category seeding ─────────────────────────────────────────────────────────

async function ensureCategories(): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>();

  for (const [usdaName, slug] of Object.entries(USDA_CATEGORY_MAP)) {
    let category = await prisma.foodCategory.findUnique({ where: { slug } });
    if (!category) {
      category = await prisma.foodCategory.create({
        data: {
          name: polishCategoryName(slug),
          nameEn: usdaName,
          slug,
          sortOrder: 0,
        },
      });
    }
    categoryMap.set(usdaName, category.id);
  }

  return categoryMap;
}

function polishCategoryName(slug: string): string {
  const map: Record<string, string> = {
    'nabial-i-jaja': 'Nabiał i jaja',
    'przyprawy-i-ziola': 'Przyprawy i zioła',
    'zywnosc-dla-niemowlat': 'Żywność dla niemowląt',
    'tluszcze-i-oleje': 'Tłuszcze i oleje',
    'drob': 'Drób',
    'zupy-i-sosy': 'Zupy i sosy',
    'wedliny': 'Wędliny',
    'platki-sniadaniowe': 'Płatki śniadaniowe',
    'owoce-i-soki': 'Owoce i soki',
    'wieprzowina': 'Wieprzowina',
    'warzywa': 'Warzywa',
    'orzechy-i-nasiona': 'Orzechy i nasiona',
    'wolowina': 'Wołowina',
    'napoje': 'Napoje',
    'ryby-i-owoce-morza': 'Ryby i owoce morza',
    'straczkowe': 'Strączkowe',
    'baranina-i-dziczyzna': 'Baranina i dziczyzna',
    'pieczywo-i-wypieki': 'Pieczywo i wypieki',
    'slodycze': 'Słodycze',
    'zboza-i-makarony': 'Zboża i makarony',
    'fast-food': 'Fast food',
    'dania-gotowe': 'Dania gotowe',
    'przekaski': 'Przekąski',
    'inne': 'Inne',
    'dania-restauracyjne': 'Dania restauracyjne',
  };
  return map[slug] ?? slug;
}

// ─── Extract nutrients from USDA format ───────────────────────────────────────

function extractNutrients(foodNutrients: UsdaFoodNutrient[]): Record<string, number> {
  const lookup = buildNutrientLookup();
  const result: Record<string, number> = {};

  for (const fn of foodNutrients) {
    if (fn.amount === undefined || fn.amount === null) continue;
    const mapping = lookup.get(fn.nutrient.id);
    if (mapping) {
      result[mapping.field] = fn.amount * mapping.factor;
    }
  }

  // Compute salt from sodium if not present
  if (result['sodium_mg'] !== undefined && result['salt_g'] === undefined) {
    result['salt_g'] = result['sodium_mg'] * 2.5 / 1000;
  }

  return result;
}

// ─── Extract household measures from USDA portions ───────────────────────────

function extractMeasures(portions: UsdaFoodPortion[] | undefined): Array<{ name: string; nameEn: string; grams: number }> {
  if (!portions?.length) return [];

  const measures: Array<{ name: string; nameEn: string; grams: number }> = [];

  for (const p of portions) {
    if (!p.gramWeight || p.gramWeight <= 0) continue;

    const nameEn = [p.amount, p.measureUnit?.name, p.modifier, p.portionDescription]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!nameEn) continue;

    measures.push({
      name: nameEn, // Will be English initially; can be translated later
      nameEn,
      grams: p.gramWeight,
    });
  }

  return measures;
}

// ─── Quality score computation ────────────────────────────────────────────────

function computeQualityScore(nutrients: Record<string, number>): number {
  let score = 0;

  // Base macros present (+20)
  if (nutrients['kcal'] !== undefined) score += 5;
  if (nutrients['protein_g'] !== undefined) score += 5;
  if (nutrients['fat_g'] !== undefined) score += 5;
  if (nutrients['carbs_g'] !== undefined) score += 5;

  // Fiber and sugar (+10)
  if (nutrients['fiber_g'] !== undefined) score += 5;
  if (nutrients['sugars_g'] !== undefined) score += 5;

  // Fat breakdown (+10)
  if (nutrients['saturatedFat_g'] !== undefined) score += 5;
  if (nutrients['monounsaturatedFat_g'] !== undefined || nutrients['polyunsaturatedFat_g'] !== undefined) score += 5;

  // Key minerals (+15)
  if (nutrients['sodium_mg'] !== undefined) score += 3;
  if (nutrients['potassium_mg'] !== undefined) score += 3;
  if (nutrients['calcium_mg'] !== undefined) score += 3;
  if (nutrients['iron_mg'] !== undefined) score += 3;
  if (nutrients['magnesium_mg'] !== undefined) score += 3;

  // Key vitamins (+15)
  if (nutrients['vitaminA_ug'] !== undefined) score += 3;
  if (nutrients['vitaminC_mg'] !== undefined) score += 3;
  if (nutrients['vitaminD_ug'] !== undefined) score += 3;
  if (nutrients['vitaminB12_ug'] !== undefined) score += 3;
  if (nutrients['folate_ug'] !== undefined) score += 3;

  // Amino acids present (+10)
  const aminoAcids = ['tryptophan_g', 'threonine_g', 'isoleucine_g', 'leucine_g', 'lysine_g', 'methionine_g', 'phenylalanine_g', 'valine_g', 'histidine_g'];
  const aaCount = aminoAcids.filter(aa => nutrients[aa] !== undefined).length;
  score += Math.min(10, Math.round(aaCount * 10 / 9));

  // Cholesterol (+5)
  if (nutrients['cholesterol_mg'] !== undefined) score += 5;

  // Water (+5)
  if (nutrients['water_g'] !== undefined) score += 5;

  // Omega fatty acids (+5)
  if (nutrients['epa_g'] !== undefined || nutrients['dha_g'] !== undefined || nutrients['ala_g'] !== undefined) score += 5;

  return Math.min(100, score);
}

// ─── Data validation ──────────────────────────────────────────────────────────

interface ValidationIssue {
  field: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  code: string;
  description: string;
  suggestedFix?: string;
}

function validateNutrients(nutrients: Record<string, number>, fdcId: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check negative values
  for (const [field, value] of Object.entries(nutrients)) {
    if (value < 0) {
      issues.push({
        field,
        severity: 'ERROR',
        code: 'NEGATIVE_VALUE',
        description: `Negative value ${value} for ${field} in FDC ${fdcId}`,
        suggestedFix: 'Set to 0 or investigate source data',
      });
    }
  }

  // kcal consistency check (Atwater factors: P*4 + C*4 + F*9 + Alc*7)
  const kcal = nutrients['kcal'] ?? 0;
  const protein = nutrients['protein_g'] ?? 0;
  const fat = nutrients['fat_g'] ?? 0;
  const carbs = nutrients['carbs_g'] ?? 0;
  const alcohol = nutrients['alcohol_g'] ?? 0;
  const computed = protein * 4 + carbs * 4 + fat * 9 + alcohol * 7;

  if (kcal > 0 && Math.abs(kcal - computed) / kcal > 0.25) {
    issues.push({
      field: 'kcal',
      severity: 'WARNING',
      code: 'KCAL_MISMATCH',
      description: `kcal ${kcal} vs computed ${Math.round(computed)} (diff > 25%) in FDC ${fdcId}`,
      suggestedFix: 'Verify source data; may use specific Atwater factors',
    });
  }

  // Macros should not exceed 100g per 100g
  if (protein > 100) {
    issues.push({ field: 'protein_g', severity: 'WARNING', code: 'SUSPICIOUS_VALUE', description: `Protein ${protein}g > 100g per 100g in FDC ${fdcId}` });
  }
  if (fat > 100) {
    issues.push({ field: 'fat_g', severity: 'WARNING', code: 'SUSPICIOUS_VALUE', description: `Fat ${fat}g > 100g per 100g in FDC ${fdcId}` });
  }
  if (carbs > 100) {
    issues.push({ field: 'carbs_g', severity: 'WARNING', code: 'SUSPICIOUS_VALUE', description: `Carbs ${carbs}g > 100g per 100g in FDC ${fdcId}` });
  }

  return issues;
}

// ─── Main import function ─────────────────────────────────────────────────────

export async function importUsdaFile(
  filePath: string,
  datasetType: 'sr_legacy' | 'foundation',
  userId?: string,
): Promise<ImportProgress> {
  // Create import job
  const job = await prisma.importJob.create({
    data: {
      source: `usda_${datasetType}`,
      status: 'RUNNING',
      startedAt: new Date(),
      createdBy: userId,
      config: { filePath, datasetType } as object,
    },
  });

  const progress: ImportProgress = {
    jobId: job.id,
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    duplicates: 0,
    errorLog: [],
  };

  try {
    // Read and parse JSON file
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    const key = datasetType === 'sr_legacy' ? 'SRLegacyFoods' : 'FoundationFoods';
    const foods: UsdaFood[] = data[key] ?? data;
    if (!Array.isArray(foods)) {
      throw new Error(`Expected array at key "${key}" or root`);
    }

    progress.total = foods.length;

    // Ensure categories exist
    const categoryMap = await ensureCategories();

    // Process in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < foods.length; i += BATCH_SIZE) {
      const batch = foods.slice(i, i + BATCH_SIZE);
      await processBatch(batch, categoryMap, datasetType, progress);

      // Update job progress
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          importedCount: progress.imported,
          skippedCount: progress.skipped,
          errorCount: progress.errors,
          duplicateCount: progress.duplicates,
          totalRecords: progress.total,
        },
      });
    }

    // Mark job as completed
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        importedCount: progress.imported,
        skippedCount: progress.skipped,
        errorCount: progress.errors,
        duplicateCount: progress.duplicates,
        totalRecords: progress.total,
        errorLog: progress.errorLog.length > 0 ? JSON.parse(JSON.stringify(progress.errorLog)) : undefined,
        summary: JSON.parse(JSON.stringify({
          datasetType,
          totalRecords: progress.total,
          imported: progress.imported,
          skipped: progress.skipped,
          errors: progress.errors,
          duplicates: progress.duplicates,
        })),
      },
    });
  } catch (err) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorLog: JSON.parse(JSON.stringify([{ error: err instanceof Error ? err.message : String(err) }])),
      },
    });
    throw err;
  }

  return progress;
}

// ─── Batch processor ──────────────────────────────────────────────────────────

async function processBatch(
  foods: UsdaFood[],
  categoryMap: Map<string, string>,
  datasetType: string,
  progress: ImportProgress,
) {
  for (const food of foods) {
    try {
      const sourceId = String(food.fdcId);

      // Skip duplicates by source + sourceId
      const existing = await prisma.foodProduct.findUnique({
        where: { source_sourceId: { source: `usda_${datasetType}`, sourceId } },
      });
      if (existing) {
        progress.duplicates++;
        progress.skipped++;
        continue;
      }

      // Extract data
      const nutrients = extractNutrients(food.foodNutrients);
      const measures = extractMeasures(food.foodPortions);

      // Skip if no kcal data
      if (nutrients['kcal'] === undefined) {
        progress.skipped++;
        continue;
      }

      // Validate
      const issues = validateNutrients(nutrients, food.fdcId);

      // Determine category
      const categoryName = food.foodCategory?.description ?? 'Inne';
      const categoryId = categoryMap.get(categoryName) ?? categoryMap.get('Inne');

      // Quality score
      const qualityScore = computeQualityScore(nutrients);

      // Generate slug
      const baseSlug = slugify(food.description);
      let slug = baseSlug;
      let slugIdx = 2;
      while (await prisma.foodProduct.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${slugIdx++}`;
      }

      // Create product
      const product = await prisma.foodProduct.create({
        data: {
          source: `usda_${datasetType}`,
          sourceId,
          name: food.description,
          nameEn: food.description,
          slug,
          categoryId,
          languageCode: 'en',
          qualityScore,
          verificationStatus: qualityScore >= 60 ? 'AUTO_VERIFIED' : 'UNVERIFIED',
          nutrients: {
            create: {
              kcal: nutrients['kcal'] ?? 0,
              protein_g: nutrients['protein_g'] ?? 0,
              fat_g: nutrients['fat_g'] ?? 0,
              carbs_g: nutrients['carbs_g'] ?? 0,
              saturatedFat_g: nutrients['saturatedFat_g'],
              monounsaturatedFat_g: nutrients['monounsaturatedFat_g'],
              polyunsaturatedFat_g: nutrients['polyunsaturatedFat_g'],
              transFat_g: nutrients['transFat_g'],
              sugars_g: nutrients['sugars_g'],
              fiber_g: nutrients['fiber_g'],
              starch_g: nutrients['starch_g'],
              salt_g: nutrients['salt_g'],
              sodium_mg: nutrients['sodium_mg'],
              potassium_mg: nutrients['potassium_mg'],
              calcium_mg: nutrients['calcium_mg'],
              magnesium_mg: nutrients['magnesium_mg'],
              phosphorus_mg: nutrients['phosphorus_mg'],
              iron_mg: nutrients['iron_mg'],
              zinc_mg: nutrients['zinc_mg'],
              copper_mg: nutrients['copper_mg'],
              manganese_mg: nutrients['manganese_mg'],
              selenium_ug: nutrients['selenium_ug'],
              vitaminA_ug: nutrients['vitaminA_ug'],
              betaCarotene_ug: nutrients['betaCarotene_ug'],
              vitaminD_ug: nutrients['vitaminD_ug'],
              vitaminE_mg: nutrients['vitaminE_mg'],
              vitaminK_ug: nutrients['vitaminK_ug'],
              vitaminC_mg: nutrients['vitaminC_mg'],
              vitaminB1_mg: nutrients['vitaminB1_mg'],
              vitaminB2_mg: nutrients['vitaminB2_mg'],
              vitaminB3_mg: nutrients['vitaminB3_mg'],
              vitaminB5_mg: nutrients['vitaminB5_mg'],
              vitaminB6_mg: nutrients['vitaminB6_mg'],
              folate_ug: nutrients['folate_ug'],
              vitaminB12_ug: nutrients['vitaminB12_ug'],
              choline_mg: nutrients['choline_mg'],
              cholesterol_mg: nutrients['cholesterol_mg'],
              water_g: nutrients['water_g'],
              alcohol_g: nutrients['alcohol_g'],
              caffeine_mg: nutrients['caffeine_mg'],
              ash_g: nutrients['ash_g'],
              tryptophan_g: nutrients['tryptophan_g'],
              threonine_g: nutrients['threonine_g'],
              isoleucine_g: nutrients['isoleucine_g'],
              leucine_g: nutrients['leucine_g'],
              lysine_g: nutrients['lysine_g'],
              methionine_g: nutrients['methionine_g'],
              phenylalanine_g: nutrients['phenylalanine_g'],
              valine_g: nutrients['valine_g'],
              histidine_g: nutrients['histidine_g'],
              epa_g: nutrients['epa_g'],
              dha_g: nutrients['dha_g'],
              ala_g: nutrients['ala_g'],
            },
          },
          ...(measures.length > 0 ? {
            householdMeasures: {
              create: measures.map((m, idx) => ({
                name: m.name,
                nameEn: m.nameEn,
                grams: m.grams,
                source: 'usda',
                sortOrder: idx,
              })),
            },
          } : {}),
          // Store source metadata for traceability
          sourceMeta: {
            create: {
              source: `usda_${datasetType}`,
              sourceId,
              sourceUrl: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}/nutrients`,
              sourceLicense: 'public_domain',
              sourceVersion: datasetType === 'sr_legacy' ? 'SR Legacy 2021-10' : 'Foundation Foods 2024',
            },
          },
        },
      });

      // Log quality issues
      for (const issue of issues) {
        await prisma.dataQualityIssue.create({
          data: {
            entityType: 'FoodProduct',
            entityId: product.id,
            field: issue.field,
            severity: issue.severity,
            issueCode: issue.code,
            description: issue.description,
            suggestedFix: issue.suggestedFix,
            importJobId: progress.jobId,
          },
        });
      }

      progress.imported++;
    } catch (err) {
      progress.errors++;
      progress.errorLog.push({
        fdcId: food.fdcId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ─── Convenience function to import from data directory ──────────────────────

export async function importUsdaFromDirectory(
  dirPath: string,
  userId?: string,
): Promise<ImportProgress[]> {
  const results: ImportProgress[] = [];

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (!file.endsWith('.json')) continue;

    let datasetType: 'sr_legacy' | 'foundation';

    if (file.toLowerCase().includes('sr_legacy') || file.toLowerCase().includes('srlegacy')) {
      datasetType = 'sr_legacy';
    } else if (file.toLowerCase().includes('foundation')) {
      datasetType = 'foundation';
    } else {
      continue; // Skip unknown files
    }

    console.log(`[usda-import] Importing ${file} as ${datasetType}...`);
    const result = await importUsdaFile(fullPath, datasetType, userId);
    results.push(result);
    console.log(`[usda-import] Done: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`);
  }

  return results;
}
