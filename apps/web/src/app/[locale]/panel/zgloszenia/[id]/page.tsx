import type { Metadata } from 'next';
import { BRAND } from '@config/brand';
import { ClientTicketThread } from '@/components/client-panel/ClientTicketThread';

export const metadata: Metadata = {
  title: `Zgłoszenie — ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function ClientTicketThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientTicketThread id={id} />;
}
