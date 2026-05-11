import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../utils/redis';

const isDev = process.env.NODE_ENV !== 'production';

function makeStore(prefix: string) {
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      redis.call(args[0], ...args.slice(1)) as unknown as Promise<number>,
    prefix: `rl:${prefix}:`,
  });
}

const RATE_LIMIT_MESSAGE = {
  error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, try again later' },
};

// Global limiter — keyed by IP (runs before auth middleware)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 1000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('global'),
  message: RATE_LIMIT_MESSAGE,
});

// Auth endpoint limiter — keyed by IP (unauthenticated, 10/15min)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 100 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('auth'),
  message: RATE_LIMIT_MESSAGE,
});

// /auth/forgot-password — 3 req/15min per IP
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('forgot'),
  message: RATE_LIMIT_MESSAGE,
});

// /auth/reset-password, /auth/verify-email — 5 req/min per IP
export const authActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('auth-action'),
  message: RATE_LIMIT_MESSAGE,
});

// /auth/resend-verification — 1 req/60s per IP
export const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('resend-verify'),
  message: RATE_LIMIT_MESSAGE,
});

// PDF export limiter — 5 per hour per user
export const pdfExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('pdf-export'),
  keyGenerator: (req) => `pdf:${req.user?.sub ?? ipKeyGenerator(req.ip ?? '0.0.0.0')}`,
  message: RATE_LIMIT_MESSAGE,
});

// Per-user limiter for authenticated endpoints (applied AFTER requireAuth)
// Keys by userId so limits survive restarts and work across multiple instances
export const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('user'),
  keyGenerator: (req) => `user:${req.user?.sub ?? ipKeyGenerator(req.ip ?? '0.0.0.0')}`,
  message: RATE_LIMIT_MESSAGE,
});
