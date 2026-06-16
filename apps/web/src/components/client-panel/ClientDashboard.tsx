'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Link } from '@/i18n/navigation';
import { Loader2, Clock, Ticket, CreditCard, FileText, UserRound, Plus, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { OpsHoursView } from '@/types/ops';
import type { MyTicketSummary } from '@/types/tickets';
import { STATUS_LABELS, STATUS_BADGE, OPEN_STATUSES } from '@/components/tickets/ticketFormat';

const PLAN_LABELS: Record<string, string> = {
  START: 'Start',
  FIRMA: 'Firma',
  FIRMA_PLUS: 'Firma Plus',
};

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Client panel home — a quick overview that ties the standalone panel pages
 * together: current service plan + hours usage, open tickets, and shortcuts.
 */
export function ClientDashboard() {
  const { data: session } = useSession();
  const [hours, setHours] = useState<OpsHoursView | null>(null);
  const [tickets, setTickets] = useState<MyTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.orders.getMyHours({}, '').then((r) => r.hours).catch(() => null),
      api.tickets.listMy(undefined, '').then((r) => r.tickets).catch(() => []),
    ]).then(([h, tk]) => {
      setHours(h);
      setTickets(tk);
      setLoading(false);
    });
  }, []);

  const firstName = session?.user?.name?.split(' ')[0] || '';
  const openTickets = tickets.filter((t) => OPEN_STATUSES.includes(t.status));

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-bamboo-deep">Twój panel</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-navy-deep">
          {firstName ? `Cześć, ${firstName}` : 'Witaj'}
        </h1>
        <p className="mt-1 text-sm text-navy-soft">
          Tu zarządzasz swoją obsługą IT — pakiet, godziny, zgłoszenia i faktury.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-8 text-sm text-navy-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Wczytywanie…
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Service / hours card */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy-deep">Obsługa IT</h2>
              <Link
                href="/panel/godziny"
                className="inline-flex items-center gap-1 text-xs text-navy-soft hover:text-bamboo-deep"
              >
                Godziny <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {hours ? (
              <HoursMini hours={hours} />
            ) : (
              <div className="mt-4">
                <p className="text-sm text-navy-soft">Nie masz jeszcze aktywnego pakietu.</p>
                <Link
                  href="/pakiety"
                  className="mt-3 inline-flex rounded-full bg-bamboo-deep px-4 py-2 text-sm font-semibold text-navy-deep hover:bg-bamboo-deep/90"
                >
                  Zobacz pakiety
                </Link>
              </div>
            )}
          </div>

          {/* Tickets card */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy-deep">
                Zgłoszenia {openTickets.length > 0 && (
                  <span className="ml-1 rounded-full bg-bamboo-deep/15 px-2 py-0.5 text-xs text-navy-deep">
                    {openTickets.length} otwarte
                  </span>
                )}
              </h2>
              <Link
                href="/panel/zgloszenia"
                className="inline-flex items-center gap-1 text-xs text-navy-soft hover:text-bamboo-deep"
              >
                Wszystkie <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {tickets.length === 0 ? (
              <div className="mt-4">
                <p className="text-sm text-navy-soft">Brak zgłoszeń. Coś nie działa?</p>
                <Link
                  href="/panel/zgloszenia"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bamboo-deep px-4 py-2 text-sm font-semibold text-navy-deep hover:bg-bamboo-deep/90"
                >
                  <Plus className="h-4 w-4" /> Nowe zgłoszenie
                </Link>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {tickets.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/panel/zgloszenia/${t.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 hover:text-bamboo-deep"
                    >
                      <span className="min-w-0 truncate text-sm text-navy-deep">
                        <span className="font-mono text-xs text-navy-soft">#{t.number}</span>{' '}
                        {t.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[t.status]}`}
                      >
                        {STATUS_LABELS[t.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <NavTile href="/panel/subskrypcja" icon={CreditCard} label="Pakiet" />
        <NavTile href="/panel/godziny" icon={Clock} label="Godziny" />
        <NavTile href="/panel/zgloszenia" icon={Ticket} label="Zgłoszenia" />
        <NavTile href="/panel/faktury" icon={FileText} label="Faktury" />
        <NavTile href="/panel/profil" icon={UserRound} label="Profil" />
      </div>
    </div>
  );
}

function HoursMini({ hours }: { hours: OpsHoursView }) {
  const overage = Number(hours.overageHours) > 0;
  const pct =
    hours.availableMinutes > 0
      ? Math.min(100, Math.round((hours.consumedMinutes / hours.availableMinutes) * 100))
      : 0;
  return (
    <div className="mt-3">
      <p className="font-display text-2xl font-bold text-navy-deep">
        Pakiet {PLAN_LABELS[hours.plan] ?? hours.plan}
      </p>
      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span className="text-navy-soft">Wykorzystane w tym miesiącu</span>
        <span className="font-medium text-navy-deep">
          {fmtMinutes(hours.consumedMinutes)} / {fmtMinutes(hours.availableMinutes)}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={overage ? 'h-full bg-red-500' : 'h-full bg-bamboo-deep'}
          style={{ width: `${pct}%` }}
        />
      </div>
      {overage && (
        <p className="mt-2 text-xs font-medium text-red-600">
          Przekroczenie: {String(hours.overageHours).replace('.', ',')} h
        </p>
      )}
    </div>
  );
}

function NavTile({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white p-4 text-center transition-colors hover:border-bamboo-deep hover:bg-paper"
    >
      <Icon className="h-5 w-5 text-bamboo-deep" />
      <span className="text-sm font-medium text-navy-deep">{label}</span>
    </Link>
  );
}
