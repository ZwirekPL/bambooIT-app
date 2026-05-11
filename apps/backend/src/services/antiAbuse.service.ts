/**
 * 39 — Anti-abuse service.
 *
 * 39.3 Disposable email blocking
 * 39.4 IP clustering (anti-trial-farming)
 * 39.6 Account lockout (progressive delays)
 */

import { prisma } from '@db';
import { redis } from '../utils/redis';
import { AppError } from '../utils/errors';
import { logAudit } from './audit.service';

// ─── 39.3 Disposable email blocking ─────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', 'throwaway.email',
  'temp-mail.org', 'fakeinbox.com', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'dispostable.com', 'yopmail.com', 'maildrop.cc', 'trashmail.com',
  'tempail.com', 'tmpmail.net', 'tmails.net', 'mohmal.com', 'getairmail.com',
  'mailnesia.com', 'burnermail.io', 'tmail.ws', 'crazymailing.com',
  'tempmailo.com', 'inboxbear.com', 'getnada.com', 'emailondeck.com',
  '10minutemail.com', 'minutemail.com', 'disposableaddress.com',
  'mailcatch.com', 'mintemail.com', 'discard.email', 'spamgourmet.com',
  'mailexpire.com', 'tempr.email', 'tempinbox.com', 'trashmail.net',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

// ─── 39.4 IP clustering ─────────────────────────────────────────────────────

/**
 * Get /24 subnet from IP (e.g. "192.168.1.100" → "192.168.1")
 */
function getSubnet(ip: string): string {
  // Handle IPv6-mapped IPv4
  const cleaned = ip.replace('::ffff:', '');
  const parts = cleaned.split('.');
  if (parts.length === 4) return parts.slice(0, 3).join('.');
  return cleaned; // IPv6 — use full address
}

/**
 * Count recent trial registrations from the same IP subnet (last 30 days).
 */
export async function countTrialsFromSubnet(ip: string): Promise<number> {
  const subnet = getSubnet(ip);
  const key = `ip-cluster:${subnet}`;

  try {
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Record a registration from an IP.
 */
export async function recordRegistrationIp(ip: string): Promise<void> {
  const subnet = getSubnet(ip);
  const key = `ip-cluster:${subnet}`;

  try {
    await redis.incr(key);
    await redis.expire(key, 30 * 24 * 60 * 60); // 30 days
  } catch {
    // non-blocking
  }
}

/**
 * Check if IP cluster has too many trials (threshold: 5 per subnet per 30 days).
 */
export async function checkIpAbuse(ip: string): Promise<boolean> {
  if (!ip) return false;
  const count = await countTrialsFromSubnet(ip);
  return count >= 5;
}

// ─── 39.6 Account lockout ───────────────────────────────────────────────────

const LOCKOUT_KEY_PREFIX = 'login-attempts:';
const LOCKOUT_TIERS = [
  { attempts: 5, lockoutSeconds: 15 * 60 },    // 5 attempts → 15 min
  { attempts: 10, lockoutSeconds: 60 * 60 },   // 10 attempts → 1 hour
  { attempts: 20, lockoutSeconds: 0 },          // 20 attempts → permanent (LOCKED)
];

interface LockoutState {
  attempts: number;
  lockedUntil: number | null; // unix timestamp
}

async function getLockoutState(email: string): Promise<LockoutState> {
  try {
    const raw = await redis.get(`${LOCKOUT_KEY_PREFIX}${email}`);
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw) as LockoutState;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

async function setLockoutState(email: string, state: LockoutState, ttl: number): Promise<void> {
  try {
    await redis.set(`${LOCKOUT_KEY_PREFIX}${email}`, JSON.stringify(state), 'EX', ttl);
  } catch {
    // non-blocking
  }
}

/**
 * Check if account is locked before login attempt.
 * Throws AppError if locked.
 */
export async function checkAccountLockout(email: string): Promise<void> {
  const state = await getLockoutState(email);

  if (state.lockedUntil) {
    const now = Date.now();
    if (state.lockedUntil === -1) {
      // Permanently locked
      throw new AppError(423, 'ACCOUNT_LOCKED', 'Account is locked. Contact support.');
    }
    if (now < state.lockedUntil) {
      const remainingMin = Math.ceil((state.lockedUntil - now) / 60000);
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', `Too many login attempts. Try again in ${remainingMin} minutes.`);
    }
  }
}

/**
 * Record a failed login attempt. Returns remaining attempts before next lockout tier.
 */
export async function recordFailedLogin(email: string): Promise<number> {
  const state = await getLockoutState(email);
  const previousAttempts = state.attempts;
  state.attempts += 1;

  // Find applicable lockout tier
  for (const tier of LOCKOUT_TIERS) {
    if (state.attempts >= tier.attempts && previousAttempts < tier.attempts) {
      // We just crossed a tier boundary — audit it
      if (tier.lockoutSeconds === 0) {
        state.lockedUntil = -1;
        await setLockoutState(email, state, 365 * 24 * 60 * 60);
        logAudit({
          action: 'ACCOUNT_LOCKED',
          metadata: { email, tier: 'PERMANENT', attempts: state.attempts },
        });
        return 0;
      }
      state.lockedUntil = Date.now() + tier.lockoutSeconds * 1000;
      await setLockoutState(email, state, tier.lockoutSeconds + 3600);
      logAudit({
        action: 'ACCOUNT_LOCKED',
        metadata: {
          email,
          tier: 'TEMPORARY',
          attempts: state.attempts,
          lockoutSeconds: tier.lockoutSeconds,
        },
      });
      return 0;
    }
    if (state.attempts >= tier.attempts) {
      // Already past this tier — keep the existing lockout, no new audit
      if (tier.lockoutSeconds === 0) {
        state.lockedUntil = -1;
        await setLockoutState(email, state, 365 * 24 * 60 * 60);
        return 0;
      }
      state.lockedUntil = Date.now() + tier.lockoutSeconds * 1000;
      await setLockoutState(email, state, tier.lockoutSeconds + 3600);
      return 0;
    }
  }

  // Not yet locked — store state with 24h TTL
  state.lockedUntil = null;
  await setLockoutState(email, state, 24 * 60 * 60);

  // Return attempts until next tier
  const nextTier = LOCKOUT_TIERS.find((t) => t.attempts > state.attempts);
  return nextTier ? nextTier.attempts - state.attempts : 0;
}

/**
 * Clear lockout state after successful login.
 */
export async function clearLockout(email: string): Promise<void> {
  try {
    await redis.del(`${LOCKOUT_KEY_PREFIX}${email}`);
  } catch {
    // non-blocking
  }
}

/**
 * Admin: unlock a locked account.
 */
export async function adminUnlockAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  await clearLockout(user.email);
}
