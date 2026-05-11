// ─── Clinical Rule Admin Controller ──────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as ruleService from '../services/clinicalRule.service';

const listSchema = z.object({
  type: z.enum(['POLICY', 'RED_FLAG']).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  category: z.string().max(50).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const idSchema = z.object({ id: z.string().cuid() });

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  type: z.enum(['POLICY', 'RED_FLAG']),
  severity: z.enum(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']),
  priority: z.number().int().min(0).max(200),
  conditions: z.record(z.unknown()),
  effects: z.unknown(),
  source: z.string().max(200).optional(),
  version: z.string().max(20).optional(),
  sources: z.array(z.object({
    ref: z.string(),
    url: z.string().optional(),
    year: z.number().optional(),
  })).optional(),
  conflictsWith: z.array(z.string()).optional(),
  category: z.string().max(50).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']).optional(),
  priority: z.number().int().min(0).max(200).optional(),
  conditions: z.record(z.unknown()).optional(),
  effects: z.unknown().optional(),
  source: z.string().max(200).nullable().optional(),
  version: z.string().max(20).optional(),
  sources: z.array(z.object({
    ref: z.string(),
    url: z.string().optional(),
    year: z.number().optional(),
  })).nullable().optional(),
  conflictsWith: z.array(z.string()).optional(),
  category: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query'));
    const result = await ruleService.listRules(parsed.data);
    return res.json(result);
  } catch (err) { next(err); }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const rule = await ruleService.getRuleById(parsed.data.id);
    return res.json(rule);
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
    const rule = await ruleService.createRule({
      ...parsed.data,
      conditions: JSON.parse(JSON.stringify(parsed.data.conditions)),
      effects: JSON.parse(JSON.stringify(parsed.data.effects)),
      sources: parsed.data.sources ? JSON.parse(JSON.stringify(parsed.data.sources)) : undefined,
      createdBy: req.user?.sub,
    });
    return res.status(201).json(rule);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = updateSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));

    const data = bodyParsed.data;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
    if (data.effects !== undefined) updateData.effects = data.effects;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.sources !== undefined) updateData.sources = data.sources;
    if (data.conflictsWith !== undefined) updateData.conflictsWith = data.conflictsWith;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const rule = await ruleService.updateRule(idParsed.data.id, updateData, req.user?.sub);
    return res.json(rule);
  } catch (err) { next(err); }
}

export async function toggleActive(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
    const rule = await ruleService.toggleRuleActive(idParsed.data.id, bodyParsed.data.isActive, req.user?.sub);
    return res.json(rule);
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    await ruleService.deleteRule(parsed.data.id);
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const history = await ruleService.getRuleHistory(parsed.data.id);
    return res.json(history);
  } catch (err) { next(err); }
}

// ── 46.1 Duplicate ────────────────────────────────────────────────────────

export async function duplicate(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const rule = await ruleService.duplicateRule(parsed.data.id, req.user!.sub);
    return res.status(201).json(rule);
  } catch (err) { next(err); }
}

// ── 46.7 Restore from history ─────────────────────────────────────────────

const restoreSchema = z.object({ id: z.string().cuid(), historyId: z.string().cuid() });

export async function restore(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = restoreSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid params'));
    const rule = await ruleService.restoreFromHistory(parsed.data.id, parsed.data.historyId, req.user!.sub);
    return res.json(rule);
  } catch (err) { next(err); }
}

// ── 46.4 Bulk ─────────────────────────────────────────────────────────────

const bulkSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
  action: z.enum(['activate', 'deactivate', 'changeSeverity', 'changeCategory']),
  value: z.string().optional(),
});

export async function bulk(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid body'));
    const result = await ruleService.bulkRuleAction(parsed.data.ids, parsed.data.action, parsed.data.value);
    return res.json({ ok: true, affected: result.count });
  } catch (err) { next(err); }
}
