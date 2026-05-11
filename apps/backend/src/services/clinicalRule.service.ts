// ─── Clinical Rule CRUD Service ──────────────────────────────────────────────

import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { invalidateRuleCache } from '../policies/rule-store';

interface ListFilters {
  type?: 'POLICY' | 'RED_FLAG';
  severity?: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  isActive?: boolean;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listRules(filters: ListFilters) {
  const { type, severity, isActive, category, search, page = 1, limit = 50 } = filters;

  const where: Prisma.ClinicalRuleWhereInput = {};
  if (type) where.type = type;
  if (severity) where.severity = severity;
  if (isActive !== undefined) where.isActive = isActive;
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rules, total] = await Promise.all([
    prisma.clinicalRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.clinicalRule.count({ where }),
  ]);

  // Resolve createdBy → email (46.8)
  const creatorIds = [...new Set(rules.map((r) => r.createdBy).filter(Boolean))] as string[];
  const creators = creatorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, email: true } })
    : [];
  const creatorMap = new Map(creators.map((u) => [u.id, u.email]));
  const enrichedRules = rules.map((r) => ({
    ...r,
    createdByEmail: r.createdBy ? creatorMap.get(r.createdBy) ?? null : null,
  }));

  return { rules: enrichedRules, total, page, limit };
}

export async function getRuleById(id: string) {
  const rule = await prisma.clinicalRule.findUnique({ where: { id } });
  if (!rule) throw new AppError(404, 'NOT_FOUND', 'Clinical rule not found');
  return rule;
}

export async function createRule(data: {
  name: string;
  description: string;
  type: 'POLICY' | 'RED_FLAG';
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  priority: number;
  conditions: Prisma.InputJsonValue;
  effects: Prisma.InputJsonValue;
  source?: string;
  version?: string;
  sources?: Prisma.InputJsonValue;
  conflictsWith?: string[];
  category?: string;
  createdBy?: string;
}) {
  const rule = await prisma.clinicalRule.create({
    data: {
      name: data.name,
      description: data.description,
      type: data.type,
      severity: data.severity,
      priority: data.priority,
      conditions: data.conditions,
      effects: data.effects,
      source: data.source ?? null,
      version: data.version ?? '1.0',
      sources: data.sources ?? undefined,
      conflictsWith: data.conflictsWith ?? [],
      category: data.category ?? null,
      isDefault: false,
      isActive: true,
      createdBy: data.createdBy ?? null,
    },
  });

  await invalidateRuleCache();
  return rule;
}

export async function updateRule(
  id: string,
  data: {
    name?: string;
    description?: string;
    severity?: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
    priority?: number;
    conditions?: Prisma.InputJsonValue;
    effects?: Prisma.InputJsonValue;
    source?: string | null;
    version?: string;
    sources?: Prisma.InputJsonValue | null;
    conflictsWith?: string[];
    category?: string | null;
    isActive?: boolean;
  },
  changedBy?: string,
) {
  const existing = await prisma.clinicalRule.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Clinical rule not found');

  // Save history snapshot
  await prisma.clinicalRuleHistory.create({
    data: {
      ruleId: id,
      changedBy: changedBy ?? null,
      changeSummary: buildChangeSummary(existing, data),
      previousData: JSON.parse(JSON.stringify(existing)),
    },
  });

  // Prisma requires Prisma.DbNull for nullable Json fields instead of null
  const updateData: Record<string, unknown> = { ...data };
  if (data.sources === null) {
    updateData.sources = Prisma.DbNull;
  }

  const updated = await prisma.clinicalRule.update({
    where: { id },
    data: updateData,
  });

  await invalidateRuleCache();
  return updated;
}

export async function toggleRuleActive(id: string, isActive: boolean, changedBy?: string) {
  const existing = await prisma.clinicalRule.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Clinical rule not found');

  await prisma.clinicalRuleHistory.create({
    data: {
      ruleId: id,
      changedBy: changedBy ?? null,
      changeSummary: isActive ? 'Activated rule' : 'Deactivated rule',
      previousData: JSON.parse(JSON.stringify(existing)),
    },
  });

  const updated = await prisma.clinicalRule.update({
    where: { id },
    data: { isActive },
  });

  await invalidateRuleCache();
  return updated;
}

export async function deleteRule(id: string) {
  const existing = await prisma.clinicalRule.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Clinical rule not found');
  if (existing.isDefault) {
    throw new AppError(400, 'CANNOT_DELETE_DEFAULT', 'Default rules cannot be deleted, only deactivated');
  }

  await prisma.clinicalRule.delete({ where: { id } });
  await invalidateRuleCache();
}

export async function getRuleHistory(ruleId: string) {
  const entries = await prisma.clinicalRuleHistory.findMany({
    where: { ruleId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Resolve changedBy → email (46.8)
  const changerIds = [...new Set(entries.map((e) => e.changedBy).filter(Boolean))] as string[];
  const changers = changerIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: changerIds } }, select: { id: true, email: true } })
    : [];
  const changerMap = new Map(changers.map((u) => [u.id, u.email]));

  return entries.map((e) => ({
    ...e,
    changedByEmail: e.changedBy ? changerMap.get(e.changedBy) ?? null : null,
  }));
}

// ── Duplicate rule (46.1) ─────────────────────────────────────────────────

export async function duplicateRule(id: string, createdBy: string) {
  const source = await prisma.clinicalRule.findUnique({ where: { id } });
  if (!source) throw new AppError(404, 'NOT_FOUND', 'Clinical rule not found');

  const copy = await prisma.clinicalRule.create({
    data: {
      name: `${source.name} (kopia)`,
      description: source.description,
      type: source.type,
      severity: source.severity,
      priority: source.priority,
      conditions: source.conditions as Prisma.InputJsonValue,
      effects: source.effects as Prisma.InputJsonValue,
      source: source.source,
      version: '1.0',
      sources: source.sources as Prisma.InputJsonValue ?? Prisma.DbNull,
      conflictsWith: source.conflictsWith,
      category: source.category,
      isDefault: false,
      isActive: false,
      createdBy,
    },
  });

  await invalidateRuleCache();
  return copy;
}

// ── Restore from history (46.7) ───────────────────────────────────────────

export async function restoreFromHistory(ruleId: string, historyId: string, changedBy: string) {
  const historyEntry = await prisma.clinicalRuleHistory.findFirst({
    where: { id: historyId, ruleId },
  });
  if (!historyEntry) throw new AppError(404, 'NOT_FOUND', 'History entry not found');

  const existing = await prisma.clinicalRule.findUnique({ where: { id: ruleId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Clinical rule not found');

  const snapshot = historyEntry.previousData as Record<string, unknown>;

  // Save current state as history before restore
  await prisma.clinicalRuleHistory.create({
    data: {
      ruleId,
      changedBy,
      changeSummary: `Restored to version from ${historyEntry.createdAt.toISOString().slice(0, 10)}`,
      previousData: existing as unknown as Prisma.InputJsonValue,
    },
  });

  const restored = await prisma.clinicalRule.update({
    where: { id: ruleId },
    data: {
      name: snapshot.name as string,
      description: snapshot.description as string,
      severity: snapshot.severity as 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW',
      priority: snapshot.priority as number,
      conditions: snapshot.conditions as Prisma.InputJsonValue,
      effects: snapshot.effects as Prisma.InputJsonValue,
      source: snapshot.source as string | null,
      version: snapshot.version as string,
      conflictsWith: snapshot.conflictsWith as string[],
      category: snapshot.category as string | null,
    },
  });

  await invalidateRuleCache();
  return restored;
}

// ── Bulk operations (46.4) ────────────────────────────────────────────────

export type BulkRuleAction = 'activate' | 'deactivate' | 'changeSeverity' | 'changeCategory';

export async function bulkRuleAction(ids: string[], action: BulkRuleAction, value?: string) {
  const data: Prisma.ClinicalRuleUpdateManyMutationInput = {};
  if (action === 'activate') data.isActive = true;
  else if (action === 'deactivate') data.isActive = false;
  else if (action === 'changeSeverity' && value) data.severity = value as 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  else if (action === 'changeCategory' && value) data.category = value;

  const result = await prisma.clinicalRule.updateMany({
    where: { id: { in: ids } },
    data,
  });

  await invalidateRuleCache();
  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildChangeSummary(
  existing: Record<string, unknown>,
  changes: Record<string, unknown>,
): string {
  const changedFields = Object.keys(changes).filter(k => changes[k] !== undefined);
  if (changedFields.length === 0) return 'No changes';
  return `Updated: ${changedFields.join(', ')}`;
}
