import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  company: { findUnique: vi.fn() },
  servicePackage: { findUnique: vi.fn() },
  ticket: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  ticketMessage: { create: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock('@db', () => ({
  prisma: {
    company: m.company,
    servicePackage: m.servicePackage,
    ticket: m.ticket,
    ticketMessage: m.ticketMessage,
    user: m.user,
  },
  Prisma: {},
}));

import {
  createTicket,
  addAdminMessage,
  addClientMessage,
  updateTicket,
} from '../../services/ticket.service';

beforeEach(() => {
  vi.clearAllMocks();
  m.ticket.create.mockResolvedValue({ id: 't1', number: 1000 });
  m.ticket.update.mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 't1', ...((data as object) ?? {}) }));
  m.ticketMessage.create.mockResolvedValue({ id: 'msg1' });
});

describe('createTicket — SLA', () => {
  it('derives slaDueAt = now + package reactionTimeHours', async () => {
    m.company.findUnique.mockResolvedValue({ id: 'c1', servicePlan: 'FIRMA' });
    m.servicePackage.findUnique.mockResolvedValue({ reactionTimeHours: 8 });

    const before = Date.now();
    await createTicket({ companyId: 'c1', createdById: 'u1', title: 'Drukarka', body: 'nie działa' });
    const after = Date.now();

    const data = m.ticket.create.mock.calls[0][0].data;
    const due = (data.slaDueAt as Date).getTime();
    expect(due).toBeGreaterThanOrEqual(before + 8 * 3600_000 - 50);
    expect(due).toBeLessThanOrEqual(after + 8 * 3600_000 + 50);
    // First message carries the body.
    expect(data.messages.create.body).toBe('nie działa');
  });

  it('leaves slaDueAt null when the company has no service plan', async () => {
    m.company.findUnique.mockResolvedValue({ id: 'c1', servicePlan: null });
    await createTicket({ companyId: 'c1', createdById: 'u1', title: 'X', body: 'y' });
    expect(m.ticket.create.mock.calls[0][0].data.slaDueAt).toBeNull();
    expect(m.servicePackage.findUnique).not.toHaveBeenCalled();
  });
});

describe('addAdminMessage — first response / status', () => {
  it('public reply sets firstResponseAt and moves NEW → IN_PROGRESS', async () => {
    m.ticket.findUnique.mockResolvedValue({ id: 't1', status: 'NEW', firstResponseAt: null });
    await addAdminMessage('t1', 'admin1', 'patrzę na to', false);
    const data = m.ticket.update.mock.calls[0][0].data;
    expect(data.firstResponseAt).toBeInstanceOf(Date);
    expect(data.status).toBe('IN_PROGRESS');
  });

  it('internal note does not set firstResponseAt nor change status', async () => {
    m.ticket.findUnique.mockResolvedValue({ id: 't1', status: 'NEW', firstResponseAt: null });
    await addAdminMessage('t1', 'admin1', 'notatka', true);
    const data = m.ticket.update.mock.calls[0][0].data;
    expect(data.firstResponseAt).toBeUndefined();
    expect(data.status).toBeUndefined();
  });

  it('does not overwrite an existing firstResponseAt', async () => {
    const earlier = new Date('2026-06-01T10:00:00Z');
    m.ticket.findUnique.mockResolvedValue({ id: 't1', status: 'IN_PROGRESS', firstResponseAt: earlier });
    await addAdminMessage('t1', 'admin1', 'kolejna odpowiedź', false);
    expect(m.ticket.update.mock.calls[0][0].data.firstResponseAt).toBeUndefined();
  });
});

describe('addClientMessage — reopen on reply', () => {
  it('moves WAITING_CLIENT → IN_PROGRESS', async () => {
    m.ticket.findFirst.mockResolvedValue({ id: 't1', status: 'WAITING_CLIENT' });
    await addClientMessage('c1', 't1', 'u1', 'dopisałem');
    expect(m.ticket.update.mock.calls[0][0].data).toEqual({ status: 'IN_PROGRESS' });
  });

  it('rejects replying to a CLOSED ticket', async () => {
    m.ticket.findFirst.mockResolvedValue({ id: 't1', status: 'CLOSED' });
    await expect(addClientMessage('c1', 't1', 'u1', 'halo')).rejects.toThrow();
  });
});

describe('updateTicket — status timestamps', () => {
  it('RESOLVED sets resolvedAt', async () => {
    m.ticket.findUnique.mockResolvedValue({ id: 't1', status: 'IN_PROGRESS', firstResponseAt: new Date(), resolvedAt: null });
    await updateTicket('t1', { status: 'RESOLVED' });
    expect(m.ticket.update.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(Date);
  });

  it('reopening to IN_PROGRESS clears resolvedAt and closedAt', async () => {
    m.ticket.findUnique.mockResolvedValue({ id: 't1', status: 'RESOLVED', firstResponseAt: new Date(), resolvedAt: new Date() });
    await updateTicket('t1', { status: 'IN_PROGRESS' });
    const data = m.ticket.update.mock.calls[0][0].data;
    expect(data.resolvedAt).toBeNull();
    expect(data.closedAt).toBeNull();
  });

  it('rejects assigning a non-admin user', async () => {
    m.ticket.findUnique.mockResolvedValue({ id: 't1', status: 'NEW' });
    m.user.findUnique.mockResolvedValue({ role: 'CLIENT' });
    await expect(updateTicket('t1', { assigneeId: 'u_client' })).rejects.toThrow();
  });
});
