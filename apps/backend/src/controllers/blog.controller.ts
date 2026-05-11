import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as blogService from '../services/blog.service';
import { logAudit } from '../services/audit.service';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../utils/cache';

const POST_TTL = 60; // 1 minute — short TTL so scheduled posts appear promptly

const slugParamSchema = z.object({ slug: z.string().min(1).max(200) });
const idParamSchema = z.object({ id: z.string().cuid() });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().min(1).max(100).optional(),
});

const createPostSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  title: z.string().min(2).max(300),
  titleEn: z.string().min(2).max(300).optional(),
  excerpt: z.string().min(10).max(1000),
  excerptEn: z.string().min(10).max(1000).optional(),
  content: z.string().min(50),
  contentEn: z.string().min(50).optional(),
  category: z.string().min(1).max(100),
  author: z.string().min(2).max(150),
  imageSrc: z.string().max(500).optional(),
  imageAlt: z.string().max(300).optional(),
  imageAltEn: z.string().max(300).optional(),
  readTime: z.number().int().min(1).max(120),
  publishedAt: z.string().datetime(),
  published: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  faq: z
    .array(
      z.object({
        question: z.string().min(1).max(500),
        answer: z.string().min(1).max(2000),
      })
    )
    .optional(),
});

const updatePostSchema = createPostSchema.partial();

// Public endpoints

export async function listPosts(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  const cacheKey = `cache:posts:${JSON.stringify(parsed.data)}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ ok: true, ...(cached as object) });
    }

    const result = await blogService.listPublishedPosts(parsed.data);
    await cacheSet(cacheKey, result, POST_TTL);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getPostBySlug(req: Request, res: Response, next: NextFunction) {
  const parsed = slugParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid slug'));
  }

  const cacheKey = `cache:post:slug:${parsed.data.slug}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ ok: true, post: cached });
    }

    const post = await blogService.getPublishedPostBySlug(parsed.data.slug);
    await cacheSet(cacheKey, post, POST_TTL);
    return res.json({ ok: true, post });
  } catch (err) {
    next(err);
  }
}

// Admin endpoints (ADMIN only — mounted under /admin/posts)

export async function adminGetPostById(req: Request, res: Response, next: NextFunction) {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid post id'));
  }

  try {
    const post = await blogService.getPostById(parsed.data.id);
    return res.json({ ok: true, post });
  } catch (err) {
    next(err);
  }
}

export async function adminListPosts(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const result = await blogService.listAllPosts(parsed.data);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function adminCreatePost(req: Request, res: Response, next: NextFunction) {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid data'));
  }

  try {
    const { scheduledAt: scheduledAtStr, ...createRest } = parsed.data;
    const scheduledDate = scheduledAtStr ? new Date(scheduledAtStr) : scheduledAtStr === null ? null : undefined;
    const post = await blogService.createPost({
      ...createRest,
      publishedAt: new Date(parsed.data.publishedAt),
      scheduledAt: scheduledDate,
      // Auto-publish when scheduling — visibility is controlled by scheduledAt filter
      ...(scheduledDate ? { published: true } : {}),
    });

    logAudit({
      userId: req.user?.sub,
      action: 'CREATE_POST',
      resourceType: 'POST',
      resourceId: post.id,
      ip: req.ip,
    });

    await cacheDelPattern('cache:posts:*');

    return res.status(201).json({ ok: true, post });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdatePost(req: Request, res: Response, next: NextFunction) {
  const paramsParsed = idParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid post id'));
  }

  const bodyParsed = updatePostSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res
      .status(400)
      .json(apiError('VALIDATION_ERROR', bodyParsed.error.issues[0]?.message ?? 'Invalid data'));
  }

  try {
    const { publishedAt: publishedAtStr, scheduledAt: scheduledAtStr, ...rest } = bodyParsed.data;
    const scheduledDate = scheduledAtStr !== undefined
      ? (scheduledAtStr ? new Date(scheduledAtStr) : null)
      : undefined;
    const post = await blogService.updatePost(paramsParsed.data.id, {
      ...rest,
      ...(publishedAtStr ? { publishedAt: new Date(publishedAtStr) } : {}),
      ...(scheduledDate !== undefined ? { scheduledAt: scheduledDate } : {}),
      // Auto-publish when scheduling — visibility is controlled by scheduledAt filter
      ...(scheduledDate ? { published: true } : {}),
    });

    logAudit({
      userId: req.user?.sub,
      action: 'EDIT_POST',
      resourceType: 'POST',
      resourceId: post.id,
      ip: req.ip,
    });

    await cacheDel(`cache:post:slug:${post.slug}`);
    if ('published' in bodyParsed.data || 'scheduledAt' in bodyParsed.data) {
      await cacheDelPattern('cache:posts:*');
    }

    return res.json({ ok: true, post });
  } catch (err) {
    next(err);
  }
}

export async function adminDeletePost(req: Request, res: Response, next: NextFunction) {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid post id'));
  }

  try {
    const { slug } = await blogService.deletePost(parsed.data.id);

    logAudit({
      userId: req.user?.sub,
      action: 'DELETE_POST',
      resourceType: 'POST',
      resourceId: parsed.data.id,
      ip: req.ip,
    });

    await cacheDel(`cache:post:slug:${slug}`);

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function adminGetPostStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await blogService.getPostStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
}
