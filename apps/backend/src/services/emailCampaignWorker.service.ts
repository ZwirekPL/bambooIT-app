/**
 * Email Campaign Worker (84.4b-d)
 *
 * Generates personalized email content and sends via nodemailer.
 * Called by BullMQ cron jobs or admin "send now" action.
 *
 * Content generators:
 *   - Weekly patient summary (personalized insights)
 *   - Dietitian patient overview
 *   - Trigger-based: plateau, milestone, inactive, plan expiry
 */

import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import {
  isCampaignSystemEnabled,
  selectSubjectVariant,
  recordSend,
  hasRecentSend,
  type PersonalizedData,
  type DietitianSummaryData,
} from './emailCampaign.service';
import {
  sendWeeklySummaryEmail,
  sendDietitianSummaryEmail,
  sendCustomCampaignEmail,
  type WeeklySummaryEmailData,
} from '../utils/email';
import {
  renderBlocksToHtml,
  wrapInEmailLayout,
  type EmailBlockTemplate,
  type TemplateVars,
} from '../utils/templateRenderer';

// ─── Tips pool (rotated per patient) ────────────────────────────────────────

const TIPS: Record<string, string[]> = {
  lose_weight: [
    'Pij szklankę wody przed każdym posiłkiem — to zmniejsza apetyt o 20-25%.',
    'Jedz powoli — sygnał sytości dociera do mózgu po 20 minutach.',
    'Dodaj białko do śniadania — zmniejszysz apetyt na resztę dnia.',
    'Warzywa powinny zajmować połowę talerza przy każdym posiłku.',
    'Unikaj jedzenia przed ekranem — nieświadome jedzenie = więcej kalorii.',
  ],
  maintenance: [
    'Regularność posiłków to klucz do utrzymania wagi.',
    'Ważenie raz w tygodniu (rano, na czczo) wystarczy — nie codziennie.',
    'Spróbuj nowego przepisu w tym tygodniu — różnorodność = lepsze mikro.',
    'Nawodnienie: 30ml na kg masy ciała to minimum.',
    'Sen 7-8h = lepszy metabolizm. Zadbaj o regularną porę snu.',
  ],
  muscle_gain: [
    'Białko w ciągu 2h po treningu — wspiera regenerację i wzrost mięśni.',
    'Nie pomijaj węglowodanów — to paliwo do treningu i regeneracji.',
    'Kreotyna 3-5g/d — najlepiej przebadany suplement na masę mięśniową.',
    'Progresywny overload > więcej powtórzeń. Zwiększaj obciążenie co tydzień.',
    'Sen to najlepsza regeneracja — GH (hormon wzrostu) wydziela się w fazie głębokiego snu.',
  ],
};

function getPersonalizedTip(goal: string, weekNumber: number): string {
  const pool = TIPS[goal] ?? TIPS.maintenance;
  return pool[weekNumber % pool.length];
}

// ─── Personalized Data Generator ────────────────────────────────────────────

export async function buildPersonalizedData(patientId: string): Promise<PersonalizedData | null> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true, userId: true },
  });
  if (!patient) return null;

  // Recent check-ins (last 4 weeks)
  const checkIns = await prisma.checkIn.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take: 4,
    select: { weightKg: true, compliance: true, createdAt: true },
  });

  // Weight trend
  let weightTrend: string | null = null;
  if (checkIns.length >= 2) {
    const latest = Number(checkIns[0].weightKg);
    const previous = Number(checkIns[1].weightKg);
    const diff = latest - previous;
    weightTrend = diff > 0 ? `+${diff.toFixed(1)}kg` : `${diff.toFixed(1)}kg`;
  }

  // Compliance average
  const complianceValues = checkIns.map((c) => c.compliance).filter((c): c is number => c != null);
  const weeklyCompliance = complianceValues.length > 0
    ? Math.round(complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length)
    : null;

  // Streak (consecutive check-ins within 10 days each)
  let streak = 0;
  for (let i = 0; i < checkIns.length - 1; i++) {
    const gap = (checkIns[i].createdAt.getTime() - checkIns[i + 1].createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (gap <= 10) streak++;
    else break;
  }

  // Top/worst rated meals (last 2 weeks)
  const ratings = await prisma.recipeRating.findMany({
    where: { patientId, createdAt: { gte: new Date(Date.now() - 14 * 86400000) } },
    orderBy: { rating: 'desc' },
    take: 10,
    select: { rating: true, recipe: { select: { title: true } } },
  });
  const topMeal = ratings.length > 0 ? ratings[0].recipe?.title ?? null : null;
  const worstMeal = ratings.length > 1 ? ratings[ratings.length - 1].recipe?.title ?? null : null;

  // Missing micro (from latest plan coverage)
  const plan = await prisma.dietPlan.findFirst({
    where: { patientId, status: { in: ['PUBLISHED', 'SENT', 'REVIEWED'] } },
    orderBy: { createdAt: 'desc' },
    select: { policyMetadata: true },
  });
  const coverage = (plan?.policyMetadata as Record<string, unknown>)?.coverage as Record<string, unknown> | undefined;
  const dailyGL = (coverage?.dailyGlycemicLoad as number[]) ?? [];
  const avgGi = dailyGL.length > 0 ? Math.round(dailyGL.reduce((a, b) => a + b, 0) / dailyGL.length) : null;

  // Achievement detection
  let achievement: string | null = null;
  if (checkIns.length >= 2) {
    const totalProgress = await prisma.checkIn.findMany({
      where: { patientId },
      orderBy: { createdAt: 'asc' },
      take: 1,
      select: { weightKg: true },
    });
    if (totalProgress.length > 0) {
      const totalLost = Number(totalProgress[0].weightKg) - Number(checkIns[0].weightKg);
      if (totalLost >= 10) achievement = `${totalLost.toFixed(1)}kg stracone od początku!`;
      else if (totalLost >= 5) achievement = `${totalLost.toFixed(1)}kg stracone — świetna robota!`;
      else if (streak >= 4) achievement = `${streak + 1} tygodni regularnych check-inów!`;
    }
  }

  // Goal for tip selection
  const targets = await prisma.nutritionTargets.findUnique({
    where: { patientId },
    select: { goal: true },
  });
  const weekNum = Math.floor(Date.now() / (7 * 86400000));
  const tip = getPersonalizedTip(targets?.goal ?? 'maintenance', weekNum);

  return {
    patientName: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Pacjencie',
    weightTrend,
    weeklyCompliance,
    topMeal,
    worstMeal,
    missingMicro: null, // TODO: extract from plan quality data
    avgGi,
    streak: streak + 1,
    achievement,
    tip,
  };
}

// ─── Dietitian Summary Generator ────────────────────────────────────────────

export async function buildDietitianSummary(dietitianUserId: string): Promise<DietitianSummaryData | null> {
  const profile = await prisma.dietitianProfile.findUnique({
    where: { userId: dietitianUserId },
    select: { firstName: true, lastName: true },
  });
  if (!profile) return null;

  const patients = await prisma.patient.findMany({
    where: { dietitianId: dietitianUserId },
    select: {
      id: true, firstName: true, lastName: true,
      checkIns: { orderBy: { createdAt: 'desc' }, take: 1, select: { compliance: true, createdAt: true } },
    },
  });

  const now = Date.now();
  const lowCompliance: Array<{ name: string; compliance: number }> = [];
  const inactive: Array<{ name: string; daysSinceLastCheckin: number }> = [];
  let totalCompliance = 0;
  let complianceCount = 0;
  let activeCount = 0;

  for (const p of patients) {
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || `Pacjent ${p.id.slice(-4)}`;
    const lastCheckin = p.checkIns[0];

    if (lastCheckin) {
      const daysSince = Math.floor((now - lastCheckin.createdAt.getTime()) / 86400000);
      if (daysSince <= 14) {
        activeCount++;
        if (lastCheckin.compliance != null) {
          totalCompliance += lastCheckin.compliance;
          complianceCount++;
          if (lastCheckin.compliance < 50) lowCompliance.push({ name, compliance: lastCheckin.compliance });
        }
      }
      if (daysSince > 14) inactive.push({ name, daysSinceLastCheckin: daysSince });
    } else {
      inactive.push({ name, daysSinceLastCheckin: 999 });
    }
  }

  return {
    dietitianName: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Dietetyku',
    totalPatients: patients.length,
    activePatients: activeCount,
    avgCompliance: complianceCount > 0 ? Math.round(totalCompliance / complianceCount) : 0,
    lowCompliancePatients: lowCompliance.slice(0, 5),
    inactivePatients: inactive.slice(0, 5),
    plateauPatients: [], // TODO: detect from check-in trends
    milestones: [],      // TODO: detect from progress data
  };
}

// ─── Trigger Detection ──────────────────────────────────────────────────────

export interface TriggerResult {
  type: 'TRIGGER_PLATEAU' | 'TRIGGER_MILESTONE' | 'TRIGGER_INACTIVE' | 'TRIGGER_PLAN_EXPIRY';
  patientId: string;
  userId: string;
  email: string;
  data: Record<string, unknown>;
}

export async function detectTriggers(): Promise<TriggerResult[]> {
  const triggers: TriggerResult[] = [];
  const now = Date.now();

  // Get active patients with weeklySummary enabled
  const patients = await prisma.patient.findMany({
    where: { user: { deletedAt: null } },
    select: {
      id: true,
      userId: true,
      firstName: true,
      user: { select: { email: true, notificationPreferences: { select: { weeklySummary: true } } } },
      checkIns: { orderBy: { createdAt: 'desc' }, take: 4, select: { weightKg: true, createdAt: true, compliance: true } },
      dietPlans: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, status: true } },
    },
  });

  for (const p of patients) {
    if (!p.user.notificationPreferences?.weeklySummary) continue;
    const name = [p.firstName].filter(Boolean).join(' ') || 'Pacjent';

    // TRIGGER_INACTIVE: no check-in for >14 days
    const lastCheckin = p.checkIns[0];
    if (lastCheckin) {
      const daysSince = Math.floor((now - lastCheckin.createdAt.getTime()) / 86400000);
      if (daysSince >= 14 && daysSince < 21) { // send once, not spam
        triggers.push({
          type: 'TRIGGER_INACTIVE',
          patientId: p.id, userId: p.userId, email: p.user.email,
          data: { name, daysSince },
        });
      }
    }

    // TRIGGER_PLATEAU: 3+ check-ins with <0.3kg change
    if (p.checkIns.length >= 3) {
      const weights = p.checkIns.slice(0, 3).map((c) => Number(c.weightKg));
      const range = Math.max(...weights) - Math.min(...weights);
      if (range < 0.3) {
        triggers.push({
          type: 'TRIGGER_PLATEAU',
          patientId: p.id, userId: p.userId, email: p.user.email,
          data: { name, weeks: 3, currentWeight: weights[0] },
        });
      }
    }

    // TRIGGER_MILESTONE: total weight loss milestones (5kg, 10kg, 15kg, 20kg)
    if (p.checkIns.length >= 2) {
      const firstCheckin = await prisma.checkIn.findFirst({
        where: { patientId: p.id },
        orderBy: { createdAt: 'asc' },
        select: { weightKg: true },
      });
      if (firstCheckin) {
        const totalLost = Number(firstCheckin.weightKg) - Number(p.checkIns[0].weightKg);
        const milestones = [5, 10, 15, 20];
        for (const m of milestones) {
          if (totalLost >= m && totalLost < m + 0.5) {
            triggers.push({
              type: 'TRIGGER_MILESTONE',
              patientId: p.id, userId: p.userId, email: p.user.email,
              data: { name, milestone: `${m}kg`, totalLost: totalLost.toFixed(1) },
            });
            break;
          }
        }
      }
    }

    // TRIGGER_PLAN_EXPIRY: latest plan created >25 days ago and still active
    const latestPlan = p.dietPlans[0];
    if (latestPlan && ['PUBLISHED', 'SENT'].includes(latestPlan.status)) {
      const daysSinceCreation = Math.floor((now - latestPlan.createdAt.getTime()) / 86400000);
      if (daysSinceCreation >= 25 && daysSinceCreation < 30) {
        triggers.push({
          type: 'TRIGGER_PLAN_EXPIRY',
          patientId: p.id, userId: p.userId, email: p.user.email,
          data: { name, daysRemaining: 30 - daysSinceCreation },
        });
      }
    }
  }

  return triggers;
}

// ─── Helpers for executeCampaign ────────────────────────────────────────────

function buildHighlights(data: PersonalizedData): string[] {
  const out: string[] = [];
  if (data.weightTrend)       out.push(`Zmiana wagi: ${data.weightTrend}`);
  if (data.weeklyCompliance != null) out.push(`Adherencja do planu: ${data.weeklyCompliance}%`);
  if (data.achievement)       out.push(`Osiągnięcie: ${data.achievement}`);
  if (data.topMeal)           out.push(`Najlepiej oceniany posiłek: ${data.topMeal}`);
  return out;
}

interface CampaignRecipient {
  userId: string;
  email: string;
  name: string;
  weightTrend?: string | null;
  compliance?: number | null;
}

async function resolveCustomRecipients(segmentation: string): Promise<CampaignRecipient[]> {
  if (segmentation === 'dietitians') {
    const users = await prisma.user.findMany({
      where: { role: 'DIETITIAN', deletedAt: null },
      select: { id: true, email: true },
    });
    return users.map((u) => ({ userId: u.id, email: u.email, name: u.email }));
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const patients = await prisma.patient.findMany({
    where: {
      user: { deletedAt: null },
      ...(segmentation === 'active'
        ? { checkIns: { some: { createdAt: { gte: fourteenDaysAgo } } } }
        : {}),
    },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      user: { select: { email: true } },
    },
  });

  let filtered = patients;
  if (!['all', 'active'].includes(segmentation)) {
    // NutritionTargets.patientId references Patient.id (not Patient.userId)
    const targets = await prisma.nutritionTargets.findMany({
      where: { patientId: { in: patients.map((p) => p.id) }, goal: segmentation },
      select: { patientId: true },
    });
    const segmentIds = new Set(targets.map((t) => t.patientId));
    filtered = patients.filter((p) => segmentIds.has(p.id));
  }

  return filtered.map((p) => ({
    userId: p.userId,
    email: p.user.email,
    name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.user.email,
  }));
}

// ─── Send Campaign to Eligible Recipients ───────────────────────────────────

export async function executeCampaign(campaignId: string, dryRun = false): Promise<{
  sent: number;
  skipped: number;
  errors: number;
}> {
  const enabled = await isCampaignSystemEnabled();
  if (!enabled) return { sent: 0, skipped: 0, errors: 0 };

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !campaign.enabled) return { sent: 0, skipped: 0, errors: 0 };

  let sent = 0, skipped = 0, errors = 0;

  if (campaign.type === 'WEEKLY_SUMMARY') {
    // Get patients with weeklySummary=true
    const patients = await prisma.patient.findMany({
      where: {
        user: {
          deletedAt: null,
          notificationPreferences: { weeklySummary: true },
        },
      },
      select: { id: true, userId: true, user: { select: { email: true } } },
    });

    // Segment filter
    let filtered = patients;
    if (campaign.segmentation && campaign.segmentation !== 'all') {
      const targets = await prisma.nutritionTargets.findMany({
        where: { patientId: { in: patients.map((p) => p.id) }, goal: campaign.segmentation },
        select: { patientId: true },
      });
      const segmentIds = new Set(targets.map((t) => t.patientId));
      filtered = patients.filter((p) => segmentIds.has(p.id));
    }

    for (const patient of filtered) {
      try {
        if (!dryRun && await hasRecentSend(campaignId, patient.userId)) { skipped++; continue; }

        const data = await buildPersonalizedData(patient.id);
        if (!data) { skipped++; continue; }

        const { subject, variant } = selectSubjectVariant(campaign);
        const personalizedSubject = subject.replace('{{name}}', data.patientName);

        if (!dryRun) {
          const appUrl = process.env.APP_URL ?? 'https://e-dietetyk.com';
          const emailData: WeeklySummaryEmailData = {
            highlights: buildHighlights(data),
            tips: data.tip ? [data.tip] : [],
            checkinUrl: `${process.env.APP_URL ?? 'https://e-dietetyk.com'}/check-in`,
            weightCurrent: null,
            weightChange: null,
            weightDirection: data.weightTrend ?? 'stable',
            currentKcal: null,
            adaptationApplied: false,
          };
          const send = await recordSend({
            campaignId,
            recipientId: patient.userId,
            recipientEmail: patient.user.email,
            variant,
            personalData: data,
          });
          const unsubscribeUrl = `${appUrl}/api/email-campaigns/unsubscribe/${send.id}`;
          await sendWeeklySummaryEmail(patient.user.email, data.patientName, { ...emailData, unsubscribeUrl });
        }
        sent++;
      } catch { errors++; }
    }
  }

  if (campaign.type === 'DIETITIAN_SUMMARY') {
    const dietitians = await prisma.user.findMany({
      where: { role: 'DIETITIAN', deletedAt: null },
      select: { id: true, email: true },
    });

    for (const d of dietitians) {
      try {
        if (!dryRun && await hasRecentSend(campaignId, d.id)) { skipped++; continue; }

        const data = await buildDietitianSummary(d.id);
        if (!data || data.totalPatients === 0) { skipped++; continue; }

        const { subject: _subject, variant } = selectSubjectVariant(campaign);

        if (!dryRun) {
          const send = await recordSend({
            campaignId,
            recipientId: d.id,
            recipientEmail: d.email,
            variant,
            personalData: data,
          });
          const appUrl = process.env.APP_URL ?? 'https://e-dietetyk.com';
          const unsubscribeUrl = `${appUrl}/api/email-campaigns/unsubscribe/${send.id}`;
          await sendDietitianSummaryEmail(d.email, { ...data, unsubscribeUrl });
        }
        sent++;
      } catch { errors++; }
    }
  }

  if (campaign.type === 'CUSTOM' || campaign.type === 'MOTIVATION') {
    if (!campaign.bodyTemplate) return { sent: 0, skipped: 1, errors: 0 };

    let template: EmailBlockTemplate;
    try {
      template = JSON.parse(campaign.bodyTemplate) as EmailBlockTemplate;
    } catch {
      return { sent: 0, skipped: 0, errors: 1 };
    }

    const recipients = await resolveCustomRecipients(campaign.segmentation ?? 'all');

    const appUrl = process.env.APP_URL ?? 'https://e-dietetyk.com';

    for (const r of recipients) {
      try {
        if (!dryRun && await hasRecentSend(campaignId, r.userId)) { skipped++; continue; }

        if (!dryRun) {
          const { subject, variant } = selectSubjectVariant(campaign);
          const personalizedSubject = subject.replace('{{name}}', r.name);
          const send = await recordSend({
            campaignId,
            recipientId: r.userId,
            recipientEmail: r.email,
            variant,
            personalData: r as unknown as PersonalizedData,
          });
          const unsubscribeUrl = `${appUrl}/api/email-campaigns/unsubscribe/${send.id}`;
          const vars: TemplateVars = {
            patientName: r.name || undefined,
            weightTrend: r.weightTrend ?? undefined,
            compliance: r.compliance != null ? String(r.compliance) : undefined,
            unsubscribeUrl,
          };
          const body = renderBlocksToHtml(template, vars);
          const html = wrapInEmailLayout(body, personalizedSubject, send.id, unsubscribeUrl);
          await sendCustomCampaignEmail(r.email, personalizedSubject, html);
        }
        sent++;
      } catch { errors++; }
    }
  }

  return { sent, skipped, errors };
}
