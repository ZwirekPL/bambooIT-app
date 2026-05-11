/**
 * 33.9 — Admin AI cost tracking endpoints.
 * Access: ADMIN only.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@db';
import { apiError } from '../utils/errors';

const listQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  model: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function listAiCosts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(query.dateFrom);
      if (query.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(query.dateTo);
    }
    if (query.model) {
      where.model = { contains: query.model };
    }

    const [logs, total] = await Promise.all([
      prisma.aiCostLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          dietPlan: {
            select: {
              patientId: true,
              status: true,
              patient: {
                select: {
                  firstName: true,
                  lastName: true,
                  dietitianId: true,
                  user: { select: { email: true } },
                },
              },
            },
          },
        },
      }),
      prisma.aiCostLog.count({ where }),
    ]);

    // Aggregate stats
    const aggregation = await prisma.aiCostLog.aggregate({
      where,
      _sum: {
        estimatedCostUsd: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      _count: true,
      _avg: {
        estimatedCostUsd: true,
      },
    });

    // Per-model breakdown
    const byModel = await prisma.aiCostLog.groupBy({
      by: ['model'],
      where,
      _sum: { estimatedCostUsd: true, totalTokens: true },
      _count: true,
    });

    // Resolve dietitian emails
    const dietitianIds = [...new Set(logs.map((l) => l.dietPlan?.patient?.dietitianId).filter(Boolean))] as string[];
    const dietitians = dietitianIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: dietitianIds } }, select: { id: true, email: true } })
      : [];
    const dietitianMap = new Map(dietitians.map((u) => [u.id, u.email]));

    res.json({
      logs: logs.map((l) => ({
        id: l.id,
        dietPlanId: l.dietPlanId,
        patientId: l.dietPlan?.patientId,
        patientEmail: l.dietPlan?.patient?.user?.email ?? null,
        patientName: [l.dietPlan?.patient?.firstName, l.dietPlan?.patient?.lastName].filter(Boolean).join(' ') || null,
        dietitianEmail: l.dietPlan?.patient?.dietitianId ? dietitianMap.get(l.dietPlan.patient.dietitianId) ?? null : null,
        planStatus: l.dietPlan?.status,
        model: l.model,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        totalTokens: l.totalTokens,
        estimatedCostUsd: l.estimatedCostUsd,
        jobType: l.jobType,
        createdAt: l.createdAt,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      summary: {
        totalCostUsd: aggregation._sum.estimatedCostUsd ?? 0,
        totalPlans: aggregation._count,
        avgCostPerPlan: aggregation._avg.estimatedCostUsd ?? 0,
        totalTokens: aggregation._sum.totalTokens ?? 0,
        byModel: byModel.map((m) => ({
          model: m.model,
          count: m._count,
          totalCostUsd: m._sum.estimatedCostUsd ?? 0,
          totalTokens: m._sum.totalTokens ?? 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAiCostForPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { dietPlanId } = req.params;
    if (!dietPlanId) {
      res.status(400).json(apiError('MISSING_PARAM', 'dietPlanId is required'));
      return;
    }

    const logs = await prisma.aiCostLog.findMany({
      where: { dietPlanId },
      orderBy: { createdAt: 'asc' },
    });

    const totalCost = logs.reduce((sum, l) => sum + l.estimatedCostUsd, 0);
    const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);

    res.json({
      dietPlanId,
      logs,
      totalCostUsd: totalCost,
      totalTokens,
      attempts: logs.length,
    });
  } catch (err) {
    next(err);
  }
}
