import type { ErrorEvent, EventHint } from '@sentry/nextjs';

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

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  const statusCode = event.contexts?.response?.status_code;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return null;
  }

  if (event.user) {
    const { email: _email, ip_address: _ip, ...rest } = event.user;
    event.user = { ...rest, ip_address: null };
  }

  if (event.request) {
    if (event.request.data !== undefined) {
      event.request.data = redactDeep(event.request.data) as typeof event.request.data;
    }
    if (event.request.headers) {
      event.request.headers = redactDeep(event.request.headers) as Record<string, string>;
    }
    if (event.request.cookies) {
      event.request.cookies = REDACTED as never;
    }
  }

  if (event.extra) {
    event.extra = redactDeep(event.extra) as typeof event.extra;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (redactDeep(b.data) as Record<string, unknown>) : b.data,
    }));
  }

  return event;
}
