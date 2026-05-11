import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as noteService from '../services/note.service';
import { logAudit } from '../services/audit.service';

const patientIdSchema = z.object({ patientId: z.string().cuid() });

const createNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  dietPlanId: z.string().cuid().optional(),
});

export async function create(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = patientIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  const bodyParsed = createNoteSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const note = await noteService.createNote(
      {
        patientId: paramsParsed.data.patientId,
        dietitianId: req.user!.sub,
        dietPlanId: bodyParsed.data.dietPlanId,
        content: bodyParsed.data.content,
      },
      req.user!.sub,
      req.user!.role
    );

    logAudit({
      userId: req.user!.sub,
      action: 'CREATE_NOTE',
      resourceType: 'DIETITIAN_NOTE',
      resourceId: note.id,
      ip: req.ip,
    });

    return res.status(201).json({ ok: true, note });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = patientIdSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const notes = await noteService.listNotes(
      paramsParsed.data.patientId,
      req.user!.sub,
      req.user!.role
    );
    return res.json({ ok: true, notes });
  } catch (err) {
    next(err);
  }
}

export async function listMy(req: Request, res: Response, next: NextFunction) {
  try {
    const notes = await noteService.listNotesForPatient(req.user!.sub);
    return res.json({ ok: true, notes });
  } catch (err) {
    next(err);
  }
}
