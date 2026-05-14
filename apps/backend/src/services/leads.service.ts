import { prisma } from '@db';
import type { Lead, LeadType } from '@prisma/client';
import { sendLeadNotifications } from '../utils/leadNotifications';
import { logAudit } from './audit.service';

/**
 * Lead service — creates Lead rows from public marketing forms and
 * dispatches admin + client notifications. Conversion to Subscription
 * happens later in BE-2 (Stripe success flow).
 */

const SIZE_RANGE_TO_COUNT: Record<string, number> = {
  '1-5': 5,
  '6-15': 15,
  '16-30': 30,
  '30+': 30,
};

export interface AuditLeadInput {
  name: string;
  company: string;
  email: string;
  phone?: string;
  size: '1-5' | '6-15' | '16-30' | '30+';
  industry: 'accounting' | 'law' | 'medical' | 'production' | 'hospitality' | 'other';
  message?: string;
  rodo: true;
}

export interface ContactLeadInput {
  name: string;
  email: string;
  phone?: string;
  message: string;
  rodo: true;
}

interface LeadMeta {
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLead(input: AuditLeadInput, meta: LeadMeta): Promise<Lead> {
  const consentAt = new Date();
  const lead = await prisma.lead.create({
    data: {
      type: 'AUDIT' satisfies LeadType,
      firstName: input.name.trim(),
      company: input.company.trim(),
      email: input.email,
      phone: input.phone?.trim() || null,
      industry: input.industry,
      sizeRange: input.size,
      employeesCount: SIZE_RANGE_TO_COUNT[input.size] ?? null,
      description: input.message?.trim() ?? '',
      rodoConsent: true,
      rodoConsentAt: consentAt,
      source: 'audit-form',
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  logAudit({
    action: 'LEAD_CREATED',
    resourceType: 'LEAD',
    resourceId: lead.id,
    ip: meta.ipAddress,
    metadata: { type: 'AUDIT', source: 'audit-form' },
  });

  // Fire-and-forget notifications — failures are non-fatal (logged inside).
  await sendLeadNotifications(lead);

  return lead;
}

export async function createContactLead(input: ContactLeadInput, meta: LeadMeta): Promise<Lead> {
  const consentAt = new Date();
  const lead = await prisma.lead.create({
    data: {
      type: 'CONTACT' satisfies LeadType,
      firstName: input.name.trim(),
      email: input.email,
      phone: input.phone?.trim() || null,
      description: input.message.trim(),
      rodoConsent: true,
      rodoConsentAt: consentAt,
      source: 'contact-form',
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  logAudit({
    action: 'LEAD_CREATED',
    resourceType: 'LEAD',
    resourceId: lead.id,
    ip: meta.ipAddress,
    metadata: { type: 'CONTACT', source: 'contact-form' },
  });

  await sendLeadNotifications(lead);

  return lead;
}
