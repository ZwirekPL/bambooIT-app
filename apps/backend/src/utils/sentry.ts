/**
 * Sentry Error Tracking (Faza 81)
 *
 * Initialized early in server.ts. Captures 5xx errors, solver failures,
 * and BullMQ job errors. Skips 4xx (validation/auth).
 *
 * PII scrubbing (RODO Faza 1.2): removes password/answers/content/medicalFlags
 * and strips email from user context.
 *
 * Required env: SENTRY_DSN, SENTRY_ENVIRONMENT (dev/staging/production)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let _sentry: any = null;

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'answers',
  'medicalflags',
  'medical_flags',
  'rawresponse',
  'raw_response',
  'content',
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'token',
  'access_token',
  'refresh_token',
  'encryption_key',
  'secret',
]);

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 10;

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redactDeep(v, depth + 1);
    }
    return result;
  }
  return value;
}

function scrubSentryEvent(event: any): any | null {
  const statusCode = event.contexts?.response?.status_code;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) return null;

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }

  if (event.request) {
    if (event.request.data !== undefined) event.request.data = redactDeep(event.request.data);
    if (event.request.headers) event.request.headers = redactDeep(event.request.headers);
    if (event.request.cookies) event.request.cookies = REDACTED;
  }

  if (event.extra) event.extra = redactDeep(event.extra);

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b: any) => ({
      ...b,
      data: b.data ? redactDeep(b.data) : b.data,
    }));
  }

  return event;
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN not set — error tracking disabled');
    return;
  }

  try {
    // Dynamic require — only loads if @sentry/node is installed
    _sentry = require('@sentry/node');
    _sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
      tracesSampleRate: 0.1,
      beforeSend: scrubSentryEvent,
    });
    console.log('[sentry] Initialized for', process.env.SENTRY_ENVIRONMENT ?? 'development');
  } catch {
    console.log('[sentry] @sentry/node not installed — skipping');
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!_sentry) return;
  if (context) {
    _sentry.withScope((scope: any) => {
      const scrubbed = redactDeep(context) as Record<string, unknown>;
      for (const [key, value] of Object.entries(scrubbed)) scope.setExtra(key, value);
      _sentry.captureException(err);
    });
  } else {
    _sentry.captureException(err);
  }
}

export function setUser(user: { id: string; role: string }) {
  _sentry?.setUser({ id: user.id, username: user.role });
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  const scrubbed = data ? (redactDeep(data) as Record<string, unknown>) : undefined;
  _sentry?.addBreadcrumb({ message, category, data: scrubbed, level: 'info' });
}
