/**
 * Diet Cost Estimation Service
 *
 * Estimates weekly grocery cost from a diet plan by:
 * 1. Aggregating ingredients across all 7 days
 * 2. Looking up prices from CleanProduct.estimatedPricePer100g
 * 3. Falling back to category-based averages when no price data
 */
import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { decryptJson } from '../utils/encryption';
import type { PlanContent, PlanDay, PlanItem, PlanIngredient } from './planValidation.service';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CostEstimate {
  weeklyTotalPln: number;
  dailyAveragePln: number;
  confidencePct: number;
  breakdown: CostBreakdownItem[];
  categoryBreakdown: Array<{ category: string; totalPln: number; pct: number }>;
}

export interface CostBreakdownItem {
  ingredientName: string;
  totalGrams: number;
  pricePer100g: number | null;
  estimatedCostPln: number;
  source: 'db' | 'category_avg' | 'fallback';
}

// ─── Category fallback prices (PLN per 100g) ────────────────────────────────

const CATEGORY_AVG_PRICE_PER_100G: Record<string, number> = {
  'Mięso i drób': 3.50,
  'Ryby i owoce morza': 5.00,
  'Nabiał': 1.20,
  'Jaja': 1.50,
  'Warzywa': 0.80,
  'Owoce': 1.20,
  'Pieczywo i produkty zbożowe': 0.60,
  'Kasze i makarony': 0.50,
  'Tłuszcze i oleje': 2.00,
  'Orzechy i nasiona': 4.00,
  'Przyprawy i zioła': 3.00,
  'Napoje': 0.50,
};

const GLOBAL_FALLBACK_PRICE = 1.50; // PLN per 100g

// ─── Helpers ────────────────────────────────────────────────────────────────────

function normalizeForAggregation(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

function extractDays(content: Record<string, unknown>): PlanDay[] {
  const raw = content['days'];
  if (!Array.isArray(raw)) return [];
  return raw as PlanDay[];
}

function extractIngredients(item: PlanItem): Array<{ name: string; grams: number }> {
  const ingredients = (item as PlanItem & { ingredients?: PlanIngredient[] }).ingredients;
  if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
    return ingredients.map(ing => ({ name: ing.name, grams: Number(ing.grams) || 0 }));
  }
  return [{ name: item.name, grams: Number(item.grams) || 0 }];
}

/** Aggregate all ingredients by normalized name from plan content */
function aggregateIngredients(days: PlanDay[]): Map<string, { displayName: string; totalGrams: number }> {
  const totals = new Map<string, { displayName: string; totalGrams: number }>();

  for (const day of days) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        for (const ing of extractIngredients(item)) {
          const key = normalizeForAggregation(ing.name);
          const existing = totals.get(key);
          if (existing) {
            existing.totalGrams += ing.grams;
          } else {
            totals.set(key, { displayName: ing.name, totalGrams: ing.grams });
          }
        }
      }
    }
  }

  return totals;
}

/** Look up product price by fuzzy name match */
async function lookupPrice(ingredientName: string): Promise<{
  price: number | null;
  category: string | null;
}> {
  const product = await prisma.cleanProduct.findFirst({
    where: {
      name: { contains: ingredientName, mode: 'insensitive' },
    },
    select: {
      estimatedPricePer100g: true,
      category: true,
    },
  });

  if (!product) return { price: null, category: null };

  return {
    price: product.estimatedPricePer100g
      ? Number(product.estimatedPricePer100g)
      : null,
    category: product.category,
  };
}

/** Get fallback price from category averages */
function getCategoryFallback(category: string | null): number | null {
  if (!category) return null;
  return CATEGORY_AVG_PRICE_PER_100G[category] ?? null;
}

// ─── Core estimation logic ──────────────────────────────────────────────────────

async function computeCostEstimate(days: PlanDay[]): Promise<CostEstimate> {
  const ingredients = aggregateIngredients(days);
  const breakdown: CostBreakdownItem[] = [];
  let knownCount = 0;
  let totalCount = 0;

  for (const [_key, { displayName, totalGrams }] of ingredients) {
    totalCount++;
    const { price: dbPrice, category } = await lookupPrice(displayName);

    let pricePer100g: number | null = null;
    let estimatedCost: number;
    let source: CostBreakdownItem['source'];

    if (dbPrice !== null) {
      pricePer100g = dbPrice;
      estimatedCost = (totalGrams / 100) * dbPrice;
      source = 'db';
      knownCount++;
    } else {
      const catPrice = getCategoryFallback(category);
      if (catPrice !== null) {
        pricePer100g = catPrice;
        estimatedCost = (totalGrams / 100) * catPrice;
        source = 'category_avg';
      } else {
        pricePer100g = GLOBAL_FALLBACK_PRICE;
        estimatedCost = (totalGrams / 100) * GLOBAL_FALLBACK_PRICE;
        source = 'fallback';
      }
    }

    breakdown.push({
      ingredientName: displayName,
      totalGrams: Math.round(totalGrams),
      pricePer100g,
      estimatedCostPln: Math.round(estimatedCost * 100) / 100,
      source,
    });
  }

  // Compute totals
  const weeklyTotal = breakdown.reduce((sum, item) => sum + item.estimatedCostPln, 0);
  const dayCount = days.length || 7;
  const dailyAvg = weeklyTotal / dayCount;
  const confidence = totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0;

  // Category breakdown
  const categoryMap = new Map<string, number>();
  for (const item of breakdown) {
    // Infer category from the source category or ingredient name
    const cat = inferCategory(item.ingredientName);
    const prev = categoryMap.get(cat) ?? 0;
    categoryMap.set(cat, prev + item.estimatedCostPln);
  }

  const categoryBreakdown = [...categoryMap.entries()]
    .map(([category, totalPln]) => ({
      category,
      totalPln: Math.round(totalPln * 100) / 100,
      pct: weeklyTotal > 0 ? Math.round((totalPln / weeklyTotal) * 100) : 0,
    }))
    .sort((a, b) => b.totalPln - a.totalPln);

  return {
    weeklyTotalPln: Math.round(weeklyTotal * 100) / 100,
    dailyAveragePln: Math.round(dailyAvg * 100) / 100,
    confidencePct: confidence,
    breakdown: breakdown.sort((a, b) => b.estimatedCostPln - a.estimatedCostPln),
    categoryBreakdown,
  };
}

/** Simple keyword-based category inference for cost breakdown grouping */
function inferCategory(name: string): string {
  const lower = name.toLowerCase();
  const categories: Array<[string, string[]]> = [
    ['Mięso i drób', ['kurczak', 'indyk', 'wołowin', 'wieprzow', 'mięso', 'szynk', 'schab', 'filet', 'pierś']],
    ['Ryby i owoce morza', ['łosoś', 'tuńczyk', 'dorsz', 'makrela', 'ryba', 'krewet', 'śledź']],
    ['Nabiał', ['jogurt', 'mleko', 'ser', 'twaróg', 'śmietana', 'kefir', 'ricotta', 'mozzarella', 'feta']],
    ['Jaja', ['jajko', 'jajka', 'jajo']],
    ['Warzywa', ['pomidor', 'ogórek', 'sałat', 'szpinak', 'brokuł', 'papryk', 'cebul', 'marchew', 'ziemniak', 'cukini']],
    ['Owoce', ['banan', 'jabłk', 'gruszk', 'truskawk', 'maliny', 'jagod', 'borówk', 'pomarańcz', 'kiwi']],
    ['Pieczywo i produkty zbożowe', ['chleb', 'pieczywo', 'bułk', 'tortill', 'makaron', 'ryż', 'kasza', 'płatk']],
    ['Orzechy i nasiona', ['orzech', 'migdał', 'chia', 'siemię', 'słonecznik', 'pestki', 'nerkowc']],
    ['Tłuszcze i oleje', ['oliwa', 'olej', 'masło', 'ghee']],
    ['Napoje', ['kawa', 'herbata', 'sok', 'woda', 'kakao']],
  ];

  for (const [cat, keywords] of categories) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'Inne';
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/** Estimate cost for a saved diet plan by ID */
export async function estimatePlanCost(planId: string): Promise<CostEstimate> {
  const plan = await prisma.dietPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

  const content = decryptJson(plan.content) as Record<string, unknown>;
  const days = extractDays(content);

  if (days.length === 0) {
    return {
      weeklyTotalPln: 0,
      dailyAveragePln: 0,
      confidencePct: 0,
      breakdown: [],
      categoryBreakdown: [],
    };
  }

  return computeCostEstimate(days);
}

/** Estimate cost from decrypted plan content directly (preview before saving) */
export async function estimatePlanCostFromContent(content: PlanContent): Promise<CostEstimate> {
  const days = extractDays(content as Record<string, unknown>);

  if (days.length === 0) {
    return {
      weeklyTotalPln: 0,
      dailyAveragePln: 0,
      confidencePct: 0,
      breakdown: [],
      categoryBreakdown: [],
    };
  }

  return computeCostEstimate(days);
}
