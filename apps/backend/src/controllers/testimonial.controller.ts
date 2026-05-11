import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as testimonialService from '../services/testimonial.service';
import { logAudit } from '../services/audit.service';

const createSchema = z.object({
  content: z.string().min(10).max(1000),
  rating: z.number().int().min(1).max(5),
});

const statusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

const replySchema = z.object({
  reply: z.string().max(500),
});

// Public

export async function getApproved(_req: Request, res: Response, next: NextFunction) {
  try {
    const testimonials = await testimonialService.getApprovedTestimonials();
    return res.json({ ok: true, testimonials });
  } catch (err) {
    next(err);
  }
}

// Authenticated user

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Content (10-1000 chars) and rating (1-5) required'));
  }

  try {
    const testimonial = await testimonialService.createTestimonial(
      req.user!.sub,
      parsed.data.content,
      parsed.data.rating
    );
    logAudit({
      userId: req.user!.sub,
      action: 'CREATE_TESTIMONIAL',
      resourceType: 'TESTIMONIAL',
      resourceId: testimonial.id,
    });
    return res.status(201).json({ ok: true, testimonial });
  } catch (err) {
    next(err);
  }
}

export async function getMy(req: Request, res: Response, next: NextFunction) {
  try {
    const testimonial = await testimonialService.getMyTestimonial(req.user!.sub);
    return res.json({ ok: true, testimonial });
  } catch (err) {
    next(err);
  }
}

export async function deleteMy(req: Request, res: Response, next: NextFunction) {
  try {
    await testimonialService.deleteMyTestimonial(req.user!.sub);
    logAudit({
      userId: req.user!.sub,
      action: 'DELETE_TESTIMONIAL',
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Admin

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'rating', 'reviewedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  ratingMin: z.coerce.number().int().min(1).max(5).optional(),
  ratingMax: z.coerce.number().int().min(1).max(5).optional(),
});

export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    const params = parsed.success ? parsed.data : { page: 1, limit: 20 };
    const result = await testimonialService.listAllTestimonials(params);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await testimonialService.getTestimonialStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
}

const bulkSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(50),
  status: z.enum(['APPROVED', 'REJECTED']),
});

export async function bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid body'));

  try {
    const result = await testimonialService.bulkUpdateStatus(parsed.data.ids, parsed.data.status, req.user!.sub);
    return res.json({ ok: true, affected: result.count });
  } catch (err) {
    next(err);
  }
}

export async function replyToTestimonial(req: Request, res: Response, next: NextFunction) {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Reply max 500 chars'));

  try {
    const testimonial = await testimonialService.replyToTestimonial(req.params.id, parsed.data.reply);
    return res.json({ ok: true, testimonial });
  } catch (err) {
    next(err);
  }
}

export async function togglePin(req: Request, res: Response, next: NextFunction) {
  try {
    const testimonial = await testimonialService.togglePin(req.params.id);
    return res.json({ ok: true, testimonial });
  } catch (err) {
    next(err);
  }
}

export async function editMy(req: Request, res: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Content and rating required'));

  try {
    const testimonial = await testimonialService.updateMyTestimonial(req.user!.sub, parsed.data.content, parsed.data.rating);
    return res.json({ ok: true, testimonial });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Status must be APPROVED or REJECTED'));
  }

  try {
    const testimonial = await testimonialService.updateTestimonialStatus(
      req.params.id,
      parsed.data.status,
      req.user!.sub
    );
    logAudit({
      userId: req.user!.sub,
      action: parsed.data.status === 'APPROVED' ? 'APPROVE_TESTIMONIAL' : 'REJECT_TESTIMONIAL',
      resourceType: 'TESTIMONIAL',
      resourceId: req.params.id,
    });
    return res.json({ ok: true, testimonial });
  } catch (err) {
    next(err);
  }
}
