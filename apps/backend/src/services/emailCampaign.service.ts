/**
 * Email Campaign Service (84.4)
 *
 * Manages automated email campaigns:
 *   - Weekly patient summary (personalized)
 *   - Weekly dietitian summary (patient overview)
 *   - Trigger-based: plateau, milestone, inactive, plan expiry
 *   - A/B testing for subject lines
 *
 * Master switch: FeatureFlag 'EMAIL_CAMPAIGNS_ENABLED' (admin toggle)
 */

import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { getSetting } from './appSettings.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CampaignType =
  | 'WEEKLY_SUMMARY'
  | 'DIETITIAN_SUMMARY'
  | 'TRIGGER_PLATEAU'
  | 'TRIGGER_MILESTONE'
  | 'TRIGGER_INACTIVE'
  | 'TRIGGER_PLAN_EXPIRY'
  | 'MOTIVATION'
  | 'CUSTOM';

export interface CreateCampaignInput {
  type: CampaignType;
  name: string;
  subject: string;
  subjectVariantB?: string;
  bodyTemplate?: string;
  schedule?: string;        // cron: "0 8 * * 1"
  segmentation?: string;    // lose_weight | maintenance | muscle_gain | all
  enabled?: boolean;
}

export interface PersonalizedData {
  patientName: string;
  weightTrend: string | null;       // "+0.3kg" or "-0.8kg" or null
  weeklyCompliance: number | null;  // 0-100
  topMeal: string | null;           // best rated meal name
  worstMeal: string | null;         // worst rated meal name
  missingMicro: string | null;      // "żelazo" or null
  avgGi: number | null;
  streak: number;                   // consecutive check-in days
  achievement: string | null;       // "5kg lost!" or "4 weeks streak!"
  tip: string | null;               // personalized tip
}

export interface DietitianSummaryData {
  dietitianName: string;
  totalPatients: number;
  activePatients: number;
  avgCompliance: number;
  lowCompliancePatients: Array<{ name: string; compliance: number }>;
  inactivePatients: Array<{ name: string; daysSinceLastCheckin: number }>;
  plateauPatients: string[];
  milestones: Array<{ name: string; milestone: string }>;
}

// ─── Master switch ──────────────────────────────────────────────────────────

export async function isCampaignSystemEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: 'EMAIL_CAMPAIGNS_ENABLED' },
    select: { enabled: true },
  });
  return flag?.enabled ?? false;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function listCampaigns() {
  return prisma.emailCampaign.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { sends: true } } },
  });
}

export async function getCampaign(id: string) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: { _count: { select: { sends: true } } },
  });
  if (!campaign) throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
  return campaign;
}

export async function createCampaign(input: CreateCampaignInput) {
  return prisma.emailCampaign.create({
    data: {
      type: input.type,
      name: input.name,
      subject: input.subject,
      subjectVariantB: input.subjectVariantB,
      bodyTemplate: input.bodyTemplate,
      schedule: input.schedule,
      segmentation: input.segmentation ?? 'all',
      enabled: input.enabled ?? true,
    },
  });
}

export async function updateCampaign(id: string, data: Partial<CreateCampaignInput>) {
  await getCampaign(id); // ensure exists
  return prisma.emailCampaign.update({ where: { id }, data });
}

export async function deleteCampaign(id: string) {
  await getCampaign(id);
  return prisma.emailCampaign.delete({ where: { id } });
}

export async function duplicateCampaign(id: string) {
  const original = await getCampaign(id);
  return prisma.emailCampaign.create({
    data: {
      type: original.type,
      name: `Kopia: ${original.name}`,
      subject: original.subject,
      subjectVariantB: original.subjectVariantB ?? undefined,
      bodyTemplate: original.bodyTemplate ?? undefined,
      schedule: original.schedule ?? undefined,
      segmentation: original.segmentation ?? 'all',
      enabled: false,
    },
  });
}

// ─── A/B Test Subject Selection ─────────────────────────────────────────────

export function selectSubjectVariant(campaign: {
  subject: string;
  subjectVariantB: string | null;
  variantASent: number;
  variantBSent: number;
  variantAOpened: number;
  variantBOpened: number;
}): { subject: string; variant: 'A' | 'B' } {
  if (!campaign.subjectVariantB) {
    return { subject: campaign.subject, variant: 'A' };
  }

  const totalSent = campaign.variantASent + campaign.variantBSent;

  // First 50 sends: random 50/50 split
  if (totalSent < 50) {
    const useB = Math.random() < 0.5;
    return {
      subject: useB ? campaign.subjectVariantB : campaign.subject,
      variant: useB ? 'B' : 'A',
    };
  }

  // After 50 sends: pick winner by open rate
  const rateA = campaign.variantASent > 0 ? campaign.variantAOpened / campaign.variantASent : 0;
  const rateB = campaign.variantBSent > 0 ? campaign.variantBOpened / campaign.variantBSent : 0;

  if (rateB > rateA + 0.05) {
    return { subject: campaign.subjectVariantB, variant: 'B' };
  }
  return { subject: campaign.subject, variant: 'A' };
}

// ─── Track opens/clicks ─────────────────────────────────────────────────────

export async function trackOpen(sendId: string) {
  const send = await prisma.emailSend.findUnique({
    where: { id: sendId },
    select: { id: true, openedAt: true, variant: true, campaignId: true },
  });
  if (!send || send.openedAt) return; // already tracked

  await prisma.$transaction([
    prisma.emailSend.update({ where: { id: sendId }, data: { openedAt: new Date() } }),
    prisma.emailCampaign.update({
      where: { id: send.campaignId },
      data: send.variant === 'B'
        ? { variantBOpened: { increment: 1 } }
        : { variantAOpened: { increment: 1 } },
    }),
  ]);
}

export async function trackClick(sendId: string) {
  await prisma.emailSend.update({
    where: { id: sendId },
    data: { clickedAt: new Date() },
  });
}

// ─── Campaign Stats ─────────────────────────────────────────────────────────

export async function getCampaignStats(campaignId: string) {
  const [total, opened, clicked] = await prisma.$transaction([
    prisma.emailSend.count({ where: { campaignId } }),
    prisma.emailSend.count({ where: { campaignId, openedAt: { not: null } } }),
    prisma.emailSend.count({ where: { campaignId, clickedAt: { not: null } } }),
  ]);

  const campaign = await getCampaign(campaignId);

  return {
    totalSent: total,
    opened,
    clicked,
    openRate: total > 0 ? Math.round((opened / total) * 1000) / 10 : 0,
    clickRate: total > 0 ? Math.round((clicked / total) * 1000) / 10 : 0,
    abTest: campaign.subjectVariantB ? {
      variantA: { sent: campaign.variantASent, opened: campaign.variantAOpened, rate: campaign.variantASent > 0 ? Math.round((campaign.variantAOpened / campaign.variantASent) * 1000) / 10 : 0 },
      variantB: { sent: campaign.variantBSent, opened: campaign.variantBOpened, rate: campaign.variantBSent > 0 ? Math.round((campaign.variantBOpened / campaign.variantBSent) * 1000) / 10 : 0 },
      winner: campaign.variantASent + campaign.variantBSent >= 50
        ? ((campaign.variantBSent > 0 ? campaign.variantBOpened / campaign.variantBSent : 0) > (campaign.variantASent > 0 ? campaign.variantAOpened / campaign.variantASent : 0) ? 'B' : 'A')
        : 'testing',
    } : undefined,
  };
}

// ─── Duplicate send guard ────────────────────────────────────────────────────

/**
 * Returns true if this recipient already received this campaign within the
 * given window (default 23h — prevents double-sends within the same day).
 */
export async function hasRecentSend(
  campaignId: string,
  recipientId: string,
  windowHours = 23,
): Promise<boolean> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const existing = await prisma.emailSend.findFirst({
    where: { campaignId, recipientId, sentAt: { gte: since } },
    select: { id: true },
  });
  return existing !== null;
}

// ─── List sends for a campaign ──────────────────────────────────────────────

export async function listSends(campaignId: string, limit = 50) {
  return prisma.emailSend.findMany({
    where: { campaignId },
    orderBy: { sentAt: 'desc' },
    take: limit,
    select: {
      id: true,
      recipientEmail: true,
      variant: true,
      openedAt: true,
      clickedAt: true,
      sentAt: true,
    },
  });
}

// ─── Record a send ──────────────────────────────────────────────────────────

export async function recordSend(input: {
  campaignId: string;
  recipientId: string;
  recipientEmail: string;
  variant: 'A' | 'B';
  personalData?: PersonalizedData | DietitianSummaryData;
}) {
  const send = await prisma.emailSend.create({
    data: {
      campaignId: input.campaignId,
      recipientId: input.recipientId,
      recipientEmail: input.recipientEmail,
      variant: input.variant,
      personalData: input.personalData as object ?? undefined,
    },
  });

  // Increment variant counter
  await prisma.emailCampaign.update({
    where: { id: input.campaignId },
    data: input.variant === 'B'
      ? { variantBSent: { increment: 1 }, lastSentAt: new Date() }
      : { variantASent: { increment: 1 }, lastSentAt: new Date() },
  });

  return send;
}
