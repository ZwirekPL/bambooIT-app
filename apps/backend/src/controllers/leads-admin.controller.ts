import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as leadsAdminService from '../services/leads-admin.service';
import { logAudit } from '../services/audit.service';

const listLeadsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED']).optional(),
  type: z.enum(['AUDIT', 'CONTACT']).optional(),
  source: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const updateStatusBody = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED']),
});

const addNoteBody = z.object({
  text: z.string().min(1).max(2000),
});

function parseListParams(query: z.infer<typeof listLeadsQuery>) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    status: query.status,
    type: query.type,
    source: query.source,
    search: query.search,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
  };
}

export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = listLeadsQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const result = await leadsAdminService.listLeads(parseListParams(parsed.data));
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function stats(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await leadsAdminService.getLeadsStats();
    return res.json({ ok: true, stats: data });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const lead = await leadsAdminService.getLeadById(req.params.id);
    return res.json({ ok: true, lead });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  const parsed = updateStatusBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid status'));
  }

  try {
    const { lead, previousStatus } = await leadsAdminService.updateLeadStatus(
      req.params.id,
      parsed.data.status,
    );
    logAudit({
      userId: req.user!.sub,
      action: 'LEAD_STATUS_UPDATED',
      resourceType: 'LEAD',
      resourceId: lead.id,
      ip: req.ip,
      metadata: { from: previousStatus, to: lead.status },
    });
    return res.json({ ok: true, lead });
  } catch (err) {
    next(err);
  }
}

export async function addNote(req: Request, res: Response, next: NextFunction) {
  const parsed = addNoteBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Note text is required (1-2000 chars)'));
  }

  try {
    const author = {
      id: req.user!.sub,
      name: req.user!.email.split('@')[0] ?? 'admin',
    };
    const { lead, note } = await leadsAdminService.addLeadNote(
      req.params.id,
      parsed.data.text,
      author,
    );
    logAudit({
      userId: req.user!.sub,
      action: 'LEAD_NOTE_ADDED',
      resourceType: 'LEAD',
      resourceId: lead.id,
      ip: req.ip,
      metadata: { noteId: note.id },
    });
    return res.status(201).json({ ok: true, lead, note });
  } catch (err) {
    next(err);
  }
}

export async function deleteNote(req: Request, res: Response, next: NextFunction) {
  try {
    const lead = await leadsAdminService.deleteLeadNote(req.params.id, req.params.noteId);
    logAudit({
      userId: req.user!.sub,
      action: 'LEAD_NOTE_DELETED',
      resourceType: 'LEAD',
      resourceId: lead.id,
      ip: req.ip,
      metadata: { noteId: req.params.noteId },
    });
    return res.json({ ok: true, lead });
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  const parsed = listLeadsQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }

  try {
    const csv = await leadsAdminService.exportLeadsCsv(parseListParams(parsed.data));
    const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    logAudit({
      userId: req.user!.sub,
      action: 'LEAD_EXPORTED',
      resourceType: 'LEAD',
      ip: req.ip,
      metadata: { filters: parsed.data },
    });
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}
