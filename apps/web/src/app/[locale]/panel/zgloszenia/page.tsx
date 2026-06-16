import type { Metadata } from 'next';
import { BRAND } from '@config/brand';
import { ClientTicketsPanel } from '@/components/client-panel/ClientTicketsPanel';

export const metadata: Metadata = {
  title: `Zgłoszenia — ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default function ClientTicketsPage() {
  return <ClientTicketsPanel />;
}
