import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as tenantService from '../services/tenant.service';
import { logAudit } from '../services/audit.service';

const slugSchema = z.string().min(2).max(60).regex(/^[a-z0-9][a-z0-9-]*$/);

const createSchema = z.object({
  name: z.string().min(2).max(100),
  slug: slugSchema.optional(),
});

const updateSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    slug: slugSchema.optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
  })
  .refine((d) => d.name !== undefined || d.slug !== undefined || d.logoUrl !== undefined, {
    message: 'At least one field must be provided',
  });

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const tenant = await tenantService.createTenant(
      parsed.data.name,
      req.user!.sub,
      parsed.data.slug
    );
    logAudit({ userId: req.user!.sub, action: 'CREATE_TENANT', resourceType: 'TENANT', resourceId: tenant.id, ip: req.ip });
    return res.status(201).json({ ok: true, tenant });
  } catch (err) {
    next(err);
  }
}

export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  const slugParsed = slugSchema.safeParse(req.params.slug);
  if (!slugParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid slug'));
  }

  try {
    const tenant = await tenantService.getTenantBySlug(slugParsed.data);

    if (req.user!.role !== 'ADMIN' && tenant.ownerId !== req.user!.sub) {
      return res.status(403).json(apiError('FORBIDDEN', 'Insufficient permissions'));
    }

    return res.json({ ok: true, tenant });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const slugParsed = slugSchema.safeParse(req.params.slug);
  if (!slugParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid slug'));
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const existing = await tenantService.getTenantBySlug(slugParsed.data);

    if (req.user!.role !== 'ADMIN' && existing.ownerId !== req.user!.sub) {
      return res.status(403).json(apiError('FORBIDDEN', 'Insufficient permissions'));
    }

    const tenant = await tenantService.updateTenant(slugParsed.data, parsed.data);
    logAudit({ userId: req.user!.sub, action: 'UPDATE_TENANT', resourceType: 'TENANT', resourceId: tenant.id, ip: req.ip });
    return res.json({ ok: true, tenant });
  } catch (err) {
    next(err);
  }
}
