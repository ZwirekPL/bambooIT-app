import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  lead: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock('@db', () => ({
  prisma: { lead: m.lead },
  Prisma: {},
}));

import {
  listLeads,
  getLeadById,
  getLeadsStats,
  updateLeadStatus,
  addLeadNote,
  deleteLeadNote,
  exportLeadsCsv,
} from '../../services/leads-admin.service';

const baseLead = {
  id: 'lead_1',
  type: 'AUDIT',
  firstName: 'Jan',
  lastName: null,
  company: 'ACME',
  email: 'jan@acme.pl',
  phone: null,
  industry: 'accounting',
  sizeRange: '6-15',
  employeesCount: 15,
  description: 'Need help with M365',
  status: 'NEW',
  notes: null,
  source: 'audit-form',
  createdAt: new Date('2026-05-14T08:00:00Z'),
};

describe('listLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.lead.count.mockResolvedValue(1);
    m.lead.findMany.mockResolvedValue([baseLead]);
  });

  it('builds OR clause when search provided', async () => {
    await listLeads({ search: 'acme', page: 1, pageSize: 25 });

    const where = m.lead.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0]).toEqual({ email: { contains: 'acme', mode: 'insensitive' } });
  });

  it('applies status + type filters', async () => {
    await listLeads({ status: 'NEW', type: 'AUDIT' });

    const where = m.lead.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('NEW');
    expect(where.type).toBe('AUDIT');
  });

  it('clamps pageSize to 200 max', async () => {
    await listLeads({ pageSize: 5000 });

    const args = m.lead.findMany.mock.calls[0][0];
    expect(args.take).toBe(200);
  });

  it('applies date range filter when dateFrom/dateTo provided', async () => {
    const from = new Date('2026-05-01');
    const to = new Date('2026-05-14');
    await listLeads({ dateFrom: from, dateTo: to });

    const where = m.lead.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte).toBe(from);
    expect(where.createdAt.lte).toBe(to);
  });
});

describe('getLeadById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws 404 when lead missing', async () => {
    m.lead.findUnique.mockResolvedValue(null);
    await expect(getLeadById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('getLeadsStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.lead.count.mockResolvedValue(10);
    m.lead.groupBy
      .mockResolvedValueOnce([
        { status: 'NEW', _count: { _all: 5 } },
        { status: 'CONTACTED', _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { type: 'AUDIT', _count: { _all: 7 } },
        { type: 'CONTACT', _count: { _all: 3 } },
      ]);
  });

  it('zero-fills missing status buckets', async () => {
    const stats = await getLeadsStats();

    expect(stats.byStatus.NEW).toBe(5);
    expect(stats.byStatus.CONTACTED).toBe(3);
    expect(stats.byStatus.QUALIFIED).toBe(0);
    expect(stats.byStatus.CONVERTED).toBe(0);
    expect(stats.byStatus.REJECTED).toBe(0);
  });

  it('returns total + byType', async () => {
    const stats = await getLeadsStats();
    expect(stats.byType.AUDIT).toBe(7);
    expect(stats.byType.CONTACT).toBe(3);
  });
});

describe('updateLeadStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns previousStatus + updated lead', async () => {
    m.lead.findUnique.mockResolvedValue({ status: 'NEW' });
    m.lead.update.mockResolvedValue({ ...baseLead, status: 'CONTACTED' });

    const result = await updateLeadStatus('lead_1', 'CONTACTED');

    expect(result.previousStatus).toBe('NEW');
    expect(result.lead.status).toBe('CONTACTED');
  });

  it('throws 404 when lead missing', async () => {
    m.lead.findUnique.mockResolvedValue(null);
    await expect(updateLeadStatus('missing', 'CONTACTED')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('addLeadNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.lead.findUnique.mockResolvedValue({ notes: null });
    m.lead.update.mockResolvedValue({ ...baseLead, notes: [] });
  });

  it('rejects empty note text', async () => {
    await expect(
      addLeadNote('lead_1', '   ', { id: 'u1', name: 'Rem' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects note text over 2000 chars', async () => {
    await expect(
      addLeadNote('lead_1', 'x'.repeat(2001), { id: 'u1', name: 'Rem' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('appends note to existing notes array', async () => {
    m.lead.findUnique.mockResolvedValueOnce({
      notes: [
        {
          id: 'old',
          text: 'Old note',
          authorId: 'u0',
          authorName: 'X',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    await addLeadNote('lead_1', 'New note', { id: 'u1', name: 'Rem' });

    const updateArgs = m.lead.update.mock.calls[0][0];
    expect(updateArgs.data.notes).toHaveLength(2);
    expect(updateArgs.data.notes[1]).toMatchObject({
      text: 'New note',
      authorId: 'u1',
      authorName: 'Rem',
    });
  });
});

describe('deleteLeadNote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws 404 when note not on lead', async () => {
    m.lead.findUnique.mockResolvedValue({
      notes: [
        { id: 'n1', text: 'x', authorId: 'u1', authorName: 'A', createdAt: 'now' },
      ],
    });

    await expect(deleteLeadNote('lead_1', 'missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('filters out the targeted note', async () => {
    m.lead.findUnique.mockResolvedValue({
      notes: [
        { id: 'n1', text: 'keep', authorId: 'u1', authorName: 'A', createdAt: 'now' },
        { id: 'n2', text: 'drop', authorId: 'u1', authorName: 'A', createdAt: 'now' },
      ],
    });
    m.lead.update.mockResolvedValue({ ...baseLead });

    await deleteLeadNote('lead_1', 'n2');

    const updateArgs = m.lead.update.mock.calls[0][0];
    expect(updateArgs.data.notes).toHaveLength(1);
    expect(updateArgs.data.notes[0].id).toBe('n1');
  });
});

describe('exportLeadsCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.lead.findMany.mockResolvedValue([baseLead]);
  });

  it('emits header row + data row separated by CRLF', async () => {
    const csv = await exportLeadsCsv({});
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('id,type,status');
    expect(lines[1]).toContain('lead_1');
  });

  it('escapes cells containing commas / quotes / newlines', async () => {
    m.lead.findMany.mockResolvedValueOnce([
      {
        ...baseLead,
        company: 'ACME, Inc.',
        description: 'Line 1\nLine 2 with "quote"',
      },
    ]);
    const csv = await exportLeadsCsv({});
    expect(csv).toContain('"ACME, Inc."');
    expect(csv).toContain('""quote""');
  });
});
