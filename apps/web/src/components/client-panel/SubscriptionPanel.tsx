'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { Subscription } from '@/types/api';
import { PanelCardSkeleton } from '@/components/ui/Skeleton';

type State =
  | { kind: 'loading' }
  | { kind: 'empty'; stripeConfigured: boolean }
  | { kind: 'ready'; subscription: Subscription; stripeConfigured: boolean }
  | { kind: 'error'; message: string };

const PLAN_LABELS: Record<string, string> = {
  START: 'Start',
  FIRMA: 'Firma',
  FIRMA_PLUS: 'Firma Plus',
};

/**
 * Client subscription dashboard — shows current plan + status + "Manage in
 * Stripe" button that redirects to Customer Portal (cancel/upgrade/payment
 * method). All actual subscription management happens in Stripe.
 *
 * Per PLAN_BE-2.md Q6 — this is the canonical place for clients to manage
 * their subscription. /zamowienie/sukces also gets a "Zarządzaj subskrypcją"
 * button that links here.
 */
export function SubscriptionPanel() {
  const t = useTranslations('clientPanel.subscription');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.subscription.getMy('');
        if (!res.subscription || !res.subscription.stripeSubscriptionId) {
          setState({ kind: 'empty', stripeConfigured: res.stripeConfigured });
        } else {
          setState({
            kind: 'ready',
            subscription: res.subscription,
            stripeConfigured: res.stripeConfigured,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('errorLoad');
        setState({ kind: 'error', message: msg });
      }
    })();
  }, [t]);

  async function openPortal() {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const res = await api.subscription.getPortal('');
      if (res.url) {
        window.location.href = res.url;
      } else {
        setState({ kind: 'error', message: t('errorPortal') });
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('errorPortal');
      setState({ kind: 'error', message: msg });
    } finally {
      setPortalLoading(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-line/70" />
          <div className="h-8 w-64 animate-pulse rounded bg-line/70" />
        </div>
        <PanelCardSkeleton />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-3xl border border-red-300 bg-red-50 p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy">{t('errorTitle')}</h1>
        <p className="mt-3 text-sm text-red-700">{state.message}</p>
      </div>
    );
  }

  if (state.kind === 'empty') {
    return (
      <div className="rounded-3xl border border-line bg-white p-10 text-center md:p-14">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-navy md:text-4xl">
          {t('emptyTitle')}
        </h1>
        <p className="mx-auto mt-4 max-w-prose text-base text-navy-soft">{t('emptyMessage')}</p>
        <Link
          href="/pakiety"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-navy-deep px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep"
        >
          {t('emptyCta')}
        </Link>
      </div>
    );
  }

  const { subscription, stripeConfigured } = state;
  const planLabel = PLAN_LABELS[subscription.plan] ?? subscription.plan;
  const periodEndStr = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo-deep">
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-light leading-tight tracking-[-0.02em] text-navy md:text-4xl">
          {t('title')}
        </h1>
      </header>

      <div className="rounded-3xl border border-line bg-white p-8 md:p-10">
        <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-navy-soft">
              {t('fields.plan')}
            </dt>
            <dd className="mt-2 font-display text-2xl font-semibold text-navy">{planLabel}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-navy-soft">
              {t('fields.status')}
            </dt>
            <dd className="mt-2 font-display text-2xl font-semibold text-navy">
              {t(`statuses.${subscription.status}`)}
            </dd>
          </div>
          {periodEndStr && (
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-navy-soft">
                {subscription.cancelAtPeriodEnd ? t('fields.cancelsOn') : t('fields.renewsOn')}
              </dt>
              <dd className="mt-2 font-display text-xl text-navy">{periodEndStr}</dd>
            </div>
          )}
        </dl>

        {subscription.cancelAtPeriodEnd && (
          <p className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {t('cancelNotice', { date: periodEndStr ?? '' })}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={openPortal}
            disabled={portalLoading || !stripeConfigured}
            className="inline-flex items-center gap-3 rounded-full bg-navy-deep px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-navy-deep disabled:hover:text-white"
          >
            {portalLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('managePortalCta')}
          </button>
          <Link
            href="/pakiety"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-colors hover:border-bamboo-deep"
          >
            {t('changePlanCta')}
          </Link>
        </div>

        {!stripeConfigured && (
          <p className="mt-6 text-xs text-navy-soft">{t('mockModeNote')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Dane firmy</h2>
          <p className="mt-2 text-sm text-navy-soft">
            Zmień NIP, adres do faktur, telefon kontaktowy lub branżę.
          </p>
          <Link
            href="/panel/profil"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-bamboo-deep underline-offset-4 hover:underline"
          >
            Edytuj dane firmy →
          </Link>
        </div>

        <div className="rounded-3xl border border-line bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Faktury</h2>
          <p className="mt-2 text-sm text-navy-soft">
            Fakturę VAT wysyłamy mailem po każdej płatności. Potrzebujesz kopii?
          </p>
          <Link
            href="/panel/faktury"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-bamboo-deep underline-offset-4 hover:underline"
          >
            Zobacz faktury →
          </Link>
        </div>
      </div>
    </div>
  );
}
