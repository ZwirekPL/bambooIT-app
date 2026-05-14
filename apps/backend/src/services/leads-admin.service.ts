import { prisma, Prisma } from '@db';
import type { Lead, LeadStatus, LeadType } from '@prisma/client';
import { AppError } from '../utils/errors';

/**
 * Admin-side Lead service — list/filter/update/notes/CSV export.
 *
 * Notes are stored as JSON array on Lead.notes (no separate table needed
 * for two-person team). Each note: { id, text, authorId, authorName, createdAt }.
 */

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;

export interface LeadNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface ListLeadsParams {
  page?: number;
  pageSize?: number;
  status?: LeadStatus;
  type?: LeadType;
  source?: string;
  search?: string; // matches email or company (case-insensitive)
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ListLeadsResult {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

function buildWhere(p: ListLeadsParams): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  if (p.status) where.status = p.status;
  if (p.type) where.type = p.type;
  if (p.source) where.source = p.source;
  if (p.search) {
    where.OR = [
      { email: { contains: p.search, mode: 'insensitive' } },
      { company: { contains: p.search, mode: 'insensitive' } },
      { firstName: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.dateFrom || p.dateTo) {
    where.createdAt = {};
    if (p.dateFrom) where.createdAt.gte = p.dateFrom;
    if (p.dateTo) where.createdAt.lte = p.dateTo;
  }
  return where;
}

export async function listLeads(params: ListLeadsParams): Promise<ListLeadsResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, params.pageSize ?? PAGE_SIZE_DEFAULT));
  const where = buildWhere(params);

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { leads, total, page, pageSize };
}

export async function getLeadById(id: string): Promise<Lead> {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new AppError(404, 'NOT_FOUND', 'Lead not found');
  return lead;
}

export interface LeadsStats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  byType: Record<LeadType, number>;
  last7Days: number;
}

export async function getLeadsStats(): Promise<LeadsStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [grouped, byType, last7Days, total] = await Promise.all([
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.lead.count(),
  ]);

  const byStatus: Record<LeadStatus, number> = {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    CONVERTED: 0,
    REJECTED: 0,
  };
  for (const row of grouped) {
    byStatus[row.status] = row._count._all;
  }

  const byTypeOut: Record<LeadType, number> = { AUDIT: 0, CONTACT: 0 };
  for (const row of byType) {
    byTypeOut[row.type] = row._count._all;
  }

  return { total, byStatus, byType: byTypeOut, last7Days };
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<{ lead: Lead; previousStatus: LeadStatus }> {
  const existing = await prisma.lead.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  const lead = await prisma.lead.update({
    where: { id },
    data: { status },
  });

  return { lead, previousStatus: existing.status };
}

function parseNotes(raw: Prisma.JsonValue | null): LeadNote[] {
  if (!Array.isArray(raw)) return [];
  const valid: LeadNote[] = [];
  for (const candidate of raw) {
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      !Array.isArray(candidate) &&
      typeof (candidate as Record<string, unknown>).id === 'string' &&
      typeof (candidate as Record<string, unknown>).text === 'string' &&
      typeof (candidate as Record<string, unknown>).authorId === 'string' &&
      typeof (candidate as Record<string, unknown>).authorName === 'string' &&
      typeof (candidate as Record<string, unknown>).createdAt === 'string'
    ) {
      valid.push(candidate as unknown as LeadNote);
    }
  }
  return valid;
}

export async function addLeadNote(
  leadId: string,
  text: string,
  author: { id: string; name: string },
): Promise<{ lead: Lead; note: LeadNote }> {
  if (!text.trim()) {
    throw new AppError(400, 'EMPTY_NOTE', 'Note text cannot be empty');
  }
  if (text.length > 2000) {
    throw new AppError(400, 'NOTE_TOO_LONG', 'Note text must be 2000 characters or fewer');
  }

  const existing = await prisma.lead.findUnique({ where: { id: leadId }, select: { notes: true } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  const existingNotes = parseNotes(existing.notes);
  const note: LeadNote = {
    id: cuidLike(),
    text: text.trim(),
    authorId: author.id,
    authorName: author.name,
    createdAt: new Date().toISOString(),
  };

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { notes: [...existingNotes, note] as unknown as Prisma.InputJsonValue },
  });

  return { lead, note };
}

export async function deleteLeadNote(
  leadId: string,
  noteId: string,
): Promise<Lead> {
  const existing = await prisma.lead.findUnique({ where: { id: leadId }, select: { notes: true } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  const notes = parseNotes(existing.notes);
  const filtered = notes.filter((n) => n.id !== noteId);

  if (filtered.length === notes.length) {
    throw new AppError(404, 'NOTE_NOT_FOUND', 'Note not found on this lead');
  }

  return prisma.lead.update({
    where: { id: leadId },
    data: { notes: filtered as unknown as Prisma.InputJsonValue },
  });
}

/**
 * Generates a CSV stream-friendly string for the leads matching the given
 * filters. CSV is meant for spreadsheet import — keep flat columns; notes
 * count only (full notes content stays in admin detail view).
 */
export async function exportLeadsCsv(params: ListLeadsParams): Promise<string> {
  const where = buildWhere(params);
  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000, // hard cap
  });

  const headers = [
    'id',
    'type',
    'status',
    'firstName',
    'lastName',
    'company',
    'nip',
    'email',
    'phone',
    'industry',
    'sizeRange',
    'employeesCount',
    'description',
    'source',
    'notesCount',
    'createdAt',
  ];

  const rows = leads.map((lead) => [
    lead.id,
    lead.type,
    lead.status,
    lead.firstName,
    lead.lastName ?? '',
    lead.company ?? '',
    lead.nip ?? '',
    lead.email,
    lead.phone ?? '',
    lead.industry ?? '',
    lead.sizeRange ?? '',
    String(lead.employeesCount ?? ''),
    lead.description,
    lead.source ?? '',
    String(parseNotes(lead.notes).length),
    lead.createdAt.toISOString(),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}

function escapeCsvCell(value: string): string {
  if (value === '') return '';
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Small cuid-like helper for note IDs (no need for full cuid package). */
function cuidLike(): string {
  return 'n_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
