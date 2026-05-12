import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { sendEmailVerificationEmail, sendAccountDeletionEmail } from '../utils/email';
import { logAudit } from './audit.service';
import { cacheDel } from '../utils/cache';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  : null;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
  ip?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    throw new AppError(400, 'INVALID_CREDENTIALS', 'User not found');
  }

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) {
    throw new AppError(400, 'INVALID_OLD_PASSWORD', 'Old password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  logAudit({ userId, action: 'PASSWORD_CHANGE', resourceType: 'USER', resourceId: userId, ip });
}

export async function changeEmail(
  userId: string,
  newEmail: string,
  password: string,
  ip?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    throw new AppError(400, 'INVALID_CREDENTIALS', 'User not found');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Password is incorrect');
  }

  if (newEmail.toLowerCase() === user.email.toLowerCase()) {
    throw new AppError(400, 'SAME_EMAIL', 'New email is the same as current email');
  }

  const existing = await prisma.user.findFirst({
    where: { email: newEmail.toLowerCase(), deletedAt: null },
  });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
  }

  // Update email and reset verification
  await prisma.user.update({
    where: { id: userId },
    data: { email: newEmail.toLowerCase(), emailVerified: null },
  });

  // Invalidate stale verification tokens
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Create new verification token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  const verifyUrl = `${process.env.APP_URL}/pl/zweryfikuj-email?token=${rawToken}`;
  await sendEmailVerificationEmail(newEmail.toLowerCase(), verifyUrl);

  logAudit({ userId, action: 'EMAIL_CHANGE', resourceType: 'USER', resourceId: userId, ip });
}

export async function getDietitianProfile(userId: string) {
  const profile = await prisma.dietitianProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Dietitian profile not found');
  }
  return {
    code: profile.code,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.user.email,
  };
}

export async function updateDietitianProfile(
  userId: string,
  data: { firstName?: string; lastName?: string },
  ip?: string,
) {
  const profile = await prisma.dietitianProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Dietitian profile not found');
  }

  const updated = await prisma.dietitianProfile.update({
    where: { userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
    },
    include: { user: { select: { email: true } } },
  });

  await cacheDel(`cache:profile:${userId}`);

  logAudit({ userId, action: 'UPDATE_PATIENT', resourceType: 'USER', resourceId: profile.id, ip });

  return {
    code: updated.code,
    firstName: updated.firstName,
    lastName: updated.lastName,
    email: updated.user.email,
  };
}

/**
 * RODO Art. 17 — delete own account (66.2).
 * Soft delete + PII anonymization + Stripe subscription cancel.
 */
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_PASSWORD', 'Invalid password');
  }

  const originalEmail = user.email;

  // Cancel Stripe subscription if exists
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription?.stripeSubscriptionId && stripe) {
    try {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } catch {
      // Non-critical — subscription may already be canceled
    }
  }

  // Generate anonymous email
  const anonId = crypto.randomBytes(8).toString('hex');
  const anonEmail = `deleted_${anonId}@removed.local`;

  // Soft delete + anonymize PII
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      email: anonEmail,
      passwordHash: null,
    },
  });

  // Anonymize company profile
  await prisma.company.updateMany({
    where: { userId },
    data: {
      contactFirstName: null,
      contactLastName: null,
    },
  });

  // Delete tokens and fingerprints
  await Promise.all([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.deviceFingerprint.deleteMany({ where: { userId } }),
  ]);

  // Audit log
  logAudit({
    userId,
    action: 'DELETE_OWN_ACCOUNT',
    resourceType: 'USER',
    resourceId: userId,
  });

  // Send confirmation email to original address
  sendAccountDeletionEmail(originalEmail).catch(() => {});
}
