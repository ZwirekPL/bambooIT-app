'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { OpsHoursView } from '@/types/ops';

const MONTH_NAMES = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

/** Minutes → "5 h 20 min" (or "5 h" when whole, "20 min" under an hour). */
function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

type State =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'ready'; hours: OpsHoursView }
  | { kind: 'error' };

/**
 * Client read-only hours view — "how much of my support package did I use this
 * month". Pure transparency (D-078): no actions, mirrors the admin Godziny tab.
 */
export function ClientHoursPanel() {
  const t = useTranslations('clientPanel.hours');
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    api.orders
      .getMyHours({ year, month }, '')
      .then((res) => {
        if (cancelled) return;
        setState(res.hours ? { kind: 'ready', hours: res.hours } : { kind: 'empty' });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-bamboo-deep">
          {t('eyebrow')}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-navy-deep">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-navy-soft">{t('subtitle')}</p>
      </header>

      {/* Month selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy-deep">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-navy-soft transition-colors hover:bg-paper hover:text-navy-deep"
          >
            {t('prev')}
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-navy-soft transition-colors hover:bg-paper hover:text-navy-deep"
          >
            {t('next')}
          </button>
        </div>
      </div>

      {state.kind === 'loading' && (
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-8 text-sm text-navy-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          …
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-2xl border border-line bg-white p-8">
          <p className="font-medium text-navy-deep">{t('errorTitle')}</p>
          <p className="mt-1 text-sm text-navy-soft">{t('errorLoad')}</p>
        </div>
      )}

      {state.kind === 'empty' && (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <p className="font-medium text-navy-deep">{t('emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-navy-soft">{t('emptyMessage')}</p>
          <Link
            href="/pakiety"
            className="mt-4 inline-flex rounded-full bg-bamboo-deep px-5 py-2.5 text-sm font-semibold text-navy-deep transition-colors hover:bg-bamboo-deep/90"
          >
            {t('emptyCta')}
          </Link>
        </div>
      )}

      {state.kind === 'ready' && <HoursCard hours={state.hours} t={t} />}

      <Link href="/panel/subskrypcja" className="inline-block text-sm text-navy-soft hover:text-bamboo-deep">
        ← {t('backToSubscription')}
      </Link>
    </div>
  );
}

function HoursCard({
  hours,
  t,
}: {
  hours: OpsHoursView;
  t: ReturnType<typeof useTranslations>;
}) {
  const overage = Number(hours.overageHours) > 0;
  const pct =
    hours.availableMinutes > 0
      ? Math.min(100, Math.round((hours.consumedMinutes / hours.availableMinutes) * 100))
      : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-navy-soft">{t('used')}</span>
          <span className="font-display text-2xl font-bold text-navy-deep">
            {fmtMinutes(hours.consumedMinutes)}
            <span className="ml-1 text-base font-normal text-navy-soft">
              / {fmtMinutes(hours.availableMinutes)} {t('available')}
            </span>
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className={overage ? 'h-full bg-red-500' : 'h-full bg-bamboo-deep'}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label={t('included')} value={`${hours.hoursIncluded} h`} />
          <Stat label={t('carryover')} value={fmtMinutes(hours.carryoverInMinutes)} />
          <Stat
            label={t('overageHours')}
            value={`${String(hours.overageHours).replace('.', ',')} h`}
            danger={overage}
          />
          <Stat label={t('overageAmount')} value={`${hours.overageAmountNet} zł`} danger={overage} />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <h3 className="border-b border-line px-6 py-4 text-sm font-semibold text-navy-deep">
          {t('worklog')}
        </h3>
        {hours.entries.length === 0 ? (
          <p className="px-6 py-5 text-sm text-navy-soft">{t('noEntries')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {hours.entries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-4 px-6 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm text-navy-deep">
                    {e.description}
                    {!e.billable && (
                      <span className="ml-2 rounded bg-line px-1.5 py-0.5 text-[10px] text-navy-soft">
                        {t('notBillable')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-navy-soft">{e.date.slice(0, 10)}</p>
                </div>
                <span className="shrink-0 text-sm font-medium text-navy-deep">
                  {fmtMinutes(e.minutes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className={danger ? 'font-semibold text-red-600' : 'font-semibold text-navy-deep'}>
        {value}
      </div>
      <div className="text-xs text-navy-soft">{label}</div>
    </div>
  );
}
