// ─── Conflict Detector Service (30.2.2) ─────────────────────────────────────
//
// Checks matched protocol triggers against ProtocolConflict table.
// Returns detected conflicts with severity (BLOCK / WARN).

import { prisma } from '@db';
import { redis } from '../utils/redis';

const CACHE_KEY = 'protocol-conflicts:active';
const CACHE_TTL = 300; // 5 minutes

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DetectedConflict {
  conflictId: string;
  triggerAField: string;
  triggerAValue: string;
  triggerBField: string;
  triggerBValue: string;
  severity: 'BLOCK' | 'WARN';
  messageKey: string;
  winnerSide: string;
}

export interface ConflictResult {
  conflicts: DetectedConflict[];
  hasBlockingConflict: boolean;
}

interface ConflictRow {
  id: string;
  triggerAField: string;
  triggerAValue: string;
  triggerBField: string;
  triggerBValue: string;
  severity: string;
  messageKey: string;
  winnerSide: string;
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Fetches active conflicts from DB with Redis cache.
 */
async function getActiveConflicts(): Promise<ConflictRow[]> {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as ConflictRow[];
  } catch {
    // Redis unavailable
  }

  const rows = await prisma.protocolConflict.findMany({
    where: { isActive: true },
  });

  const conflicts: ConflictRow[] = rows.map((r) => ({
    id: r.id,
    triggerAField: r.triggerAField,
    triggerAValue: r.triggerAValue,
    triggerBField: r.triggerBField,
    triggerBValue: r.triggerBValue,
    severity: r.severity,
    messageKey: r.messageKey,
    winnerSide: r.winnerSide,
  }));

  try {
    await redis.set(CACHE_KEY, JSON.stringify(conflicts), 'EX', CACHE_TTL);
  } catch {
    // Non-blocking
  }

  return conflicts;
}

/**
 * Detect conflicts between interview answers.
 *
 * Works directly on raw answers (not matched protocols) so it can be used
 * in pre-check before saving the interview.
 *
 * @param answers - Raw interview answers
 * @returns Detected conflicts and whether any are blocking
 */
export async function detectConflicts(
  answers: Record<string, unknown>,
): Promise<ConflictResult> {
  const conflictDefs = await getActiveConflicts();
  const detected: DetectedConflict[] = [];

  // Build a set of all active field::value pairs from answers
  const activeValues = new Set<string>();
  for (const [field, value] of Object.entries(answers)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item !== 'none' && item !== '') {
          activeValues.add(`${field}::${item}`);
        }
      }
    } else if (typeof value === 'string') {
      activeValues.add(`${field}::${value}`);
    }
  }

  // Check each conflict definition against active values
  for (const c of conflictDefs) {
    const hasA = activeValues.has(`${c.triggerAField}::${c.triggerAValue}`);
    const hasB = activeValues.has(`${c.triggerBField}::${c.triggerBValue}`);

    if (hasA && hasB) {
      detected.push({
        conflictId: c.id,
        triggerAField: c.triggerAField,
        triggerAValue: c.triggerAValue,
        triggerBField: c.triggerBField,
        triggerBValue: c.triggerBValue,
        severity: c.severity as 'BLOCK' | 'WARN',
        messageKey: c.messageKey,
        winnerSide: c.winnerSide,
      });
    }
  }

  return {
    conflicts: detected,
    hasBlockingConflict: detected.some((c) => c.severity === 'BLOCK'),
  };
}

/**
 * Invalidate the conflict cache (call after admin CRUD on ProtocolConflict).
 */
export async function invalidateConflictCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY);
  } catch {
    // Non-blocking
  }
}
