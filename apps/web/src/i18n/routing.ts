import { defineRouting } from 'next-intl/routing';

/**
 * Per D-023 / ADR-004 — bambooIT MVP is PL-only. The EN locale infrastructure
 * (en.json stub + locale[en] segment) is kept for future re-enable: add 'en'
 * back to `locales` below and rebuild en.json from pl.json keys.
 *
 * K10.3 reduction (2026-05-14): EN dropped from `locales` so `/en/*` URLs
 * 404; en.json reduced to a tiny placeholder. Blog pages no longer branch
 * on locale === 'en'.
 */
export const routing = defineRouting({
  locales: ['pl'],
  defaultLocale: 'pl',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
