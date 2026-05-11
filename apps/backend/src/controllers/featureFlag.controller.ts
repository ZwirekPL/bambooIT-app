import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as flagService from '../services/featureFlag.service';
import { logAudit } from '../services/audit.service';

const idSchema = z.object({ id: z.string().cuid() });

const conditionsSchema = z.object({
  roles: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
  percentage: z.number().int().min(0).max(100).optional(),
}).optional().nullable();

const createSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  conditions: conditionsSchema,
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  conditions: conditionsSchema,
});

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const flags = await flagService.listFeatureFlags();
    return res.json({ flags });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const params = idSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const flag = await flagService.getFeatureFlag(params.data.id);
    if (!flag) return res.status(404).json(apiError('NOT_FOUND', 'Feature flag not found'));
    return res.json(flag);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', body.error.message));

    const flag = await flagService.createFeatureFlag({
      key: body.data.key,
      name: body.data.name,
      description: body.data.description,
      enabled: body.data.enabled,
      conditions: body.data.conditions ?? undefined,
    });

    logAudit({
      userId: req.user?.sub,
      action: 'CREATE_FEATURE_FLAG',
      resourceType: 'FEATURE_FLAG',
      resourceId: flag.id,
      ip: req.ip,
    });

    return res.status(201).json(flag);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const params = idSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));

    const body = updateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', body.error.message));

    const flag = await flagService.updateFeatureFlag(params.data.id, {
      name: body.data.name,
      description: body.data.description,
      enabled: body.data.enabled,
      conditions: body.data.conditions,
    });

    logAudit({
      userId: req.user?.sub,
      action: 'UPDATE_FEATURE_FLAG',
      resourceType: 'FEATURE_FLAG',
      resourceId: flag.id,
      ip: req.ip,
    });

    return res.json(flag);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const params = idSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));

    await flagService.deleteFeatureFlag(params.data.id);

    logAudit({
      userId: req.user?.sub,
      action: 'DELETE_FEATURE_FLAG',
      resourceType: 'FEATURE_FLAG',
      resourceId: params.data.id,
      ip: req.ip,
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
