'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function CheckoutCanceled() {
  const t = useTranslations('checkout');

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-paper px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="rounded-3xl border border-line bg-white p-10 text-center md:p-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-navy-deep">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-white"
              aria-hidden="true"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-navy-soft">
            {t('canceledEyebrow')}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] text-navy md:text-4xl">
            {t('canceledTitle')}
          </h1>
          <p className="mx-auto mt-4 max-w-prose text-base leading-[1.6] text-navy-soft md:text-lg">
            {t('canceledDescription')}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pakiety"
              className="inline-flex items-center gap-2 rounded-full bg-navy-deep px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep"
            >
              {t('canceledCtaRetry')}
            </Link>
            <Link
              href="/audyt"
              className="font-mono text-xs uppercase tracking-[0.15em] text-bamboo-deep underline-offset-4 transition-colors hover:underline"
            >
              {t('canceledCtaAudit')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
