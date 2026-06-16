'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { OpsClientSummary } from '@/types/ops';
import { PLAN_LABELS, fmtMinutes } from './opsFormat';

export function ClientsTable() {
  const [clients, setClients] = useState<OpsClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.admin.ops
      .listClients()
      .then((r) => {
        if (!cancelled) setClients(r.clients);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Nie udało się wczytać klientów.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-navy-soft">Wczytywanie…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center">
        <p className="text-sm font-medium text-navy-deep">Brak klientów</p>
        <p className="mt-1 text-sm text-navy-soft">
          Klienci pojawią się tu po rejestracji konta firmowego. Otwórz klienta i ustaw mu
          pakiet w zakładce „Pakiet”, aby aktywować obsługę i naliczanie godzin.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-navy-soft">
            <th className="px-4 py-3 font-medium">Firma</th>
            <th className="px-4 py-3 font-medium">Pakiet</th>
            <th className="px-4 py-3 font-medium">Bieżący miesiąc</th>
            <th className="px-4 py-3 font-medium">Onboarding</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const cm = c.currentMonth;
            const overage = cm ? Number(cm.overageHours) > 0 : false;
            const pct = cm && cm.availableMinutes > 0
              ? Math.min(100, Math.round((cm.consumedMinutes / cm.availableMinutes) * 100))
              : 0;
            return (
              <tr
                key={c.id}
                className="border-b border-line/60 last:border-0 hover:bg-paper/60"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/klienci/${c.id}`}
                    className="font-medium text-navy-deep hover:text-bamboo-deep"
                  >
                    {c.companyName || c.contactName || c.email}
                  </Link>
                  <div className="text-xs text-navy-soft">{c.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-bamboo-deep/10 px-2.5 py-0.5 text-xs font-medium text-navy-deep">
                    {c.servicePlan ? PLAN_LABELS[c.servicePlan] : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {cm ? (
                    <div className="min-w-[140px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-navy-soft">
                          {fmtMinutes(cm.consumedMinutes)} / {fmtMinutes(cm.availableMinutes)}
                        </span>
                        {overage && (
                          <span className="font-medium text-red-600">+{cm.overageHours} h</span>
                        )}
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div
                          className={overage ? 'h-full bg-red-500' : 'h-full bg-bamboo-deep'}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-navy-soft">brak wpisów</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.onboardingComplete ? (
                    <span className="text-xs font-medium text-bamboo-deep">✓ ukończony</span>
                  ) : (
                    <span className="text-xs text-navy-soft">w toku</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
