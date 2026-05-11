/**
 * Server-side API proxy.
 *
 * Forwards requests from the browser to the backend, injecting the
 * `Authorization: Bearer <backendToken>` header server-side. The token is
 * read from the NextAuth JWT (httpOnly cookie) and never exposed to the
 * client. This eliminates the XSS → token-theft vector that exists when
 * `backendToken` is present in `session.user`.
 *
 * Path: /api/proxy/<anything> → <BACKEND>/<anything>
 *
 * Notes:
 *  - Streams request and response bodies (uploads, downloads, exports work).
 *  - Does NOT enforce auth — backend still verifies the token. If no token
 *    is present, request is forwarded without it (so public endpoints work).
 *  - Forwards 401 responses verbatim; the existing client-side 401 handler
 *    in api.ts triggers performFullLogout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/server-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKEND_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// State-changing methods require an Origin/Referer matching our own host
// (defense in depth on top of sameSite=lax cookie + backend CSRF check).
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Per-IP token bucket (in-memory). Single Next.js instance — for cluster use Redis.
// Default: 120 requests / 60s per IP. Backend has its own per-route limits;
// this is a coarse blanket cap to stop trivial bot floods at the edge.
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  // Trust X-Forwarded-For (Vercel / nginx set it). Take first hop.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { allowed: true, retryAfter: 0 };
}

// Periodic cleanup so the Map doesn't grow unbounded
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return; // every 5 min
  lastCleanup = now;
  for (const [ip, bucket] of ipBuckets) {
    if (bucket.resetAt < now) ipBuckets.delete(ip);
  }
}

function isAllowedDevHost(host: string): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

function isSameOrigin(req: NextRequest): boolean {
  // req.nextUrl.host is usually correct, but behind a reverse proxy (Docker/nginx)
  // it may reflect the internal hostname instead of the public one.
  // nginx forwards the real public Host header via proxy_set_header Host $host,
  // so also accept req.headers.get('host') as a trusted self-host value.
  const selfHosts = new Set(
    [req.nextUrl.host, req.headers.get('host') ?? ''].filter(Boolean),
  );
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  const checkUrl = (raw: string | null): boolean => {
    if (!raw) return false;
    try {
      const u = new URL(raw);
      if (selfHosts.has(u.host)) return true;
      return isAllowedDevHost(u.hostname);
    } catch {
      return false;
    }
  };

  return checkUrl(origin) || checkUrl(referer);
}

// Hop-by-hop headers that must NOT be forwarded
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  maybeCleanup();

  // Rate limit per IP (coarse blanket cap; backend has per-route limits)
  const ip = clientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Reset': String(rl.retryAfter),
        },
      },
    );
  }

  // CSRF defense in depth: state-changing requests must come from our own origin.
  // (sameSite=lax cookie + backend Origin check are the primary defenses; this
  // is a third layer that fails fast and keeps the proxy itself safe even if
  // upstream config changes.)
  if (STATE_CHANGING.has(req.method.toUpperCase()) && !isSameOrigin(req)) {
    return NextResponse.json(
      { error: { code: 'CSRF_REJECTED', message: 'Cross-origin request blocked' } },
      { status: 403 },
    );
  }

  const { path } = await ctx.params;
  const subPath = '/' + (path?.join('/') ?? '');
  const search = req.nextUrl.search; // includes leading ?
  const targetUrl = `${BACKEND_URL}${subPath}${search}`;

  // Pull token from encrypted NextAuth JWT cookie (server-side only)
  const backendToken = await getBackendToken();

  // Build forwarded headers
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  if (backendToken) headers.set('authorization', `Bearer ${backendToken}`);

  // Body: stream-through for methods that have a body
  const method = req.method.toUpperCase();
  const canHaveBody = method !== 'GET' && method !== 'HEAD';

  // Only forward a body if one actually exists. Some POSTs (e.g. /auth/logout)
  // have no payload — setting `duplex: 'half'` without a body crashes undici
  // with "expected non-null body source".
  const body = canHaveBody ? (req.body ?? undefined) : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      // @ts-expect-error — undici-specific, required ONLY when forwarding a stream body
      duplex: body ? 'half' : undefined,
      redirect: 'manual',
    });
  } catch (err) {
    console.error('[proxy] upstream fetch failed:', err);
    return NextResponse.json(
      { error: { code: 'PROXY_UPSTREAM_ERROR', message: 'Backend unreachable' } },
      { status: 502 },
    );
  }

  // Strip hop-by-hop response headers
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
