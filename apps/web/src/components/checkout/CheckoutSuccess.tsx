'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const PRODUCT_LABELS: Record<string, string> = {
  START: 'Pakiet Start',
  FIRMA: 'Pakiet Firma',
  FIRMA_PLUS: 'Pakiet Firma Plus',
};

export function CheckoutSuccess() {
  const t = useTranslations('checkout');
  const searchParams = useSearchParams();
  const product = searchParams.get('product');
  const isMock = searchParams.get('mock') === 'checkout';
  const productLabel = product ? PRODUCT_LABELS[product] ?? product : null;

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-paper px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="rounded-3xl border border-bamboo/40 bg-white p-10 text-center md:p-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bamboo">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-navy-deep"
              aria-hidden="true"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>

          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo-deep">
            {t('successEyebrow')}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] text-navy md:text-4xl">
            {t('successTitle')}
          </h1>
          <p className="mx-auto mt-4 max-w-prose text-base leading-[1.6] text-navy-soft md:text-lg">
            {t('successDescription')}
          </p>

          {isMock && (
            <p
              role="status"
              className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-800"
            >
              {t('mockWarning')}
            </p>
          )}

          {productLabel && (
            <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-5 py-2 font-mono text-xs uppercase tracking-[0.15em] text-navy">
              {t('successProduct')}: <span className="font-bold text-navy-deep">{productLabel}</span>
            </p>
          )}

          <p className="mx-auto mt-8 max-w-prose text-sm leading-[1.6] text-navy-soft">
            {t('successNextSteps')}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/panel/subskrypcja"
              className="inline-flex items-center gap-2 rounded-full bg-navy-deep px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep"
            >
              {t('successCtaSubscription')}
            </Link>
            <Link
              href="/pomoc-zdalna"
              className="font-mono text-xs uppercase tracking-[0.15em] text-bamboo-deep underline-offset-4 transition-colors hover:underline"
            >
              {t('successCtaRemoteHelp')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
