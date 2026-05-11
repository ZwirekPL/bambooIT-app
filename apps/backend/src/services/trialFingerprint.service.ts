import { prisma } from '@db';

/**
 * Checks if a card fingerprint has already been used for a trial subscription.
 * Returns true if the fingerprint is already recorded (trial abuse detected).
 */
export async function isCardFingerprintUsed(fingerprint: string): Promise<boolean> {
  const existing = await prisma.trialFingerprint.findUnique({
    where: { cardFingerprint: fingerprint },
  });
  return existing !== null;
}

/**
 * Records a card fingerprint after a successful trial checkout.
 * Called from the Stripe webhook when checkout.session.completed fires for a trial.
 */
export async function recordTrialFingerprint(
  fingerprint: string,
  userId: string,
  stripeSessionId?: string,
): Promise<void> {
  await prisma.trialFingerprint.upsert({
    where: { cardFingerprint: fingerprint },
    create: {
      cardFingerprint: fingerprint,
      userId,
      stripeSessionId: stripeSessionId ?? null,
    },
    update: {}, // Already exists — no-op
  });
}

/**
 * Checks if a user has already used a trial (by userId — quick check before Stripe).
 */
export async function hasUserUsedTrial(userId: string): Promise<boolean> {
  const count = await prisma.trialFingerprint.count({
    where: { userId },
  });
  return count > 0;
}
