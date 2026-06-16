import 'dotenv/config';
import { initSentry } from './utils/sentry';
// Initialize Sentry BEFORE other imports (81.1)
initSentry();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { userRouter } from './routes/user.routes';
import { profileRouter } from './routes/profile.routes';
import { adminRouter } from './routes/admin.routes';
import { orderRouter } from './routes/order.routes';
import { subscriptionRouter } from './routes/subscription.routes';
import { webhookRouter } from './routes/webhook.routes';
import { checkoutRouter } from './routes/checkout.routes';
import { blogRouter } from './routes/blog.routes';
import { testimonialRouter } from './routes/testimonial.routes';
import { referralRouter } from './routes/referral.routes';
import { leadsRouter } from './routes/leads.routes';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { globalLimiter, authLimiter, userLimiter, leadLimiter } from './middleware/rateLimiters';
import { csrfProtection } from './middleware/csrf';
import {
  scheduleAuditRetention,
  scheduleUserCleanup,
  scheduleMonthlyReport,
  startMaintenanceWorker,
} from './jobs/cleanupSoftDeleted.job';
import { shutdownQueues } from './queues';

// Validate required environment variables at startup
const REQUIRED_ENV = [
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'JWT_SECRET',
  'APP_URL',
  'REDIS_URL',
] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// Email transport: Resend OR full SMTP must be configured (utils/email.ts
// picks Resend first, falls back to SMTP). At least one is required so
// transactional mail (lead notifications, password reset) actually sends.
const hasResend = Boolean(process.env.RESEND_API_KEY);
const hasSmtp = Boolean(
  process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS,
);
if (!hasResend && !hasSmtp) {
  console.error(
    '[startup] No email transport configured — set RESEND_API_KEY or SMTP_HOST/PORT/USER/PASS',
  );
  process.exit(1);
}

if (hasSmtp && isNaN(Number(process.env.SMTP_PORT))) {
  console.error('[startup] SMTP_PORT must be a valid number');
  process.exit(1);
}

if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
  console.error('[startup] JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

const app = express();

// Trust first proxy (nginx) — required for correct IP in rate limiter & logging
app.set('trust proxy', 1);

// Security headers — must be early in the middleware chain
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // allow cross-origin API calls
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);

// Stripe webhook needs raw body — must be mounted BEFORE express.json()
app.use('/webhooks', express.raw({ type: 'application/json', limit: '5mb' }), webhookRouter);

// CORS — restrict to known origins; allow LAN access in development
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',');

function isAllowedOrigin(origin: string | undefined): boolean {
  // No origin → same-origin request or server-to-server (e.g. Next.js SSR calling the API).
  // These never carry credentials from a cross-origin browser context, so allowing them is safe.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  // In development, allow LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) on any port
  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      const host = url.hostname;
      if (
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
      ) {
        return true;
      }
    } catch {
      // Invalid URL — reject
    }
  }

  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// CSRF protection — validate Origin/Referer for state-changing requests
app.use(csrfProtection(allowedOrigins));

app.use(globalLimiter);

app.use('/auth', authLimiter, authRouter);
app.use('/health', healthRouter);
app.use('/users', requireAuth(), userLimiter, userRouter);
app.use('/profile', requireAuth(), userLimiter, profileRouter);
app.use('/admin', requireAuth('ADMIN'), userLimiter, adminRouter);
app.use('/checkout', requireAuth(), userLimiter, checkoutRouter);
app.use('/orders', requireAuth('ADMIN', 'CLIENT'), userLimiter, orderRouter);
app.use('/subscriptions', requireAuth('ADMIN'), userLimiter, subscriptionRouter);
app.use('/posts', globalLimiter, blogRouter);
app.use('/testimonials', globalLimiter, testimonialRouter);
app.use('/referrals', requireAuth(), userLimiter, referralRouter);
app.use('/leads', leadLimiter, leadsRouter);

// Global error handler — must be last
app.use(errorHandler);

// ─── Start maintenance worker (diet workers removed in 2c) ──────────────────
startMaintenanceWorker();

// Schedule cron-like jobs (idempotent — safe to call on every boot).
scheduleUserCleanup().catch((err) => {
  console.error('[cron] Failed to schedule user cleanup:', err);
});
scheduleAuditRetention().catch((err) => {
  console.error('[cron] Failed to schedule audit retention:', err);
});
scheduleMonthlyReport().catch((err) => {
  console.error('[cron] Failed to schedule monthly report:', err);
});

const PORT = Number(process.env.PORT ?? 4000);
const server = app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received. Shutting down gracefully...`);
  server.close();
  await shutdownQueues();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
