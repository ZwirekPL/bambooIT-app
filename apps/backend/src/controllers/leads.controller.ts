import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as leadsService from '../services/leads.service';

/**
 * Lead capture controllers — public endpoints called from /audyt and
 * /kontakt forms. Honeypot field `website` must be empty (boty wypełnią,
 * my zwracamy fake 200 success). DB write failure → 500. Email send
 * failure → still 200 (lead jest w bazie, admin fallback).
 */

const SIZE_VALUES = ['1-3', '4-10', '11-30', '30+'] as const;
const INDUSTRY_VALUES = [
  'accounting',
  'law',
  'medical',
  'production',
  'hospitality',
  'other',
] as const;

const auditLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(1).max(150),
  email: z.string().email().toLowerCase().max(150),
  phone: z.string().trim().max(30).optional().or(z.literal('').transform(() => undefined)),
  size: z.enum(SIZE_VALUES),
  industry: z.enum(INDUSTRY_VALUES),
  message: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  rodo: z.literal(true),
  website: z.string().max(0).optional(), // honeypot
});

const contactLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().toLowerCase().max(150),
  phone: z.string().trim().max(30).optional().or(z.literal('').transform(() => undefined)),
  message: z.string().trim().min(10).max(2000),
  rodo: z.literal(true),
  website: z.string().max(0).optional(), // honeypot
});

function getClientMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 500),
  };
}

export async function submitAudit(req: Request, res: Response, next: NextFunction) {
  const parsed = auditLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json(apiError('VALIDATION_ERROR', 'Sprawdź wypełnione pola i spróbuj ponownie.'));
  }

  // Honeypot — bot filled it. Fake-success without DB write or notification.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return res.status(200).json({ ok: true });
  }

  try {
    const meta = getClientMeta(req);
    const lead = await leadsService.createAuditLead(parsed.data, meta);
    return res.status(201).json({ ok: true, leadId: lead.id });
  } catch (err) {
    next(err);
  }
}

export async function submitContact(req: Request, res: Response, next: NextFunction) {
  const parsed = contactLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json(apiError('VALIDATION_ERROR', 'Sprawdź wypełnione pola i spróbuj ponownie.'));
  }

  if (parsed.data.website && parsed.data.website.length > 0) {
    return res.status(200).json({ ok: true });
  }

  try {
    const meta = getClientMeta(req);
    const lead = await leadsService.createContactLead(parsed.data, meta);
    return res.status(201).json({ ok: true, leadId: lead.id });
  } catch (err) {
    next(err);
  }
}
