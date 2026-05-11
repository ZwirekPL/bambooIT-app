/**
 * Product Selection Service — Intelligent 4-layer product selection for AI diet plans.
 *
 * Layers:
 *   0. Health-driven products (clinical rules, protocols, micronutrient deficiencies)
 *   1. Patient history products (liked/disliked from recipe ratings + past plans)
 *   2. Preference products (interview checkboxes + textarea, budget)
 *   3. Fill products (quality-sorted, category-balanced from DB)
 *
 * Also exposes recommended products for the dietitian panel.
 */

import { prisma } from '@db';
import type { PolicyResult } from '../policies/types';
import { buildPatientContext, loadPolicyRules, evaluatePolicies } from '../policies';
import { analyzePlanMicronutrients, type MicronutrientReport, type NutrientAssessment } from './micronutrientAnalysis.service';
import { decryptJson } from '../utils/encryption';
import * as fs from 'fs';
import * as path from 'path';

// Load blacklisted product names (reviewed and approved for filtering)
let BLACKLISTED_NAMES: Set<string> = new Set();
try {
  const filePath = path.resolve(__dirname, '../../../data/filtered-product-names.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as string[];
  BLACKLISTED_NAMES = new Set(data.map(n => n.toLowerCase()));
  console.log(`[productSelection] Loaded ${BLACKLISTED_NAMES.size} blacklisted product names`);
} catch {
  // File may not exist in production — that's OK
}

// ─── Public types ────────────────────────────────────────────────────────────

export interface PersonalizedProductList {
  /** Products recommended for health reasons (with explanations) */
  health: HealthProduct[];
  /** Products the patient liked (from recipe ratings) */
  liked: string[];
  /** Products the patient disliked (from ratings + textarea) — EXCLUDE from prompt */
  disliked: string[];
  /** All products grouped by category for the AI prompt */
  categories: Record<string, string[]>;
  /** Total product count */
  totalCount: number;
  /** Errors/warnings encountered during selection */
  warnings: string[];
}

export interface HealthProduct {
  name: string;
  reason: string; // e.g. "Bogate w żelazo (3.3 mg/100g) — niedobór żelaza"
  category: string;
  nutrientKey?: string; // e.g. "ironMg"
  valuePer100g?: number;
}

export interface RecommendedProductsResponse {
  /** Products recommended based on health conditions */
  healthProducts: HealthProduct[];
  /** Products the patient liked in past plans */
  likedProducts: string[];
  /** Products to avoid */
  dislikedProducts: string[];
  /** Summary text for the dietitian */
  summary: string;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const MAX_PRODUCTS = 200;
const HEALTH_PRODUCTS_LIMIT = 40;
const HISTORY_PRODUCTS_LIMIT = 40;
const PREFERENCE_PRODUCTS_LIMIT = 60;

/** Minimum products per category to ensure diet diversity (uses DB category slugs) */
const MIN_CATEGORY_COVERAGE: Record<string, number> = {
  'mieso-i-wedliny': 8,
  'ryby': 6,
  'nabial-i-jaja': 10,
  'warzywa': 15,
  'owoce': 8,
  'produkty-zbozowe': 12,  // kasze, ryże, makarony, pieczywo — kluczowe dla węgli złożonych
  'tluszcze': 5,
  'bakalie-i-nasiona': 5,
  'przyprawy': 4,
};

/**
 * Maps nutrient deficiency keys to CleanProductNutrients DB fields
 * and the minimum threshold per 100g for a product to be "rich" in that nutrient.
 */
const NUTRIENT_PRODUCT_QUERIES: Record<string, {
  dbField: string;
  minPer100g: number;
  label: string;
  unit: string;
}> = {
  ironMg: { dbField: 'ironMg', minPer100g: 2.0, label: 'żelazo', unit: 'mg' },
  calciumMg: { dbField: 'calciumMg', minPer100g: 100, label: 'wapń', unit: 'mg' },
  magnesiumMg: { dbField: 'magnesiumMg', minPer100g: 40, label: 'magnez', unit: 'mg' },
  zincMg: { dbField: 'zincMg', minPer100g: 2.0, label: 'cynk', unit: 'mg' },
  vitaminDUg: { dbField: 'vitaminDUg', minPer100g: 1.0, label: 'witamina D', unit: 'µg' },
  vitaminCMg: { dbField: 'vitaminCMg', minPer100g: 20, label: 'witamina C', unit: 'mg' },
  vitaminB12Ug: { dbField: 'vitaminB12Ug', minPer100g: 1.0, label: 'witamina B12', unit: 'µg' },
  folateUg: { dbField: 'folateUg', minPer100g: 50, label: 'kwas foliowy', unit: 'µg' },
  potassiumMg: { dbField: 'potassiumMg', minPer100g: 300, label: 'potas', unit: 'mg' },
  iodineUg: { dbField: 'iodineUg', minPer100g: 20, label: 'jod', unit: 'µg' },
  seleniumUg: { dbField: 'seleniumUg', minPer100g: 10, label: 'selen', unit: 'µg' },
  omega3Per100g: { dbField: 'omega3Per100g', minPer100g: 0.3, label: 'omega-3', unit: 'g' },
  fiberPer100g: { dbField: 'fiberPer100g', minPer100g: 5.0, label: 'błonnik', unit: 'g' },
  vitaminAUg: { dbField: 'vitaminAUg', minPer100g: 100, label: 'witamina A', unit: 'µg' },
  vitaminEMg: { dbField: 'vitaminEMg', minPer100g: 2.0, label: 'witamina E', unit: 'mg' },
  vitaminKUg: { dbField: 'vitaminKUg', minPer100g: 30, label: 'witamina K', unit: 'µg' },
  phosphorusMg: { dbField: 'phosphorusMg', minPer100g: 100, label: 'fosfor', unit: 'mg' },
};

/**
 * Maps clinical rule PREFER_PRODUCTS flagKeys to nutrient queries.
 * Allows the policy engine to drive product selection without hardcoded disease logic.
 */
const FLAG_TO_NUTRIENT_MAP: Record<string, string[]> = {
  highFiber: ['fiberPer100g'],
  heartFriendly: ['omega3Per100g', 'potassiumMg', 'magnesiumMg'],
  diabeticFriendly: [], // handled by GI filter, not nutrient
  highProtein: [], // handled by macro targets
  lowSugar: [],
  lowSalt: [],
  lowFat: [],
};

// ─── Allergen map (EU 14 → allergen codes) ──────────────────────────────────

const ALLERGEN_MAP: Record<string, string> = {
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

// ─── Diet type → diet flag code ─────────────────────────────────────────────

const DIET_FLAG_MAP: Record<string, string[]> = {
  VEGETARIAN: ['vegetarian'],
  VEGAN: ['vegan'],
  KETO: ['keto'],
  GLUTEN_FREE: ['glutenFree'],
  LACTOSE_FREE: ['lactoseFree'],
};

// ─── Main entry point ────────────────────────────────────────────────────────

export interface ProductSelectionInput {
  patientId: string;
  policyResult: PolicyResult;
  micronutrientReport?: MicronutrientReport | null;
  preferences?: {
    dietType?: string;
    allergies?: string[];
    preferredFoods?: string[];
    preferredFoodsOther?: string;
    dislikedFoods?: string[];
    dislikedFoodsOther?: string;
    budget?: string;
  };
}

/**
 * Builds a personalized product list for AI diet generation.
 * 4 layers: health → history → preferences → fill.
 */
export async function getPersonalizedProducts(
  input: ProductSelectionInput,
): Promise<PersonalizedProductList> {
  const { patientId, policyResult, micronutrientReport, preferences } = input;
  const warnings: string[] = [];

  // Build exclusion filters first (allergies + policy keywords)
  const excludeAllergenCodes = buildAllergenExclusions(preferences?.allergies);
  const excludeKeywords = policyResult.excludeKeywords ?? [];
  const requiredDietFlags = preferences?.dietType
    ? DIET_FLAG_MAP[preferences.dietType.toUpperCase()] ?? []
    : [];

  const baseWhere = buildBaseWhereClause(excludeAllergenCodes, requiredDietFlags);

  // ─── Layer 0: Health products ────────────────────────────────────────────
  let healthProducts: HealthProduct[] = [];
  try {
    healthProducts = await getHealthDrivenProducts(
      policyResult,
      micronutrientReport ?? null,
      baseWhere,
      excludeKeywords,
    );
  } catch (err) {
    const msg = `[productSelection] Warstwa 0 (zdrowie) — błąd: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    warnings.push(msg);
  }

  // ─── Layer 1: Patient history ────────────────────────────────────────────
  let likedProducts: string[] = [];
  let dislikedFromRatings: string[] = [];
  try {
    const history = await getPatientHistoryProducts(patientId);
    likedProducts = history.liked;
    dislikedFromRatings = history.disliked;
  } catch (err) {
    const msg = `[productSelection] Warstwa 1 (historia) — błąd: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    warnings.push(msg);
  }

  // ─── Layer 2: Preference products ────────────────────────────────────────
  let preferenceProducts: string[] = [];
  try {
    preferenceProducts = await getPreferenceProducts(preferences, baseWhere, excludeKeywords);
  } catch (err) {
    const msg = `[productSelection] Warstwa 2 (preferencje) — błąd: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    warnings.push(msg);
  }

  // Build combined disliked list (ratings + textarea)
  const dislikedFromTextarea = parseTextareaProducts(preferences?.dislikedFoodsOther);
  const allDisliked = [...new Set([...dislikedFromRatings, ...dislikedFromTextarea])];

  // Build combined exclude keywords (policy + disliked textarea)
  const allExcludeKeywords = [...new Set([...excludeKeywords, ...dislikedFromTextarea.map(d => d.toLowerCase())])];

  // ─── Collect unique product names from layers 0-2 ────────────────────────
  const collectedNames = new Set<string>();
  const healthNames = healthProducts.map(p => p.name);

  for (const name of [...healthNames, ...likedProducts, ...preferenceProducts]) {
    if (!isExcludedByKeywords(name, allExcludeKeywords)) {
      collectedNames.add(name);
    }
  }

  // ─── Layer 3: Fill remaining with quality-sorted, category-balanced ──────
  let fillProducts: Array<{ name: string; category: string }> = [];
  try {
    const remaining = MAX_PRODUCTS - collectedNames.size;
    if (remaining > 0) {
      fillProducts = await getFillProducts(
        remaining,
        collectedNames,
        baseWhere,
        allExcludeKeywords,
      );
    }
  } catch (err) {
    const msg = `[productSelection] Warstwa 3 (uzupełnienie) — błąd: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    warnings.push(msg);
  }

  // ─── Build final grouped result ──────────────────────────────────────────
  const categories: Record<string, string[]> = {};

  // Add health products with their categories
  for (const hp of healthProducts) {
    if (isExcludedByKeywords(hp.name, allExcludeKeywords)) continue;
    const cat = hp.category || 'Inne';
    if (!categories[cat]) categories[cat] = [];
    if (!categories[cat].includes(hp.name)) categories[cat].push(hp.name);
  }

  // Add liked + preference products (need to fetch their categories)
  const otherNames = [...likedProducts, ...preferenceProducts].filter(
    n => !isExcludedByKeywords(n, allExcludeKeywords),
  );
  if (otherNames.length > 0) {
    const catMap = await fetchCategoriesForNames(otherNames);
    for (const name of otherNames) {
      const cat = catMap.get(name) ?? 'Inne';
      if (!categories[cat]) categories[cat] = [];
      if (!categories[cat].includes(name)) categories[cat].push(name);
    }
  }

  // Add fill products
  for (const fp of fillProducts) {
    const cat = fp.category || 'Inne';
    if (!categories[cat]) categories[cat] = [];
    if (!categories[cat].includes(fp.name)) categories[cat].push(fp.name);
  }

  const totalCount = Object.values(categories).reduce((s, arr) => s + arr.length, 0);

  if (totalCount < 50) {
    warnings.push(
      `[productSelection] Niska liczba produktów: ${totalCount}. ` +
      `Możliwe przyczyny: restrykcyjna dieta, wiele alergii, lub problem z bazą danych.`,
    );
  }

  console.log(
    `[productSelection] Wynik: ${totalCount} produktów w ${Object.keys(categories).length} kategoriach ` +
    `(zdrowie: ${healthProducts.length}, polubione: ${likedProducts.length}, ` +
    `preferencje: ${preferenceProducts.length}, uzupełnienie: ${fillProducts.length})`,
  );

  return {
    health: healthProducts.filter(hp => !isExcludedByKeywords(hp.name, allExcludeKeywords)),
    liked: likedProducts.filter(n => !isExcludedByKeywords(n, allExcludeKeywords)),
    disliked: allDisliked,
    categories,
    totalCount,
    warnings,
  };
}

// ─── Layer 0: Health-driven products ─────────────────────────────────────────

async function getHealthDrivenProducts(
  policyResult: PolicyResult,
  microReport: MicronutrientReport | null,
  baseWhere: Record<string, unknown>,
  excludeKeywords: string[],
): Promise<HealthProduct[]> {
  const healthProducts: HealthProduct[] = [];
  const addedNames = new Set<string>();

  // 0a: From micronutrient deficiencies (DEFICIENT + SUBOPTIMAL)
  if (microReport) {
    const deficientNutrients = [
      ...microReport.deficiencies,
      ...microReport.suboptimal,
    ];

    for (const deficiency of deficientNutrients) {
      const query = NUTRIENT_PRODUCT_QUERIES[deficiency.nutrientKey];
      if (!query) continue;

      const products = await findProductsRichIn(
        query.dbField,
        query.minPer100g,
        8, // top 8 per nutrient
        baseWhere,
        excludeKeywords,
      );

      for (const p of products) {
        if (addedNames.has(p.name)) continue;
        addedNames.add(p.name);

        const valuePer100g = p.nutrientValue !== null ? Number(p.nutrientValue) : undefined;
        const valueStr = valuePer100g !== undefined ? ` (${valuePer100g.toFixed(1)} ${query.unit}/100g)` : '';
        const statusLabel = deficiency.status === 'DEFICIENT' ? 'niedobór' : 'nieoptymalny poziom';

        healthProducts.push({
          name: p.name,
          reason: `Bogate w ${query.label}${valueStr} — ${statusLabel} ${query.label}`,
          category: p.category ?? 'Inne',
          nutrientKey: deficiency.nutrientKey,
          valuePer100g,
        });
      }
    }
  }

  // 0b: From policy engine PREFER_PRODUCTS flags
  for (const pref of policyResult.preferFlags) {
    // Check if this flag maps to specific nutrient queries
    const nutrientKeys = FLAG_TO_NUTRIENT_MAP[pref.flagKey];
    if (nutrientKeys && nutrientKeys.length > 0) {
      for (const nk of nutrientKeys) {
        const query = NUTRIENT_PRODUCT_QUERIES[nk];
        if (!query) continue;

        const products = await findProductsRichIn(
          query.dbField,
          query.minPer100g,
          5,
          baseWhere,
          excludeKeywords,
        );

        for (const p of products) {
          if (addedNames.has(p.name)) continue;
          addedNames.add(p.name);

          const valuePer100g = p.nutrientValue !== null ? Number(p.nutrientValue) : undefined;
          const valueStr = valuePer100g !== undefined ? ` (${valuePer100g.toFixed(1)} ${query.unit}/100g)` : '';

          healthProducts.push({
            name: p.name,
            reason: `Zalecane: bogate w ${query.label}${valueStr} (reguła kliniczna)`,
            category: p.category ?? 'Inne',
            nutrientKey: nk,
            valuePer100g,
          });
        }
      }
    }

    // Also find products with the diet flag directly
    const flagProducts = await findProductsByDietFlag(
      pref.flagKey,
      pref.flagValue,
      6,
      baseWhere,
      excludeKeywords,
    );

    for (const p of flagProducts) {
      if (addedNames.has(p.name)) continue;
      addedNames.add(p.name);

      healthProducts.push({
        name: p.name,
        reason: `Zalecane: flaga ${pref.flagKey} (reguła kliniczna)`,
        category: p.category ?? 'Inne',
      });
    }
  }

  // 0c: From low GI preference (diabeticFriendly flag or related rules)
  const hasDiabeticFlag = policyResult.preferFlags.some(f => f.flagKey === 'diabeticFriendly');
  if (hasDiabeticFlag) {
    const lowGiProducts = await prisma.cleanProduct.findMany({
      where: {
        ...baseWhere,
        glycemicIndex: { not: null, lte: 55 },
        name: { not: { in: [...addedNames] } },
      },
      select: { name: true, category: true, glycemicIndex: true },
      orderBy: { qualityScore: 'desc' },
      take: 8,
    });

    for (const p of lowGiProducts) {
      if (isExcludedByKeywords(p.name, excludeKeywords)) continue;
      if (addedNames.has(p.name)) continue;
      addedNames.add(p.name);

      healthProducts.push({
        name: p.name,
        reason: `Niski indeks glikemiczny (GI: ${p.glycemicIndex}) — zalecane przy cukrzycy`,
        category: p.category ?? 'Inne',
      });
    }
  }

  return healthProducts.slice(0, HEALTH_PRODUCTS_LIMIT);
}

// ─── Layer 1: Patient history products ───────────────────────────────────────

interface PatientHistoryResult {
  liked: string[];
  disliked: string[];
}

async function getPatientHistoryProducts(patientId: string): Promise<PatientHistoryResult> {
  // Get all recipe ratings for this patient with ingredient details
  const ratings = await prisma.recipeRating.findMany({
    where: { patientId },
    select: {
      rating: true,
      recipeId: true,
    },
  });

  if (ratings.length === 0) {
    return { liked: [], disliked: [] };
  }

  // Fetch ingredients for rated recipes
  const recipeIds = ratings.map(r => r.recipeId);
  const ingredients = await prisma.recipeIngredient.findMany({
    where: { recipeId: { in: recipeIds } },
    select: {
      recipeId: true,
      displayName: true,
      cleanProduct: { select: { name: true } },
    },
  });

  // Build recipe → ingredients map
  const recipeIngredients = new Map<string, string[]>();
  for (const ing of ingredients) {
    const name = ing.cleanProduct?.name ?? ing.displayName;
    if (!name) continue;
    if (!recipeIngredients.has(ing.recipeId)) recipeIngredients.set(ing.recipeId, []);
    recipeIngredients.get(ing.recipeId)!.push(name);
  }

  const likedCounts = new Map<string, number>();
  const dislikedCounts = new Map<string, number>();

  for (const r of ratings) {
    const names = recipeIngredients.get(r.recipeId) ?? [];
    for (const name of names) {
      if (r.rating >= 4) {
        likedCounts.set(name, (likedCounts.get(name) ?? 0) + 1);
      } else if (r.rating <= 2) {
        dislikedCounts.set(name, (dislikedCounts.get(name) ?? 0) + 1);
      }
    }
  }

  // Remove from liked if also in disliked (conflicting signals)
  for (const name of dislikedCounts.keys()) {
    likedCounts.delete(name);
  }

  // Sort by frequency and take top N
  const liked = [...likedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, HISTORY_PRODUCTS_LIMIT)
    .map(([name]) => name);

  const disliked = [...dislikedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return { liked, disliked };
}

// ─── Layer 2: Preference products ────────────────────────────────────────────

/**
 * Maps interview checkbox preferredFoods categories to DB product categories.
 */
const PREFERRED_CATEGORY_MAP: Record<string, string[]> = {
  ryby: ['Ryby i owoce morza'],
  'owoce morza': ['Ryby i owoce morza'],
  nabiał: ['Nabiał i jaja'],
  kasze: ['Zboża i kasze'],
  warzywa: ['Warzywa'],
  owoce: ['Owoce'],
  mięso: ['Mięso i drób'],
  drób: ['Mięso i drób'],
  'rośliny strączkowe': ['Rośliny strączkowe'],
  orzechy: ['Orzechy i nasiona'],
  nasiona: ['Orzechy i nasiona'],
  jaja: ['Nabiał i jaja'],
  pieczywo: ['Zboża i kasze'],
  makaron: ['Zboża i kasze'],
  ryż: ['Zboża i kasze'],
};

async function getPreferenceProducts(
  preferences: ProductSelectionInput['preferences'],
  baseWhere: Record<string, unknown>,
  excludeKeywords: string[],
): Promise<string[]> {
  if (!preferences) return [];

  const result: string[] = [];
  const addedNames = new Set<string>();

  // 2a: From checkbox preferredFoods → boost those categories
  if (preferences.preferredFoods?.length) {
    for (const pref of preferences.preferredFoods) {
      const categories = PREFERRED_CATEGORY_MAP[pref.toLowerCase()];
      if (!categories) continue;

      const products = await prisma.cleanProduct.findMany({
        where: {
          ...baseWhere,
          category: { in: categories },
        },
        select: { name: true },
        orderBy: { qualityScore: 'desc' },
        take: 10,
      });

      for (const p of products) {
        if (addedNames.has(p.name)) continue;
        if (isExcludedByKeywords(p.name, excludeKeywords)) continue;
        addedNames.add(p.name);
        result.push(p.name);
      }
    }
  }

  // 2b: From textarea preferredFoodsOther → search DB by name
  const textareaPreferred = parseTextareaProducts(preferences.preferredFoodsOther);
  if (textareaPreferred.length > 0) {
    for (const term of textareaPreferred) {
      const products = await prisma.cleanProduct.findMany({
        where: {
          ...baseWhere,
          name: { contains: term, mode: 'insensitive' },
        },
        select: { name: true },
        orderBy: { qualityScore: 'desc' },
        take: 3,
      });

      for (const p of products) {
        if (addedNames.has(p.name)) continue;
        if (isExcludedByKeywords(p.name, excludeKeywords)) continue;
        addedNames.add(p.name);
        result.push(p.name);
      }
    }
  }

  // 2c: Budget filter — boost BUDGET products if patient selected budget
  if (preferences.budget === 'BUDGET' || preferences.budget === 'oszczędny') {
    const budgetProducts = await prisma.cleanProduct.findMany({
      where: {
        ...baseWhere,
        priceCategory: 'BUDGET',
      },
      select: { name: true },
      orderBy: { qualityScore: 'desc' },
      take: 15,
    });

    for (const p of budgetProducts) {
      if (addedNames.has(p.name)) continue;
      if (isExcludedByKeywords(p.name, excludeKeywords)) continue;
      addedNames.add(p.name);
      result.push(p.name);
    }
  }

  return result.slice(0, PREFERENCE_PRODUCTS_LIMIT);
}

// ─── Layer 3: Fill products (quality-sorted, category-balanced) ──────────────

async function getFillProducts(
  limit: number,
  existingNames: Set<string>,
  baseWhere: Record<string, unknown>,
  excludeKeywords: string[],
): Promise<Array<{ name: string; category: string }>> {
  // Count existing products per category
  const existingCategoryCounts = new Map<string, number>();
  // We need categories of existing names — fetch them
  if (existingNames.size > 0) {
    const existing = await prisma.cleanProduct.findMany({
      where: { name: { in: [...existingNames] } },
      select: { name: true, category: true },
    });
    for (const p of existing) {
      const cat = p.category ?? 'Inne';
      existingCategoryCounts.set(cat, (existingCategoryCounts.get(cat) ?? 0) + 1);
    }
  }

  const result: Array<{ name: string; category: string }> = [];
  const addedNames = new Set<string>(existingNames);

  // First pass: fill minimum coverage per category
  for (const [category, minCount] of Object.entries(MIN_CATEGORY_COVERAGE)) {
    const currentCount = existingCategoryCounts.get(category) ?? 0;
    const needed = minCount - currentCount;
    if (needed <= 0) continue;

    const products = await prisma.cleanProduct.findMany({
      where: {
        ...baseWhere,
        category,
        name: { notIn: [...addedNames] },
      },
      select: { name: true, category: true },
      orderBy: { qualityScore: 'desc' },
      take: needed,
    });

    for (const p of products) {
      if (isExcludedByKeywords(p.name, excludeKeywords)) continue;
      addedNames.add(p.name);
      result.push({ name: p.name, category: p.category ?? 'Inne' });
    }
  }

  // Second pass: fill remaining with top quality products
  const stillNeeded = limit - result.length;
  if (stillNeeded > 0) {
    const topProducts = await prisma.cleanProduct.findMany({
      where: {
        ...baseWhere,
        name: { notIn: [...addedNames] },
      },
      select: { name: true, category: true },
      orderBy: { qualityScore: 'desc' },
      take: stillNeeded,
    });

    for (const p of topProducts) {
      if (isExcludedByKeywords(p.name, excludeKeywords)) continue;
      result.push({ name: p.name, category: p.category ?? 'Inne' });
    }
  }

  return result;
}

// ─── Dietitian endpoint: recommended products for a patient ──────────────────

/**
 * Returns health-driven product recommendations for a specific patient.
 * Used by the dietitian panel to show what products are recommended
 * when reviewing or creating a diet plan.
 */
export async function getRecommendedProductsForPatient(
  patientId: string,
): Promise<RecommendedProductsResponse> {
  // Build patient context from latest interview
  const patientCtx = await buildPatientContext(patientId);
  if (!patientCtx) {
    return {
      healthProducts: [],
      likedProducts: [],
      dislikedProducts: [],
      summary: 'Brak wywiadu żywieniowego — nie można określić zaleceń.',
    };
  }

  // Run policy engine
  const dbRules = await loadPolicyRules();
  const policyResult = evaluatePolicies(dbRules, patientCtx);

  // Try to get latest micronutrient report
  let microReport: MicronutrientReport | null = null;
  try {
    const latestPlan = await prisma.dietPlan.findFirst({
      where: { patientId, status: { in: ['GENERATED', 'REVIEWED', 'PUBLISHED', 'SENT'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true },
    });
    if (latestPlan?.content) {
      const content = decryptJson(latestPlan.content as string) as { days?: unknown[] };
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { sex: true, birthYear: true, birthDate: true },
      });
      const age = patient?.birthDate
        ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : patient?.birthYear
          ? new Date().getFullYear() - patient.birthYear
          : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      microReport = await analyzePlanMicronutrients(content as any, patient?.sex ?? null, age);
    }
  } catch {
    // Micronutrient data is optional — continue without it
  }

  // Build exclusion filters
  const excludeAllergenCodes = buildAllergenExclusions(patientCtx.allergies);
  const requiredDietFlags = patientCtx.dietType
    ? DIET_FLAG_MAP[patientCtx.dietType.toUpperCase()] ?? []
    : [];
  const baseWhere = buildBaseWhereClause(excludeAllergenCodes, requiredDietFlags);

  // Get health products
  const healthProducts = await getHealthDrivenProducts(
    policyResult,
    microReport,
    baseWhere,
    policyResult.excludeKeywords,
  );

  // Get history
  const history = await getPatientHistoryProducts(patientId);

  // Build summary
  const summaryParts: string[] = [];
  if (healthProducts.length > 0) {
    summaryParts.push(`${healthProducts.length} produktów zalecanych zdrowotnie`);
  }
  if (microReport?.deficiencies.length) {
    const defNames = microReport.deficiencies.map(d => d.label).join(', ');
    summaryParts.push(`Niedobory: ${defNames}`);
  }
  if (policyResult.appliedRules.length > 0) {
    summaryParts.push(`${policyResult.appliedRules.length} reguł klinicznych aktywnych`);
  }
  if (history.liked.length > 0) {
    summaryParts.push(`${history.liked.length} ulubionych składników`);
  }

  return {
    healthProducts,
    likedProducts: history.liked,
    dislikedProducts: history.disliked,
    summary: summaryParts.length > 0
      ? summaryParts.join('. ') + '.'
      : 'Brak szczególnych zaleceń zdrowotnych.',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAllergenExclusions(allergies?: string[]): string[] {
  if (!allergies?.length) return [];
  const codes: string[] = [];
  for (const allergy of allergies) {
    const code = ALLERGEN_MAP[allergy.toLowerCase()];
    if (code) codes.push(code);
  }
  return codes;
}

function buildBaseWhereClause(
  excludeAllergenCodes: string[],
  requiredDietFlags: string[],
): Record<string, unknown> {
  const where: Record<string, unknown> = {
    verificationStatus: { not: 'FLAGGED' },
    // Use products with clean Polish names:
    // - ILEWAZY: cleaned Polish names (main source for diet plans)
    // - OPENFOODFACTS: only nabial/mieso/ryby (skip napoje/slodycze/produkty-gotowe)
    // - USDA/CIQUAL/MANUAL: only those with clean translated names
    // Filtering of ugly names is handled by isExcludedByKeywords()
    OR: [
      { sourcePrimary: 'ILEWAZY' },
      { sourcePrimary: 'MANUAL' },
      {
        sourcePrimary: 'OPENFOODFACTS',
        // Include all food categories from OFF (napoje/produkty-gotowe/slodycze have useful items too: oliwa, płatki, kasza)
      },
      {
        sourcePrimary: 'USDA',
        // Only USDA products with clean names (translated) — short, no commas
        name: { not: { contains: ',' } },
      },
    ],
  };

  if (excludeAllergenCodes.length > 0) {
    where.allergens = {
      none: {
        allergenCode: { in: excludeAllergenCodes },
        presence: 'CONTAINS',
      },
    };
  }

  if (requiredDietFlags.length > 0) {
    where.dietFlags = {
      some: {
        flagCode: { in: requiredDietFlags },
        value: true,
      },
    };
  }

  return where;
}

/**
 * Find products rich in a specific nutrient.
 * Uses raw query to filter by nutrient field dynamically.
 */
async function findProductsRichIn(
  dbField: string,
  minValue: number,
  limit: number,
  baseWhere: Record<string, unknown>,
  excludeKeywords: string[],
): Promise<Array<{ name: string; category: string | null; nutrientValue: number | null }>> {
  // Use Prisma query with join on nutrients
  const products = await prisma.cleanProduct.findMany({
    where: {
      ...baseWhere,
      nutrients: {
        [dbField]: { gte: minValue },
      },
    },
    select: {
      name: true,
      category: true,
      nutrients: {
        select: { [dbField]: true },
      },
    },
    orderBy: {
      nutrients: { [dbField]: { sort: 'desc', nulls: 'last' } },
    },
    take: limit * 2, // fetch extra in case of keyword exclusions
  });

  return products
    .filter(p => !isExcludedByKeywords(p.name, excludeKeywords))
    .slice(0, limit)
    .map(p => ({
      name: p.name,
      category: p.category,
      nutrientValue: p.nutrients?.[dbField] !== undefined ? Number(p.nutrients[dbField]) : null,
    }));
}

async function findProductsByDietFlag(
  flagKey: string,
  flagValue: boolean,
  limit: number,
  baseWhere: Record<string, unknown>,
  excludeKeywords: string[],
): Promise<Array<{ name: string; category: string | null }>> {
  const products = await prisma.cleanProduct.findMany({
    where: {
      ...baseWhere,
      dietFlags: {
        some: { flagCode: flagKey, value: flagValue },
      },
    },
    select: { name: true, category: true },
    orderBy: { qualityScore: 'desc' },
    take: limit * 2,
  });

  return products
    .filter(p => !isExcludedByKeywords(p.name, excludeKeywords))
    .slice(0, limit);
}

function isExcludedByKeywords(name: string, excludeKeywords: string[]): boolean {
  const lower = name.toLowerCase();

  // Check blacklist (reviewed product names)
  if (BLACKLISTED_NAMES.has(lower)) return true;

  // Filter out portion-format names (Łyżeczka X, Garść Y, etc.)
  if (/^(garść|łyżeczka|łyżka|kromka|porcja|szklanka|kieliszek|plaster|kawałek|duża|mała|średnia|gałązka|\d+\s)/i.test(name)) {
    return true;
  }

  // Filter out non-Polish product names (USDA auto-translated garbage)
  if (/\b(raw|cooked|braised|grilled|baked|frozen|canned|dried|ready-to-eat|baby|infant|GERBER|QUAKER|agents|Northern|Plains|Indians|crude|defatted|glandless|partially|separable)\b/i.test(name)) {
    return true;
  }

  // Filter out fast food, branded products, junk food, energy drinks
  if (/\b(McDonald|Mc\s?Chicken|Mc\s?Nugget|Big\s?Mac|KFC|Burger\s?King|Subway|Pizza\s?Hut|Starbucks|Coca.?Cola|Pepsi|Fanta|Sprite|Red\s?Bull|Monster|Snickers|Mars|Twix|Oreo|Nutella|Lay'?s|Pringles|Doritos|Tiger|Rockstar|Hot\s?Dog|Kebab|Hamburger|Cheeseburger)\b/i.test(name)) {
    return true;
  }

  // Filter out Polish branded products (ILEWAZY)
  if (/\b(Serduszko|biszkoptowy|Otrębusie|MixChips|Kardynałki|Mlekovita|Podlaski|Knorr|Abba|Konspol|Tassimo|Nescafe|Milka|Felix|enerBio|enerBIO|Love Las|Cud Miód|Crispy Natural|Danone|Danonek|Bakuś|Actimel|Monte|Fantasia|Danonki|Rolmlecz|Delfiko|Redd's|Dr Pepper)\b/i.test(name)) {
    return true;
  }

  // Filter out non-cooking products (supplements, energy drinks, snack bars, candies, cookies)
  if (/\b(energetyczn|energy|suplementu?|protein bar|baton\s+(proteinow|energetyczn|zbożow)|wafelk[ia]|ciasteczk[ia]|cukierk[ia]|drage|żelk[ia]|gum[ai]|chipsy?|chrupk[ia]|paluszk[ia]|precl|kraker|nachos|popcorn|ciastk[ia]|herbatnik[ia]|murzynk|pączk[ia]|fawork[ia])\b/i.test(name)) {
    return true;
  }

  // Filter out highly processed / powder / niche products unsuitable for standard diet plans
  if (/\b(w proszku|proszek|granulat|liofilizowany|liofilizowana|liofilizowane|zagęszczone|zagęszczony|suszone chipsy|suszona.*słodzona)\b/i.test(name)) {
    return true;
  }
  // Filter out niche/expensive oils, margarines, and exotic products
  if (/olej z awokado|olej argan|olej rydz|olej z czarnuszk|olej z ostropest|olej carotino|olej z pestek|olej koperk|olej krokosz|olej mak|olej migdał|olej konopn|olej z lniank|olej z nasion|olej z czerwonej|olej ze zbóż|olej kujawsk|oliwa z awokado/i.test(name)) {
    return true;
  }
  // Filter out margarines (use masło or oliwa instead)
  if (/margary/i.test(name)) {
    return true;
  }

  // Filter out USDA-style comma-separated descriptions
  if ((name.match(/,/g) ?? []).length >= 2) return true;

  // Filter out USDA placeholder names and garbage OFF entries
  if (/\{\{PH_/.test(name)) return true;
  if (/^\d+$/.test(name.trim())) return true; // numeric-only names
  if (/^[.!?]$/.test(name.trim())) return true; // single punctuation
  if (name.trim().length < 3) return true; // too short
  if (/\b(2x|3x|4x|5x)\s/i.test(name)) return true; // "2x Snickers"
  if (/\b(Whey|WPC|Protein\s+(Bar|Shake|Powder|Isolate|Pudding|Matrix))\b/i.test(name)) return true; // supplements
  if (/\b(4move|isotoni|izoton|bcaa|creatine|l-karnityn)\b/i.test(name)) return true; // supplements/sports

  // Filter out English brand names and USDA products with English words
  if (/\b(KRAFT|HORMEL|Pillsbury|Oscar Mayer|Clif|Velveeta|Pasteurized|Process|Spread|Sliced|Turkey Pepperoni|family size|silk |Smart |Light |Zero |sugar free)\b/i.test(name)) return true;
  // Filter out non-Polish food terms (USDA remnants)
  if (/\b(extender|grain|isolate|concentrate|malt|puffed|enriched|fortified|flavored|nonfat|lowfat|low-fat|fat-free|whole milk|skim milk|evaporated|condensed|sweetened|unsweetened|instant|powder mix)\b/i.test(name)) return true;
  // Filter out Japanese/Indian/exotic prepared foods
  if (/\b(natto|papad|tempeh|miso|tofu|seitan)\b/i.test(name) && !/tofu/i.test(name)) return true; // keep tofu
  // Filter out names that are mostly English (>50% English words)
  if (/^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z]/.test(name) && !/\b[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\b/.test(name)) return true;

  // Filter out names with parenthetical markers from USDA translations
  if (/\(a\)|\(e\)|\(y\)/.test(name)) return true;

  // Filter out names with HTML entities (&quot; etc.)
  if (/&\w+;/.test(name)) return true;

  // Filter out very long names (likely USDA compound descriptions)
  if (name.length > 50) return true;

  // Filter out USDA-translated Polish names with awkward modifiers
  if (/\b(prepackaged|deli|luncheon|nisko sól|bez soli dodanej|surowe bez kości|separable lean|ready to cook|ready to eat|pan-fried|stir-fried|deep-fried)\b/i.test(name)) return true;
  // Filter out multi-word USDA descriptions with "lub" (or) — sign of bad translation
  if (/\blub\b.*\blub\b/i.test(name)) return true;

  if (excludeKeywords.length === 0) return false;
  return excludeKeywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Parse comma/semicolon-separated textarea input into individual product terms.
 * Filters out empty strings and very short terms.
 */
function parseTextareaProducts(text?: string): string[] {
  if (!text || text.trim().length === 0) return [];
  return text
    .split(/[,;]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);
}

async function fetchCategoriesForNames(names: string[]): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();
  const products = await prisma.cleanProduct.findMany({
    where: { name: { in: names } },
    select: { name: true, category: true },
  });
  return new Map(products.map(p => [p.name, p.category ?? 'Inne']));
}
