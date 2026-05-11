import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { prisma } from '@db';
import * as patientService from '../services/patient.service';
import { getRecommendedProductsForPatient } from '../services/productSelection.service';
import { segmentUser } from '../services/segmentation.service';
import { logAudit } from '../services/audit.service';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache';

const PATIENT_TTL = 60;

const patientIdSchema = z.object({ id: z.string().cuid() });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().min(1).max(100).optional(),
  planStatus: z.enum(['NONE', 'AI_DRAFT', 'GENERATED', 'REVIEWED', 'SENT', 'PUBLISHED']).optional(),
  scope: z.enum(['mine', 'unassigned']).optional(),
  sortBy: z.enum(['firstName', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  interviewFilter: z.enum(['none', 'stale']).optional(),
});

const updateSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    sex: z.string().min(1).max(20),
    birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
    heightCm: z.number().int().min(50).max(300),
    weightKg: z.number().min(10).max(500),
    goal: z.string().min(1).max(500),
  })
  .partial();

export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const result = await patientService.listPatients({
      ...parsed.data,
      dietitianUserId: req.user?.sub,
      role: req.user?.role,
      scope: parsed.data.scope,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function stats(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patientService.getPatientStats({
      dietitianUserId: req.user?.sub,
      role: req.user?.role,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  const cacheKey = `cache:patient:${parsed.data.id}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ ok: true, patient: cached });
    }

    const patient = await patientService.getPatient(parsed.data.id, req.user?.sub, req.user?.role);
    await cacheSet(cacheKey, patient, PATIENT_TTL);
    logAudit({
      userId: req.user?.sub,
      action: 'VIEW_PATIENT',
      resourceType: 'PATIENT',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, patient });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const idParsed = patientIdSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  const bodyParsed = updateSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  if (Object.keys(bodyParsed.data).length === 0) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  }

  try {
    const patient = await patientService.updatePatient(
      idParsed.data.id,
      bodyParsed.data,
      req.user?.sub,
      req.user?.role
    );
    await cacheDel(`cache:patient:${idParsed.data.id}`);
    logAudit({
      userId: req.user?.sub,
      action: 'UPDATE_PATIENT',
      resourceType: 'PATIENT',
      resourceId: idParsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true, patient });
  } catch (err) {
    next(err);
  }
}

export async function getSegment(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    // Verify ownership — dietitian can only access own patients
    await patientService.getPatient(parsed.data.id, req.user?.sub, req.user?.role);

    const segment = await segmentUser(parsed.data.id);
    if (!segment) {
      return res.status(404).json(apiError('NOT_FOUND', 'Segment could not be computed — missing interview or nutrition targets'));
    }
    return res.json({ ok: true, segment });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    await patientService.deletePatient(parsed.data.id, req.user?.sub, req.user?.role);
    await cacheDel(`cache:patient:${parsed.data.id}`);
    logAudit({
      userId: req.user?.sub,
      action: 'DELETE_PATIENT',
      resourceType: 'PATIENT',
      resourceId: parsed.data.id,
      ip: req.ip,
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** PATCH /patients/:id/assign — assign unassigned patient to current dietitian (59.4) */
export async function assignToMe(req: Request, res: Response, next: NextFunction) {
  const idParsed = patientIdSchema.safeParse(req.params);
  if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  const dietitianId = req.user?.sub;
  if (!dietitianId) return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));

  try {
    const patient = await patientService.getPatient(idParsed.data.id);
    if (patient.dietitianId) {
      return res.status(400).json(apiError('ALREADY_ASSIGNED', 'Patient is already assigned to a dietitian'));
    }

    await prisma.patient.update({
      where: { id: idParsed.data.id },
      data: { dietitianId },
    });

    logAudit({
      userId: dietitianId,
      action: 'UPDATE_PATIENT',
      resourceType: 'PATIENT',
      resourceId: idParsed.data.id,
      ip: req.ip,
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── GET /patients/:id/recommended-products ──────────────────────────────────

export async function getRecommendedProducts(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Nieprawidłowe ID pacjenta'));
  }

  try {
    // Verify ownership — dietitian can only access own patients
    await patientService.getPatient(parsed.data.id, req.user?.sub, req.user?.role);

    const result = await getRecommendedProductsForPatient(parsed.data.id);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}
