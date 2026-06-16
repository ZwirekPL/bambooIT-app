import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

/**
 * Ticketing — support requests from clients (TKT-2).
 *
 * The request body is the first TicketMessage (whole thread in one place).
 * SLA: slaDueAt = createdAt + ServicePackage[company.servicePlan].reactionTimeHours
 * (calendar hours in MVP; business-hours refinement deferred — see PLAN_ticketing §9).
 * firstResponseAt marks the first non-internal admin reaction; SLA is met when
 * firstResponseAt <= slaDueAt. Time logged against a ticket lives on TimeEntry
 * (ops.service) and feeds the ticket's total + the monthly "what we did" report.
 */

type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_CLIENT' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type TicketChannel = 'PORTAL' | 'PHONE' | 'EMAIL' | 'MANUAL';
type Plan = 'START' | 'FIRMA' | 'FIRMA_PLUS';

// Statuses that count as "open" (still need attention / can breach SLA).
const ACTIVE_STATUSES: TicketStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING_CLIENT'];

// ─── SLA ────────────────────────────────────────────────────────────────────

/** Reaction deadline from the company's package, or null when it has no plan. */
async function computeSlaDueAt(plan: Plan | null, from: Date): Promise<Date | null> {
  if (!plan) return null;
  const pkg = await prisma.servicePackage.findUnique({ where: { plan } });
  if (!pkg) return null;
  return new Date(from.getTime() + pkg.reactionTimeHours * 60 * 60 * 1000);
}

// ─── Create ─────────────────────────────────────────────────────────────────

interface CreateTicketInput {
  companyId: string;
  createdById: string;
  title: string;
  body: string;
  priority?: TicketPriority;
  category?: string | null;
  channel?: TicketChannel;
}

export async function createTicket(input: CreateTicketInput) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, servicePlan: true },
  });
  if (!company) throw new AppError(404, 'NOT_FOUND', 'Company not found');

  const slaDueAt = await computeSlaDueAt(company.servicePlan, new Date());

  return prisma.ticket.create({
    data: {
      companyId: input.companyId,
      createdById: input.createdById,
      title: input.title,
      priority: input.priority ?? 'NORMAL',
      category: input.category ?? null,
      channel: input.channel ?? 'PORTAL',
      slaDueAt,
      messages: {
        create: { authorId: input.createdById, body: input.body, internal: false },
      },
    },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
}

// ─── Client views (own company only; internal notes hidden) ───────────────────

const messageAuthor = { select: { id: true, email: true, role: true } } as const;

export async function listMyTickets(companyId: string, status?: TicketStatus) {
  return prisma.ticket.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      priority: true,
      category: true,
      slaDueAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: { where: { internal: false } } } },
    },
  });
}

export async function getMyTicket(companyId: string, id: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id, companyId },
    include: {
      messages: {
        where: { internal: false },
        orderBy: { createdAt: 'asc' },
        include: { author: messageAuthor },
      },
    },
  });
  if (!ticket) throw new AppError(404, 'NOT_FOUND', 'Ticket not found');
  return ticket;
}

export async function addClientMessage(
  companyId: string,
  ticketId: string,
  authorId: string,
  body: string,
) {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, companyId } });
  if (!ticket) throw new AppError(404, 'NOT_FOUND', 'Ticket not found');
  if (ticket.status === 'CLOSED') {
    throw new AppError(400, 'TICKET_CLOSED', 'This ticket is closed — open a new one');
  }

  const message = await prisma.ticketMessage.create({
    data: { ticketId, authorId, body, internal: false },
  });

  // A client reply on a ticket we were waiting on moves it back into progress;
  // otherwise we still bump updatedAt so it resurfaces in the queue.
  await prisma.ticket.update({
    where: { id: ticketId },
    data: ticket.status === 'WAITING_CLIENT' ? { status: 'IN_PROGRESS' } : {},
  });

  return message;
}

// ─── Admin queue / detail ─────────────────────────────────────────────────────

interface ListTicketsFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  companyId?: string;
  assigneeId?: string;
  slaBreached?: boolean;
  page: number;
  pageSize: number;
}

/** WHERE for tickets past their SLA with no first reaction yet (still active). */
function slaBreachedWhere(now: Date): Prisma.TicketWhereInput {
  return {
    slaDueAt: { lt: now },
    firstResponseAt: null,
    status: { in: ACTIVE_STATUSES },
  };
}

export async function listTickets(filters: ListTicketsFilters) {
  const where: Prisma.TicketWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.slaBreached) Object.assign(where, slaBreachedWhere(new Date()));

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        channel: true,
        slaDueAt: true,
        firstResponseAt: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, companyName: true, contactFirstName: true, contactLastName: true } },
        assignee: { select: { id: true, email: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return { tickets, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getTicketStats() {
  const now = new Date();
  const [grouped, slaBreached] = await Promise.all([
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ticket.count({ where: slaBreachedWhere(now) }),
  ]);

  const byStatus: Record<TicketStatus, number> = {
    NEW: 0,
    IN_PROGRESS: 0,
    WAITING_CLIENT: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };
  for (const row of grouped) byStatus[row.status as TicketStatus] = row._count._all;
  const open = byStatus.NEW + byStatus.IN_PROGRESS + byStatus.WAITING_CLIENT;

  return { byStatus, open, slaBreached };
}

export async function getTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          id: true,
          companyName: true,
          contactFirstName: true,
          contactLastName: true,
          servicePlan: true,
          user: { select: { email: true } },
        },
      },
      createdBy: { select: { id: true, email: true, role: true } },
      assignee: { select: { id: true, email: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { author: messageAuthor } },
      timeEntries: {
        orderBy: { date: 'desc' },
        include: { createdBy: { select: { email: true } } },
      },
    },
  });
  if (!ticket) throw new AppError(404, 'NOT_FOUND', 'Ticket not found');

  const totalMinutes = ticket.timeEntries.reduce((sum, e) => sum + e.minutes, 0);
  return { ...ticket, totalMinutes };
}

export async function addAdminMessage(
  ticketId: string,
  authorId: string,
  body: string,
  internal: boolean,
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError(404, 'NOT_FOUND', 'Ticket not found');

  const message = await prisma.ticketMessage.create({
    data: { ticketId, authorId, body, internal },
  });

  // A public admin reply marks the SLA first response and pulls NEW into progress.
  const data: Prisma.TicketUpdateInput = {};
  if (!internal) {
    if (!ticket.firstResponseAt) data.firstResponseAt = new Date();
    if (ticket.status === 'NEW') data.status = 'IN_PROGRESS';
  }
  await prisma.ticket.update({ where: { id: ticketId }, data });

  return { message, statusChanged: data.status !== undefined };
}

interface UpdateTicketPatch {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string | null;
  assigneeId?: string | null;
}

export async function updateTicket(id: string, patch: UpdateTicketPatch) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError(404, 'NOT_FOUND', 'Ticket not found');

  const data: Prisma.TicketUpdateInput = {};

  if (patch.priority) data.priority = patch.priority;
  if (patch.category !== undefined) data.category = patch.category;

  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: patch.assigneeId },
        select: { role: true },
      });
      if (!assignee || assignee.role !== 'ADMIN') {
        throw new AppError(400, 'INVALID_ASSIGNEE', 'Assignee must be an admin');
      }
      data.assignee = { connect: { id: patch.assigneeId } };
    } else {
      data.assignee = { disconnect: true };
    }
  }

  if (patch.status) {
    data.status = patch.status;
    if (patch.status === 'RESOLVED') {
      data.resolvedAt = new Date();
    } else if (patch.status === 'CLOSED') {
      data.closedAt = new Date();
      if (!ticket.resolvedAt) data.resolvedAt = new Date();
    } else {
      // Reopened / active again — clear terminal timestamps.
      data.resolvedAt = null;
      data.closedAt = null;
      if (patch.status === 'IN_PROGRESS' && !ticket.firstResponseAt) {
        data.firstResponseAt = new Date();
      }
    }
  }

  const updated = await prisma.ticket.update({ where: { id }, data });
  return { ticket: updated, prevStatus: ticket.status as TicketStatus };
}
