import { prisma } from '@db';
import { getPlanLimits, type PlanLimits } from '../config/planLimits';
import { getSetting, SETTING_PAYWALL_ENABLED } from './appSettings.service';

/**
 * Paywall feature flag — checks DB AppSettings first, falls back to env var.
 * DB setting takes precedence when it exists.
 */
export async function isPaywallEnabled(): Promise<boolean> {
  const dbSetting = await getSetting<boolean | null>(SETTING_PAYWALL_ENABLED, null);
  if (dbSetting !== null) return dbSetting;
  return process.env.PAYWALL_ENABLED === 'true';
}

export interface AccessStatus {
  paywallEnabled: boolean;
  hasAccess: boolean;
  /** Most recent active order (if any). */
  activeOrder: {
    id: string;
    productType: string;
    status: string;
    createdAt: Date;
  } | null;
  /** Plan limits for the active order (17.6.3). */
  planLimits: PlanLimits | null;
  /** Usage this week (17.6.3). */
  weeklyUsage: {
    dietsGenerated: number;
    swapsUsed: number;
  } | null;
}

/**
 * Check whether a patient (by userId) has an active paid order
 * that grants access to interviews and diet plans.
 *
 * Access is granted when:
 * - paywall is disabled (feature flag off), OR
 * - patient has at least one Order with status PAID, ACTIVE, or COMPLETED
 */
export async function checkAccess(userId: string): Promise<AccessStatus> {
  if (!(await isPaywallEnabled())) {
    return { paywallEnabled: false, hasAccess: true, activeOrder: null, planLimits: null, weeklyUsage: null };
  }

  // Admin-granted access (29.0.6)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { grantedAccessUntil: true },
  });
  if (user?.grantedAccessUntil && user.grantedAccessUntil > new Date()) {
    return { paywallEnabled: true, hasAccess: true, activeOrder: null, planLimits: null, weeklyUsage: null };
  }

  const patient = await prisma.patient.findUnique({ where: { userId } });
  if (!patient) {
    return { paywallEnabled: true, hasAccess: false, activeOrder: null, planLimits: null, weeklyUsage: null };
  }

  const order = await prisma.order.findFirst({
    where: {
      patientId: patient.id,
      status: { in: ['PAID', 'ACTIVE', 'COMPLETED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, productType: true, status: true, createdAt: true },
  });

  if (!order) {
    return { paywallEnabled: true, hasAccess: false, activeOrder: null, planLimits: null, weeklyUsage: null };
  }

  const limits = getPlanLimits(order.productType);

  // Count this week's usage
  const weekStart = getWeekStart();
  const weeklyUsage = await getWeeklyUsage(patient.id, weekStart);

  return {
    paywallEnabled: true,
    hasAccess: true,
    activeOrder: order,
    planLimits: limits,
    weeklyUsage,
  };
}

/**
 * Check if patient can generate a new diet plan this week (17.6.3).
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function checkDietGenerationLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!(await isPaywallEnabled())) {
    return { allowed: true };
  }

  const status = await checkAccess(userId);

  if (!status.hasAccess || !status.activeOrder) {
    return { allowed: false, reason: 'No active order' };
  }

  const limits = status.planLimits;
  if (!limits) {
    return { allowed: true }; // Unknown product type — allow (legacy)
  }

  // FREE_7: only 1 plan ever
  if (status.activeOrder.productType === 'FREE_7') {
    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { allowed: false, reason: 'Patient not found' };

    const existingPlan = await prisma.dietPlan.findFirst({
      where: { patientId: patient.id },
    });
    if (existingPlan) {
      return { allowed: false, reason: 'Free plan allows only 1 diet plan' };
    }
    return { allowed: true };
  }

  // Check weekly diet generation limit
  if (limits.maxDietsPerWeek > 0 && status.weeklyUsage) {
    if (status.weeklyUsage.dietsGenerated >= limits.maxDietsPerWeek) {
      return {
        allowed: false,
        reason: `Weekly diet limit reached (${limits.maxDietsPerWeek}/week)`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if patient can perform a meal swap this week (17.6.3).
 */
export async function checkSwapLimit(userId: string): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  if (!(await isPaywallEnabled())) {
    return { allowed: true };
  }

  const status = await checkAccess(userId);

  if (!status.hasAccess || !status.activeOrder) {
    return { allowed: false, reason: 'No active order' };
  }

  const limits = status.planLimits;
  if (!limits) {
    return { allowed: true }; // Unknown product type — allow (legacy)
  }

  if (limits.maxSwapsPerWeek === 0) {
    return { allowed: false, reason: 'Meal swaps not included in your plan' };
  }

  if (status.weeklyUsage) {
    const remaining = limits.maxSwapsPerWeek - status.weeklyUsage.swapsUsed;
    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `Weekly swap limit reached (${limits.maxSwapsPerWeek}/week)`,
        remaining: 0,
      };
    }
    return { allowed: true, remaining };
  }

  return { allowed: true, remaining: limits.maxSwapsPerWeek };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns Monday 00:00:00 of the current week (UTC). */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // Days since Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday;
}

/** Count diet plans and meal swaps created this week for a patient. */
async function getWeeklyUsage(patientId: string, weekStart: Date) {
  const [dietsGenerated, swapsUsed] = await Promise.all([
    prisma.dietPlan.count({
      where: {
        patientId,
        createdAt: { gte: weekStart },
      },
    }),
    prisma.mealSwap.count({
      where: {
        confirmed: true,
        createdAt: { gte: weekStart },
        dietPlan: { patientId },
      },
    }),
  ]);

  return { dietsGenerated, swapsUsed };
}
