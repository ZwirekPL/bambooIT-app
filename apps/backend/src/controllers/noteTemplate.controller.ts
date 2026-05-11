import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as noteTemplateService from '../services/noteTemplate.service';

const idSchema = z.object({ id: z.string().cuid() });

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  category: z.string().max(100).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  category: z.string().max(100).nullable().optional(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const templates = await noteTemplateService.listTemplates(req.user!.sub);
    return res.json({ ok: true, templates });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  const bodyParsed = createSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const template = await noteTemplateService.createTemplate({
      dietitianId: req.user!.sub,
      title: bodyParsed.data.title,
      content: bodyParsed.data.content,
      category: bodyParsed.data.category,
    });
    return res.status(201).json({ ok: true, template });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = idSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid template id'));
  }

  const bodyParsed = updateSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const template = await noteTemplateService.updateTemplate(
      paramsParsed.data.id,
      req.user!.sub,
      req.user!.role,
      bodyParsed.data
    );
    return res.json({ ok: true, template });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = idSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid template id'));
  }

  try {
    await noteTemplateService.deleteTemplate(
      paramsParsed.data.id,
      req.user!.sub,
      req.user!.role
    );
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
