import { prisma } from '@db';
import type { EmailCampaign, EmailCampaignAudience } from '@prisma/client';
import { AppError } from '../utils/errors';
import { sendCampaignEmail, isEmailTransportConfigured } from '../utils/email';

/**
 * Admin email campaigns (U-6). MVP: compose → pick audience → send. Fan-out
 * uses the shared mock-safe transport, so in dev (no RESEND/SMTP) nothing
 * actually goes out. See PLAN_U6_EMAIL_KAMPANIE.md.
 *
 * Audience segments:
 *  - ALL_CLIENTS — verified, non-deleted CLIENT users who granted an active
 *    EMAIL_NOTIFICATIONS consent (RODO-respecting newsletter list).
 *  - LEADS       — non-rejected leads with rodoConsent, de-duped by email.
 *  - TEST        — only the sending admin (safe dry-run).
 */

export interface CreateCampaignInput {
  subject: string;
  body: string;
  audience: EmailCampaignAudience;
}

export interface UpdateCampaignInput {
  subject?: string;
  body?: string;
  audience?: EmailCampaignAudience;
}

export interface AudienceCounts {
  ALL_CLIENTS: number;
  LEADS: number;
}

export function listCampaigns(): Promise<EmailCampaign[]> {
  return prisma.emailCampaign.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getCampaign(id: string): Promise<EmailCampaign> {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
  return campaign;
}

export function createCampaign(
  input: CreateCampaignInput,
  createdById: string,
): Promise<EmailCampaign> {
  return prisma.emailCampaign.create({
    data: {
      subject: input.subject,
      body: input.body,
      audience: input.audience,
      createdById,
    },
  });
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
): Promise<EmailCampaign> {
  const campaign = await getCampaign(id);
  if (campaign.status !== 'DRAFT') {
    throw new AppError(409, 'CAMPAIGN_LOCKED', 'Only draft campaigns can be edited');
  }
  return prisma.emailCampaign.update({ where: { id }, data: input });
}

export async function deleteCampaign(id: string): Promise<void> {
  const campaign = await getCampaign(id);
  if (campaign.status === 'SENDING') {
    throw new AppError(409, 'CAMPAIGN_LOCKED', 'A sending campaign cannot be deleted');
  }
  await prisma.emailCampaign.delete({ where: { id } });
}

/** Distinct recipient emails for an audience. `requesterEmail` used for TEST. */
async function resolveRecipients(
  audience: EmailCampaignAudience,
  requesterEmail: string,
): Promise<string[]> {
  if (audience === 'TEST') return [requesterEmail];

  if (audience === 'ALL_CLIENTS') {
    const users = await prisma.user.findMany({
      where: {
        role: 'CLIENT',
        deletedAt: null,
        emailVerified: { not: null },
        consents: {
          some: { consentType: 'EMAIL_NOTIFICATIONS', granted: true, revokedAt: null },
        },
      },
      select: { email: true },
    });
    return [...new Set(users.map((u) => u.email))];
  }

  // LEADS
  const leads = await prisma.lead.findMany({
    where: { status: { not: 'REJECTED' }, rodoConsent: true },
    select: { email: true },
  });
  return [...new Set(leads.map((l) => l.email))];
}

export async function getAudienceCounts(): Promise<AudienceCounts> {
  const [clients, leads] = await Promise.all([
    prisma.user.count({
      where: {
        role: 'CLIENT',
        deletedAt: null,
        emailVerified: { not: null },
        consents: {
          some: { consentType: 'EMAIL_NOTIFICATIONS', granted: true, revokedAt: null },
        },
      },
    }),
    prisma.lead.count({ where: { status: { not: 'REJECTED' }, rodoConsent: true } }),
  ]);
  return { ALL_CLIENTS: clients, LEADS: leads };
}

export interface SendResult {
  campaign: EmailCampaign;
  transportConfigured: boolean;
}

/**
 * Send a draft campaign. Marks SENDING, fans out sequentially (recipient counts
 * are tiny at this scale — no queue needed), then settles to SENT (or FAILED if
 * every send threw). Mock-safe: with no transport configured each send is a
 * no-op that counts as sent.
 */
export async function sendCampaign(
  id: string,
  requester: { email: string },
): Promise<SendResult> {
  const campaign = await getCampaign(id);
  if (campaign.status !== 'DRAFT') {
    throw new AppError(409, 'CAMPAIGN_LOCKED', 'Only draft campaigns can be sent');
  }

  const recipients = await resolveRecipients(campaign.audience, requester.email);
  const transportConfigured = isEmailTransportConfigured();

  await prisma.emailCampaign.update({
    where: { id },
    data: { status: 'SENDING', recipientCount: recipients.length },
  });

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      await sendCampaignEmail(to, campaign.subject, campaign.body);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  const allFailed = recipients.length > 0 && sent === 0;
  const updated = await prisma.emailCampaign.update({
    where: { id },
    data: {
      status: allFailed ? 'FAILED' : 'SENT',
      sentCount: sent,
      failedCount: failed,
      sentAt: new Date(),
    },
  });

  return { campaign: updated, transportConfigured };
}
