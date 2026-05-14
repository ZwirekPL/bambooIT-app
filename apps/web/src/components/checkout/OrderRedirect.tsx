'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { CheckoutProductType } from '@/types/api';

const VALID_PLANS: CheckoutProductType[] = ['START', 'FIRMA', 'FIRMA_PLUS'];

/**
 * /zamow client component — auth gate + Stripe Checkout dispatcher.
 *
 * Flow:
 *  1. Read ?plan=START|FIRMA|FIRMA_PLUS from URL.
 *  2. Unauthenticated → redirect to /rejestracja?callbackUrl=<current>
 *  3. Authenticated → POST /checkout/create-session → redirect to Stripe.
 *  4. Errors → user-facing message + "wróć do pakietów" CTA.
 *
 * StrictMode in dev fires effects twice; the `started` ref guards against
 * double-dispatching the checkout session creation.
 */
export function OrderRedirect() {
  const t = useTranslations('order');
  const router = useRouter();
  const locale = useLocale();
  const params = useSearchParams();
  const { status } = useSession();
  const planParam = params.get('plan');
  const plan = VALID_PLANS.includes(planParam as CheckoutProductType)
    ? (planParam as CheckoutProductType)
    : null;

  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!plan) {
      setError(t('errorInvalidPlan'));
      return;
    }

    if (status === 'unauthenticated') {
      const callback = `/${locale}/zamow?plan=${plan}`;
      router.replace(`/${locale}/rejestracja?callbackUrl=${encodeURIComponent(callback)}`);
      return;
    }

    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const result = await api.checkout.createSession({ productType: plan });
        if (result.url) {
          window.location.href = result.url;
        } else {
          setError(t('errorGeneric'));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Token expired between session load and POST — kick back to login.
          const callback = `/${locale}/zamow?plan=${plan}`;
          router.replace(`/${locale}/zaloguj?callbackUrl=${encodeURIComponent(callback)}`);
          return;
        }
        setError(err instanceof Error ? err.message : t('errorGeneric'));
      }
    })();
  }, [status, plan, locale, router, t]);

  if (error) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center bg-paper px-5 py-16">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-navy">
            {t('errorTitle')}
          </h1>
          <p className="mt-4 text-base text-navy-soft">{error}</p>
          <Link
            href="/pakiety"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-navy-deep px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep"
          >
            {t('backToPricing')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-paper px-5 py-16">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-bamboo-deep" />
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-[-0.02em] text-navy">
          {t('redirectingTitle')}
        </h1>
        <p className="mt-3 text-base text-navy-soft">{t('redirectingMessage')}</p>
      </div>
    </section>
  );
}
