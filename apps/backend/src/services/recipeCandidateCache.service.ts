/**
 * Recipe Candidate Cache Service
 *
 * Caches recipe candidate query results in Redis to avoid repeated DB queries
 * for similar meal slots. Falls back to direct DB queries when Redis is unavailable.
 */

import { redis } from '../utils/redis';
import {
  findCandidates as findCandidatesDb,
  type RecipeCandidateQuery,
  type ScoredRecipeCandidate,
} from './recipeCandidate.service';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Cache TTL in seconds (1 hour) */
const CACHE_TTL = 3600;

/** Cache key prefix */
const CACHE_PREFIX = 'rc:';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from query parameters.
 *
 * Groups queries by:
 *  - mealType
 *  - kcal bucket (rounded to nearest 50)
 *  - sorted allergen codes
 *  - sorted diet flags
 *  - current month (for seasonal scoring)
 *  - cost ceiling
 *  - time limit
 */
function buildCacheKey(query: RecipeCandidateQuery): string {
  const kcalBucket = Math.round((query.targetKcal || 0) / 50) * 50;
  const allergens = (query.excludeAllergens ?? []).sort().join(',');
  const flags = (query.requiredDietFlags ?? []).sort().join(',');
  const month = new Date().getMonth() + 1;
  const cost = query.maxCost ?? 'any';
  const time = query.maxTotalTimeMinutes ?? 'any';
  return `${CACHE_PREFIX}${query.mealType}:${kcalBucket}:${allergens}:${flags}:${month}:${cost}:${time}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Find recipe candidates with Redis caching.
 *
 * On cache hit: returns cached results with excludeRecipeIds filtered out.
 * On cache miss: queries DB, stores result, returns scored candidates.
 * On Redis error: falls through to direct DB query.
 *
 * @param query - candidate query (same as findCandidates)
 * @returns scored and sorted recipe candidates
 */
export async function findCandidatesCached(
  query: RecipeCandidateQuery,
): Promise<ScoredRecipeCandidate[]> {
  if (!redis) return findCandidatesDb(query);

  const key = buildCacheKey(query);

  // Try cache
  try {
    const cached = await redis.get(key);
    if (cached) {
      let results: ScoredRecipeCandidate[] = JSON.parse(cached);

      // Filter out already-used recipes (diversity)
      if (query.excludeRecipeIds?.length) {
        const excluded = new Set(query.excludeRecipeIds);
        results = results.filter((r) => !excluded.has(r.recipeId));
      }

      return results;
    }
  } catch {
    // Redis error — fall through to DB
  }

  // Cache miss — query DB
  const results = await findCandidatesDb(query);

  // Store in cache (fire-and-forget)
  try {
    redis.set(key, JSON.stringify(results), 'EX', CACHE_TTL).catch(() => {});
  } catch {
    // Ignore cache write errors
  }

  return results;
}

/**
 * Invalidate all recipe candidate caches.
 *
 * Call after recipe import, update, or deletion to ensure
 * stale data is not served from cache.
 */
export async function invalidateRecipeCandidateCache(): Promise<void> {
  if (!redis) return;

  try {
    const keys = await redis.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Ignore — cache will expire naturally via TTL
  }
}
