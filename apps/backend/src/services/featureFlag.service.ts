import { prisma, Prisma } from '@db';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FlagConditions {
  /** Only these roles see the feature */
  roles?: string[];
  /** Specific user IDs that see the feature (allowlist) */
  userIds?: string[];
  /** Percentage rollout (0–100). Uses hash of userId for determinism */
  percentage?: number;
}

export interface FlagContext {
  userId?: string;
  role?: string;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

interface CachedFlags {
  flags: Map<string, { enabled: boolean; conditions: FlagConditions | null }>;
  loadedAt: number;
}

let cache: CachedFlags | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

async function loadFlags(): Promise<CachedFlags> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }

  const rows = await prisma.featureFlag.findMany({
    select: { key: true, enabled: true, conditions: true },
  });

  const flags = new Map<string, { enabled: boolean; conditions: FlagConditions | null }>();
  for (const row of rows) {
    flags.set(row.key, {
      enabled: row.enabled,
      conditions: row.conditions as FlagConditions | null,
    });
  }

  cache = { flags, loadedAt: Date.now() };
  return cache;
}

/** Force cache invalidation (call after admin CRUD) */
export function invalidateFlagCache(): void {
  cache = null;
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash for percentage rollout.
 * Returns 0–99 based on flagKey + userId.
 */
function hashPercentage(flagKey: string, userId: string): number {
  let hash = 0;
  const str = `${flagKey}:${userId}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash) % 100;
}

/**
 * Check if a feature flag is enabled for a given context.
 *
 * Evaluation order:
 * 1. Flag not found → false
 * 2. Flag globally disabled → false
 * 3. No conditions → true (globally enabled)
 * 4. userIds allowlist → true if matched
 * 5. roles list → true if matched
 * 6. percentage → deterministic hash check
 * 7. If conditions exist but none match → false
 */
export async function isFeatureEnabled(key: string, ctx?: FlagContext): Promise<boolean> {
  const { flags } = await loadFlags();
  const flag = flags.get(key);

  if (!flag) return false;
  if (!flag.enabled) return false;

  const cond = flag.conditions;
  if (!cond) return true; // globally enabled, no conditions

  const hasAnyCondition = (cond.userIds && cond.userIds.length > 0)
    || (cond.roles && cond.roles.length > 0)
    || (cond.percentage !== undefined);

  if (!hasAnyCondition) return true;

  // User ID allowlist
  if (cond.userIds && cond.userIds.length > 0 && ctx?.userId) {
    if (cond.userIds.includes(ctx.userId)) return true;
  }

  // Role-based
  if (cond.roles && cond.roles.length > 0 && ctx?.role) {
    if (cond.roles.includes(ctx.role)) return true;
  }

  // Percentage rollout
  if (cond.percentage !== undefined && ctx?.userId) {
    if (hashPercentage(key, ctx.userId) < cond.percentage) return true;
  }

  return false;
}

// ─── Admin CRUD ──────────────────────────────────────────────────────────────

export async function listFeatureFlags() {
  return prisma.featureFlag.findMany({
    orderBy: { key: 'asc' },
  });
}

export async function getFeatureFlag(id: string) {
  return prisma.featureFlag.findUnique({ where: { id } });
}

export async function createFeatureFlag(data: {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  conditions?: FlagConditions;
}) {
  const flag = await prisma.featureFlag.create({
    data: {
      key: data.key,
      name: data.name,
      description: data.description,
      enabled: data.enabled ?? false,
      conditions: data.conditions as unknown as Prisma.InputJsonValue ?? undefined,
    },
  });
  invalidateFlagCache();
  return flag;
}

export async function updateFeatureFlag(id: string, data: {
  name?: string;
  description?: string;
  enabled?: boolean;
  conditions?: FlagConditions | null;
}) {
  const updateData: Prisma.FeatureFlagUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.conditions !== undefined) {
    updateData.conditions = data.conditions as unknown as Prisma.InputJsonValue ?? Prisma.JsonNull;
  }

  const flag = await prisma.featureFlag.update({
    where: { id },
    data: updateData,
  });
  invalidateFlagCache();
  return flag;
}

export async function deleteFeatureFlag(id: string) {
  await prisma.featureFlag.delete({ where: { id } });
  invalidateFlagCache();
}
