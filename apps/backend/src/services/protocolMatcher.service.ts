// ─── Protocol Matcher Service (30.2.1) ──────────────────────────────────────
//
// Scans ProtocolTrigger table and matches interview answers to protocols.
// Results are sorted by priority (1=diseases > 2=allergies > 3=preferences).

import { prisma } from '@db';
import { redis } from '../utils/redis';

const CACHE_KEY = 'protocol-triggers:active';
const CACHE_TTL = 300; // 5 minutes

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MatchedProtocol {
  triggerId: string;
  protocolId: string;
  protocolName: string;
  interviewField: string;
  interviewValue: string;
  priority: number;
  score: number;
}

export interface MatchResult {
  matchedProtocols: MatchedProtocol[];
  unmatchedFields: string[];
}

interface TriggerRow {
  id: string;
  interviewField: string;
  interviewValue: string;
  protocolId: string;
  protocolName: string;
  priority: number;
  score: number;
}

// ─── Fields that can contain arrays in interview answers ─────────────────────

const ARRAY_FIELDS = new Set([
  'chronicDiseases',
  'allergies',
  'intolerances',
  'activityTypes',
  'digestiveIssues',
  'medications',
  'hormonalIssues',
  'cuisinePreferences',
  'supplements',
]);

const SCALAR_FIELDS = new Set([
  'mainGoal',
  'dietType',
  'pregnancyStatus',
  'stressLevel',
  'sleepHours',
  'alcoholFrequency',
  'workType',
  'cookingTime',
]);

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Fetches active triggers from DB with Redis cache.
 */
async function getActiveTriggers(): Promise<TriggerRow[]> {
  // Try cache
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as TriggerRow[];
  } catch {
    // Redis unavailable — fall through to DB
  }

  const rows = await prisma.protocolTrigger.findMany({
    where: { isActive: true },
    include: {
      protocol: { select: { name: true, isActive: true } },
    },
    orderBy: { priority: 'asc' },
  });

  const triggers: TriggerRow[] = rows
    .filter((r) => r.protocol.isActive)
    .map((r) => ({
      id: r.id,
      interviewField: r.interviewField,
      interviewValue: r.interviewValue,
      protocolId: r.protocolId,
      protocolName: r.protocol.name,
      priority: r.priority,
      score: r.score,
    }));

  // Cache
  try {
    await redis.set(CACHE_KEY, JSON.stringify(triggers), 'EX', CACHE_TTL);
  } catch {
    // Non-blocking
  }

  return triggers;
}

/**
 * Matches interview answers against active ProtocolTriggers.
 *
 * @param answers - Raw interview answers (decrypted JSON)
 * @returns Matched protocols sorted by priority, deduplicated by protocolId (highest priority wins)
 */
export async function matchProtocolsFromInterview(
  answers: Record<string, unknown>,
): Promise<MatchResult> {
  const triggers = await getActiveTriggers();
  const matched: MatchedProtocol[] = [];
  const matchedFieldValues = new Set<string>();

  // Build a lookup: field+value → triggers
  const triggerMap = new Map<string, TriggerRow[]>();
  for (const t of triggers) {
    const key = `${t.interviewField}::${t.interviewValue}`;
    const arr = triggerMap.get(key) ?? [];
    arr.push(t);
    triggerMap.set(key, arr);
  }

  // Check each interview field
  const allCheckedFields: string[] = [];

  for (const field of [...ARRAY_FIELDS, ...SCALAR_FIELDS]) {
    const value = answers[field];
    if (value === undefined || value === null || value === '') continue;

    allCheckedFields.push(field);

    if (ARRAY_FIELDS.has(field) && Array.isArray(value)) {
      for (const item of value) {
        if (typeof item !== 'string' || item === 'none' || item === '') continue;
        const key = `${field}::${item}`;
        const hits = triggerMap.get(key);
        if (hits) {
          for (const t of hits) {
            matched.push({
              triggerId: t.id,
              protocolId: t.protocolId,
              protocolName: t.protocolName,
              interviewField: field,
              interviewValue: item,
              priority: t.priority,
              score: t.score,
            });
            matchedFieldValues.add(key);
          }
        }
      }
    } else if (SCALAR_FIELDS.has(field) && typeof value === 'string') {
      const key = `${field}::${value}`;
      const hits = triggerMap.get(key);
      if (hits) {
        for (const t of hits) {
          matched.push({
            triggerId: t.id,
            protocolId: t.protocolId,
            protocolName: t.protocolName,
            interviewField: field,
            interviewValue: value,
            priority: t.priority,
            score: t.score,
          });
          matchedFieldValues.add(key);
        }
      }
    }
  }

  // Sort by priority (1=highest), then by score (highest first)
  matched.sort((a, b) => a.priority - b.priority || b.score - a.score);

  // Deduplicate: keep highest priority match per protocolId
  const seen = new Set<string>();
  const deduplicated: MatchedProtocol[] = [];
  for (const m of matched) {
    if (!seen.has(m.protocolId)) {
      seen.add(m.protocolId);
      deduplicated.push(m);
    }
  }

  // Unmatched: fields that had values but no trigger matched
  const unmatchedFields = allCheckedFields.filter((f) => {
    const value = answers[f];
    if (ARRAY_FIELDS.has(f) && Array.isArray(value)) {
      return !value.some((v: string) => matchedFieldValues.has(`${f}::${v}`));
    }
    return !matchedFieldValues.has(`${f}::${value}`);
  });

  return { matchedProtocols: deduplicated, unmatchedFields };
}

/**
 * Invalidate the trigger cache (call after admin CRUD on ProtocolTrigger).
 */
export async function invalidateTriggerCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY);
  } catch {
    // Non-blocking
  }
}
