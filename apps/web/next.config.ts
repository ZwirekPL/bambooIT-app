import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      // Production server (bambooIT)
      {
        protocol: 'https',
        hostname: 'bambooit.pl',
        pathname: '/uploads/**',
      },
      // Local dev backend (port 4000)
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4001',
        pathname: '/uploads/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24 h
  },
  allowedDevOrigins: ['192.168.*.*', '172.*.*.*', '10.*.*.*'],
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    // Pre-launch guard: emit a hard noindex on every response until
    // SITE_INDEXABLE=true. Strongest of the three layers (robots.ts +
    // root-layout metadata are the others) — applies to non-HTML too.
    const indexable = process.env.SITE_INDEXABLE === 'true';

    // Content Security Policy — covers Stripe, Sentry, NextAuth, Next.js dev tools.
    // Starts in REPORT-ONLY mode in production: violations are logged but not
    // blocked. Once you've verified no false positives in browser console,
    // switch the header key from 'Content-Security-Policy-Report-Only' to
    // 'Content-Security-Policy' to enforce.
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' is needed by Next.js for inline bootstrap scripts;
      // 'unsafe-eval' only in dev (Next.js HMR uses eval).
      `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://js.stripe.com https://m.stripe.network https://www.googletagmanager.com https://*.google-analytics.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      // connect-src: allow API, Sentry, Stripe, GA4; in dev allow ws for HMR
      `connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com${isProd ? '' : ' ws: wss:'}`,
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      ...(isProd ? ['upgrade-insecure-requests'] : []),
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          ...(indexable ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // HSTS only in production over HTTPS — preload-eligible
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Upload source maps for better stack traces
  silent: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
