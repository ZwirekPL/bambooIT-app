import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  lead: {
    create: vi.fn(),
  },
  sendLeadNotifications: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('@db', () => ({
  prisma: { lead: m.lead },
}));

vi.mock('../../utils/leadNotifications', () => ({
  sendLeadNotifications: m.sendLeadNotifications,
}));

vi.mock('../../services/audit.service', () => ({
  logAudit: m.logAudit,
}));

import { createAuditLead, createContactLead } from '../../services/leads.service';

const baseLead = {
  id: 'lead_test_id',
  createdAt: new Date('2026-05-14T08:00:00Z'),
};

describe('createAuditLead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.lead.create.mockResolvedValue({ ...baseLead, type: 'AUDIT', email: 'jan@firma.pl' });
    m.sendLeadNotifications.mockResolvedValue(undefined);
  });

  it('maps size="4-10" to employeesCount=10 and preserves sizeRange', async () => {
    await createAuditLead(
      {
        name: 'Jan Kowalski',
        company: 'ACME Sp. z o.o.',
        email: 'jan@firma.pl',
        size: '4-10',
        industry: 'accounting',
        rodo: true,
      },
      {},
    );

    expect(m.lead.create).toHaveBeenCalledOnce();
    const data = m.lead.create.mock.calls[0][0].data;
    expect(data.sizeRange).toBe('4-10');
    expect(data.employeesCount).toBe(10);
    expect(data.type).toBe('AUDIT');
    expect(data.rodoConsent).toBe(true);
    expect(data.rodoConsentAt).toBeInstanceOf(Date);
    expect(data.source).toBe('audit-form');
  });

  it('maps size="30+" to employeesCount=30 and preserves sizeRange', async () => {
    await createAuditLead(
      {
        name: 'Anna',
        company: 'BigCo',
        email: 'anna@bigco.pl',
        size: '30+',
        industry: 'production',
        rodo: true,
      },
      {},
    );

    const data = m.lead.create.mock.calls[0][0].data;
    expect(data.sizeRange).toBe('30+');
    expect(data.employeesCount).toBe(30);
  });

  it('stores whole "name" string in firstName (no auto-split)', async () => {
    await createAuditLead(
      {
        name: 'Anna Maria Kowalska',
        company: 'X',
        email: 'a@x.pl',
        size: '1-3',
        industry: 'other',
        rodo: true,
      },
      {},
    );

    const data = m.lead.create.mock.calls[0][0].data;
    expect(data.firstName).toBe('Anna Maria Kowalska');
    expect(data.lastName).toBeUndefined();
  });

  it('passes meta (ipAddress + userAgent) into Lead row', async () => {
    await createAuditLead(
      {
        name: 'Jan',
        company: 'X',
        email: 'a@x.pl',
        size: '1-3',
        industry: 'other',
        rodo: true,
      },
      { ipAddress: '1.2.3.4', userAgent: 'Mozilla/5.0' },
    );

    const data = m.lead.create.mock.calls[0][0].data;
    expect(data.ipAddress).toBe('1.2.3.4');
    expect(data.userAgent).toBe('Mozilla/5.0');
  });

  it('still resolves when sendLeadNotifications fails (caller handles)', async () => {
    m.sendLeadNotifications.mockResolvedValue(undefined); // sender swallows internally
    await expect(
      createAuditLead(
        {
          name: 'Jan',
          company: 'X',
          email: 'a@x.pl',
          size: '1-3',
          industry: 'other',
          rodo: true,
        },
        {},
      ),
    ).resolves.toBeDefined();
  });

  it('logs LEAD_CREATED audit entry', async () => {
    await createAuditLead(
      {
        name: 'Jan',
        company: 'X',
        email: 'a@x.pl',
        size: '1-3',
        industry: 'other',
        rodo: true,
      },
      { ipAddress: '1.2.3.4' },
    );

    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LEAD_CREATED',
        resourceType: 'LEAD',
        resourceId: 'lead_test_id',
        ip: '1.2.3.4',
      }),
    );
  });
});

describe('createContactLead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.lead.create.mockResolvedValue({ ...baseLead, type: 'CONTACT' });
    m.sendLeadNotifications.mockResolvedValue(undefined);
  });

  it('creates a CONTACT-type lead with message in description', async () => {
    await createContactLead(
      {
        name: 'Anna',
        email: 'anna@x.pl',
        message: 'Witam, mam pytanie...',
        rodo: true,
      },
      {},
    );

    const data = m.lead.create.mock.calls[0][0].data;
    expect(data.type).toBe('CONTACT');
    expect(data.description).toBe('Witam, mam pytanie...');
    expect(data.source).toBe('contact-form');
    expect(data.sizeRange).toBeUndefined();
    expect(data.industry).toBeUndefined();
  });
});
