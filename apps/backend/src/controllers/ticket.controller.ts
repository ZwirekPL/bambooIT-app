import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as ticketService from '../services/ticket.service';
import { getCompanyIdForUser } from '../services/ops.service';
import { logAudit } from '../services/audit.service';

const TICKET_STATUS = z.enum(['NEW', 'IN_PROGRESS', 'WAITING_CLIENT', 'RESOLVED', 'CLOSED']);
const TICKET_PRIORITY = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

const idParam = z.object({ id: z.string().cuid() });

// Client suggests a priority but not URGENT — that is an admin escalation (§9).
const clientPriority = z.enum(['LOW', 'NORMAL', 'HIGH']);

const createMyTicketBody = z.object({
  title: z.string().min(3).max(160),
  body: z.string().min(1).max(5000),
  priority: clientPriority.optional(),
  category: z.string().max(60).nullable().optional(),
});

const messageBody = z.object({ body: z.string().min(1).max(5000) });

const adminMessageBody = z.object({
  body: z.string().min(1).max(5000),
  internal: z.boolean().optional().default(false),
});

const adminCreateBody = z.object({
  companyId: z.string().cuid(),
  title: z.string().min(3).max(160),
  body: z.string().min(1).max(5000),
  priority: TICKET_PRIORITY.optional(),
  category: z.string().max(60).nullable().optional(),
  channel: z.enum(['PHONE', 'MANUAL']).optional(),
});

const adminPatchBody = z.object({
  status: TICKET_STATUS.optional(),
  priority: TICKET_PRIORITY.optional(),
  category: z.string().max(60).nullable().optional(),
  assigneeId: z.string().cuid().nullable().optional(),
});

const listQuery = z.object({
  status: TICKET_STATUS.optional(),
  priority: TICKET_PRIORITY.optional(),
  companyId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().optional(),
  slaBreached: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});

const myListQuery = z.object({ status: TICKET_STATUS.optional() });

// ─── Client ───────────────────────────────────────────────────────────────────

export async function createMyTicket(req: Request, res: Response, next: NextFunction) {
  const body = createMyTicketBody.safeParse(req.body);
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ticket payload'));

  try {
    const companyId = await getCompanyIdForUser(req.user!.sub);
    const ticket = await ticketService.createTicket({
      companyId,
      createdById: req.user!.sub,
      title: body.data.title,
      body: body.data.body,
      priority: body.data.priority,
      category: body.data.category,
      channel: 'PORTAL',
    });
    logAudit({
      userId: req.user!.sub,
      action: 'TICKET_CREATED',
      resourceType: 'TICKET',
      resourceId: ticket.id,
      ip: req.ip,
      metadata: { number: ticket.number, channel: 'PORTAL' },
    });
    return res.status(201).json({ ok: true, ticket });
  } catch (err) {
    next(err);
  }
}

export async function listMyTickets(req: Request, res: Response, next: NextFunction) {
  const query = myListQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid filter'));

  try {
    const companyId = await getCompanyIdForUser(req.user!.sub);
    const tickets = await ticketService.listMyTickets(companyId, query.data.status);
    return res.json({ ok: true, tickets });
  } catch (err) {
    next(err);
  }
}

export async function getMyTicket(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    const companyId = await getCompanyIdForUser(req.user!.sub);
    const ticket = await ticketService.getMyTicket(companyId, params.data.id);
    return res.json({ ok: true, ticket });
  } catch (err) {
    next(err);
  }
}

export async function addMyMessage(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  const body = messageBody.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid message'));

  try {
    const companyId = await getCompanyIdForUser(req.user!.sub);
    const message = await ticketService.addClientMessage(
      companyId,
      params.data.id,
      req.user!.sub,
      body.data.body,
    );
    logAudit({
      userId: req.user!.sub,
      action: 'TICKET_MESSAGE_ADDED',
      resourceType: 'TICKET',
      resourceId: params.data.id,
      ip: req.ip,
      metadata: { internal: false },
    });
    return res.status(201).json({ ok: true, message });
  } catch (err) {
    next(err);
  }
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function listTickets(req: Request, res: Response, next: NextFunction) {
  const query = listQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid filters'));

  try {
    const result = await ticketService.listTickets(query.data);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getTicketStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await ticketService.getTicketStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    const ticket = await ticketService.getTicket(params.data.id);
    return res.json({ ok: true, ticket });
  } catch (err) {
    next(err);
  }
}

export async function createTicket(req: Request, res: Response, next: NextFunction) {
  const body = adminCreateBody.safeParse(req.body);
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid ticket payload'));

  try {
    const ticket = await ticketService.createTicket({
      companyId: body.data.companyId,
      createdById: req.user!.sub,
      title: body.data.title,
      body: body.data.body,
      priority: body.data.priority,
      category: body.data.category,
      channel: body.data.channel ?? 'MANUAL',
    });
    logAudit({
      userId: req.user!.sub,
      action: 'TICKET_CREATED',
      resourceType: 'TICKET',
      resourceId: ticket.id,
      ip: req.ip,
      metadata: { number: ticket.number, channel: ticket.channel },
    });
    return res.status(201).json({ ok: true, ticket });
  } catch (err) {
    next(err);
  }
}

export async function addAdminMessage(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  const body = adminMessageBody.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid message'));

  try {
    const { message } = await ticketService.addAdminMessage(
      params.data.id,
      req.user!.sub,
      body.data.body,
      body.data.internal,
    );
    logAudit({
      userId: req.user!.sub,
      action: 'TICKET_MESSAGE_ADDED',
      resourceType: 'TICKET',
      resourceId: params.data.id,
      ip: req.ip,
      metadata: { internal: body.data.internal },
    });
    return res.status(201).json({ ok: true, message });
  } catch (err) {
    next(err);
  }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  const params = idParam.safeParse(req.params);
  const body = adminPatchBody.safeParse(req.body);
  if (!params.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  if (!body.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patch'));

  try {
    const { ticket, prevStatus } = await ticketService.updateTicket(params.data.id, body.data);
    if (body.data.status && body.data.status !== prevStatus) {
      logAudit({
        userId: req.user!.sub,
        action: 'TICKET_STATUS_CHANGED',
        resourceType: 'TICKET',
        resourceId: ticket.id,
        ip: req.ip,
        metadata: { from: prevStatus, to: body.data.status },
      });
    }
    if (body.data.assigneeId !== undefined) {
      logAudit({
        userId: req.user!.sub,
        action: 'TICKET_ASSIGNED',
        resourceType: 'TICKET',
        resourceId: ticket.id,
        ip: req.ip,
        metadata: { assigneeId: body.data.assigneeId },
      });
    }
    logAudit({
      userId: req.user!.sub,
      action: 'TICKET_UPDATED',
      resourceType: 'TICKET',
      resourceId: ticket.id,
      ip: req.ip,
    });
    return res.json({ ok: true, ticket });
  } catch (err) {
    next(err);
  }
}
