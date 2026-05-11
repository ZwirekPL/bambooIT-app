import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { logAudit } from './audit.service';

type ConsentType =
  | 'HEALTH_DATA_PROCESSING'
  | 'AI_DISCLAIMER'
  | 'EMAIL_NOTIFICATIONS'
  | 'TERMS_ACCEPTANCE'
  | 'PRIVACY_POLICY'
  | 'COOKIE_FUNCTIONAL'
  | 'COOKIE_ANALYTICS'
  | 'COOKIE_MARKETING';

/**
 * Grant a new consent record for the user.
 * If the user already has an active consent of this type, the old one is revoked first.
 */
export async function grantConsent(
  userId: string,
  consentType: ConsentType,
  documentVersion: string,
  ipAddress?: string,
) {
  // Revoke any existing active consent of the same type
  await prisma.userConsent.updateMany({
    where: { userId, consentType, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const consent = await prisma.userConsent.create({
    data: {
      userId,
      consentType,
      granted: true,
      documentVersion,
      ipAddress: ipAddress ?? null,
    },
  });

  logAudit({
    userId,
    action: 'CONSENT_GRANTED',
    resourceType: 'CONSENT',
    resourceId: consent.id,
    metadata: { consentType, documentVersion },
  });

  return consent;
}

/**
 * Revoke the latest active consent of the given type.
 */
export async function revokeConsent(
  userId: string,
  consentType: ConsentType,
  ipAddress?: string,
) {
  const activeConsent = await prisma.userConsent.findFirst({
    where: { userId, consentType, revokedAt: null },
    orderBy: { acceptedAt: 'desc' },
  });

  if (!activeConsent) {
    throw new AppError(404, 'CONSENT_NOT_FOUND', `No active consent of type ${consentType} found`);
  }

  const updated = await prisma.userConsent.update({
    where: { id: activeConsent.id },
    data: { revokedAt: new Date() },
  });

  logAudit({
    userId,
    action: 'CONSENT_REVOKED',
    resourceType: 'CONSENT',
    resourceId: activeConsent.id,
    ip: ipAddress,
    metadata: { consentType },
  });

  return updated;
}

/**
 * Get all active (non-revoked) consents for a user.
 */
export async function getActiveConsents(userId: string) {
  return prisma.userConsent.findMany({
    where: { userId, revokedAt: null },
    orderBy: { acceptedAt: 'desc' },
    select: {
      id: true,
      consentType: true,
      granted: true,
      documentVersion: true,
      acceptedAt: true,
    },
  });
}

/**
 * Get full consent history for a user (for DSAR / Art. 15).
 */
export async function getConsentHistory(userId: string) {
  return prisma.userConsent.findMany({
    where: { userId },
    orderBy: { acceptedAt: 'desc' },
    select: {
      id: true,
      consentType: true,
      granted: true,
      documentVersion: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });
}

/**
 * Check whether the user has an active consent of the given type.
 */
export async function hasActiveConsent(
  userId: string,
  consentType: ConsentType,
): Promise<boolean> {
  const consent = await prisma.userConsent.findFirst({
    where: { userId, consentType, revokedAt: null },
  });
  return consent !== null;
}
