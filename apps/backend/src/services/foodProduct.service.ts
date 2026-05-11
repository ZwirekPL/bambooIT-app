import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

// ─── types ────────────────────────────────────────────────────────────────────

export interface NutrientsInput {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  saturatedFat_g?: number;
  monounsaturatedFat_g?: number;
  polyunsaturatedFat_g?: number;
  transFat_g?: number;
  sugars_g?: number;
  addedSugars_g?: number;
  fiber_g?: number;
  starch_g?: number;
  salt_g?: number;
  sodium_mg?: number;
  potassium_mg?: number;
  calcium_mg?: number;
  magnesium_mg?: number;
  phosphorus_mg?: number;
  iron_mg?: number;
  zinc_mg?: number;
  copper_mg?: number;
  manganese_mg?: number;
  iodine_ug?: number;
  selenium_ug?: number;
  vitaminA_ug?: number;
  vitaminC_mg?: number;
  vitaminD_ug?: number;
  vitaminE_mg?: number;
  vitaminK_ug?: number;
  vitaminB1_mg?: number;
  vitaminB2_mg?: number;
  vitaminB3_mg?: number;
  vitaminB5_mg?: number;
  vitaminB6_mg?: number;
  folate_ug?: number;
  vitaminB12_ug?: number;
  biotin_ug?: number;
  cholesterol_mg?: number;
}

export interface AllergenInput {
  allergenCode: string;
  presence: 'CONTAINS' | 'MAY_CONTAIN' | 'FREE' | 'UNKNOWN';
  source?: 'AUTO_RULE' | 'MANUAL' | 'HEURISTIC' | 'SOURCE_DATA';
  confidence?: number;
  notes?: string;
}

export interface DietFlagInput {
  flagCode: string;
  value: boolean;
  source?: 'AUTO_RULE' | 'MANUAL' | 'HEURISTIC' | 'SOURCE_DATA';
  confidence?: number;
  notes?: string;
}

export interface HouseholdMeasureInput {
  name: string;
  nameEn?: string;
  grams: number;
  source?: string;
}

export interface CreateFoodProductInput {
  name: string;
  nameEn?: string;
  source?: string;
  sourceId?: string;
  brandName?: string;
  categoryId?: string;
  description?: string;
  state?: string;
  ediblePortionPercent?: number;
  density_g_per_ml?: number;
  defaultServingGrams?: number;
  searchableSynonyms?: string[];
  languageCode?: string;
  glycemicIndex?: number;
  fodmapLevel?: string;
  processingLevel?: string;
  notesClinical?: string;
  notesDietitian?: string;
  nutrients: NutrientsInput;
  allergens?: AllergenInput[];
  dietFlags?: DietFlagInput[];
  measures?: HouseholdMeasureInput[];
}

export interface UpdateFoodProductInput {
  name?: string;
  nameEn?: string;
  categoryId?: string;
  description?: string;
  state?: string;
  defaultServingGrams?: number;
  glycemicIndex?: number;
  fodmapLevel?: string;
  processingLevel?: string;
  isBabySafe?: boolean;
  isPregnancySafe?: boolean;
  isBreastfeedingSafe?: boolean;
  notesClinical?: string;
  notesDietitian?: string;
  isActive?: boolean;
  nutrients?: NutrientsInput;
}

export interface ListFoodProductsOptions {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  source?: string;
  verificationStatus?: string;
  isActive?: boolean;
  allergenFree?: string[];
  dietFlags?: string[];
  minKcal?: number;
  maxKcal?: number;
  minProtein?: number;
  maxProtein?: number;
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
  const existing = await prisma.foodProduct.findUnique({ where: { slug } });
  if (!existing) return slug;
  let i = 2;
  while (await prisma.foodProduct.findUnique({ where: { slug: `${slug}-${i}` } })) {
    i++;
  }
  return `${slug}-${i}`;
}

// ─── select ───────────────────────────────────────────────────────────────────

const foodProductSelect = {
  id: true,
  source: true,
  sourceId: true,
  name: true,
  nameEn: true,
  slug: true,
  brandId: true,
  categoryId: true,
  description: true,
  state: true,
  ediblePortionPercent: true,
  density_g_per_ml: true,
  defaultServingGrams: true,
  searchableSynonyms: true,
  languageCode: true,
  isActive: true,
  qualityScore: true,
  verificationStatus: true,
  glycemicIndex: true,
  fodmapLevel: true,
  processingLevel: true,
  isBabySafe: true,
  isPregnancySafe: true,
  isBreastfeedingSafe: true,
  notesClinical: true,
  notesDietitian: true,
  createdAt: true,
  updatedAt: true,
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  nutrients: true,
  allergens: true,
  dietFlags: true,
  householdMeasures: true,
} satisfies Prisma.FoodProductSelect;

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listFoodProducts(opts: ListFoodProductsOptions) {
  const skip = (opts.page - 1) * opts.limit;

  const where: Prisma.FoodProductWhereInput = {
    ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    ...(opts.search ? {
      OR: [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { nameEn: { contains: opts.search, mode: 'insensitive' } },
        { searchableSynonyms: { has: opts.search.toLowerCase() } },
      ],
    } : {}),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.verificationStatus ? { verificationStatus: opts.verificationStatus as Prisma.EnumVerificationStatusFilter<"FoodProduct"> } : {}),
    ...(opts.minKcal !== undefined || opts.maxKcal !== undefined ? {
      nutrients: {
        ...(opts.minKcal !== undefined ? { kcal: { gte: opts.minKcal } } : {}),
        ...(opts.maxKcal !== undefined ? { kcal: { lte: opts.maxKcal } } : {}),
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
    prisma.foodProduct.findMany({
      where,
      skip,
      take: opts.limit,
      orderBy: { name: 'asc' },
      select: foodProductSelect,
    }),
    prisma.foodProduct.count({ where }),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}

// ─── get by id ────────────────────────────────────────────────────────────────

export async function getFoodProductById(id: string) {
  const item = await prisma.foodProduct.findUnique({
    where: { id },
    select: {
      ...foodProductSelect,
      aliases: true,
      sourceMeta: true,
    },
  });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Food product not found');
  return item;
}

// ─── search ───────────────────────────────────────────────────────────────────

export async function searchFoodProducts(query: string, limit: number = 20) {
  return prisma.foodProduct.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { nameEn: { contains: query, mode: 'insensitive' } },
        { aliases: { some: { alias: { contains: query, mode: 'insensitive' } } } },
      ],
    },
    take: limit,
    orderBy: [{ qualityScore: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      slug: true,
      categoryId: true,
      category: { select: { name: true } },
      nutrients: {
        select: { kcal: true, protein_g: true, fat_g: true, carbs_g: true },
      },
    },
  });
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createFoodProduct(input: CreateFoodProductInput) {
  const slug = await uniqueSlug(input.name);

  return prisma.foodProduct.create({
    data: {
      name: input.name,
      nameEn: input.nameEn,
      slug,
      source: input.source ?? 'manual',
      sourceId: input.sourceId,
      categoryId: input.categoryId,
      description: input.description,
      state: (input.state as Prisma.EnumFoodStateFieldUpdateOperationsInput['set']) ?? 'RAW',
      ediblePortionPercent: input.ediblePortionPercent,
      density_g_per_ml: input.density_g_per_ml,
      defaultServingGrams: input.defaultServingGrams,
      searchableSynonyms: input.searchableSynonyms ?? [],
      languageCode: input.languageCode ?? 'pl',
      glycemicIndex: input.glycemicIndex,
      fodmapLevel: input.fodmapLevel as Prisma.NullableEnumFodmapLevelFieldUpdateOperationsInput['set'],
      processingLevel: input.processingLevel as Prisma.NullableEnumProcessingLevelFieldUpdateOperationsInput['set'],
      notesClinical: input.notesClinical,
      notesDietitian: input.notesDietitian,
      nutrients: { create: input.nutrients },
      ...(input.allergens?.length ? {
        allergens: { create: input.allergens },
      } : {}),
      ...(input.dietFlags?.length ? {
        dietFlags: { create: input.dietFlags },
      } : {}),
      ...(input.measures?.length ? {
        householdMeasures: { create: input.measures },
      } : {}),
    },
    select: foodProductSelect,
  });
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateFoodProduct(id: string, input: UpdateFoodProductInput) {
  await getFoodProductById(id);

  return prisma.foodProduct.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.state !== undefined ? { state: input.state as Prisma.EnumFoodStateFieldUpdateOperationsInput['set'] } : {}),
      ...(input.defaultServingGrams !== undefined ? { defaultServingGrams: input.defaultServingGrams } : {}),
      ...(input.glycemicIndex !== undefined ? { glycemicIndex: input.glycemicIndex } : {}),
      ...(input.fodmapLevel !== undefined ? { fodmapLevel: input.fodmapLevel as Prisma.NullableEnumFodmapLevelFieldUpdateOperationsInput['set'] } : {}),
      ...(input.processingLevel !== undefined ? { processingLevel: input.processingLevel as Prisma.NullableEnumProcessingLevelFieldUpdateOperationsInput['set'] } : {}),
      ...(input.isBabySafe !== undefined ? { isBabySafe: input.isBabySafe } : {}),
      ...(input.isPregnancySafe !== undefined ? { isPregnancySafe: input.isPregnancySafe } : {}),
      ...(input.isBreastfeedingSafe !== undefined ? { isBreastfeedingSafe: input.isBreastfeedingSafe } : {}),
      ...(input.notesClinical !== undefined ? { notesClinical: input.notesClinical } : {}),
      ...(input.notesDietitian !== undefined ? { notesDietitian: input.notesDietitian } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.nutrients ? {
        nutrients: {
          upsert: {
            create: input.nutrients,
            update: input.nutrients,
          },
        },
      } : {}),
    },
    select: foodProductSelect,
  });
}

// ─── verify ───────────────────────────────────────────────────────────────────

export async function verifyFoodProduct(id: string, userId: string, status: 'MANUALLY_VERIFIED' | 'REJECTED') {
  await getFoodProductById(id);
  return prisma.foodProduct.update({
    where: { id },
    data: {
      verificationStatus: status,
      verifiedAt: new Date(),
      verifiedBy: userId,
    },
    select: foodProductSelect,
  });
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteFoodProduct(id: string) {
  await getFoodProductById(id);
  await prisma.foodProduct.delete({ where: { id } });
  return { id };
}

// ─── categories ───────────────────────────────────────────────────────────────

export async function listCategories() {
  return prisma.foodCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      children: {
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
      _count: { select: { products: true } },
    },
    where: { parentId: null },
  });
}

// ─── household measures ───────────────────────────────────────────────────────

export async function addHouseholdMeasure(foodProductId: string, input: HouseholdMeasureInput) {
  await getFoodProductById(foodProductId);
  return prisma.householdMeasure.create({
    data: { foodProductId, name: input.name, nameEn: input.nameEn, grams: input.grams, source: input.source ?? 'manual' },
  });
}

export async function deleteHouseholdMeasure(id: string) {
  const measure = await prisma.householdMeasure.findUnique({ where: { id } });
  if (!measure) throw new AppError(404, 'NOT_FOUND', 'Measure not found');
  await prisma.householdMeasure.delete({ where: { id } });
  return { id };
}
