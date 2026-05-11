import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@db';
import { getCacheMetrics } from '../services/dietTemplateCache.service';
import { logAudit } from '../services/audit.service';

const idSchema = z.object({ id: z.string().cuid() });

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  goal: z.string().optional(),
  dietType: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const metrics = await getCacheMetrics();
    return res.json(metrics);
  } catch (err) {
    next(err);
  }
}

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse(req.query);
    const where: Record<string, unknown> = {};

    if (query.goal) where.goal = query.goal;
    if (query.dietType) where.dietType = query.dietType;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [templates, total] = await Promise.all([
      prisma.dietTemplate.findMany({
        where,
        orderBy: { usageCount: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          segmentHash: true,
          goal: true,
          kcalBucket: true,
          dietType: true,
          allergies: true,
          diseases: true,
          mealCount: true,
          kcal: true,
          proteinG: true,
          fatG: true,
          carbsG: true,
          sourceAiModel: true,
          sourceDietPlanId: true,
          usageCount: true,
          lastUsedAt: true,
          qualityScore: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.dietTemplate.count({ where }),
    ]);

    return res.json({
      templates,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idSchema.parse(req.params);
    const data = updateSchema.parse(req.body);

    const template = await prisma.dietTemplate.update({
      where: { id },
      data,
      select: {
        id: true,
        segmentHash: true,
        goal: true,
        kcalBucket: true,
        dietType: true,
        isActive: true,
        qualityScore: true,
        usageCount: true,
      },
    });

    logAudit({
      userId: req.user?.sub,
      action: 'UPDATE_DIET_TEMPLATE',
      resourceType: 'DIET_TEMPLATE',
      resourceId: id,
    });

    return res.json(template);
  } catch (err) {
    next(err);
  }
}

export async function removeTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idSchema.parse(req.params);

    await prisma.dietTemplate.delete({ where: { id } });

    logAudit({
      userId: req.user?.sub,
      action: 'DELETE_DIET_TEMPLATE',
      resourceType: 'DIET_TEMPLATE',
      resourceId: id,
    });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function invalidateAll(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await prisma.dietTemplate.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    logAudit({
      action: 'INVALIDATE_ALL_DIET_TEMPLATES',
      resourceType: 'DIET_TEMPLATE',
    });

    return res.json({ deactivated: result.count });
  } catch (err) {
    next(err);
  }
}
