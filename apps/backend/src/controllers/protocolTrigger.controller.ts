// ─── Protocol Trigger & Conflict Controller (30.6) ──────────────────────────

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { logAudit } from '../services/audit.service';
import { prisma } from '@db';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const idSchema = z.object({ id: z.string().cuid() });

const triggerCreateSchema = z.object({
  interviewField: z.string().min(1).max(100),
  interviewValue: z.string().min(1).max(100),
  protocolId:     z.string().cuid(),
  priority:       z.number().int().min(1).max(3).default(3),
  score:          z.number().min(0).max(1).default(1.0),
  isActive:       z.boolean().default(true),
});

const triggerUpdateSchema = z.object({
  interviewField: z.string().min(1).max(100).optional(),
  interviewValue: z.string().min(1).max(100).optional(),
  protocolId:     z.string().cuid().optional(),
  priority:       z.number().int().min(1).max(3).optional(),
  score:          z.number().min(0).max(1).optional(),
  isActive:       z.boolean().optional(),
});

const conflictCreateSchema = z.object({
  triggerAField: z.string().min(1).max(100),
  triggerAValue: z.string().min(1).max(100),
  triggerBField: z.string().min(1).max(100),
  triggerBValue: z.string().min(1).max(100),
  severity:      z.enum(['BLOCK', 'WARN']),
  messageKey:    z.string().min(1).max(200),
  winnerSide:    z.enum(['A', 'B']).default('B'),
  isActive:      z.boolean().default(true),
});

const conflictUpdateSchema = z.object({
  triggerAField: z.string().min(1).max(100).optional(),
  triggerAValue: z.string().min(1).max(100).optional(),
  triggerBField: z.string().min(1).max(100).optional(),
  triggerBValue: z.string().min(1).max(100).optional(),
  severity:      z.enum(['BLOCK', 'WARN']).optional(),
  messageKey:    z.string().min(1).max(200).optional(),
  winnerSide:    z.enum(['A', 'B']).optional(),
  isActive:      z.boolean().optional(),
});

const toggleSchema = z.object({ isActive: z.boolean() });

// ─── Trigger Handlers ─────────────────────────────────────────────────────────

export async function listTriggers(req: Request, res: Response, next: NextFunction) {
  try {
    const { field, protocolId, priority, active } = req.query;
    const where: Record<string, unknown> = {};
    if (field && typeof field === 'string') where.interviewField = field;
    if (protocolId && typeof protocolId === 'string') where.protocolId = protocolId;
    if (priority) where.priority = Number(priority);
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const triggers = await prisma.protocolTrigger.findMany({
      where,
      include: { protocol: { select: { id: true, name: true } } },
      orderBy: [{ priority: 'asc' }, { interviewField: 'asc' }, { interviewValue: 'asc' }],
    });
    return res.json({ ok: true, triggers });
  } catch (err) { next(err); }
}

export async function getTrigger(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const trigger = await prisma.protocolTrigger.findUnique({
      where: { id: parsed.data.id },
      include: { protocol: { select: { id: true, name: true } } },
    });
    if (!trigger) return res.status(404).json(apiError('NOT_FOUND', 'Trigger not found'));
    return res.json({ ok: true, trigger });
  } catch (err) { next(err); }
}

export async function createTrigger(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = triggerCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'));

    // Verify protocol exists
    const protocol = await prisma.nutritionProtocol.findUnique({ where: { id: parsed.data.protocolId } });
    if (!protocol) return res.status(404).json(apiError('NOT_FOUND', 'Protocol not found'));

    const trigger = await prisma.protocolTrigger.create({
      data: parsed.data,
      include: { protocol: { select: { id: true, name: true } } },
    });

    logAudit({
      userId: req.user?.sub,
      action: 'CREATE_PROTOCOL_TRIGGER',
      resourceType: 'PROTOCOL_TRIGGER',
      resourceId: trigger.id,
      ip: req.ip,
      metadata: { interviewField: trigger.interviewField, interviewValue: trigger.interviewValue, protocolName: protocol.name },
    });

    return res.status(201).json({ ok: true, trigger });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return res.status(409).json(apiError('CONFLICT', 'Trigger with this field/value/protocol combination already exists'));
    }
    next(err);
  }
}

export async function updateTrigger(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = triggerUpdateSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', bodyParsed.error.issues[0]?.message ?? 'Invalid body'));

    if (bodyParsed.data.protocolId) {
      const protocol = await prisma.nutritionProtocol.findUnique({ where: { id: bodyParsed.data.protocolId } });
      if (!protocol) return res.status(404).json(apiError('NOT_FOUND', 'Protocol not found'));
    }

    const trigger = await prisma.protocolTrigger.update({
      where: { id: idParsed.data.id },
      data: bodyParsed.data,
      include: { protocol: { select: { id: true, name: true } } },
    });

    logAudit({
      userId: req.user?.sub,
      action: 'UPDATE_PROTOCOL_TRIGGER',
      resourceType: 'PROTOCOL_TRIGGER',
      resourceId: trigger.id,
      ip: req.ip,
      metadata: bodyParsed.data,
    });

    return res.json({ ok: true, trigger });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Record to update not found')) {
      return res.status(404).json(apiError('NOT_FOUND', 'Trigger not found'));
    }
    next(err);
  }
}

export async function toggleTrigger(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = toggleSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid body'));

    const trigger = await prisma.protocolTrigger.update({
      where: { id: idParsed.data.id },
      data: { isActive: bodyParsed.data.isActive },
      include: { protocol: { select: { id: true, name: true } } },
    });

    logAudit({
      userId: req.user?.sub,
      action: 'TOGGLE_PROTOCOL_TRIGGER',
      resourceType: 'PROTOCOL_TRIGGER',
      resourceId: trigger.id,
      ip: req.ip,
      metadata: { isActive: bodyParsed.data.isActive },
    });

    return res.json({ ok: true, trigger });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Record to update not found')) {
      return res.status(404).json(apiError('NOT_FOUND', 'Trigger not found'));
    }
    next(err);
  }
}

export async function deleteTrigger(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));

    const trigger = await prisma.protocolTrigger.findUnique({ where: { id: parsed.data.id } });
    if (!trigger) return res.status(404).json(apiError('NOT_FOUND', 'Trigger not found'));

    await prisma.protocolTrigger.delete({ where: { id: parsed.data.id } });

    logAudit({
      userId: req.user?.sub,
      action: 'DELETE_PROTOCOL_TRIGGER',
      resourceType: 'PROTOCOL_TRIGGER',
      resourceId: parsed.data.id,
      ip: req.ip,
      metadata: { interviewField: trigger.interviewField, interviewValue: trigger.interviewValue },
    });

    return res.json({ ok: true });
  } catch (err) { next(err); }
}

// ─── Conflict Handlers ───────────────────────────────────────────────────────

export async function listConflicts(req: Request, res: Response, next: NextFunction) {
  try {
    const { severity, active } = req.query;
    const where: Record<string, unknown> = {};
    if (severity && typeof severity === 'string') where.severity = severity;
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const conflicts = await prisma.protocolConflict.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { triggerAField: 'asc' }],
    });
    return res.json({ ok: true, conflicts });
  } catch (err) { next(err); }
}

export async function getConflict(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const conflict = await prisma.protocolConflict.findUnique({ where: { id: parsed.data.id } });
    if (!conflict) return res.status(404).json(apiError('NOT_FOUND', 'Conflict not found'));
    return res.json({ ok: true, conflict });
  } catch (err) { next(err); }
}

export async function createConflict(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = conflictCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'));

    const conflict = await prisma.protocolConflict.create({ data: parsed.data });

    logAudit({
      userId: req.user?.sub,
      action: 'CREATE_PROTOCOL_CONFLICT',
      resourceType: 'PROTOCOL_CONFLICT',
      resourceId: conflict.id,
      ip: req.ip,
      metadata: {
        triggerA: `${conflict.triggerAField}:${conflict.triggerAValue}`,
        triggerB: `${conflict.triggerBField}:${conflict.triggerBValue}`,
        severity: conflict.severity,
      },
    });

    return res.status(201).json({ ok: true, conflict });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return res.status(409).json(apiError('CONFLICT', 'Conflict with this trigger pair already exists'));
    }
    next(err);
  }
}

export async function updateConflict(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = conflictUpdateSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', bodyParsed.error.issues[0]?.message ?? 'Invalid body'));

    const conflict = await prisma.protocolConflict.update({
      where: { id: idParsed.data.id },
      data: bodyParsed.data,
    });

    logAudit({
      userId: req.user?.sub,
      action: 'UPDATE_PROTOCOL_CONFLICT',
      resourceType: 'PROTOCOL_CONFLICT',
      resourceId: conflict.id,
      ip: req.ip,
      metadata: bodyParsed.data,
    });

    return res.json({ ok: true, conflict });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Record to update not found')) {
      return res.status(404).json(apiError('NOT_FOUND', 'Conflict not found'));
    }
    next(err);
  }
}

export async function toggleConflict(req: Request, res: Response, next: NextFunction) {
  try {
    const idParsed = idSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));
    const bodyParsed = toggleSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid body'));

    const conflict = await prisma.protocolConflict.update({
      where: { id: idParsed.data.id },
      data: { isActive: bodyParsed.data.isActive },
    });

    logAudit({
      userId: req.user?.sub,
      action: 'TOGGLE_PROTOCOL_CONFLICT',
      resourceType: 'PROTOCOL_CONFLICT',
      resourceId: conflict.id,
      ip: req.ip,
      metadata: { isActive: bodyParsed.data.isActive },
    });

    return res.json({ ok: true, conflict });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Record to update not found')) {
      return res.status(404).json(apiError('NOT_FOUND', 'Conflict not found'));
    }
    next(err);
  }
}

export async function deleteConflict(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ID'));

    const conflict = await prisma.protocolConflict.findUnique({ where: { id: parsed.data.id } });
    if (!conflict) return res.status(404).json(apiError('NOT_FOUND', 'Conflict not found'));

    await prisma.protocolConflict.delete({ where: { id: parsed.data.id } });

    logAudit({
      userId: req.user?.sub,
      action: 'DELETE_PROTOCOL_CONFLICT',
      resourceType: 'PROTOCOL_CONFLICT',
      resourceId: parsed.data.id,
      ip: req.ip,
      metadata: {
        triggerA: `${conflict.triggerAField}:${conflict.triggerAValue}`,
        triggerB: `${conflict.triggerBField}:${conflict.triggerBValue}`,
      },
    });

    return res.json({ ok: true });
  } catch (err) { next(err); }
}
