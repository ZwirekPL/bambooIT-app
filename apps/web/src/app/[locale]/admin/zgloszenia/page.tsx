import type { Metadata } from 'next';
import { TicketQueue } from '@/components/admin/tickets/TicketQueue';

export const metadata: Metadata = {
  title: 'Zgłoszenia',
  robots: { index: false, follow: false },
};

export default function AdminTicketsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-deep">Zgłoszenia</h1>
        <p className="mt-1 text-sm text-navy-soft">
          Kolejka zgłoszeń obsługi IT — status, SLA i czas pracy w jednym miejscu.
        </p>
      </header>
      <TicketQueue />
    </div>
  );
}
