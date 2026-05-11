/**
 * S-12 scraper monitoring stats service.
 *
 * Aggregates operational metrics over the Recipe corpus so admins can spot
 * regressions after a new scrape run. Works on the existing DB — no live
 * scraper data needed.
 */

import { prisma } from '@db';

export interface DomainStats {
  domain: string;
  total: number;
  withNutrition: number;
  withCookTime: number;
  withImage: number;
  avgQualityScore: number;
  avgRating: number | null;
  ratingCount: number;
  /** Recipes failing the S-3 NON_SCALABLE heuristic (servings=1 & kcal > 1200). */
  nonScalableGuess: number;
  /** Recipes with fewer than 3 ingredients — S-3 REQUIRED violation. */
  missingIngredients: number;
  /** Recipes with 0-1 instruction steps — S-3 REQUIRED violation. */
  missingSteps: number;
}

export interface ScraperStats {
  generatedAt: string;
  perDomain: DomainStats[];
  totals: {
    recipes: number;
    withNutrition: number;
    withCookTime: number;
    withImage: number;
    avgQualityScore: number;
  };
  /**
   * Monthly ingestion trend for the last 12 months. Count = Recipe rows whose
   * createdAt falls in the month.
   */
  trend: Array<{ month: string; count: number }>;
  /** Top diet flag counts (value=true) across the corpus. */
  flagCounts: Array<{ flagCode: string; count: number }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DOMAIN_MAP: Array<{ label: string; needle: string }> = [
  { label: 'aniagotuje.pl', needle: 'aniagotuje.pl' },
  { label: 'kwestiasmaku.com', needle: 'kwestiasmaku.com' },
  { label: 'jadlonomia.com', needle: 'jadlonomia.com' },
  { label: 'dietetykpowszechny.pl', needle: 'dietetykpowszechny.pl' },
  { label: 'paleosmak.pl', needle: 'paleosmak.pl' },
];

function domainOfUrl(url: string | null | undefined): string {
  if (!url) return 'manual / no-url';
  for (const { label, needle } of DOMAIN_MAP) {
    if (url.includes(needle)) return label;
  }
  return 'other';
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─── Main aggregator ───────────────────────────────────────────────────────────

export async function computeScraperStats(): Promise<ScraperStats> {
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      sourceUrl: true,
      createdAt: true,
      qualityScore: true,
      imageUrl: true,
      cookTimeMinutes: true,
      totalTimeMinutes: true,
      servings: true,
      averageRating: true,
      ratingCount: true,
      _count: { select: { ingredients: true, instructionSteps: true } },
      nutritionSnapshot: { select: { kcal: true } },
    },
  });

  const byDomain = new Map<string, DomainStats & { qualitySum: number; ratingSum: number; ratingRecipes: number }>();

  for (const r of recipes) {
    const domain = domainOfUrl(r.sourceUrl);
    let bucket = byDomain.get(domain);
    if (!bucket) {
      bucket = {
        domain,
        total: 0,
        withNutrition: 0,
        withCookTime: 0,
        withImage: 0,
        avgQualityScore: 0,
        avgRating: null,
        ratingCount: 0,
        nonScalableGuess: 0,
        missingIngredients: 0,
        missingSteps: 0,
        qualitySum: 0,
        ratingSum: 0,
        ratingRecipes: 0,
      };
      byDomain.set(domain, bucket);
    }
    bucket.total++;
    if (r.nutritionSnapshot) bucket.withNutrition++;
    if (r.cookTimeMinutes != null || r.totalTimeMinutes != null) bucket.withCookTime++;
    if (r.imageUrl) bucket.withImage++;
    bucket.qualitySum += r.qualityScore ?? 0;

    const kcal = toNumber(r.nutritionSnapshot?.kcal);
    if (r.servings != null && r.servings <= 1 && kcal != null && kcal > 1200) {
      bucket.nonScalableGuess++;
    }
    if (r._count.ingredients < 3) bucket.missingIngredients++;
    if (r._count.instructionSteps < 2) bucket.missingSteps++;

    const rating = toNumber(r.averageRating);
    if (rating != null && r.ratingCount > 0) {
      bucket.ratingSum += rating;
      bucket.ratingRecipes++;
      bucket.ratingCount += r.ratingCount;
    }
  }

  const perDomain: DomainStats[] = [];
  let totalQualitySum = 0;
  let totalWithNutrition = 0;
  let totalWithCookTime = 0;
  let totalWithImage = 0;
  for (const b of byDomain.values()) {
    const avgQ = b.total > 0 ? Math.round(b.qualitySum / b.total) : 0;
    const avgR = b.ratingRecipes > 0 ? Math.round((b.ratingSum / b.ratingRecipes) * 100) / 100 : null;
    perDomain.push({
      domain: b.domain,
      total: b.total,
      withNutrition: b.withNutrition,
      withCookTime: b.withCookTime,
      withImage: b.withImage,
      avgQualityScore: avgQ,
      avgRating: avgR,
      ratingCount: b.ratingCount,
      nonScalableGuess: b.nonScalableGuess,
      missingIngredients: b.missingIngredients,
      missingSteps: b.missingSteps,
    });
    totalQualitySum += b.qualitySum;
    totalWithNutrition += b.withNutrition;
    totalWithCookTime += b.withCookTime;
    totalWithImage += b.withImage;
  }
  perDomain.sort((a, b) => b.total - a.total);

  // Monthly trend — last 12 months.
  const now = new Date();
  const trend: Array<{ month: string; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    trend.push({ month: monthKey, count: 0 });
  }
  const trendMap = new Map(trend.map((t) => [t.month, t]));
  for (const r of recipes) {
    const d = r.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = trendMap.get(key);
    if (entry) entry.count++;
  }

  // Flag counts (current DB state — value=true rows)
  const flagGroups = await prisma.recipeDietFlag.groupBy({
    by: ['flagCode'],
    where: { value: true },
    _count: { flagCode: true },
    orderBy: { _count: { flagCode: 'desc' } },
  });
  const flagCounts = flagGroups.map((g) => ({
    flagCode: g.flagCode,
    count: g._count.flagCode,
  }));

  const total = recipes.length;
  const totals = {
    recipes: total,
    withNutrition: totalWithNutrition,
    withCookTime: totalWithCookTime,
    withImage: totalWithImage,
    avgQualityScore: total > 0 ? Math.round(totalQualitySum / total) : 0,
  };

  return {
    generatedAt: new Date().toISOString(),
    perDomain,
    totals,
    trend,
    flagCounts,
  };
}
