import type { Metadata } from 'next';
import { TicketDetail } from '@/components/admin/tickets/TicketDetail';

export const metadata: Metadata = {
  title: 'Zgłoszenie',
  robots: { index: false, follow: false },
};

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketDetail id={id} />;
}
