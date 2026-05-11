import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as mealSwapService from '../services/mealSwap.service';
import { logAudit } from '../services/audit.service';
import { cacheDel } from '../utils/cache';

// ─── schemas ──────────────────────────────────────────────────────────────────

const swapRequestSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  mealIndex: z.number().int().min(0).max(9),
});

const planIdSchema = z.object({ id: z.string().cuid() });
const swapIdSchema = z.object({ swapId: z.string().cuid() });

const confirmSchema = z.object({
  chosenIndex: z.number().int().min(0).max(2),
});

// ─── POST /diet-plans/:id/swap ────────────────────────────────────────────────

export async function requestSwap(req: Request, res: Response, next: NextFunction) {
  const idParsed = planIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const bodyParsed = swapRequestSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  if (!req.user?.patientId) {
    return res.status(403).json(apiError('FORBIDDEN', 'Only patients can request meal swaps'));
  }

  try {
    const result = await mealSwapService.requestSwap({
      dietPlanId: idParsed.data.id,
      dayIndex: bodyParsed.data.dayIndex,
      mealIndex: bodyParsed.data.mealIndex,
      userId: req.user.sub,
      patientId: req.user.patientId,
    });

    logAudit({
      userId: req.user.sub,
      action: 'REQUEST_MEAL_SWAP',
      resourceType: 'MEAL_SWAP',
      resourceId: result.id,
      ip: req.ip,
      metadata: { dietPlanId: idParsed.data.id, dayIndex: bodyParsed.data.dayIndex, mealIndex: bodyParsed.data.mealIndex },
    });

    return res.status(201).json({ ok: true, swap: result });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /diet-plans/:id/swap/:swapId/confirm ──────────────────────────────

export async function confirmSwap(req: Request, res: Response, next: NextFunction) {
  const idParsed = planIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  const swapParsed = swapIdSchema.safeParse(req.params);
  if (!swapParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid swap id'));
  }

  const bodyParsed = confirmSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const result = await mealSwapService.confirmSwap(
      swapParsed.data.swapId,
      bodyParsed.data.chosenIndex,
      req.user!.sub,
    );

    // Invalidate plan cache
    await cacheDel(`cache:diet-plan:latest:${req.user!.patientId}`);
    await cacheDel(`cache:diet-plan:latest:${req.user!.patientId}:PATIENT`);

    logAudit({
      userId: req.user!.sub,
      action: 'CONFIRM_MEAL_SWAP',
      resourceType: 'MEAL_SWAP',
      resourceId: swapParsed.data.swapId,
      ip: req.ip,
      metadata: { dietPlanId: idParsed.data.id, chosenIndex: bodyParsed.data.chosenIndex },
    });

    return res.json({ ok: true, swap: result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /diet-plans/:id/swaps ────────────────────────────────────────────────

export async function listSwaps(req: Request, res: Response, next: NextFunction) {
  const parsed = planIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid plan id'));
  }

  try {
    const swaps = await mealSwapService.listSwaps(parsed.data.id);
    return res.json({ ok: true, swaps });
  } catch (err) {
    next(err);
  }
}
