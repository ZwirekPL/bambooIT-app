// ─── Nutrition Protocol Controller (28.6 / 28.7) ────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@db';
import { apiError } from '../utils/errors';
import * as svc from '../services/protocol.service';
import { logAudit } from '../services/audit.service';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const idSchema = z.object({ id: z.string().cuid() });

const macroRatioSchema = z.object({
  proteinPct: z.number().min(0).max(100),
  fatPct:     z.number().min(0).max(100),
  carbsPct:   z.number().min(0).max(100),
});

const macroRatiosSchema = z.object({
  REDUCE:   macroRatioSchema,
  GAIN:     macroRatioSchema,
  MAINTAIN: macroRatioSchema,
});

const caloricAdjSchema = z.object({
  REDUCE:   z.number().min(-25).max(30),
  GAIN:     z.number().min(-25).max(30),
  MAINTAIN: z.number().min(-25).max(30),
});

const mealSlotSchema = z.object({
  mealName: z.string().min(1),
  pct:      z.number().min(0).max(100),
});

const foodRestrictionSchema = z.object({
  category: z.string().min(1),
  keywords: z.array(z.string()),
  level:    z.enum(['HARD_BLOCK', 'STRONG', 'SOFT']),
  reason:   z.string(),
});

const avoidCategorySchema = z.object({
  category: z.string().min(1),
  reason:   z.string(),
});

const createSchema = z.object({
  name:                  z.string().min(1).max(200),
  description:           z.string().optional(),
  scope:                 z.enum(['GLOBAL', 'DIETITIAN']).optional(),
  dietitianId:           z.string().cuid().optional(),
  isDefault:             z.boolean().optional(),
  macroRatios:           macroRatiosSchema,
  caloricAdjustments:    caloricAdjSchema,
  minProteinPerKg:       z.number().min(0.8).max(3).optional(),
  maxProteinPerKg:       z.number().min(0.8).max(3).optional(),
  defaultMealCount:      z.number().int().min(1).max(8).optional(),
  mealDistribution:      z.array(mealSlotSchema),
  foodRestrictions:      z.array(foodRestrictionSchema).optional(),
  systemPromptAdditions: z.string().optional(),
  preferredCuisines:     z.array(z.string()).optional(),
  recipeComplexity:      z.enum(['SIMPLE', 'MODERATE', 'COMPLEX']).optional(),
  avoidFoodCategories:   z.array(avoidCategorySchema).optional(),
});

const updateSchema = createSchema.partial().omit({ scope: true, dietitianId: true }).extend({
  isActive: z.boolean().optional(),
});

const toggleSchema = z.object({ isActive: z.boolean() });

const assignSchema = z.object({
  dietitianId: z.string().cuid(),
});

const setActiveSchema = z.object({
  protocolId: z.string().cuid(),
});

// ─── Admin handlers ───────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = req.query.scope as 'GLOBAL' | 'DIETITIAN' | undefined;
    const protocols = await svc.listProtocols({ scope, activeOnly: false });
    return res.json({ ok: true, protocols });
  } catch (err) { next(err); }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const protocol = await svc.getProtocol(parsed.data.id);
    return res.json({ ok: true, protocol });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'));
    const protocol = await svc.createProtocol(parsed.data);
    logAudit({
      userId: req.user?.sub,
      action: 'CREATE_PROTOCOL',
      resourceType: 'NUTRITION_PROTOCOL',
      resourceId: protocol.id,
      ip: req.ip,
      metadata: { name: protocol.name, scope: protocol.scope },
    });
    return res.status(201).json({ ok: true, protocol });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = updateSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', bodyParsed.error.issues[0]?.message ?? 'Invalid body'));
    const { protocol, changes } = await svc.updateProtocol(idParsed.data.id, bodyParsed.data);
    if (changes) {
      logAudit({
        userId: req.user?.sub,
        action: 'UPDATE_PROTOCOL',
        resourceType: 'NUTRITION_PROTOCOL',
        resourceId: idParsed.data.id,
        ip: req.ip,
        metadata: { version: protocol.version, changes },
      });
    }
    return res.json({ ok: true, protocol });
  } catch (err) { next(err); }
}

export async function toggle(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = toggleSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid body'));
    const { protocol, changes } = await svc.updateProtocol(idParsed.data.id, { isActive: bodyParsed.data.isActive });
    if (changes) {
      logAudit({
        userId: req.user?.sub,
        action: 'TOGGLE_PROTOCOL',
        resourceType: 'NUTRITION_PROTOCOL',
        resourceId: idParsed.data.id,
        ip: req.ip,
        metadata: { isActive: bodyParsed.data.isActive },
      });
    }
    return res.json({ ok: true, protocol });
  } catch (err) { next(err); }
}

/** GET /admin/protocols/:id/dietitians — list dietitians assigned to a protocol */
export async function listAssigned(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const accesses = await prisma.dietitianProtocolAccess.findMany({
      where: { protocolId: parsed.data.id },
      include: {
        dietitian: {
          select: { id: true, email: true, dietitianProfile: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
    return res.json({ ok: true, assigned: accesses.map(a => ({
      dietitianId: a.dietitianId,
      email: a.dietitian.email,
      firstName: a.dietitian.dietitianProfile?.firstName ?? null,
      lastName:  a.dietitian.dietitianProfile?.lastName ?? null,
      isActive:  a.isActive,
      assignedAt: a.assignedAt,
    })) });
  } catch (err) { next(err); }
}

/** POST /admin/protocols/:id/assign — assign protocol to a dietitian */
export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = assignSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid body'));
    await svc.assignProtocolToDietitian(bodyParsed.data.dietitianId, idParsed.data.id, req.user!.sub);
    logAudit({
      userId: req.user?.sub,
      action: 'ASSIGN_PROTOCOL',
      resourceType: 'NUTRITION_PROTOCOL',
      resourceId: idParsed.data.id,
      ip: req.ip,
      metadata: { dietitianId: bodyParsed.data.dietitianId },
    });
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

/** DELETE /admin/protocols/:id/assign/:dietitianId — remove assignment */
export async function unassign(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const dIdParsed = z.object({ dietitianId: z.string().cuid() }).safeParse(req.params);
    if (!dIdParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid dietitianId'));
    await prisma.dietitianProtocolAccess.deleteMany({
      where: { protocolId: idParsed.data.id, dietitianId: dIdParsed.data.dietitianId },
    });
    logAudit({
      userId: req.user?.sub,
      action: 'UNASSIGN_PROTOCOL',
      resourceType: 'NUTRITION_PROTOCOL',
      resourceId: idParsed.data.id,
      ip: req.ip,
      metadata: { dietitianId: dIdParsed.data.dietitianId },
    });
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

// ─── Dietitian handlers ───────────────────────────────────────────────────────

/** GET /dietitian/protocol — list protocols assigned to the current dietitian */
export async function listMy(req: Request, res: Response, next: NextFunction) {
  try {
    const dietitianId = req.user!.sub;
    const protocols = await svc.getDietitianProtocols(dietitianId);
    return res.json({ ok: true, protocols });
  } catch (err) { next(err); }
}

/** PATCH /dietitian/protocol/active — set active protocol for current dietitian */
export async function setActive(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = setActiveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'protocolId is required'));
    await svc.setActiveDietitianProtocol(req.user!.sub, parsed.data.protocolId);
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── 45.2 Duplicate ────────────────────────────────────────────────────────

export async function duplicate(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const protocol = await svc.duplicateProtocol(parsed.data.id);
    return res.status(201).json({ ok: true, protocol });
  } catch (err) { next(err); }
}
