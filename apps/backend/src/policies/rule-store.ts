// ─── Clinical Rule Store — DB + Redis cache ──────────────────────────────────
//
// Reads active clinical rules from the database with Redis caching.
// Falls back to hardcoded rules if DB is empty or Redis is unavailable.

import { prisma } from '@db';
import { z } from 'zod';
import { redis } from '../utils/redis';
import { evaluateCondition, type RuleCondition } from './condition-evaluator';
import type { PatientContext, PolicyRule, PolicyEffect, RedFlag, RedFlagResult, TriggeredRedFlag } from './types';
import { CLINICAL_RULES } from './clinical-rules';
import { RED_FLAGS } from './red-flags';

const CACHE_KEY_POLICIES = 'clinical-rules:policies';
const CACHE_KEY_RED_FLAGS = 'clinical-rules:red-flags';
const CACHE_TTL_SECONDS = 300; // 5 minutes

// ─── Zod schemas for DB effect validation ───────────────────────────────────

const modifyTargetsSchema = z.object({
  type: z.literal('MODIFY_TARGETS'),
  field: z.enum(['targetKcal', 'targetProteinG', 'targetFatG', 'targetCarbsG']),
  operation: z.enum(['SET', 'MULTIPLY', 'ADD', 'MAX', 'MIN']),
  value: z.number(),
});

const mealDistributionSchema = z.object({
  type: z.literal('MEAL_DISTRIBUTION'),
  nutrient: z.string(),
  maxPerMealPct: z.number().optional(),
  minMeals: z.number().optional(),
});

const nutrientLimitSchema = z.object({
  type: z.literal('NUTRIENT_LIMIT'),
  nutrient: z.string(),
  scope: z.enum(['PER_100G', 'PER_MEAL', 'DAILY_TOTAL']),
  min: z.number().optional(),
  max: z.number().optional(),
});

const excludeProductsSchema = z.object({
  type: z.literal('EXCLUDE_PRODUCTS'),
  flagKey: z.string(),
  flagValue: z.boolean(),
});

const preferProductsSchema = z.object({
  type: z.literal('PREFER_PRODUCTS'),
  flagKey: z.string(),
  flagValue: z.boolean(),
});

const excludeKeywordsSchema = z.object({
  type: z.literal('EXCLUDE_KEYWORDS'),
  keywords: z.array(z.string()),
});

const clinicalNoteSchema = z.object({
  type: z.literal('CLINICAL_NOTE'),
  note: z.string(),
  category: z.enum(['RESTRICTION', 'RECOMMENDATION', 'WARNING', 'INFO']).optional(),
});

const suggestSupplementSchema = z.object({
  type: z.literal('SUGGEST_SUPPLEMENT'),
  name: z.string(),
  dose: z.string(),
  reason: z.string(),
  conditionalOnAge: z.object({ minAge: z.number().optional(), maxAge: z.number().optional() }).optional(),
});

const ageConditionalSchema = z.object({
  type: z.literal('AGE_CONDITIONAL'),
  ageRanges: z.array(z.object({
    minAge: z.number().optional(),
    maxAge: z.number().optional(),
    effects: z.array(z.unknown()),
  })),
});

const policyEffectSchema = z.discriminatedUnion('type', [
  modifyTargetsSchema,
  mealDistributionSchema,
  nutrientLimitSchema,
  excludeProductsSchema,
  preferProductsSchema,
  excludeKeywordsSchema,
  clinicalNoteSchema,
  suggestSupplementSchema,
  ageConditionalSchema,
]);

const redFlagEffectSchema = z.object({
  message: z.string().min(1),
});

/**
 * Validates policy effects from DB. Returns valid effects, logs warnings for invalid.
 */
function validatePolicyEffects(effects: unknown, ruleName: string): PolicyEffect[] {
  if (!Array.isArray(effects)) {
    console.warn(`[rule-store] Rule "${ruleName}": effects is not an array, skipping`);
    return [];
  }
  const valid: PolicyEffect[] = [];
  for (const effect of effects) {
    const result = policyEffectSchema.safeParse(effect);
    if (result.success) {
      valid.push(result.data as PolicyEffect);
    } else {
      console.warn(`[rule-store] Rule "${ruleName}": invalid effect skipped:`, result.error.issues[0]?.message);
    }
  }
  return valid;
}

/**
 * Validates red flag effect from DB. Returns message or empty string.
 */
function validateRedFlagEffect(effects: unknown, ruleName: string): string {
  const result = redFlagEffectSchema.safeParse(effects);
  if (result.success) return result.data.message;
  console.warn(`[rule-store] Red flag "${ruleName}": invalid effect, using empty message`);
  return '';
}

interface DbRuleRow {
  id: string;
  name: string;
  description: string;
  type: string;
  severity: string;
  priority: number;
  conditions: unknown;
  effects: unknown;
  version: string;
  conflictsWith: string[];
}

// ─── Fetch from DB with Redis cache ─────────────────────────────────────────

async function fetchRulesFromDb(type: 'POLICY' | 'RED_FLAG'): Promise<DbRuleRow[]> {
  const cacheKey = type === 'POLICY' ? CACHE_KEY_POLICIES : CACHE_KEY_RED_FLAGS;

  // Try Redis cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as DbRuleRow[];
    }
  } catch {
    // Redis unavailable — proceed to DB
  }

  // Fetch from DB
  const rows = await prisma.clinicalRule.findMany({
    where: { type, isActive: true },
    orderBy: { priority: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      severity: true,
      priority: true,
      conditions: true,
      effects: true,
      version: true,
      conflictsWith: true,
    },
  });

  // Cache in Redis
  try {
    await redis.set(cacheKey, JSON.stringify(rows), 'EX', CACHE_TTL_SECONDS);
  } catch {
    // Non-blocking
  }

  return rows as DbRuleRow[];
}

// ─── Convert DB rows to PolicyRule[] ────────────────────────────────────────

function dbRowToPolicyRule(row: DbRuleRow): PolicyRule {
  const condition = row.conditions as RuleCondition;
  const effects = validatePolicyEffects(row.effects, row.name);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    condition: (ctx: PatientContext) => evaluateCondition(condition, ctx),
    effects,
    version: row.version,
    conflictsWith: row.conflictsWith,
  };
}

// ─── Convert DB rows to RedFlag[] ───────────────────────────────────────────

function dbRowToRedFlag(row: DbRuleRow): RedFlag {
  const condition = row.conditions as RuleCondition;
  const message = validateRedFlagEffect(row.effects, row.name);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    severity: row.severity as RedFlag['severity'],
    condition: (ctx: PatientContext) => evaluateCondition(condition, ctx),
    message,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Loads active policy rules from DB. Falls back to hardcoded CLINICAL_RULES.
 */
export async function loadPolicyRules(): Promise<PolicyRule[]> {
  try {
    const rows = await fetchRulesFromDb('POLICY');
    if (rows.length > 0) {
      return rows.map(dbRowToPolicyRule);
    }
  } catch {
    // DB error — fall back to hardcoded
  }
  return CLINICAL_RULES;
}

/**
 * Loads active red flags from DB and evaluates them against patient context.
 * Falls back to hardcoded RED_FLAGS.
 */
export async function evaluateRedFlagsFromDb(ctx: PatientContext): Promise<RedFlagResult> {
  let flags: RedFlag[];

  try {
    const rows = await fetchRulesFromDb('RED_FLAG');
    flags = rows.length > 0 ? rows.map(dbRowToRedFlag) : RED_FLAGS;
  } catch {
    flags = RED_FLAGS;
  }

  const triggered: TriggeredRedFlag[] = [];

  for (const flag of flags) {
    if (flag.condition(ctx)) {
      triggered.push({
        flagId: flag.id,
        name: flag.name,
        severity: flag.severity,
        message: flag.message,
      });
    }
  }

  const blockGeneration = triggered.some(f => f.severity === 'CRITICAL');

  return {
    triggered: triggered.length > 0,
    flags: triggered,
    blockGeneration,
  };
}

/**
 * Invalidate Redis cache for clinical rules (call after admin edits).
 */
export async function invalidateRuleCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY_POLICIES, CACHE_KEY_RED_FLAGS);
  } catch {
    // Non-blocking
  }
}
