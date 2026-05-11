import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

// ─── types ────────────────────────────────────────────────────────────────────

export interface CreateCleanProductInput {
  name: string;
  nameEn?: string;
  type: 'BASE' | 'RETAIL' | 'MANUAL';
  brand?: string;
  barcode?: string;
  category: string;
  subcategory?: string;
  description?: string;
  imageUrl?: string;
  sourcePrimary: 'ILEWAZY' | 'USDA' | 'OPENFOODFACTS' | 'MANUAL';
  sourceSecondary?: 'ILEWAZY' | 'USDA' | 'OPENFOODFACTS' | 'MANUAL';
  sourceUrl?: string;
  sourceId?: string;
  qualityScore?: number;
  hasMicronutrients?: boolean;
  glycemicIndex?: number;
  glycemicLoadPer100g?: number;
  fodmapLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
  packageWeightG?: number;
  servingWeightG?: number;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'FLAGGED';
  createdByUserId?: string;
  nutrients: NutrientsInput;
  aminoAcids?: AminoAcidsInput;
  bioactives?: BioactivesInput;
  portions?: PortionInput[];
  allergens?: AllergenInput[];
  dietFlags?: DietFlagInput[];
}

export interface UpdateCleanProductInput {
  name?: string;
  nameEn?: string;
  brand?: string;
  barcode?: string | null;
  category?: string;
  subcategory?: string;
  description?: string;
  imageUrl?: string;
  qualityScore?: number;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'FLAGGED';
  glycemicIndex?: number | null;
  glycemicLoadPer100g?: number | null;
  fodmapLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN' | null;
  packageWeightG?: number | null;
  servingWeightG?: number | null;
  nutrients?: NutrientsInput;
  aminoAcids?: AminoAcidsInput;
  bioactives?: BioactivesInput;
}

export interface NutrientsInput {
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g?: number;
  sugarsPer100g?: number;
  saltPer100g?: number;
  saturatedFatPer100g?: number;
  // Fat fractions (26.B)
  monounsaturatedFatPer100g?: number;
  polyunsaturatedFatPer100g?: number;
  transFatPer100g?: number;
  omega3Per100g?: number;
  omega6Per100g?: number;
  epaPer100g?: number;
  dhaPer100g?: number;
  alaPer100g?: number;
  // Carb fractions (26.C)
  starchPer100g?: number;
  addedSugarsPer100g?: number;
  // Minerals
  sodiumMg?: number;
  potassiumMg?: number;
  calciumMg?: number;
  magnesiumMg?: number;
  phosphorusMg?: number;
  ironMg?: number;
  zincMg?: number;
  copperMg?: number;
  manganeseMg?: number;
  iodineUg?: number;
  seleniumUg?: number;
  chromiumUg?: number;
  molybdenumUg?: number;
  fluorideUg?: number;
  chlorideMg?: number;
  // Fat-soluble vitamins
  vitaminAUg?: number;
  vitaminDUg?: number;
  vitaminEMg?: number;
  vitaminKUg?: number;
  // Water-soluble vitamins
  vitaminCMg?: number;
  vitaminB1Mg?: number;
  vitaminB2Mg?: number;
  vitaminB3Mg?: number;
  vitaminB5Mg?: number;
  vitaminB6Mg?: number;
  folateUg?: number;
  vitaminB12Ug?: number;
  biotinUg?: number;
  cholineMg?: number;
  // Other
  cholesterolMg?: number;
}

export interface AminoAcidsInput {
  tryptophanPer100g?: number;
  threoninePer100g?: number;
  isoleucinePer100g?: number;
  leucinePer100g?: number;
  lysinePer100g?: number;
  methioninePer100g?: number;
  phenylalaninePer100g?: number;
  valinePer100g?: number;
  histidinePer100g?: number;
}

export interface BioactivesInput {
  purinesMg?: number;
  oxalateMg?: number;
  caffeineMg?: number;
  polyphenolsMg?: number;
  betaCaroteneUg?: number;
  lycopeneUg?: number;
  luteinZeaxanthinUg?: number;
}

export interface PortionInput {
  portionName: string;
  weightG: number;
  source?: 'ILEWAZY' | 'OPENFOODFACTS' | 'MANUAL';
}

export interface AllergenInput {
  allergenCode: string;
  presence: 'CONTAINS' | 'MAY_CONTAIN' | 'FREE' | 'UNKNOWN';
  source?: 'AUTO_RULE' | 'MANUAL' | 'HEURISTIC' | 'SOURCE_DATA';
  confidence?: number;
}

export interface DietFlagInput {
  flagCode: string;
  value: boolean;
  source?: 'AUTO_RULE' | 'MANUAL' | 'HEURISTIC' | 'SOURCE_DATA';
  confidence?: number;
}

export interface ListCleanProductsOptions {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  category?: string;
  verificationStatus?: string;
  allergenFree?: string[];
  dietFlags?: string[];
  minKcal?: number;
  maxKcal?: number;
  minQuality?: number;
  maxQuality?: number;
}

// ─── slug helper ──────────────────────────────────────────────────────────────

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

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  const existing = await prisma.cleanProduct.findUnique({ where: { slug } });
  if (!existing) return slug;
  let i = 2;
  while (await prisma.cleanProduct.findUnique({ where: { slug: `${slug}-${i}` } })) {
    i++;
  }
  return `${slug}-${i}`;
}

// ─── select ───────────────────────────────────────────────────────────────────

const cleanProductSelect = {
  id: true,
  name: true,
  nameEn: true,
  slug: true,
  type: true,
  brand: true,
  barcode: true,
  category: true,
  subcategory: true,
  description: true,
  imageUrl: true,
  sourcePrimary: true,
  sourceSecondary: true,
  sourceUrl: true,
  sourceId: true,
  qualityScore: true,
  verificationStatus: true,
  hasMicronutrients: true,
  glycemicIndex: true,
  glycemicLoadPer100g: true,
  fodmapLevel: true,
  packageWeightG: true,
  servingWeightG: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  nutrients: true,
  aminoAcids: true,
  bioactives: true,
  portions: true,
  allergens: true,
  dietFlags: true,
} satisfies Prisma.CleanProductSelect;

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listCleanProducts(opts: ListCleanProductsOptions) {
  const skip = (opts.page - 1) * opts.limit;

  const where: Prisma.CleanProductWhereInput = {
    ...(opts.search ? {
      OR: buildSearchVariants(opts.search).flatMap((v) => [
        { name: { contains: v, mode: 'insensitive' as const } },
        { nameEn: { contains: v, mode: 'insensitive' as const } },
        { brand: { contains: v, mode: 'insensitive' as const } },
      ]),
    } : {}),
    ...(opts.type ? { type: opts.type as Prisma.EnumCleanProductTypeFilter<'CleanProduct'> } : {}),
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.verificationStatus ? { verificationStatus: opts.verificationStatus as Prisma.EnumCleanVerificationStatusFilter<'CleanProduct'> } : {}),
    ...(opts.minKcal !== undefined || opts.maxKcal !== undefined ? {
      nutrients: {
        ...(opts.minKcal !== undefined ? { kcalPer100g: { gte: opts.minKcal } } : {}),
        ...(opts.maxKcal !== undefined ? { kcalPer100g: { lte: opts.maxKcal } } : {}),
      },
    } : {}),
    ...(opts.minQuality !== undefined || opts.maxQuality !== undefined ? {
      qualityScore: {
        ...(opts.minQuality !== undefined ? { gte: opts.minQuality } : {}),
        ...(opts.maxQuality !== undefined ? { lte: opts.maxQuality } : {}),
      },
    } : {}),
    ...(opts.allergenFree?.length ? {
      AND: opts.allergenFree.map(code => ({
        allergens: { none: { allergenCode: code, presence: 'CONTAINS' } },
      })),
    } : {}),
    ...(opts.dietFlags?.length ? {
      AND: opts.dietFlags.map(code => ({
        dietFlags: { some: { flagCode: code, value: true } },
      })),
    } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.cleanProduct.findMany({
      where,
      skip,
      take: opts.limit,
      orderBy: [{ qualityScore: 'desc' }, { name: 'asc' }],
      select: cleanProductSelect,
    }),
    prisma.cleanProduct.count({ where }),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}

// ─── get by id ────────────────────────────────────────────────────────────────

export async function getCleanProductById(id: string) {
  const item = await prisma.cleanProduct.findUnique({
    where: { id },
    select: {
      ...cleanProductSelect,
      _count: { select: { recipeIngredients: true } },
    },
  });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Clean product not found');
  return { ...item, recipeUsageCount: item._count.recipeIngredients };
}

// ─── stats ────────────────────────────────────────────────────────────────────

export async function getProductStats() {
  const [total, baseCount, retailCount, manualCount, verifiedCount, unverifiedCount, flaggedCount, withMicroCount, avgQuality] = await prisma.$transaction([
    prisma.cleanProduct.count(),
    prisma.cleanProduct.count({ where: { type: 'BASE' } }),
    prisma.cleanProduct.count({ where: { type: 'RETAIL' } }),
    prisma.cleanProduct.count({ where: { type: 'MANUAL' } }),
    prisma.cleanProduct.count({ where: { verificationStatus: 'VERIFIED' } }),
    prisma.cleanProduct.count({ where: { verificationStatus: 'UNVERIFIED' } }),
    prisma.cleanProduct.count({ where: { verificationStatus: 'FLAGGED' } }),
    prisma.cleanProduct.count({ where: { hasMicronutrients: true } }),
    prisma.cleanProduct.aggregate({ _avg: { qualityScore: true } }),
  ]);

  return {
    total,
    byType: { BASE: baseCount, RETAIL: retailCount, MANUAL: manualCount },
    byVerification: { VERIFIED: verifiedCount, UNVERIFIED: unverifiedCount, FLAGGED: flaggedCount },
    withMicro: withMicroCount,
    withoutMicro: total - withMicroCount,
    avgQualityScore: Math.round(avgQuality._avg.qualityScore ?? 0),
  };
}

// ─── search ───────────────────────────────────────────────────────────────────

export async function getDistinctCategories(): Promise<string[]> {
  const results = await prisma.cleanProduct.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return results.map((r) => r.category);
}

// Strip common Polish suffixes to get a searchable stem prefix.
// E.g. "banany" → "banan", "płatków" → "płatk", "jabłka" → "jabłk"
function polishStem(word: string): string {
  const w = word.toLowerCase().trim();
  // Ordered from longest to shortest suffix so the first match wins.
  const suffixes = [
    'owego', 'owych', 'owej', 'owym', 'owymi',
    'kami', 'ków', 'kom', 'kach',
    'ami', 'ach', 'owi', 'iem', 'iem',
    'ów', 'om', 'ek', 'ki', 'ce', 'ów',
    'ę', 'ą', 'y', 'i', 'e', 'u', 'o', 'a',
  ];
  // Only strip if remaining stem would be at least 3 chars.
  for (const s of suffixes) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      return w.slice(0, -s.length);
    }
  }
  return w;
}

export function buildSearchVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const stem = polishStem(trimmed);
  // Return unique variants: original query + stem (if different)
  const variants = [trimmed];
  if (stem !== trimmed.toLowerCase()) {
    variants.push(stem);
  }
  return variants;
}

export async function searchCleanProducts(query: string, limit: number = 20, type?: string, category?: string) {
  const variants = buildSearchVariants(query);
  const nameConditions = variants.flatMap((v) => [
    { name: { contains: v, mode: 'insensitive' as const } },
    { nameEn: { contains: v, mode: 'insensitive' as const } },
    { brand: { contains: v, mode: 'insensitive' as const } },
  ]);

  return prisma.cleanProduct.findMany({
    where: {
      ...(type ? { type: type as Prisma.EnumCleanProductTypeFilter<'CleanProduct'> } : {}),
      ...(category ? { category } : {}),
      OR: nameConditions,
    },
    take: limit,
    orderBy: [{ qualityScore: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      slug: true,
      type: true,
      brand: true,
      category: true,
      nutrients: {
        select: {
          kcalPer100g: true,
          proteinPer100g: true,
          fatPer100g: true,
          carbsPer100g: true,
        },
      },
      portions: {
        select: {
          id: true,
          portionName: true,
          weightG: true,
        },
      },
    },
  });
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createCleanProduct(input: CreateCleanProductInput) {
  const slug = await uniqueSlug(input.name);

  return prisma.cleanProduct.create({
    data: {
      name: input.name,
      nameEn: input.nameEn,
      slug,
      type: input.type,
      brand: input.brand,
      barcode: input.barcode,
      category: input.category,
      subcategory: input.subcategory,
      description: input.description,
      imageUrl: input.imageUrl,
      sourcePrimary: input.sourcePrimary,
      sourceSecondary: input.sourceSecondary,
      sourceUrl: input.sourceUrl,
      sourceId: input.sourceId,
      qualityScore: input.qualityScore ?? 70,
      verificationStatus: input.verificationStatus ?? 'UNVERIFIED',
      hasMicronutrients: input.hasMicronutrients ?? false,
      glycemicIndex: input.glycemicIndex,
      glycemicLoadPer100g: input.glycemicLoadPer100g,
      fodmapLevel: input.fodmapLevel,
      packageWeightG: input.packageWeightG,
      servingWeightG: input.servingWeightG,
      createdByUserId: input.createdByUserId,
      nutrients: { create: input.nutrients },
      ...(input.aminoAcids ? { aminoAcids: { create: input.aminoAcids } } : {}),
      ...(input.bioactives ? { bioactives: { create: input.bioactives } } : {}),
      ...(input.portions?.length ? {
        portions: { create: input.portions.map(p => ({ ...p, source: p.source ?? 'MANUAL' })) },
      } : {}),
      ...(input.allergens?.length ? {
        allergens: { create: input.allergens },
      } : {}),
      ...(input.dietFlags?.length ? {
        dietFlags: { create: input.dietFlags },
      } : {}),
    },
    select: cleanProductSelect,
  });
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateCleanProduct(id: string, input: UpdateCleanProductInput) {
  await getCleanProductById(id);

  return prisma.cleanProduct.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.subcategory !== undefined ? { subcategory: input.subcategory } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.qualityScore !== undefined ? { qualityScore: input.qualityScore } : {}),
      ...(input.packageWeightG !== undefined ? { packageWeightG: input.packageWeightG } : {}),
      ...(input.servingWeightG !== undefined ? { servingWeightG: input.servingWeightG } : {}),
      ...(input.verificationStatus !== undefined ? {
        verificationStatus: input.verificationStatus as Prisma.EnumCleanVerificationStatusFieldUpdateOperationsInput['set'],
      } : {}),
      ...(input.glycemicIndex !== undefined ? { glycemicIndex: input.glycemicIndex } : {}),
      ...(input.glycemicLoadPer100g !== undefined ? { glycemicLoadPer100g: input.glycemicLoadPer100g } : {}),
      ...(input.fodmapLevel !== undefined ? { fodmapLevel: input.fodmapLevel } : {}),
      ...(input.nutrients ? {
        nutrients: {
          upsert: {
            create: input.nutrients,
            update: input.nutrients,
          },
        },
      } : {}),
      ...(input.aminoAcids ? {
        aminoAcids: {
          upsert: {
            create: input.aminoAcids,
            update: input.aminoAcids,
          },
        },
      } : {}),
      ...(input.bioactives ? {
        bioactives: {
          upsert: {
            create: input.bioactives,
            update: input.bioactives,
          },
        },
      } : {}),
    },
    select: cleanProductSelect,
  });
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteCleanProduct(id: string) {
  await getCleanProductById(id);
  await prisma.cleanProduct.delete({ where: { id } });
  return { id };
}

// ─── bulk actions ─────────────────────────────────────────────────────────────

export type BulkAction = 'verify' | 'flag' | 'unverify' | 'delete' | 'changeCategory';

export interface BulkActionInput {
  ids: string[];
  action: BulkAction;
  category?: string; // required when action === 'changeCategory'
}

export async function bulkActionCleanProducts(input: BulkActionInput) {
  const { ids, action, category } = input;

  if (action === 'delete') {
    const result = await prisma.cleanProduct.deleteMany({
      where: { id: { in: ids } },
    });
    return { affected: result.count };
  }

  if (action === 'changeCategory') {
    if (!category) throw new AppError(400, 'VALIDATION_ERROR', 'Category is required for changeCategory action');
    const result = await prisma.cleanProduct.updateMany({
      where: { id: { in: ids } },
      data: { category },
    });
    return { affected: result.count };
  }

  const statusMap: Record<string, string> = {
    verify: 'VERIFIED',
    flag: 'FLAGGED',
    unverify: 'UNVERIFIED',
  };

  const newStatus = statusMap[action];
  if (!newStatus) throw new AppError(400, 'VALIDATION_ERROR', `Unknown bulk action: ${action}`);

  const result = await prisma.cleanProduct.updateMany({
    where: { id: { in: ids } },
    data: { verificationStatus: newStatus as 'VERIFIED' | 'UNVERIFIED' | 'FLAGGED' },
  });
  return { affected: result.count };
}

// ─── find duplicates ─────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DuplicateGroup {
  normalizedName: string;
  products: Array<{
    id: string;
    name: string;
    nameEn: string | null;
    type: string;
    brand: string | null;
    category: string;
    qualityScore: number;
    verificationStatus: string;
    sourcePrimary: string;
    hasMicronutrients: boolean;
    nutrients: { kcalPer100g: number; proteinPer100g: number; fatPer100g: number; carbsPer100g: number } | null;
  }>;
}

export async function findDuplicates(opts: { page: number; limit: number; minGroupSize?: number; category?: string }): Promise<{ groups: DuplicateGroup[]; total: number }> {
  const minSize = opts.minGroupSize ?? 2;

  const where: Prisma.CleanProductWhereInput = opts.category ? { category: opts.category } : {};

  const products = await prisma.cleanProduct.findMany({
    where,
    select: {
      id: true,
      name: true,
      nameEn: true,
      type: true,
      brand: true,
      category: true,
      qualityScore: true,
      verificationStatus: true,
      sourcePrimary: true,
      hasMicronutrients: true,
      nutrients: {
        select: {
          kcalPer100g: true,
          proteinPer100g: true,
          fatPer100g: true,
          carbsPer100g: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Group by normalized name
  const grouped = new Map<string, DuplicateGroup['products']>();
  for (const p of products) {
    const key = normalizeName(p.name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({
      id: p.id,
      name: p.name,
      nameEn: p.nameEn,
      type: p.type,
      brand: p.brand,
      category: p.category,
      qualityScore: p.qualityScore,
      verificationStatus: p.verificationStatus,
      sourcePrimary: p.sourcePrimary,
      hasMicronutrients: p.hasMicronutrients,
      nutrients: p.nutrients ? {
        kcalPer100g: Number(p.nutrients.kcalPer100g),
        proteinPer100g: Number(p.nutrients.proteinPer100g),
        fatPer100g: Number(p.nutrients.fatPer100g),
        carbsPer100g: Number(p.nutrients.carbsPer100g),
      } : null,
    });
  }

  // Filter groups with >= minSize entries
  const duplicateGroups: DuplicateGroup[] = [];
  for (const [key, items] of grouped) {
    if (items.length >= minSize) {
      duplicateGroups.push({ normalizedName: key, products: items });
    }
  }

  // Sort by group size desc (biggest duplicates first)
  duplicateGroups.sort((a, b) => b.products.length - a.products.length);

  const total = duplicateGroups.length;
  const skip = (opts.page - 1) * opts.limit;
  const paged = duplicateGroups.slice(skip, skip + opts.limit);

  return { groups: paged, total };
}

// ─── merge products ──────────────────────────────────────────────────────────

export interface MergeProductsInput {
  targetId: string;
  sourceId: string;
  fieldsFromSource?: string[]; // field names to copy from source to target
}

export async function mergeProducts(input: MergeProductsInput) {
  const { targetId, sourceId, fieldsFromSource } = input;

  if (targetId === sourceId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Target and source must be different products');
  }

  const [target, source] = await Promise.all([
    prisma.cleanProduct.findUnique({
      where: { id: targetId },
      include: { nutrients: true, portions: true, allergens: true, dietFlags: true },
    }),
    prisma.cleanProduct.findUnique({
      where: { id: sourceId },
      include: { nutrients: true, portions: true, allergens: true, dietFlags: true },
    }),
  ]);

  if (!target) throw new AppError(404, 'NOT_FOUND', 'Target product not found');
  if (!source) throw new AppError(404, 'NOT_FOUND', 'Source product not found');

  // Build update data from selected source fields
  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    'name', 'nameEn', 'brand', 'barcode', 'category', 'subcategory',
    'description', 'imageUrl', 'packageWeightG', 'servingWeightG',
  ];

  if (fieldsFromSource?.length) {
    for (const field of fieldsFromSource) {
      if (allowedFields.includes(field)) {
        updateData[field] = (source as Record<string, unknown>)[field];
      }
      if (field === 'nutrients' && source.nutrients) {
        // Will be handled separately
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update target with selected source fields
    if (Object.keys(updateData).length > 0) {
      await tx.cleanProduct.update({
        where: { id: targetId },
        data: updateData,
      });
    }

    // 2. Copy nutrients from source if requested
    if (fieldsFromSource?.includes('nutrients') && source.nutrients && target.nutrients) {
      const { id: _id, cleanProductId: _cid, ...nutrientData } = source.nutrients;
      await tx.cleanProductNutrients.update({
        where: { cleanProductId: targetId },
        data: nutrientData,
      });
    }

    // 3. Move unique portions from source to target
    const existingPortionNames = new Set(target.portions.map(p => p.portionName));
    for (const portion of source.portions) {
      if (!existingPortionNames.has(portion.portionName)) {
        await tx.cleanProductPortion.create({
          data: {
            cleanProductId: targetId,
            portionName: portion.portionName,
            weightG: portion.weightG,
            source: portion.source,
          },
        });
      }
    }

    // 4. Move unique allergens from source to target
    const existingAllergens = new Set(target.allergens.map(a => a.allergenCode));
    for (const allergen of source.allergens) {
      if (!existingAllergens.has(allergen.allergenCode)) {
        await tx.cleanProductAllergen.create({
          data: {
            cleanProductId: targetId,
            allergenCode: allergen.allergenCode,
            presence: allergen.presence,
            source: allergen.source,
            confidence: allergen.confidence,
          },
        });
      }
    }

    // 5. Move unique diet flags from source to target
    const existingFlags = new Set(target.dietFlags.map(f => f.flagCode));
    for (const flag of source.dietFlags) {
      if (!existingFlags.has(flag.flagCode)) {
        await tx.cleanProductDietFlag.create({
          data: {
            cleanProductId: targetId,
            flagCode: flag.flagCode,
            value: flag.value,
            source: flag.source,
            confidence: flag.confidence,
          },
        });
      }
    }

    // 6. Reassign RecipeIngredient references from source to target
    await tx.recipeIngredient.updateMany({
      where: { cleanProductId: sourceId },
      data: { cleanProductId: targetId },
    });

    // 7. Update target quality score (take the higher one)
    if (source.qualityScore > target.qualityScore) {
      await tx.cleanProduct.update({
        where: { id: targetId },
        data: { qualityScore: source.qualityScore },
      });
    }

    // 8. Delete source product (cascades to nutrients, portions, allergens, dietFlags)
    await tx.cleanProduct.delete({ where: { id: sourceId } });
  });

  // Return updated target
  return getCleanProductById(targetId);
}

// ─── preview nutrition ────────────────────────────────────────────────────────

export interface PreviewIngredient {
  cleanProductId: string;
  grams: number;
}

export async function previewNutrition(ingredients: PreviewIngredient[], servings: number = 1) {
  const ids = ingredients.map(i => i.cleanProductId);

  const products = await prisma.cleanProduct.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      hasMicronutrients: true,
      nutrients: {
        select: {
          kcalPer100g: true,
          proteinPer100g: true,
          fatPer100g: true,
          carbsPer100g: true,
          fiberPer100g: true,
          sugarsPer100g: true,
          saltPer100g: true,
          saturatedFatPer100g: true,
        },
      },
    },
  });

  const productMap = new Map(products.map(p => [p.id, p]));

  // Verify all products exist
  const missing = ids.filter(id => !productMap.has(id));
  if (missing.length > 0) {
    throw new AppError(400, 'PRODUCTS_NOT_FOUND', `Products not found: ${missing.join(', ')}`);
  }

  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalFiber = 0;
  let totalSugars = 0;
  let totalSalt = 0;
  let totalSaturatedFat = 0;
  let withoutMicro = 0;

  const breakdown: Array<{
    cleanProductId: string;
    name: string;
    grams: number;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    hasMicronutrients: boolean;
  }> = [];

  for (const ing of ingredients) {
    const product = productMap.get(ing.cleanProductId)!;
    const n = product.nutrients;
    if (!n) {
      throw new AppError(400, 'MISSING_NUTRIENTS', `Product "${product.name}" has no nutrient data`);
    }
    if (!product.hasMicronutrients) withoutMicro++;

    const factor = ing.grams / 100;
    const kcal = Number(n.kcalPer100g) * factor;
    const protein = Number(n.proteinPer100g) * factor;
    const fat = Number(n.fatPer100g) * factor;
    const carbs = Number(n.carbsPer100g) * factor;

    totalKcal += kcal;
    totalProtein += protein;
    totalFat += fat;
    totalCarbs += carbs;
    totalFiber += n.fiberPer100g ? Number(n.fiberPer100g) * factor : 0;
    totalSugars += n.sugarsPer100g ? Number(n.sugarsPer100g) * factor : 0;
    totalSalt += n.saltPer100g ? Number(n.saltPer100g) * factor : 0;
    totalSaturatedFat += n.saturatedFatPer100g ? Number(n.saturatedFatPer100g) * factor : 0;

    breakdown.push({
      cleanProductId: ing.cleanProductId,
      name: product.name,
      grams: ing.grams,
      kcal: Math.round(kcal * 10) / 10,
      protein: Math.round(protein * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      hasMicronutrients: product.hasMicronutrients,
    });
  }

  const round1 = (v: number) => Math.round(v * 10) / 10;
  const safeServings = servings > 0 ? servings : 1;

  return {
    total: {
      kcal: round1(totalKcal),
      protein: round1(totalProtein),
      fat: round1(totalFat),
      carbs: round1(totalCarbs),
      fiber: round1(totalFiber),
      sugars: round1(totalSugars),
      salt: round1(totalSalt),
      saturatedFat: round1(totalSaturatedFat),
    },
    perServing: {
      kcal: round1(totalKcal / safeServings),
      protein: round1(totalProtein / safeServings),
      fat: round1(totalFat / safeServings),
      carbs: round1(totalCarbs / safeServings),
      fiber: round1(totalFiber / safeServings),
      sugars: round1(totalSugars / safeServings),
      salt: round1(totalSalt / safeServings),
      saturatedFat: round1(totalSaturatedFat / safeServings),
    },
    servings: safeServings,
    breakdown,
    warnings: withoutMicro > 0
      ? [`${withoutMicro} ingredient(s) without micronutrient data`]
      : [],
  };
}
