import type { Metadata } from 'next';
import { BRAND } from '@config/brand';
import { ClientDashboard } from '@/components/client-panel/ClientDashboard';

export const metadata: Metadata = {
  title: `Panel — ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default function ClientPanelHome() {
  return <ClientDashboard />;
}
