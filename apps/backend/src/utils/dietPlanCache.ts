import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from './cache';

export const PLAN_CACHE_TTL_SECONDS = 3600; // 1 hour

// ─── key builders ─────────────────────────────────────────────────────────────

export function buildPlanIdCacheKey(id: string): string {
  return `dietplan:id:${id}`;
}

export function buildPlanMatchCacheKey(
  goal: string,
  kcal: number,
  mealCount: number,
  dietType: string,
): string {
  return `dietplan:match:${goal}:${kcal}:${mealCount}:${dietType}`;
}

// ─── get / set / invalidate ───────────────────────────────────────────────────

export async function getCachedPlan<T>(key: string): Promise<T | null> {
  return cacheGet<T>(key);
}

export async function setCachedPlan(
  key: string,
  value: unknown,
  ttl = PLAN_CACHE_TTL_SECONDS,
): Promise<void> {
  return cacheSet(key, value, ttl);
}

export async function invalidatePlanById(id: string): Promise<void> {
  return cacheDel(buildPlanIdCacheKey(id));
}

export async function invalidatePlanMatchCache(): Promise<void> {
  return cacheDelPattern('dietplan:match:*');
}

export async function invalidateAllPlanCache(): Promise<void> {
  await Promise.all([cacheDelPattern('dietplan:id:*'), cacheDelPattern('dietplan:match:*')]);
}
