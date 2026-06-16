'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { Subscription } from '@/types/api';
import type { OpsHoursView } from '@/types/ops';
import { PanelCardSkeleton } from '@/components/ui/Skeleton';

type State =
  | { kind: 'loading' }
  | { kind: 'empty'; stripeConfigured: boolean }
  | { kind: 'ready'; subscription: Subscription; stripeConfigured: boolean }
  | { kind: 'managed'; hours: OpsHoursView }
  | { kind: 'error'; message: string };

/** Minutes → "5 h 20 min". */
function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

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
        if (res.subscription && res.subscription.stripeSubscriptionId) {
          setState({
            kind: 'ready',
            subscription: res.subscription,
            stripeConfigured: res.stripeConfigured,
          });
          return;
        }
        // No Stripe subscription yet (Stripe is deferred). Fall back to the
        // admin-managed service plan (Company.servicePlan) so a client whose
        // package the team set manually still sees their active service.
        const hoursRes = await api.orders.getMyHours({}, '');
        if (hoursRes.hours) {
          setState({ kind: 'managed', hours: hoursRes.hours });
        } else {
          setState({ kind: 'empty', stripeConfigured: res.stripeConfigured });
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

  if (state.kind === 'managed') {
    const h = state.hours;
    const planLabel = PLAN_LABELS[h.plan] ?? h.plan;
    const overage = Number(h.overageHours) > 0;
    const pct =
      h.availableMinutes > 0
        ? Math.min(100, Math.round((h.consumedMinutes / h.availableMinutes) * 100))
        : 0;
    return (
      <div className="space-y-8">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo-deep">
            Twoja obsługa IT
          </p>
          <h1 className="mt-2 font-display text-3xl font-light leading-tight tracking-[-0.02em] text-navy md:text-4xl">
            Pakiet {planLabel}
          </h1>
          <p className="mt-2 max-w-prose text-sm text-navy-soft">
            Obsługą Twojej firmy zajmuje się zespół bambooIT. Poniżej zużycie godzin w tym
            miesiącu — szczegóły i historię znajdziesz w zakładce Godziny.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <Link href="/panel/godziny" className="text-sm text-navy-soft hover:text-bamboo-deep">
              Godziny →
            </Link>
            <Link href="/panel/zgloszenia" className="text-sm text-navy-soft hover:text-bamboo-deep">
              Zgłoszenia →
            </Link>
          </div>
        </header>

        <div className="rounded-3xl border border-line bg-white p-8 md:p-10">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-navy-soft">Wykorzystane w tym miesiącu</span>
            <span className="font-display text-2xl font-bold text-navy">
              {fmtMinutes(h.consumedMinutes)}
              <span className="ml-1 text-base font-normal text-navy-soft">
                / {fmtMinutes(h.availableMinutes)}
              </span>
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className={overage ? 'h-full bg-red-500' : 'h-full bg-bamboo-deep'}
              style={{ width: `${pct}%` }}
            />
          </div>
          {overage && (
            <p className="mt-3 text-sm font-medium text-red-600">
              Przekroczenie: {String(h.overageHours).replace('.', ',')} h ({h.overageAmountNet} zł
              netto)
            </p>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-navy-soft">Godziny w pakiecie</dt>
              <dd className="mt-1 font-semibold text-navy">{h.hoursIncluded} h / mies.</dd>
            </div>
            <div>
              <dt className="text-xs text-navy-soft">Przeniesione</dt>
              <dd className="mt-1 font-semibold text-navy">{fmtMinutes(h.carryoverInMinutes)}</dd>
            </div>
          </dl>
        </div>
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
        <div className="mt-6">
          <Link href="/panel/godziny" className="text-sm text-navy-soft hover:text-bamboo-deep">
            {t('hoursCta')} →
          </Link>
        </div>
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
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            href="/panel/godziny"
            className="inline-block text-sm text-navy-soft hover:text-bamboo-deep"
          >
            {t('hoursCta')} →
          </Link>
          <Link
            href="/panel/zgloszenia"
            className="inline-block text-sm text-navy-soft hover:text-bamboo-deep"
          >
            Zgłoszenia →
          </Link>
        </div>
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
