import crypto from 'crypto';
import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { logAudit } from './audit.service';

/** Generate a unique referral code like "DIET-A1B2C3" */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  let suffix = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `DIET-${suffix}`;
}

/** Create a referral code for a user (idempotent — returns existing if already has one). */
export async function getOrCreateCode(userId: string) {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing;

  // Retry up to 3 times in case of code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    try {
      const created = await prisma.referralCode.create({
        data: { userId, code },
      });
      logAudit({ userId, action: 'REFERRAL_CODE_GENERATED', resourceType: 'REFERRAL', resourceId: created.id });
      return created;
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') continue; // unique constraint — retry
      throw err;
    }
  }

  throw new AppError(500, 'CODE_GENERATION_FAILED', 'Could not generate unique referral code');
}

/** Get referral code + stats for a user. */
export async function getMyReferral(userId: string) {
  const referralCode = await prisma.referralCode.findUnique({
    where: { userId },
    include: {
      _count: { select: { usages: true } },
    },
  });

  if (!referralCode) return null;

  return {
    id: referralCode.id,
    code: referralCode.code,
    discountPercent: referralCode.discountPercent,
    usageCount: referralCode._count.usages,
    createdAt: referralCode.createdAt,
  };
}

/** Validate a referral code and create a usage record for a new user. */
export async function applyReferralOnRegistration(
  referralCodeStr: string,
  referredUserId: string,
): Promise<void> {
  const referralCode = await prisma.referralCode.findUnique({
    where: { code: referralCodeStr.toUpperCase() },
  });

  if (!referralCode) {
    throw new AppError(400, 'INVALID_REFERRAL_CODE', 'Invalid referral code');
  }

  // Prevent self-referral
  if (referralCode.userId === referredUserId) {
    throw new AppError(400, 'SELF_REFERRAL', 'Cannot use your own referral code');
  }

  // Check if already used by this user
  const existingUsage = await prisma.referralUsage.findUnique({
    where: {
      referralCodeId_referredUserId: {
        referralCodeId: referralCode.id,
        referredUserId,
      },
    },
  });

  if (existingUsage) return; // idempotent

  await prisma.referralUsage.create({
    data: {
      referralCodeId: referralCode.id,
      referredUserId,
    },
  });

  logAudit({
    userId: referredUserId,
    action: 'REFERRAL_USED',
    resourceType: 'REFERRAL',
    resourceId: referralCode.id,
    metadata: { referrerUserId: referralCode.userId, code: referralCode.code },
  });
}

/** Get the discount percent for a referred user (for checkout). Returns 0 if no referral. */
export async function getReferralDiscount(userId: string): Promise<number> {
  const usage = await prisma.referralUsage.findFirst({
    where: { referredUserId: userId, orderId: null },
    include: { referralCode: true },
  });

  if (!usage) return 0;
  return usage.referralCode.discountPercent;
}

/** Mark a referral usage as redeemed (link to order). */
export async function markReferralRedeemed(userId: string, orderId: string): Promise<void> {
  const usage = await prisma.referralUsage.findFirst({
    where: { referredUserId: userId, orderId: null },
  });

  if (!usage) return;

  await prisma.referralUsage.update({
    where: { id: usage.id },
    data: { orderId },
  });

  logAudit({
    userId,
    action: 'REFERRAL_DISCOUNT_APPLIED',
    resourceType: 'ORDER',
    resourceId: orderId,
    metadata: { referralUsageId: usage.id },
  });
}

/** Admin: get referral stats. */
export async function getAdminStats() {
  const [totalCodes, totalUsages, usagesWithOrders] = await Promise.all([
    prisma.referralCode.count(),
    prisma.referralUsage.count(),
    prisma.referralUsage.count({ where: { orderId: { not: null } } }),
  ]);

  // Top referrers
  const topReferrers = await prisma.referralCode.findMany({
    include: {
      _count: { select: { usages: true } },
      user: { select: { id: true, email: true } },
    },
    orderBy: { usages: { _count: 'desc' } },
    take: 10,
  });

  return {
    totalCodes,
    totalUsages,
    totalRedeemed: usagesWithOrders,
    conversionRate: totalUsages > 0 ? Math.round((usagesWithOrders / totalUsages) * 100) : 0,
    topReferrers: topReferrers.map((r) => ({
      userId: r.user.id,
      email: r.user.email,
      code: r.code,
      usageCount: r._count.usages,
    })),
  };
}
