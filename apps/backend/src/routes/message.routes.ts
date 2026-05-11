import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { apiError } from '../utils/errors';
import * as messageService from '../services/message.service';
import { logAudit } from '../services/audit.service';

export const messageRouter = Router();

// ─── List conversations ──────────────────────────────────────────────────────

messageRouter.get('/conversations', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversations = await messageService.listConversations(req.user!.sub, req.user!.role);
    return res.json({ ok: true, conversations });
  } catch (err) {
    next(err);
  }
});

// ─── Get unread count ────────────────────────────────────────────────────────

messageRouter.get('/unread-count', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await messageService.getUnreadCount(req.user!.sub, req.user!.role);
    return res.json({ ok: true, unreadCount: count });
  } catch (err) {
    next(err);
  }
});

// ─── Find or create conversation ─────────────────────────────────────────

const findConversationSchema = z.object({
  patientId: z.string().cuid().optional(),
  dietitianId: z.string().cuid().optional(),
});

messageRouter.get('/find-or-create', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const parsed = findConversationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query'));

  const userId = req.user!.sub;
  const role = req.user!.role;

  let patientId: string;
  let dietitianId: string;

  if (role === 'DIETITIAN' && parsed.data.patientId) {
    dietitianId = userId;
    patientId = parsed.data.patientId;
  } else if (role === 'PATIENT' && parsed.data.dietitianId) {
    patientId = userId;
    dietitianId = parsed.data.dietitianId;
  } else if (role === 'ADMIN' && parsed.data.patientId && parsed.data.dietitianId) {
    patientId = parsed.data.patientId;
    dietitianId = parsed.data.dietitianId;
  } else {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Missing patientId or dietitianId'));
  }

  try {
    const conversationId = await messageService.getOrCreateConversation(patientId, dietitianId);
    return res.json({ ok: true, conversationId, patientId, dietitianId });
  } catch (err) {
    next(err);
  }
});

// ─── List messages in conversation ───────────────────────────────────────────

const listMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

messageRouter.get('/:conversationId', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const idParsed = z.string().cuid().safeParse(req.params.conversationId);
  if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid conversation id'));

  const queryParsed = listMessagesSchema.safeParse(req.query);
  if (!queryParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query'));

  try {
    const result = await messageService.listMessages(
      idParsed.data,
      req.user!.sub,
      queryParsed.data.page,
      queryParsed.data.limit,
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── Send message ────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  patientId: z.string().cuid().optional(),
  dietitianId: z.string().cuid().optional(),
  content: z.string().min(1).max(5000),
});

messageRouter.post('/', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'));

  try {
    const message = await messageService.sendMessage({
      ...parsed.data,
      senderId: req.user!.sub,
      senderRole: req.user!.role as 'PATIENT' | 'DIETITIAN',
    });

    logAudit({
      userId: req.user!.sub,
      action: 'SEND_MESSAGE',
      resourceType: 'MESSAGE',
      resourceId: message.id,
      ip: req.ip,
    });

    return res.status(201).json({ ok: true, message });
  } catch (err) {
    next(err);
  }
});

// ─── Mark as read ────────────────────────────────────────────────────────────

messageRouter.patch('/:conversationId/read', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const idParsed = z.string().cuid().safeParse(req.params.conversationId);
  if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid conversation id'));

  try {
    await messageService.markAsRead(idParsed.data, req.user!.sub);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
