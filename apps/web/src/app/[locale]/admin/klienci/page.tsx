import type { Metadata } from 'next';
import { ClientsTable } from '@/components/admin/ops/ClientsTable';

export const metadata: Metadata = {
  title: 'Klienci',
  robots: { index: false, follow: false },
};

export default function AdminClientsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-deep">Klienci</h1>
        <p className="mt-1 text-sm text-navy-soft">
          Aktywni klienci obsługi IT — godziny, rozliczenia i onboarding.
        </p>
      </header>
      <ClientsTable />
    </div>
  );
}
