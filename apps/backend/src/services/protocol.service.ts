// ─── Protocol Service (28.3) ─────────────────────────────────────────────────
//
// Resolves the active NutritionProtocol for a given dietitian (or global default),
// validates protocol integrity, and provides CRUD helpers for admin/dietitian use.

import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MacroRatio {
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
}

export interface MacroRatios {
  REDUCE: MacroRatio;
  GAIN: MacroRatio;
  MAINTAIN: MacroRatio;
}

export interface CaloricAdjustments {
  REDUCE: number;
  GAIN: number;
  MAINTAIN: number;
}

export interface MealSlot {
  mealName: string;
  pct: number;
}

export interface FoodRestriction {
  category: string;
  keywords: string[];
  level: 'HARD_BLOCK' | 'STRONG' | 'SOFT';
  reason: string;
}

export interface AvoidCategory {
  category: string;
  reason: string;
}

export interface ResolvedProtocol {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  isDefault: boolean;
  scope: string;
  dietitianId: string | null;
  macroRatios: MacroRatios;
  bmrFormula: 'MIFFLIN' | 'HARRIS_BENEDICT';
  caloricAdjustments: CaloricAdjustments;
  minProteinPerKg: number;
  maxProteinPerKg: number;
  defaultMealCount: number;
  mealDistribution: MealSlot[];
  foodRestrictions: FoodRestriction[];
  systemPromptAdditions: string | null;
  preferredCuisines: string[];
  recipeComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  avoidFoodCategories: AvoidCategory[];
}

export interface ProtocolSnapshot extends ResolvedProtocol {
  capturedAt: string;
}

export type ProtocolChanges = Record<string, { old: unknown; new: unknown }>;

export interface UpdateProtocolResult {
  protocol: ResolvedProtocol;
  changes: ProtocolChanges | null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const GOALS = ['REDUCE', 'GAIN', 'MAINTAIN'] as const;

/**
 * Validates a protocol's macro ratios and caloric adjustments.
 * Throws AppError on violation.
 */
export function validateProtocol(data: {
  macroRatios: MacroRatios;
  caloricAdjustments: CaloricAdjustments;
  minProteinPerKg: number;
  maxProteinPerKg: number;
  mealDistribution: MealSlot[];
}): void {
  // B + T + W must equal 100% for each goal
  for (const goal of GOALS) {
    const r = data.macroRatios[goal];
    const sum = r.proteinPct + r.fatPct + r.carbsPct;
    if (Math.abs(sum - 100) > 0.5) {
      throw new AppError(400, 'PROTOCOL_MACRO_SUM_INVALID', `Macro ratios for goal ${goal} sum to ${sum}%, must be 100%`);
    }
  }

  // keto exception: carbs can be 5%, otherwise min 20%
  for (const goal of GOALS) {
    const r = data.macroRatios[goal];
    const isKeto = r.carbsPct <= 5;
    if (!isKeto && r.carbsPct < 20) {
      throw new AppError(400, 'PROTOCOL_CARBS_TOO_LOW', `Carbs for goal ${goal} is ${r.carbsPct}% — must be ≥20% (or ≤5% for keto)`);
    }
  }

  // Protein constraints
  if (data.minProteinPerKg < 0.8) {
    throw new AppError(400, 'PROTOCOL_PROTEIN_TOO_LOW', 'minProteinPerKg must be ≥ 0.8 g/kg');
  }
  if (data.maxProteinPerKg > 3.0) {
    throw new AppError(400, 'PROTOCOL_PROTEIN_TOO_HIGH', 'maxProteinPerKg must be ≤ 3.0 g/kg');
  }
  if (data.minProteinPerKg > data.maxProteinPerKg) {
    throw new AppError(400, 'PROTOCOL_PROTEIN_RANGE_INVALID', 'minProteinPerKg must be ≤ maxProteinPerKg');
  }

  // Caloric deficit max -25%
  for (const goal of GOALS) {
    if (data.caloricAdjustments[goal] < -25) {
      throw new AppError(400, 'PROTOCOL_DEFICIT_TOO_HIGH', `Caloric adjustment for ${goal} is ${data.caloricAdjustments[goal]}% — max deficit is -25%`);
    }
  }

  // Meal distribution must sum to 100%
  const mealSum = data.mealDistribution.reduce((acc, m) => acc + m.pct, 0);
  if (Math.abs(mealSum - 100) > 0.5) {
    throw new AppError(400, 'PROTOCOL_MEAL_DIST_INVALID', `mealDistribution sums to ${mealSum}%, must be 100%`);
  }
}

// ─── Resolve active protocol for a dietitian ─────────────────────────────────

/**
 * 28.3.1 resolveActiveProtocol(dietitianId?)
 *
 * Resolution order:
 * 1. Dietitian's active DietitianProtocolAccess (isActive=true) → linked protocol
 * 2. Global default protocol (isDefault=true, scope=GLOBAL)
 * 3. Any active GLOBAL protocol
 * 4. Throws if none found
 */
export async function resolveActiveProtocol(dietitianId?: string | null): Promise<ResolvedProtocol> {
  let protocol = null;

  // Step 1: dietitian-specific active protocol
  if (dietitianId) {
    const access = await prisma.dietitianProtocolAccess.findFirst({
      where: { dietitianId, isActive: true },
      include: { protocol: true },
    });
    if (access?.protocol?.isActive) {
      protocol = access.protocol;
    }
  }

  // Step 2: global default
  if (!protocol) {
    protocol = await prisma.nutritionProtocol.findFirst({
      where: { isDefault: true, isActive: true, scope: 'GLOBAL' },
    });
  }

  // Step 3: any active GLOBAL
  if (!protocol) {
    protocol = await prisma.nutritionProtocol.findFirst({
      where: { isActive: true, scope: 'GLOBAL' },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!protocol) {
    throw new AppError(500, 'PROTOCOL_NOT_FOUND', 'No active NutritionProtocol found');
  }

  return deserializeProtocol(protocol);
}

// ─── Snapshot for policyMetadata ─────────────────────────────────────────────

/**
 * 28.3.4 Returns a snapshot of the protocol for storing in DietPlan.policyMetadata.
 */
export function buildProtocolSnapshot(protocol: ResolvedProtocol): ProtocolSnapshot {
  return {
    ...protocol,
    capturedAt: new Date().toISOString(),
  };
}

// ─── CRUD helpers ─────────────────────────────────────────────────────────────

/** List all protocols (admin: all, dietitian: their assigned ones) */
export async function listProtocols(options?: {
  scope?: 'GLOBAL' | 'DIETITIAN';
  dietitianId?: string;
  activeOnly?: boolean;
}) {
  const where: Prisma.NutritionProtocolWhereInput = {};
  if (options?.scope) where.scope = options.scope;
  if (options?.dietitianId) where.dietitianId = options.dietitianId;
  if (options?.activeOnly) where.isActive = true;

  const protocols = await prisma.nutritionProtocol.findMany({
    where,
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  return protocols.map(deserializeProtocol);
}

/** Get a single protocol by ID */
export async function getProtocol(id: string): Promise<ResolvedProtocol> {
  const protocol = await prisma.nutritionProtocol.findUnique({ where: { id } });
  if (!protocol) throw new AppError(404, 'PROTOCOL_NOT_FOUND', 'Protocol not found');
  return deserializeProtocol(protocol);
}

/** Create a new protocol (admin only). Validates before saving. */
export async function createProtocol(data: {
  name: string;
  description?: string;
  scope?: 'GLOBAL' | 'DIETITIAN';
  dietitianId?: string;
  isDefault?: boolean;
  macroRatios: MacroRatios;
  caloricAdjustments: CaloricAdjustments;
  minProteinPerKg?: number;
  maxProteinPerKg?: number;
  defaultMealCount?: number;
  mealDistribution: MealSlot[];
  foodRestrictions?: FoodRestriction[];
  systemPromptAdditions?: string;
  preferredCuisines?: string[];
  recipeComplexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  avoidFoodCategories?: AvoidCategory[];
}): Promise<ResolvedProtocol> {
  validateProtocol({
    macroRatios: data.macroRatios,
    caloricAdjustments: data.caloricAdjustments,
    minProteinPerKg: data.minProteinPerKg ?? 0.8,
    maxProteinPerKg: data.maxProteinPerKg ?? 2.5,
    mealDistribution: data.mealDistribution,
  });

  // If new default, unset existing defaults
  if (data.isDefault) {
    await prisma.nutritionProtocol.updateMany({
      where: { isDefault: true, scope: data.scope ?? 'GLOBAL' },
      data: { isDefault: false },
    });
  }

  const protocol = await prisma.nutritionProtocol.create({
    data: {
      name: data.name,
      description: data.description,
      scope: data.scope ?? 'GLOBAL',
      dietitianId: data.dietitianId,
      isDefault: data.isDefault ?? false,
      isActive: true,
      macroRatios: data.macroRatios as unknown as Prisma.InputJsonValue,
      bmrFormula: 'MIFFLIN',
      caloricAdjustments: data.caloricAdjustments as unknown as Prisma.InputJsonValue,
      minProteinPerKg: data.minProteinPerKg ?? 0.8,
      maxProteinPerKg: data.maxProteinPerKg ?? 2.5,
      defaultMealCount: data.defaultMealCount ?? 5,
      mealDistribution: data.mealDistribution as unknown as Prisma.InputJsonValue,
      foodRestrictions: (data.foodRestrictions ?? []) as unknown as Prisma.InputJsonValue,
      systemPromptAdditions: data.systemPromptAdditions,
      preferredCuisines: data.preferredCuisines ?? [],
      recipeComplexity: data.recipeComplexity ?? 'MODERATE',
      avoidFoodCategories: (data.avoidFoodCategories ?? []) as unknown as Prisma.InputJsonValue,
    },
  });

  return deserializeProtocol(protocol);
}

/** Duplicate a protocol (45.2). */
export async function duplicateProtocol(id: string) {
  const source = await prisma.nutritionProtocol.findUnique({ where: { id } });
  if (!source) throw new AppError(404, 'NOT_FOUND', 'Protocol not found');

  const copy = await prisma.nutritionProtocol.create({
    data: {
      name: `${source.name} (kopia)`,
      description: source.description,
      scope: source.scope,
      isDefault: false,
      isActive: false,
      macroRatios: source.macroRatios as Prisma.InputJsonValue,
      bmrFormula: source.bmrFormula,
      caloricAdjustments: source.caloricAdjustments as Prisma.InputJsonValue,
      minProteinPerKg: source.minProteinPerKg,
      maxProteinPerKg: source.maxProteinPerKg,
      defaultMealCount: source.defaultMealCount,
      mealDistribution: source.mealDistribution as Prisma.InputJsonValue,
      foodRestrictions: source.foodRestrictions as Prisma.InputJsonValue ?? Prisma.DbNull,
      systemPromptAdditions: source.systemPromptAdditions,
      preferredCuisines: source.preferredCuisines,
      recipeComplexity: source.recipeComplexity,
      avoidFoodCategories: source.avoidFoodCategories as Prisma.InputJsonValue ?? Prisma.DbNull,
    },
  });

  return deserializeProtocol(copy);
}

/** Update a protocol (admin only). Increments version. Returns protocol + diff of changes. */
export async function updateProtocol(
  id: string,
  data: Partial<Omit<Parameters<typeof createProtocol>[0], 'scope' | 'dietitianId'>> & { isActive?: boolean },
): Promise<UpdateProtocolResult> {
  const existing = await prisma.nutritionProtocol.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'PROTOCOL_NOT_FOUND', 'Protocol not found');

  // Detect which content fields actually changed vs existing record
  const contentKeys = [
    'name', 'description', 'macroRatios', 'caloricAdjustments',
    'minProteinPerKg', 'maxProteinPerKg', 'defaultMealCount',
    'mealDistribution', 'foodRestrictions', 'systemPromptAdditions',
    'preferredCuisines', 'recipeComplexity', 'avoidFoodCategories',
  ] as const;

  const allTrackedKeys = [...contentKeys, 'isActive', 'isDefault'] as const;
  const decimalKeys = new Set(['minProteinPerKg', 'maxProteinPerKg']);
  function normalize(val: unknown): unknown {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    if (Array.isArray(val) && val.length === 0) return null;
    return val;
  }

  // Build per-field diff
  const changes: ProtocolChanges = {};
  for (const k of allTrackedKeys) {
    if ((data as Record<string, unknown>)[k] === undefined) continue;
    const oldRaw = decimalKeys.has(k) ? Number(existing[k as keyof typeof existing]) : existing[k as keyof typeof existing];
    const oldNorm = normalize(oldRaw);
    const newNorm = normalize((data as Record<string, unknown>)[k]);
    if (JSON.stringify(oldNorm) !== JSON.stringify(newNorm)) {
      changes[k] = { old: oldNorm, new: newNorm };
    }
  }

  const hasContentChange = contentKeys.some(k => k in changes);

  // Validate merged data only when protocol content is being changed
  if (hasContentChange) {
    const merged = {
      macroRatios: (data.macroRatios ?? (existing.macroRatios as unknown as MacroRatios)),
      caloricAdjustments: (data.caloricAdjustments ?? (existing.caloricAdjustments as unknown as CaloricAdjustments)),
      minProteinPerKg: data.minProteinPerKg ?? Number(existing.minProteinPerKg),
      maxProteinPerKg: data.maxProteinPerKg ?? Number(existing.maxProteinPerKg),
      mealDistribution: (data.mealDistribution ?? (existing.mealDistribution as unknown as MealSlot[])),
    };
    validateProtocol(merged);
  }

  // If new default, unset others of same scope
  if (data.isDefault && !existing.isDefault) {
    await prisma.nutritionProtocol.updateMany({
      where: { isDefault: true, scope: existing.scope, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.nutritionProtocol.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.macroRatios !== undefined && { macroRatios: data.macroRatios as unknown as Prisma.InputJsonValue }),
      ...(data.caloricAdjustments !== undefined && { caloricAdjustments: data.caloricAdjustments as unknown as Prisma.InputJsonValue }),
      ...(data.minProteinPerKg !== undefined && { minProteinPerKg: data.minProteinPerKg }),
      ...(data.maxProteinPerKg !== undefined && { maxProteinPerKg: data.maxProteinPerKg }),
      ...(data.defaultMealCount !== undefined && { defaultMealCount: data.defaultMealCount }),
      ...(data.mealDistribution !== undefined && { mealDistribution: data.mealDistribution as unknown as Prisma.InputJsonValue }),
      ...(data.foodRestrictions !== undefined && { foodRestrictions: data.foodRestrictions as unknown as Prisma.InputJsonValue }),
      ...(data.systemPromptAdditions !== undefined && { systemPromptAdditions: data.systemPromptAdditions }),
      ...(data.preferredCuisines !== undefined && { preferredCuisines: data.preferredCuisines }),
      ...(data.recipeComplexity !== undefined && { recipeComplexity: data.recipeComplexity }),
      ...(data.avoidFoodCategories !== undefined && { avoidFoodCategories: data.avoidFoodCategories as unknown as Prisma.InputJsonValue }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(hasContentChange && { version: { increment: 1 } }),
    },
  });

  const hasChanges = Object.keys(changes).length > 0;
  return {
    protocol: deserializeProtocol(updated),
    changes: hasChanges ? changes : null,
  };
}

// ─── Dietitian protocol access management ─────────────────────────────────────

/** List protocols assigned to a dietitian */
export async function getDietitianProtocols(dietitianId: string) {
  const accesses = await prisma.dietitianProtocolAccess.findMany({
    where: { dietitianId },
    include: { protocol: true },
    orderBy: { assignedAt: 'desc' },
  });

  // 55.1: Count patients using each protocol (via DietPlan.templateId)
  const protocolIds = accesses.map((a) => a.protocolId);
  const patientCounts = protocolIds.length > 0
    ? await prisma.dietPlan.groupBy({
        by: ['templateId'],
        where: {
          templateId: { in: protocolIds },
          patient: { dietitianId },
          status: { in: ['PUBLISHED', 'SENT', 'GENERATED', 'REVIEWED'] },
        },
        _count: { _all: true },
      })
    : [];
  const countMap = new Map(patientCounts.map((c) => [c.templateId, c._count._all]));

  return accesses.map((a) => ({
    ...deserializeProtocol(a.protocol),
    isActive: a.isActive,
    assignedAt: a.assignedAt,
    assignedBy: a.assignedBy,
    activePatientCount: countMap.get(a.protocolId) ?? 0,
  }));
}

/** Assign a protocol to a dietitian (admin only) */
export async function assignProtocolToDietitian(
  dietitianId: string,
  protocolId: string,
  assignedBy: string,
): Promise<void> {
  const protocol = await prisma.nutritionProtocol.findUnique({ where: { id: protocolId } });
  if (!protocol) throw new AppError(404, 'PROTOCOL_NOT_FOUND', 'Protocol not found');

  await prisma.dietitianProtocolAccess.upsert({
    where: { dietitianId_protocolId: { dietitianId, protocolId } },
    create: { dietitianId, protocolId, assignedBy, isActive: false },
    update: { assignedBy },
  });
}

/** Set the active protocol for a dietitian */
export async function setActiveDietitianProtocol(
  dietitianId: string,
  protocolId: string,
): Promise<void> {
  // Check access exists
  const access = await prisma.dietitianProtocolAccess.findUnique({
    where: { dietitianId_protocolId: { dietitianId, protocolId } },
  });
  if (!access) {
    throw new AppError(403, 'PROTOCOL_NOT_ASSIGNED', 'Protocol not assigned to this dietitian');
  }

  // Deactivate all others, activate chosen
  await prisma.$transaction([
    prisma.dietitianProtocolAccess.updateMany({
      where: { dietitianId, isActive: true },
      data: { isActive: false },
    }),
    prisma.dietitianProtocolAccess.update({
      where: { dietitianId_protocolId: { dietitianId, protocolId } },
      data: { isActive: true },
    }),
  ]);
}

// ─── Deserializer ─────────────────────────────────────────────────────────────

export function deserializeProtocol(p: {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  isDefault: boolean;
  scope: string;
  dietitianId: string | null;
  macroRatios: Prisma.JsonValue;
  bmrFormula: string;
  caloricAdjustments: Prisma.JsonValue;
  minProteinPerKg: { toString(): string };
  maxProteinPerKg: { toString(): string };
  defaultMealCount: number;
  mealDistribution: Prisma.JsonValue;
  foodRestrictions: Prisma.JsonValue;
  systemPromptAdditions: string | null;
  preferredCuisines: string[];
  recipeComplexity: string;
  avoidFoodCategories: Prisma.JsonValue;
}): ResolvedProtocol {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    version: p.version,
    isActive: p.isActive,
    isDefault: p.isDefault,
    scope: p.scope,
    dietitianId: p.dietitianId,
    macroRatios: p.macroRatios as unknown as MacroRatios,
    bmrFormula: p.bmrFormula as 'MIFFLIN' | 'HARRIS_BENEDICT',
    caloricAdjustments: p.caloricAdjustments as unknown as CaloricAdjustments,
    minProteinPerKg: Number(p.minProteinPerKg),
    maxProteinPerKg: Number(p.maxProteinPerKg),
    defaultMealCount: p.defaultMealCount,
    mealDistribution: p.mealDistribution as unknown as MealSlot[],
    foodRestrictions: p.foodRestrictions as unknown as FoodRestriction[],
    systemPromptAdditions: p.systemPromptAdditions,
    preferredCuisines: p.preferredCuisines,
    recipeComplexity: p.recipeComplexity as 'SIMPLE' | 'MODERATE' | 'COMPLEX',
    avoidFoodCategories: p.avoidFoodCategories as unknown as AvoidCategory[],
  };
}
