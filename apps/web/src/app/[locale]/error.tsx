'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Locale-scoped error boundary. Catches render-time errors inside the
 * [locale]/ subtree (any page below /pl or /en). Layout chrome (Header
 * + Footer) still renders — only the page content is replaced.
 *
 * Sentry capture is fire-and-forget so the boundary itself never throws.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center bg-paper px-5 py-32 text-center md:px-12 md:py-40">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mx-auto mb-8 inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-white/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-navy-soft">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-bamboo" />
          {t('eyebrow')}
        </div>
        <h1 className="font-display text-4xl font-light leading-tight tracking-[-0.03em] text-navy md:text-6xl">
          {t('title')}
        </h1>
        <p className="mt-6 text-base leading-[1.6] text-navy-soft md:text-lg">
          {t('description')}
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-navy-soft/60">
            {t('errorId')}: <span className="select-all">{error.digest}</span>
          </p>
        )}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-3 rounded-full bg-bamboo px-7 py-3.5 text-sm font-bold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-bamboo-deep"
          >
            {t('tryAgain')}
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-full border border-line-strong bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-all hover:border-bamboo hover:-translate-y-0.5"
          >
            {t('backHome')}
          </Link>
        </div>
      </div>
    </section>
  );
}
