/**
 * 39.2 — Device Fingerprint Service.
 *
 * Records browser fingerprints (from FingerprintJS) and detects
 * multiple accounts using the same device.
 */

import { prisma } from '@db';

const MAX_ACCOUNTS_PER_DEVICE = 3;

/**
 * Record a device fingerprint for a user.
 * Called on login/register with the FingerprintJS visitorId.
 */
export async function recordFingerprint(
  fingerprint: string,
  userId: string,
  userAgent?: string,
  ip?: string,
): Promise<void> {
  await prisma.deviceFingerprint.upsert({
    where: {
      fingerprint_userId: { fingerprint, userId },
    },
    create: {
      fingerprint,
      userId,
      userAgent: userAgent ?? null,
      ip: ip ?? null,
    },
    update: {
      lastSeenAt: new Date(),
      userAgent: userAgent ?? undefined,
      ip: ip ?? undefined,
    },
  });
}

/**
 * Check if a device fingerprint is associated with too many accounts.
 * Returns the list of user IDs that share this fingerprint.
 */
export async function checkFingerprintAbuse(
  fingerprint: string,
): Promise<{ isAbusive: boolean; accountCount: number; userIds: string[] }> {
  const records = await prisma.deviceFingerprint.findMany({
    where: { fingerprint },
    select: { userId: true },
    distinct: ['userId'],
  });

  const userIds = records.map((r) => r.userId);

  return {
    isAbusive: userIds.length > MAX_ACCOUNTS_PER_DEVICE,
    accountCount: userIds.length,
    userIds,
  };
}

/**
 * Get all fingerprints for a user (admin view).
 */
export async function getUserFingerprints(userId: string) {
  return prisma.deviceFingerprint.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
  });
}

/**
 * Get all users sharing a fingerprint (admin investigation).
 */
export async function getUsersByFingerprint(fingerprint: string) {
  const records = await prisma.deviceFingerprint.findMany({
    where: { fingerprint },
    include: {
      user: { select: { id: true, email: true, role: true, createdAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return records.map((r) => ({
    userId: r.userId,
    email: r.user.email,
    role: r.user.role,
    userCreatedAt: r.user.createdAt,
    firstSeen: r.createdAt,
    lastSeen: r.lastSeenAt,
    userAgent: r.userAgent,
    ip: r.ip,
  }));
}
