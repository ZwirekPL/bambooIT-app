import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { sendPasswordResetEmail, sendEmailVerificationEmail } from '../utils/email';
import { logAudit } from './audit.service';
import { redis } from '../utils/redis';
import { getOrCreateCode, applyReferralOnRegistration } from './referral.service';
import {
  isDisposableEmail,
  checkIpAbuse,
  recordRegistrationIp,
  checkAccountLockout,
  recordFailedLogin,
  clearLockout,
} from './antiAbuse.service';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — matches JWT expiry

function sessionKey(userId: string): string {
  return `session:active:${userId}`;
}

export async function login(email: string, password: string) {
  // 39.6: Check account lockout before attempting login
  await checkAccountLockout(email);

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

  if (!user || !user.passwordHash) {
    await recordFailedLogin(email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // 39.6: Clear lockout on successful login
  await clearLockout(email);

  if (!user.emailVerified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email first');
  }

  // If there's an existing active session, invalidate it (allow re-login from new device)
  try {
    await redis.del(sessionKey(user.id));
  } catch (err) {
    console.error('[auth] Redis error clearing previous session:', err);
  }

  // Update lastLoginAt timestamp
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const company = await prisma.company.findUnique({ where: { userId: user.id } });

  const firstName: string | null = company?.contactFirstName ?? null;

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, companyId: company?.id },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  // Register the active session in Redis
  try {
    const tokenHash = sha256(token);
    await redis.set(
      sessionKey(user.id),
      JSON.stringify({ tokenHash, loginAt: new Date().toISOString() }),
      'EX',
      SESSION_TTL_SECONDS
    );
  } catch (err) {
    console.error('[auth] Redis error saving active session:', err);
  }

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: company?.id ?? null,
      firstName,
    },
  };
}

interface RegisterConsents {
  healthDataProcessing: boolean;
  aiDisclaimer: boolean;
  emailNotifications: boolean;
}

export async function register(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  referralCode?: string,
  consents?: RegisterConsents,
  ipAddress?: string,
) {
  // 39.3: Block disposable emails
  if (isDisposableEmail(email)) {
    throw new AppError(400, 'DISPOSABLE_EMAIL', 'Disposable email addresses are not accepted. Please use Gmail, Outlook, or WP.');
  }

  // 39.4: Check IP abuse
  if (ipAddress && await checkIpAbuse(ipAddress)) {
    throw new AppError(429, 'IP_ABUSE', 'Too many registrations from this network. Please try later.');
  }

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'CLIENT' },
  });

  await prisma.company.create({
    data: { userId: user.id, contactFirstName: firstName, contactLastName: lastName },
  });

  // Save user consents with version tracking
  if (consents) {
    const version = '1.0';
    const ip = ipAddress ?? null;
    type ConsentRecord = { userId: string; consentType: 'HEALTH_DATA_PROCESSING' | 'AI_DISCLAIMER' | 'TERMS_ACCEPTANCE' | 'PRIVACY_POLICY' | 'EMAIL_NOTIFICATIONS' | 'COOKIE_FUNCTIONAL'; documentVersion: string; ipAddress: string | null };
    const consentRecords: ConsentRecord[] = [
      { userId: user.id, consentType: 'HEALTH_DATA_PROCESSING', documentVersion: version, ipAddress: ip },
      { userId: user.id, consentType: 'AI_DISCLAIMER', documentVersion: version, ipAddress: ip },
      { userId: user.id, consentType: 'TERMS_ACCEPTANCE', documentVersion: version, ipAddress: ip },
      { userId: user.id, consentType: 'PRIVACY_POLICY', documentVersion: version, ipAddress: ip },
    ];
    if (consents.emailNotifications) {
      consentRecords.push({ userId: user.id, consentType: 'EMAIL_NOTIFICATIONS', documentVersion: version, ipAddress: ip });
    }
    await prisma.userConsent.createMany({ data: consentRecords });

    logAudit({
      userId: user.id,
      action: 'CONSENT_GRANTED',
      resourceType: 'CONSENT',
      metadata: { types: consentRecords.map(c => c.consentType), version },
    });
  }

  // 39.4: Record registration IP
  if (ipAddress) {
    recordRegistrationIp(ipAddress).catch(() => {});
  }

  // Auto-generate a referral code for the new user
  await getOrCreateCode(user.id);

  // If a referral code was provided, record the referral usage
  if (referralCode) {
    try {
      await applyReferralOnRegistration(referralCode, user.id);
    } catch {
      // Non-blocking — invalid referral code should not prevent registration
    }
  }

  // Invalidate any stale verification tokens before creating a new one
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const verifyUrl = `${process.env.APP_URL}/pl/zweryfikuj-email?token=${rawToken}`;
  await sendEmailVerificationEmail(email, verifyUrl);

  return { user: { id: user.id, email: user.email, role: user.role } };
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

  // Anti-enumeration: always return without error regardless of whether user exists
  if (!user) return;

  // Invalidate all active reset tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${process.env.APP_URL}/pl/resetuj-haslo?token=${rawToken}`;
  await sendPasswordResetEmail(email, resetUrl);
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = sha256(rawToken);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!resetToken) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { passwordHash },
  });

  // Invalidate all active reset tokens for this user (including the current one)
  await prisma.passwordResetToken.updateMany({
    where: { userId: resetToken.userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  logAudit({ userId: resetToken.userId, action: 'PASSWORD_RESET' });
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const tokenHash = sha256(rawToken);

  const verifyToken = await prisma.emailVerificationToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!verifyToken) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  await prisma.user.update({
    where: { id: verifyToken.userId },
    data: { emailVerified: new Date() },
  });

  // Invalidate all active verification tokens for this user
  await prisma.emailVerificationToken.updateMany({
    where: { userId: verifyToken.userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  logAudit({ userId: verifyToken.userId, action: 'EMAIL_VERIFIED' });
}

export async function resendVerification(email: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

  // Anti-enumeration: always return without error regardless of whether user exists
  if (!user) return;

  // Already verified — nothing to do
  if (user.emailVerified) return;

  // Invalidate all active verification tokens for this user
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const verifyUrl = `${process.env.APP_URL}/pl/zweryfikuj-email?token=${rawToken}`;
  await sendEmailVerificationEmail(email, verifyUrl);

  logAudit({ userId: user.id, action: 'RESEND_VERIFICATION' });
}

export async function logout(rawToken: string, userId: string): Promise<void> {
  const decoded = jwt.decode(rawToken) as { exp?: number } | null;
  if (decoded?.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      const tokenHash = sha256(rawToken);
      await redis.set(`blacklist:jwt:${tokenHash}`, '1', 'EX', ttl);
    }
  }

  // Remove active session so the user can log in again on another device
  try {
    await redis.del(sessionKey(userId));
  } catch (err) {
    console.error('[auth] Redis error removing active session:', err);
  }

  logAudit({ userId, action: 'LOGOUT' });
}
