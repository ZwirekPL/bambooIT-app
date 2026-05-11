/**
 * Diet Flag Computation Engine
 *
 * Automatically computes dietary flags for food products based on:
 * - Nutrient values
 * - Allergen data
 * - Category heuristics
 * - Product name keywords
 *
 * Flags can be overridden manually; manual overrides are preserved.
 */

import { prisma } from '@db';

// ─── Flag definitions ─────────────────────────────────────────────────────────

export const DIET_FLAGS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'lactoseFree',
  'glutenFree',
  'lowFodmap',
  'lowCarb',
  'lowSodium',
  'lowSugar',
  'lowFat',
  'highProtein',
  'highFiber',
  'ketoCompatible',
  'diabeticFriendly',
  'renalFriendly',
  'liverFriendly',
  'ibsFriendly',
  'pregnancyFriendly',
  'goutFriendly',
  'heartFriendly',
  'pancreasFriendly',
] as const;

export type DietFlagCode = typeof DIET_FLAGS[number];

interface FlagResult {
  flagCode: DietFlagCode;
  value: boolean;
  confidence: number;
}

// ─── Animal product keywords ──────────────────────────────────────────────────

const MEAT_KEYWORDS = [
  'beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal', 'duck', 'goose',
  'venison', 'bison', 'rabbit', 'quail', 'pheasant', 'bacon', 'sausage',
  'ham', 'salami', 'prosciutto', 'meat', 'lard', 'suet', 'tallow',
  'wołowina', 'wieprzowina', 'kurczak', 'indyk', 'baranina', 'cielęcina',
  'kaczka', 'gęś', 'jeleń', 'dzik', 'królik', 'przepiórka', 'boczek',
  'kiełbasa', 'szynka', 'salami', 'mięso', 'smalec', 'schab', 'golonka',
  'karkówka', 'polędwica', 'łopatka', 'żeberka', 'flaki', 'wątroba',
];

const FISH_KEYWORDS = [
  'fish', 'salmon', 'tuna', 'cod', 'herring', 'mackerel', 'sardine',
  'trout', 'bass', 'halibut', 'anchovy', 'shrimp', 'prawn', 'crab',
  'lobster', 'squid', 'octopus', 'mussel', 'oyster', 'clam', 'scallop',
  'ryba', 'łosoś', 'tuńczyk', 'dorsz', 'śledź', 'makrela', 'sardynka',
  'pstrąg', 'sandacz', 'szczupak', 'karp', 'krewetka', 'krab', 'homar',
  'kałamarnica', 'ośmiornica', 'małża', 'ostryga',
];

const DAIRY_KEYWORDS = [
  'milk', 'cream', 'butter', 'cheese', 'yogurt', 'whey', 'casein', 'ghee',
  'mleko', 'śmietana', 'masło', 'ser', 'jogurt', 'serwatka', 'twaróg', 'kefir',
];

const EGG_KEYWORDS = ['egg', 'albumin', 'jajko', 'jajka'];

// ─── Category-based rules ─────────────────────────────────────────────────────

const MEAT_CATEGORIES = [
  'drob', 'wieprzowina', 'wolowina', 'baranina-i-dziczyzna', 'wedliny',
];

const FISH_CATEGORIES = ['ryby-i-owoce-morza'];

const DAIRY_CATEGORIES = ['nabial-i-jaja'];

// ─── Core computation ─────────────────────────────────────────────────────────

interface ProductData {
  name: string;
  categorySlug?: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  saturatedFat_g?: number;
  carbs_g: number;
  sugars_g?: number;
  fiber_g?: number;
  sodium_mg?: number;
  cholesterol_mg?: number;
  purines_mg?: number;
  fodmapLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
  allergenCodes: string[]; // allergen codes with CONTAINS presence
}

// ─── Pregnancy-risk keywords ─────────────────────────────────────────────────

const HIGH_MERCURY_FISH = [
  'tuna', 'tuńczyk', 'swordfish', 'miecznik', 'shark', 'rekin',
  'king mackerel', 'makrela królewska', 'marlin', 'tilefish',
];

const RAW_RISK_KEYWORDS = [
  'raw', 'surowy', 'surowa', 'surowe', 'sushi', 'tartare', 'tatar',
  'sashimi', 'carpaccio', 'ceviche',
];

function computeFlags(data: ProductData): FlagResult[] {
  const results: FlagResult[] = [];
  const nameLower = data.name.toLowerCase();
  const catSlug = data.categorySlug ?? '';

  const hasMeat = MEAT_KEYWORDS.some(kw => nameLower.includes(kw)) || MEAT_CATEGORIES.includes(catSlug);
  const hasFish = FISH_KEYWORDS.some(kw => nameLower.includes(kw)) || FISH_CATEGORIES.includes(catSlug);
  const hasDairy = DAIRY_KEYWORDS.some(kw => nameLower.includes(kw)) || DAIRY_CATEGORIES.includes(catSlug);
  const hasEgg = EGG_KEYWORDS.some(kw => nameLower.includes(kw));

  // vegetarian: no meat, no fish
  results.push({ flagCode: 'vegetarian', value: !hasMeat && !hasFish, confidence: 70 });

  // vegan: no meat, no fish, no dairy, no eggs
  results.push({ flagCode: 'vegan', value: !hasMeat && !hasFish && !hasDairy && !hasEgg, confidence: 65 });

  // pescatarian: no meat (fish ok)
  results.push({ flagCode: 'pescatarian', value: !hasMeat, confidence: 70 });

  // glutenFree: no gluten allergen
  results.push({ flagCode: 'glutenFree', value: !data.allergenCodes.includes('gluten'), confidence: 60 });

  // lactoseFree: no milk allergen
  results.push({ flagCode: 'lactoseFree', value: !data.allergenCodes.includes('milk'), confidence: 60 });

  // lowSodium: < 140mg per 100g
  if (data.sodium_mg !== undefined) {
    results.push({ flagCode: 'lowSodium', value: data.sodium_mg < 140, confidence: 85 });
  }

  // lowSugar: < 5g per 100g
  if (data.sugars_g !== undefined) {
    results.push({ flagCode: 'lowSugar', value: data.sugars_g < 5, confidence: 85 });
  }

  // lowFat: < 3g per 100g
  results.push({ flagCode: 'lowFat', value: data.fat_g < 3, confidence: 85 });

  // highProtein: > 20g per 100g
  results.push({ flagCode: 'highProtein', value: data.protein_g > 20, confidence: 90 });

  // highFiber: > 6g per 100g
  if (data.fiber_g !== undefined) {
    results.push({ flagCode: 'highFiber', value: data.fiber_g > 6, confidence: 85 });
  }

  // lowCarb: < 10g carbs per 100g (broader than keto)
  results.push({ flagCode: 'lowCarb', value: data.carbs_g < 10, confidence: 90 });

  // ketoCompatible: < 5g carbs per 100g, > 10g fat
  results.push({ flagCode: 'ketoCompatible', value: data.carbs_g < 5 && data.fat_g > 10, confidence: 75 });

  // diabeticFriendly: low sugar, moderate carbs
  if (data.sugars_g !== undefined) {
    results.push({ flagCode: 'diabeticFriendly', value: data.sugars_g < 5 && data.carbs_g < 30, confidence: 60 });
  }

  // heartFriendly: low saturated fat, low sodium, low cholesterol
  if (data.saturatedFat_g !== undefined && data.sodium_mg !== undefined) {
    const heartFriendly = data.saturatedFat_g < 3 && data.sodium_mg < 300 && (data.cholesterol_mg ?? 0) < 60;
    results.push({ flagCode: 'heartFriendly', value: heartFriendly, confidence: 55 });
  }

  // renalFriendly: low potassium, low phosphorus, low sodium (basic heuristic)
  if (data.sodium_mg !== undefined) {
    results.push({ flagCode: 'renalFriendly', value: data.sodium_mg < 200 && data.protein_g < 15, confidence: 40 });
  }

  // goutFriendly: low purines
  if (data.purines_mg !== undefined) {
    results.push({ flagCode: 'goutFriendly', value: data.purines_mg < 50, confidence: 70 });
  }

  // liverFriendly: low fat, low saturated fat
  results.push({ flagCode: 'liverFriendly', value: data.fat_g < 5 && (data.saturatedFat_g ?? data.fat_g) < 2, confidence: 45 });

  // pancreasFriendly: very low fat
  results.push({ flagCode: 'pancreasFriendly', value: data.fat_g < 3, confidence: 45 });

  // ibsFriendly: LOW FODMAP level
  if (data.fodmapLevel && data.fodmapLevel !== 'UNKNOWN') {
    results.push({
      flagCode: 'ibsFriendly',
      value: data.fodmapLevel === 'LOW',
      confidence: data.fodmapLevel === 'LOW' ? 75 : 70,
    });
  }

  // pregnancyFriendly: no raw food, no high-mercury fish
  const isHighMercury = hasFish && HIGH_MERCURY_FISH.some(kw => nameLower.includes(kw));
  const isRawRisk = RAW_RISK_KEYWORDS.some(kw => nameLower.includes(kw));
  results.push({
    flagCode: 'pregnancyFriendly',
    value: !isHighMercury && !isRawRisk,
    confidence: 50,
  });

  return results;
}

// ─── Compute and save flags for single product ───────────────────────────────

export async function computeDietFlagsForProduct(productId: string): Promise<void> {
  const product = await prisma.foodProduct.findUnique({
    where: { id: productId },
    include: {
      category: true,
      nutrients: true,
      allergens: true,
      dietFlags: true,
    },
  });

  if (!product?.nutrients) return;

  const n = product.nutrients;
  const allergenCodes = product.allergens
    .filter(a => a.presence === 'CONTAINS')
    .map(a => a.allergenCode);

  const flags = computeFlags({
    name: product.name,
    categorySlug: product.category?.slug,
    kcal: Number(n.kcal),
    protein_g: Number(n.protein_g),
    fat_g: Number(n.fat_g),
    saturatedFat_g: n.saturatedFat_g ? Number(n.saturatedFat_g) : undefined,
    carbs_g: Number(n.carbs_g),
    sugars_g: n.sugars_g ? Number(n.sugars_g) : undefined,
    fiber_g: n.fiber_g ? Number(n.fiber_g) : undefined,
    sodium_mg: n.sodium_mg ? Number(n.sodium_mg) : undefined,
    cholesterol_mg: n.cholesterol_mg ? Number(n.cholesterol_mg) : undefined,
    purines_mg: n.purines_mg ? Number(n.purines_mg) : undefined,
    allergenCodes,
  });

  for (const flag of flags) {
    // Don't overwrite manual overrides
    const existing = product.dietFlags.find(f => f.flagCode === flag.flagCode);
    if (existing?.manualOverride) continue;

    await prisma.foodProductDietFlag.upsert({
      where: {
        foodProductId_flagCode: {
          foodProductId: productId,
          flagCode: flag.flagCode,
        },
      },
      create: {
        foodProductId: productId,
        flagCode: flag.flagCode,
        value: flag.value,
        source: 'AUTO_RULE',
        confidence: flag.confidence,
      },
      update: {
        value: flag.value,
        source: 'AUTO_RULE',
        confidence: flag.confidence,
        computedAt: new Date(),
      },
    });
  }
}

// ─── Compute and save flags for single CleanProduct ─────────────────────────

export async function computeCleanDietFlagsForProduct(cleanProductId: string): Promise<void> {
  const product = await prisma.cleanProduct.findUnique({
    where: { id: cleanProductId },
    include: {
      nutrients: true,
      allergens: true,
      dietFlags: true,
      bioactives: true,
    },
  });

  if (!product?.nutrients) return;

  const n = product.nutrients;
  const allergenCodes = product.allergens
    .filter(a => a.presence === 'CONTAINS')
    .map(a => a.allergenCode);

  const flags = computeFlags({
    name: product.name,
    categorySlug: product.category,
    kcal: Number(n.kcalPer100g),
    protein_g: Number(n.proteinPer100g),
    fat_g: Number(n.fatPer100g),
    saturatedFat_g: n.saturatedFatPer100g ? Number(n.saturatedFatPer100g) : undefined,
    carbs_g: Number(n.carbsPer100g),
    sugars_g: n.sugarsPer100g ? Number(n.sugarsPer100g) : undefined,
    fiber_g: n.fiberPer100g ? Number(n.fiberPer100g) : undefined,
    sodium_mg: n.sodiumMg ? Number(n.sodiumMg) : undefined,
    cholesterol_mg: n.cholesterolMg ? Number(n.cholesterolMg) : undefined,
    purines_mg: product.bioactives?.purinesMg ? Number(product.bioactives.purinesMg) : undefined,
    fodmapLevel: product.fodmapLevel as ProductData['fodmapLevel'] ?? undefined,
    allergenCodes,
  });

  for (const flag of flags) {
    const existing = product.dietFlags.find(f => f.flagCode === flag.flagCode);
    if (existing?.source === 'MANUAL') continue; // preserve manual overrides

    await prisma.cleanProductDietFlag.upsert({
      where: {
        cleanProductId_flagCode: {
          cleanProductId,
          flagCode: flag.flagCode,
        },
      },
      create: {
        cleanProductId,
        flagCode: flag.flagCode,
        value: flag.value,
        source: 'AUTO_RULE',
        confidence: flag.confidence,
      },
      update: {
        value: flag.value,
        source: 'AUTO_RULE',
        confidence: flag.confidence,
        computedAt: new Date(),
      },
    });
  }
}

// ─── Batch process (CleanProduct) ────────────────────────────────────────────

export async function computeCleanDietFlagsForAllProducts(
  options?: { batchSize?: number; onlyUnprocessed?: boolean },
): Promise<{ processed: number }> {
  const batchSize = options?.batchSize ?? 500;
  let processed = 0;
  let cursor: string | undefined;

  while (true) {
    const products = await prisma.cleanProduct.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: options?.onlyUnprocessed ? {
        dietFlags: { none: {} },
      } : {},
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (products.length === 0) break;

    for (const p of products) {
      await computeCleanDietFlagsForProduct(p.id);
      processed++;
    }

    cursor = products[products.length - 1].id;
  }

  return { processed };
}

// ─── Batch process (FoodProduct) ─────────────────────────────────────────────

export async function computeDietFlagsForAllProducts(
  options?: { batchSize?: number; onlyUnprocessed?: boolean },
): Promise<{ processed: number }> {
  const batchSize = options?.batchSize ?? 500;
  let processed = 0;
  let cursor: string | undefined;

  while (true) {
    const products = await prisma.foodProduct.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: options?.onlyUnprocessed ? {
        dietFlags: { none: {} },
      } : {},
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (products.length === 0) break;

    for (const p of products) {
      await computeDietFlagsForProduct(p.id);
      processed++;
    }

    cursor = products[products.length - 1].id;
  }

  return { processed };
}
