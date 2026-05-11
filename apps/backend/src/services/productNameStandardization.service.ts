/**
 * Product Name Standardization Service (17.4)
 *
 * Ensures AI-generated diet plans use canonical product names from the database.
 * Provides fuzzy matching, normalization, and shopping list aggregation.
 */

import { prisma } from '@db';
import type { PlanContent, PlanItem } from './planValidation.service';

// ─── types ────────────────────────────────────────────────────────────────────

export interface CanonicalProduct {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
}

export interface MatchResult {
  originalName: string;
  canonicalName: string | null;
  productId: string | null;
  confidence: number; // 0–1
  matchType: 'EXACT' | 'CASE_INSENSITIVE' | 'CONTAINS' | 'CONTAINED_BY' | 'LEVENSHTEIN' | 'SYNONYM' | 'UNMATCHED';
}

export interface StandardizationReport {
  totalItems: number;
  matched: number;
  unmatched: number;
  unmatchedNames: string[];
}

// ─── normalization helpers ───────────────────────────────────────────────────

/** Normalize a product name for comparison (lowercase, trim, collapse whitespace, strip diacritics) */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

/** Strip USDA-style suffixes: "marchewki, baby, surowy(a)" → "marchewki" */
function stripUsdaSuffix(normalized: string): string {
  const commaIdx = normalized.indexOf(',');
  if (commaIdx > 2) return normalized.slice(0, commaIdx).trim();
  return normalized;
}

/**
 * Common Polish ingredient aliases — maps AI short names to DB forms.
 * All keys/values must be normalized (no diacritics, lowercase, ł→l).
 */
const INGREDIENT_ALIASES: Record<string, string[]> = {
  // Warzywa — odmiana i warianty
  'marchew': ['marchewki', 'marchewka'],
  'marchewka': ['marchewki', 'marchew'],
  'pomidor': ['pomidory', 'pomidorow'],
  'pomidory': ['pomidor'],
  'cukinia': ['cukinia zielona'],
  'papryka': ['papryka czerwona', 'papryka zolta', 'papryka zielona'],
  'ciecierzyca': ['ciecierzyce'],
  'fasola': ['fasolka', 'fasoli'],
  'brokul': ['brokuly'],
  'brokuly': ['brokul'],
  'szpinak': ['szpinaku'],
  'szpinak swiezy': ['szpinak'],
  'szpinak mlody': ['szpinak'],
  'groszek': ['groszek zielony'],
  'groszek zielony': ['groszek'],
  'fasola szparagowa': ['fasolka szparagowa'],
  'ziemniak': ['ziemniaki', 'ziemniaka'],
  'ziemniaki': ['ziemniak'],
  'bataty': ['batat', 'slodki ziemniak'],
  'batat': ['bataty'],
  // Białko
  'jajko': ['jajo', 'jajka', 'jaja kurze', 'jajko kurze'],
  'jajka': ['jajo', 'jajko', 'jaja kurze'],
  'jaja kurze': ['jajko', 'jajka', 'jajo'],
  'jajo': ['jajko', 'jajka'],
  'kurczak': ['kurczaka', 'drob'],
  'piers z kurczaka': ['piersi z kurczaka', 'piers kurczaka', 'filet z kurczaka', 'gotowana piers z kurczaka'],
  'losos': ['losos atlantycki', 'filet z lososia'],
  'tunczyk': ['tunczyka', 'tunczyk w wodzie', 'tunczyk w sosie wlasnym'],
  'tunczyk w sosie wlasnym': ['tunczyk'],
  'krewetki': ['krewetka'],
  // Nabiał
  'mleko': ['mleko krowie', 'mleko 2%', 'mleko 3.2%'],
  'mleko 2%': ['mleko'],
  'jogurt': ['jogurt naturalny', 'jogurt grecki'],
  'jogurt naturalny': ['jogurt'],
  'jogurt grecki': ['jogurt'],
  'ser': ['ser zolty', 'ser bialy', 'ser twarogowy'],
  'twarog': ['twarog polustlusty', 'twarog chudy', 'ser twarogowy'],
  'ser feta': ['feta'],
  'feta': ['ser feta'],
  'smietana': ['smietana 18%', 'smietana 12%'],
  'smietana 18%': ['smietana'],
  // Węglowodany
  'ryz': ['ryz bialy', 'ryz brazowy', 'ryz jasminowy'],
  'ryz bialy': ['ryz'],
  'makaron': ['makaron penne', 'makaron spaghetti', 'makaron pszenny'],
  'chleb': ['chleb pszenny', 'chleb zytni', 'chleb pelnoziarnisty'],
  'chleb pelnoziarnisty': ['chleb razowy', 'chleb zytni pelnoziarnisty'],
  'platki owsiane': ['owsianka', 'platki owsiane gorskie'],
  // Tłuszcze
  'maslo': ['maslo ekstra', 'maslo klarowane'],
  'oliwa': ['oliwa z oliwek'],
  'oliwa z oliwek': ['oliwa'],
  // Owoce
  'awokado': ['avocado'],
  'banan': ['banany'],
  'jablko': ['jablka'],
  'gruszka': ['gruszki'],
  'truskawki': ['truskawka'],
  'maliny': ['malina'],
  'borowki': ['borowki amerykanskie', 'jagody'],
  'jagody': ['borowki', 'borowki amerykanskie', 'jagody swieże'],
  'jagody swieże': ['borowki', 'jagody'],
  'pomarancza': ['pomarancze'],
  // Orzechy
  'migdaly': ['migdal'],
  'orzechy wloskie': ['orzech wloski'],
  // Inne
  'miod': ['miodu', 'miod naturalny', 'miod pszczeli'],
};

// ─── Levenshtein distance ────────────────────────────────────────────────────

export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Use single-row optimization
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);

  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[lb];
}

/** Levenshtein similarity (0–1, higher = more similar) */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// ─── fetch canonical product names ──────────────────────────────────────────

/** Cached canonical products for standardization (refreshed every 10 min) */
let cachedCanonical: CanonicalProduct[] | null = null;
let cachedAt = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/** Fetch all active product names from the database for standardization */
export async function getCanonicalProductNames(): Promise<CanonicalProduct[]> {
  if (cachedCanonical && Date.now() - cachedAt < CACHE_TTL) {
    return cachedCanonical;
  }

  const products = await prisma.cleanProduct.findMany({
    where: { verificationStatus: { not: 'FLAGGED' } },
    select: {
      id: true,
      name: true,
      nameEn: true,
    },
    orderBy: { qualityScore: 'desc' },
  });

  cachedCanonical = products.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.name.toLowerCase().replace(/\s+/g, '-'),
    synonyms: p.nameEn ? [p.nameEn] : [],
  }));
  cachedAt = Date.now();
  return cachedCanonical;
}

/**
 * Get a compact list of canonical product names for the AI system prompt.
 * Limited to ~500 most common base products to stay within AI token limits.
 * Full list (6000+) would exceed gpt-4o-mini context window.
 */
/**
 * 33.4 — Intelligent product filtering based on diet type, allergies, and exclusions.
 * Returns ~150-200 relevant product names instead of random 500.
 */
export interface CategorizedProduct { name: string; category: string }

export async function getCanonicalNamesGrouped(filters?: {
  dietType?: string;
  allergies?: string[];
  excludeKeywords?: string[];
}): Promise<Record<string, string[]>> {
  const products = await getCanonicalNamesWithCategory(filters);
  const grouped: Record<string, string[]> = {};
  for (const p of products) {
    const cat = p.category || 'Inne';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(p.name);
  }
  return grouped;
}

async function getCanonicalNamesWithCategory(filters?: {
  dietType?: string;
  allergies?: string[];
  excludeKeywords?: string[];
}): Promise<CategorizedProduct[]> {
  const names = await getCanonicalNamesList(filters);
  if (names.length === 0) return [];

  // Fetch categories for the returned product names
  const products = await prisma.cleanProduct.findMany({
    where: { name: { in: names }, verificationStatus: { not: 'FLAGGED' } },
    select: { name: true, category: true },
  });
  const catMap = new Map(products.map((p) => [p.name, p.category]));
  return names.map((n) => ({ name: n, category: catMap.get(n) ?? 'Inne' }));
}

/**
 * Essential cooking ingredients — always included in the AI prompt.
 * 40 safe products with no common allergens (no gluten, dairy, eggs, nuts,
 * fish, shellfish, soy, celery, mustard, sesame, lupin, molluscs).
 * These are universally safe and AI should use these exact names.
 */
const ESSENTIAL_INGREDIENTS: string[] = [
  // Białko (bez ryb, jaj, skorupiaków)
  'Pierś z kurczaka', 'Udko z kurczaka', 'Mięso mielone wołowe',
  'Filet z indyka', 'Mięso mielone z indyka',
  // Warzywa (bez selera)
  'Pomidor', 'Ogórek', 'Marchew', 'Cebula', 'Czosnek',
  'Papryka czerwona', 'Papryka żółta', 'Brokuł', 'Kalafior',
  'Szpinak', 'Cukinia', 'Bakłażan', 'Sałata', 'Rukola',
  'Burak', 'Por', 'Pieczarki', 'Ziemniak', 'Bataty',
  // Owoce
  'Jabłko', 'Banan', 'Truskawki', 'Borówki', 'Gruszka', 'Cytryna',
  // Węglowodany (bez glutenu — ryż i kasze bezglutenowe)
  'Ryż biały', 'Ryż brązowy', 'Kasza gryczana', 'Kasza jaglana',
  // Rośliny strączkowe (bez soi)
  'Soczewica czerwona', 'Ciecierzyca', 'Fasola biała',
  // Tłuszcze
  'Oliwa z oliwek', 'Olej rzepakowy',
  // Dodatki
  'Passata pomidorowa',
];

export async function getCanonicalNamesList(filters?: {
  dietType?: string;
  allergies?: string[];
  excludeKeywords?: string[];
}): Promise<string[]> {
  const MAX_PRODUCTS = 200;

  // Map diet type to CleanProductDietFlag code
  const dietFlagExclusions: Record<string, string[]> = {
    VEGETARIAN: ['vegetarian'],    // include only vegetarian=true products
    VEGAN: ['vegan'],
    KETO: ['keto'],
    GLUTEN_FREE: ['glutenFree'],
    LACTOSE_FREE: ['lactoseFree'],
  };

  // Map allergy names to CleanProductAllergen codes
  const allergenMap: Record<string, string> = {
    gluten: 'gluten',
    'produkty mleczne': 'milk',
    mleko: 'milk',
    laktoza: 'milk',
    jaja: 'eggs',
    jajka: 'eggs',
    ryby: 'fish',
    'owoce morza': 'crustaceans',
    skorupiaki: 'crustaceans',
    'orzechy ziemne': 'peanuts',
    orzeszki: 'peanuts',
    soja: 'soy',
    orzechy: 'nuts',
    'orzechy laskowe': 'nuts',
    seler: 'celery',
    gorczyca: 'mustard',
    sezam: 'sesame',
    siarczyny: 'sulphites',
    łubin: 'lupin',
    mięczaki: 'molluscs',
  };

  // Build allergen codes to exclude
  const excludeAllergenCodes: string[] = [];
  if (filters?.allergies?.length) {
    for (const allergy of filters.allergies) {
      const code = allergenMap[allergy.toLowerCase()];
      if (code) excludeAllergenCodes.push(code);
    }
  }

  // Build diet flag requirements
  const requiredDietFlags: string[] = [];
  if (filters?.dietType) {
    const flags = dietFlagExclusions[filters.dietType.toUpperCase()];
    if (flags) requiredDietFlags.push(...flags);
  }

  // Query CleanProducts with filtering
  const whereClause: Record<string, unknown> = {
    verificationStatus: { not: 'FLAGGED' },
  };

  // Exclude products with matching allergens (CONTAINS presence)
  if (excludeAllergenCodes.length > 0) {
    whereClause.allergens = {
      none: {
        allergenCode: { in: excludeAllergenCodes },
        presence: 'CONTAINS',
      },
    };
  }

  // Require diet flags
  if (requiredDietFlags.length > 0) {
    whereClause.dietFlags = {
      some: {
        flagCode: { in: requiredDietFlags },
        value: true,
      },
    };
  }

  const products = await prisma.cleanProduct.findMany({
    where: whereClause,
    select: { name: true },
    orderBy: { qualityScore: 'desc' },
    take: MAX_PRODUCTS,
  });

  let names = products.map((p) => p.name);

  // Apply exclude keywords filter
  if (filters?.excludeKeywords?.length) {
    const lowerExclude = filters.excludeKeywords.map((k) => k.toLowerCase());
    names = names.filter((name) => {
      const lower = name.toLowerCase();
      return !lowerExclude.some((kw) => lower.includes(kw));
    });
  }

  // Fallback: if too few products after filtering, fill with generic products
  if (names.length < 50) {
    const fallback = await prisma.cleanProduct.findMany({
      where: { verificationStatus: { not: 'FLAGGED' } },
      select: { name: true },
      orderBy: { qualityScore: 'desc' },
      take: MAX_PRODUCTS,
    });
    const existing = new Set(names);
    for (const p of fallback) {
      if (!existing.has(p.name)) {
        names.push(p.name);
        if (names.length >= MAX_PRODUCTS) break;
      }
    }
  }

  // Filter out retail/branded products with portion prefixes or brand names
  // These are not useful as ingredient names for AI
  const PORTION_PREFIXES = /^(garść|łyżeczka|łyżka|kromka|porcja|szklanka|kieliszek|plaster|kawałek|\d+\s)/i;
  names = names.filter((name) => !PORTION_PREFIXES.test(name));

  // Always include essential cooking ingredients at the beginning
  const existingSet = new Set(names.map((n) => n.toLowerCase()));
  const essentials = ESSENTIAL_INGREDIENTS.filter((ing) => {
    // Apply exclude keywords to essentials too
    if (filters?.excludeKeywords?.length) {
      const lower = ing.toLowerCase();
      if (filters.excludeKeywords.some((kw) => lower.includes(kw.toLowerCase()))) return false;
    }
    return !existingSet.has(ing.toLowerCase());
  });

  // Prepend essentials, then DB products, cap at MAX_PRODUCTS
  const combined = [...essentials, ...names];
  return combined.slice(0, MAX_PRODUCTS);
}

// ─── fuzzy matching ─────────────────────────────────────────────────────────

const LEVENSHTEIN_THRESHOLD = 0.75; // min similarity for auto-match
const CONTAINS_MIN_LENGTH = 4;      // min length for substring matching

/**
 * Try to match an AI-generated product name against canonical names.
 * Matching priority: exact → case-insensitive → synonym → contains → Levenshtein
 */
export function fuzzyMatchProduct(
  aiName: string,
  canonicalProducts: CanonicalProduct[],
): MatchResult {
  const normalizedAi = normalizeProductName(aiName);

  // 1. Exact match
  for (const p of canonicalProducts) {
    if (p.name === aiName) {
      return { originalName: aiName, canonicalName: p.name, productId: p.id, confidence: 1.0, matchType: 'EXACT' };
    }
  }

  // 2. Case-insensitive match (after normalization)
  for (const p of canonicalProducts) {
    if (normalizeProductName(p.name) === normalizedAi) {
      return { originalName: aiName, canonicalName: p.name, productId: p.id, confidence: 0.98, matchType: 'CASE_INSENSITIVE' };
    }
  }

  // 3. Synonym match (DB synonyms like nameEn)
  for (const p of canonicalProducts) {
    for (const syn of p.synonyms) {
      if (normalizeProductName(syn) === normalizedAi) {
        return { originalName: aiName, canonicalName: p.name, productId: p.id, confidence: 0.95, matchType: 'SYNONYM' };
      }
    }
  }

  // 3.5. Alias match — common Polish ingredient name variations
  const aliases = INGREDIENT_ALIASES[normalizedAi] ?? [];
  if (aliases.length > 0) {
    for (const p of canonicalProducts) {
      const normalizedCanonical = normalizeProductName(p.name);
      const strippedCanonical = stripUsdaSuffix(normalizedCanonical);
      for (const alias of aliases) {
        if (normalizedCanonical === alias || strippedCanonical === alias) {
          return { originalName: aiName, canonicalName: p.name, productId: p.id, confidence: 0.92, matchType: 'SYNONYM' };
        }
      }
    }
  }

  // 3.6. USDA suffix strip — "marchewki, baby, surowy(a)" matches "marchewki"
  for (const p of canonicalProducts) {
    const strippedCanonical = stripUsdaSuffix(normalizeProductName(p.name));
    if (strippedCanonical !== normalizeProductName(p.name) && strippedCanonical === normalizedAi) {
      return { originalName: aiName, canonicalName: p.name, productId: p.id, confidence: 0.90, matchType: 'SYNONYM' };
    }
  }

  // 4. Contains match (AI name contains canonical name or vice versa)
  if (normalizedAi.length >= CONTAINS_MIN_LENGTH) {
    let bestContains: MatchResult | null = null;
    let bestContainsLen = 0;

    for (const p of canonicalProducts) {
      const normalizedCanonical = normalizeProductName(p.name);

      // AI name contains canonical name (e.g. "jogurt naturalny 2%" contains "jogurt naturalny")
      if (normalizedAi.includes(normalizedCanonical) && normalizedCanonical.length >= CONTAINS_MIN_LENGTH) {
        if (normalizedCanonical.length > bestContainsLen) {
          bestContainsLen = normalizedCanonical.length;
          bestContains = {
            originalName: aiName,
            canonicalName: p.name,
            productId: p.id,
            confidence: 0.85 * (normalizedCanonical.length / normalizedAi.length),
            matchType: 'CONTAINS',
          };
        }
      }

      // Canonical name contains AI name (e.g. "pierś z kurczaka bez skóry" contains "pierś z kurczaka")
      if (normalizedCanonical.includes(normalizedAi) && normalizedAi.length >= CONTAINS_MIN_LENGTH) {
        if (normalizedAi.length > bestContainsLen) {
          bestContainsLen = normalizedAi.length;
          bestContains = {
            originalName: aiName,
            canonicalName: p.name,
            productId: p.id,
            confidence: 0.80 * (normalizedAi.length / normalizedCanonical.length),
            matchType: 'CONTAINED_BY',
          };
        }
      }
    }

    if (bestContains && bestContains.confidence >= 0.5) {
      return bestContains;
    }
  }

  // 5. Levenshtein distance match — pre-filter by first word to avoid O(n) on 16k products
  let bestLev: MatchResult | null = null;
  let bestSimilarity = 0;

  const firstWord = normalizedAi.split(/\s+/)[0] ?? '';
  const candidates = firstWord.length >= 3
    ? canonicalProducts.filter(p => {
        const norm = normalizeProductName(p.name);
        return norm.startsWith(firstWord.slice(0, 3)) ||
               norm.includes(firstWord) ||
               normalizedAi.includes(normalizeProductName(p.name).split(/\s+/)[0] ?? '');
      })
    : canonicalProducts.slice(0, 500); // fallback: check top 500 by quality

  for (const p of candidates) {
    const normalizedCanonical = normalizeProductName(p.name);
    const sim = levenshteinSimilarity(normalizedAi, normalizedCanonical);

    if (sim > bestSimilarity && sim >= LEVENSHTEIN_THRESHOLD) {
      bestSimilarity = sim;
      bestLev = {
        originalName: aiName,
        canonicalName: p.name,
        productId: p.id,
        confidence: sim * 0.9,
        matchType: 'LEVENSHTEIN',
      };
    }

    for (const syn of p.synonyms) {
      const synSim = levenshteinSimilarity(normalizedAi, normalizeProductName(syn));
      if (synSim > bestSimilarity && synSim >= LEVENSHTEIN_THRESHOLD) {
        bestSimilarity = synSim;
        bestLev = {
          originalName: aiName,
          canonicalName: p.name,
          productId: p.id,
          confidence: synSim * 0.85,
          matchType: 'LEVENSHTEIN',
        };
      }
    }
  }

  if (bestLev) return bestLev;

  // 6. No match found
  return { originalName: aiName, canonicalName: null, productId: null, confidence: 0, matchType: 'UNMATCHED' };
}

// ─── standardize plan content ────────────────────────────────────────────────

/**
 * Standardize all product names in a diet plan content to canonical names from the DB.
 * Returns the updated content and a report of matched/unmatched names.
 */
export async function standardizePlanContent(
  content: PlanContent,
): Promise<{ content: PlanContent; report: StandardizationReport }> {
  const canonicalProducts = await getCanonicalProductNames();

  // Build a cache to avoid re-matching the same name
  const matchCache = new Map<string, MatchResult>();
  let totalItems = 0;
  let matched = 0;
  const unmatchedNames = new Set<string>();

  /** Match a single product name, using cache. Returns canonical name or original. */
  function matchName(name: string): string {
    const cacheKey = normalizeProductName(name);
    let result = matchCache.get(cacheKey);
    if (!result) {
      result = fuzzyMatchProduct(name, canonicalProducts);
      matchCache.set(cacheKey, result);
    }
    if (result.canonicalName && result.confidence >= 0.5) {
      matched++;
      return result.canonicalName;
    }
    unmatchedNames.add(name);
    return name;
  }

  const standardizedDays = content.days.map(day => ({
    ...day,
    meals: day.meals.map(meal => ({
      ...meal,
      items: meal.items.map(item => {
        // V2 format: item has ingredients[] — item.name is a dish name, not a product
        // Only standardize ingredients[].name, not the dish name itself
        const hasIngredients = Array.isArray(item.ingredients) && item.ingredients.length > 0;

        if (hasIngredients) {
          const standardizedIngredients = item.ingredients!.map(ing => {
            totalItems++;
            return {
              ...ing,
              name: matchName(ing.name),
            };
          });
          return {
            ...item,
            ingredients: standardizedIngredients,
          };
        }

        // V1 format or no ingredients: item.name IS the product name
        totalItems++;
        const standardizedName = matchName(item.name);
        return {
          ...item,
          name: standardizedName,
        };
      }),
    })),
  }));

  return {
    content: { ...content, days: standardizedDays },
    report: {
      totalItems,
      matched,
      unmatched: unmatchedNames.size,
      unmatchedNames: [...unmatchedNames],
    },
  };
}

// ─── normalized shopping list (17.4.5) ──────────────────────────────────────

export interface NormalizedShoppingListItem {
  name: string;
  totalGrams: number;
  /** Which meals use this product: "pon obiad (150g), śr obiad (120g)" */
  usageDetails: string[];
}

/**
 * Build a shopping list with normalized product names and usage details.
 * Aggregates by normalized name to prevent duplicates from AI inconsistencies.
 */
export function buildNormalizedShoppingList(content: PlanContent): NormalizedShoppingListItem[] {
  const totals = new Map<string, { grams: number; usages: string[] }>();

  for (const day of content.days ?? []) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        const key = normalizeProductName(item.name);
        const existing = totals.get(key) ?? { grams: 0, usages: [] };
        const grams = Number(item.grams) || 0;

        existing.grams += grams;

        // Short day name for usage detail
        const dayShort = day.day.slice(0, 3).toLowerCase();
        const mealName = meal.name.toLowerCase();
        existing.usages.push(`${dayShort} ${mealName} (${grams}g)`);

        totals.set(key, existing);
      }
    }
  }

  // Map back to original (best) name — use the item.name as-is since it was already standardized
  const nameByKey = new Map<string, string>();
  for (const day of content.days ?? []) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        const key = normalizeProductName(item.name);
        if (!nameByKey.has(key)) {
          nameByKey.set(key, item.name);
        }
      }
    }
  }

  return [...totals.entries()]
    .map(([key, { grams, usages }]) => ({
      name: nameByKey.get(key) ?? key,
      totalGrams: Math.round(grams),
      usageDetails: usages,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}
