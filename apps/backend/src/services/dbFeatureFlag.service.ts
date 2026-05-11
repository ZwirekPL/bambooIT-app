/**
 * DB-first Diet Generation Feature Flag
 *
 * Checks whether DB-first generation is enabled for a given user/dietitian.
 * Wraps the generic feature flag service with DB-first-specific logic.
 */

import { prisma } from '@db';
import { isFeatureEnabled } from './featureFlag.service';

// ─── Types ──────────────────────────────────────────────────────────────────

/** DB-first generation modes */
export type DbDietMode = 'OFF' | 'DB_ONLY' | 'DB_FIRST' | 'DB_SOLVER' | 'AB_TEST';

// ─── Constants ──────────────────────────────────────────────────────────────

const FLAG_KEY = 'db_first_diet_generation';

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the DB-first diet generation mode for a user.
 *
 * Flag conditions JSON in DB can include:
 * { mode: "DB_ONLY" | "DB_FIRST" | "AB_TEST", userIds?: string[], roles?: string[], percentage?: number }
 *
 * - OFF: Use AI pipeline (default when flag doesn't exist or is disabled)
 * - DB_ONLY: Only use database, never AI
 * - DB_FIRST: Use DB, fallback to AI if coverage < 80%
 * - AB_TEST: Randomly assign DB or AI per generation (for comparison)
 */
export async function getDbDietMode(userId?: string, role?: string): Promise<DbDietMode> {
  const enabled = await isFeatureEnabled(FLAG_KEY, { userId, role });
  if (!enabled) return 'OFF';

  // Load flag to check mode from conditions
  const flag = await prisma.featureFlag.findUnique({ where: { key: FLAG_KEY } });
  if (!flag || !flag.enabled) return 'OFF';

  const conditions = flag.conditions as Record<string, unknown> | null;
  const mode = (conditions?.mode as string)?.toUpperCase();

  if (mode === 'DB_ONLY') return 'DB_ONLY';
  if (mode === 'DB_SOLVER') return 'DB_SOLVER';
  if (mode === 'AB_TEST') return 'AB_TEST';
  return 'DB_FIRST'; // default when enabled
}

/**
 * For AB_TEST mode: determine if this generation should use DB or AI.
 * Uses a simple random coin flip (50/50).
 */
export function shouldUseDbInAbTest(): boolean {
  return Math.random() < 0.5;
}
