import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

const isProd = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'production';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',

  tracesSampleRate: 0.1,

  replaysSessionSampleRate: isProd ? 0.1 : 0,
  replaysOnErrorSampleRate: isProd ? 1.0 : 0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],

  beforeSend: scrubEvent,
});

// Required by Sentry to instrument App Router navigations. Without this
// hook Sentry can't tie performance traces to client-side route changes.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
