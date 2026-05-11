/**
 * Allergen Detection Engine
 *
 * EU 14 major allergens heuristic detector.
 * Uses category-based rules + keyword matching to auto-detect allergens
 * when source data doesn't provide allergen information.
 *
 * All 14 EU allergens:
 * 1. gluten (wheat, rye, barley, oats)
 * 2. crustaceans (shrimp, crab, lobster)
 * 3. eggs
 * 4. fish
 * 5. peanuts
 * 6. soy (soybeans)
 * 7. milk (lactose, dairy)
 * 8. nuts (almonds, hazelnuts, walnuts, cashews, pecans, brazil, pistachio, macadamia)
 * 9. celery
 * 10. mustard
 * 11. sesame
 * 12. sulphites (>10mg/kg SO2)
 * 13. lupin
 * 14. molluscs (mussels, oysters, squid, octopus)
 */

import { prisma } from '@db';

export const EU_14_ALLERGENS = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy',
  'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites',
  'lupin', 'molluscs',
] as const;

export type AllergenCode = typeof EU_14_ALLERGENS[number];

interface AllergenDetection {
  allergenCode: AllergenCode;
  presence: 'CONTAINS' | 'MAY_CONTAIN' | 'FREE';
  confidence: number;
  source: 'HEURISTIC';
}

// ─── Keyword maps ─────────────────────────────────────────────────────────────

const ALLERGEN_KEYWORDS: Record<AllergenCode, string[]> = {
  gluten: [
    'wheat', 'rye', 'barley', 'oat', 'spelt', 'kamut', 'triticale', 'semolina', 'durum',
    'flour', 'bread', 'pasta', 'noodle', 'couscous', 'bulgur', 'seitan',
    'pszenica', 'żyto', 'jęczmień', 'owies', 'orkisz', 'mąka', 'chleb', 'makaron',
    'bułka', 'pieczywo', 'kasza', 'kuskus',
  ],
  crustaceans: [
    'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'crawfish', 'langoustine',
    'krewetka', 'krab', 'homar', 'langusta', 'rak',
  ],
  eggs: [
    'egg', 'albumin', 'lysozyme', 'meringue', 'mayonnaise',
    'jajko', 'jajka', 'jaje', 'białko jaja', 'żółtko', 'majonez',
  ],
  fish: [
    'salmon', 'tuna', 'cod', 'herring', 'mackerel', 'sardine', 'anchovy',
    'trout', 'bass', 'halibut', 'haddock', 'sole', 'tilapia', 'catfish',
    'łosoś', 'tuńczyk', 'dorsz', 'śledź', 'makrela', 'sardynka', 'anchois',
    'pstrąg', 'sandacz', 'szczupak', 'karp', 'flądra', 'halibut', 'mintaj',
    'ryba', 'fish',
  ],
  peanuts: [
    'peanut', 'groundnut', 'arachis',
    'orzeszek ziemny', 'orzech ziemny', 'fistaszek', 'fistaszki',
  ],
  soy: [
    'soy', 'soya', 'soybean', 'tofu', 'tempeh', 'edamame', 'miso', 'natto',
    'soja', 'tofu', 'tempeh', 'sos sojowy',
  ],
  milk: [
    'milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'whey', 'casein',
    'lactose', 'dairy', 'ghee', 'curd', 'kefir',
    'mleko', 'śmietana', 'masło', 'ser', 'jogurt', 'serwatka', 'kazeina',
    'laktoza', 'twaróg', 'kefir', 'maślanka', 'ricotta', 'mozzarella',
  ],
  nuts: [
    'almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'brazil nut',
    'pistachio', 'macadamia', 'chestnut',
    'migdał', 'orzech laskowy', 'orzech włoski', 'nerkowiec', 'pekan',
    'orzech brazylijski', 'pistacja', 'makadamia', 'kasztan',
  ],
  celery: [
    'celery', 'celeriac',
    'seler', 'selera',
  ],
  mustard: [
    'mustard',
    'gorczyca', 'musztarda',
  ],
  sesame: [
    'sesame', 'tahini',
    'sezam', 'tahini', 'tahina',
  ],
  sulphites: [
    'sulphite', 'sulfite', 'sulphur dioxide', 'sulfur dioxide',
    'wine', 'dried fruit', 'dried apricot',
    'siarczan', 'dwutlenek siarki', 'wino', 'suszone owoce',
  ],
  lupin: [
    'lupin', 'lupine',
    'łubin',
  ],
  molluscs: [
    'mussel', 'oyster', 'clam', 'scallop', 'squid', 'octopus', 'snail', 'calamari',
    'małż', 'ostryga', 'przegrzebek', 'kałamarnica', 'ośmiornica', 'ślimak',
  ],
};

// ─── Category-based allergen rules ────────────────────────────────────────────

const CATEGORY_ALLERGEN_RULES: Record<string, AllergenCode[]> = {
  'Dairy and Egg Products': ['milk'],
  'nabial-i-jaja': ['milk'],
  'Poultry Products': [],
  'Finfish and Shellfish Products': ['fish'],
  'ryby-i-owoce-morza': ['fish'],
  'Baked Products': ['gluten'],
  'pieczywo-i-wypieki': ['gluten'],
  'Cereal Grains and Pasta': ['gluten'],
  'zboza-i-makarony': ['gluten'],
  'Nut and Seed Products': ['nuts'],
  'orzechy-i-nasiona': ['nuts'],
  'Legumes and Legume Products': ['soy'],
  'straczkowe': ['soy'],
};

// ─── Detection function ──────────────────────────────────────────────────────

export function detectAllergens(
  productName: string,
  categoryName?: string,
  categorySlug?: string,
): AllergenDetection[] {
  const detections: AllergenDetection[] = [];
  const nameLower = productName.toLowerCase();

  for (const allergen of EU_14_ALLERGENS) {
    const keywords = ALLERGEN_KEYWORDS[allergen];
    let presence: 'CONTAINS' | 'MAY_CONTAIN' | 'FREE' = 'FREE';
    let confidence = 30; // Base confidence for "FREE" (low — we can't be 100% sure)

    // Check keyword match
    const keywordMatch = keywords.some(kw => nameLower.includes(kw.toLowerCase()));
    if (keywordMatch) {
      presence = 'CONTAINS';
      confidence = 75; // High confidence for keyword match
    }

    // Check category-based rules
    const catKey = categoryName ?? categorySlug ?? '';
    const categoryAllergens = CATEGORY_ALLERGEN_RULES[catKey] ?? [];
    if (categoryAllergens.includes(allergen)) {
      if (presence === 'FREE') {
        presence = 'MAY_CONTAIN';
        confidence = 60;
      } else {
        confidence = Math.min(90, confidence + 15);
      }
    }

    // Only add non-FREE detections (we'd have too many FREE entries otherwise)
    if (presence !== 'FREE') {
      detections.push({
        allergenCode: allergen,
        presence,
        confidence,
        source: 'HEURISTIC',
      });
    }
  }

  return detections;
}

// ─── Batch allergen computation ──────────────────────────────────────────────

export async function computeAllergensForProduct(productId: string): Promise<void> {
  const product = await prisma.foodProduct.findUnique({
    where: { id: productId },
    include: { category: true, allergens: true },
  });
  if (!product) return;

  const detections = detectAllergens(
    product.name,
    product.category?.nameEn ?? undefined,
    product.category?.slug ?? undefined,
  );

  for (const detection of detections) {
    // Don't overwrite manual overrides
    const existing = product.allergens.find(a => a.allergenCode === detection.allergenCode);
    if (existing?.manualOverride) continue;

    await prisma.foodProductAllergen.upsert({
      where: {
        foodProductId_allergenCode: {
          foodProductId: productId,
          allergenCode: detection.allergenCode,
        },
      },
      create: {
        foodProductId: productId,
        allergenCode: detection.allergenCode,
        presence: detection.presence,
        source: 'HEURISTIC',
        confidence: detection.confidence,
      },
      update: {
        presence: detection.presence,
        source: 'HEURISTIC',
        confidence: detection.confidence,
      },
    });
  }
}

// ─── Batch process all products ──────────────────────────────────────────────

export async function computeAllergensForAllProducts(
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
        allergens: { none: {} },
      } : {},
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (products.length === 0) break;

    for (const p of products) {
      await computeAllergensForProduct(p.id);
      processed++;
    }

    cursor = products[products.length - 1].id;
  }

  return { processed };
}
