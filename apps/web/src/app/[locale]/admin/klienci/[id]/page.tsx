import type { Metadata } from 'next';
import { ClientOpsPanel } from '@/components/admin/ops/ClientOpsPanel';

export const metadata: Metadata = {
  title: 'Karta klienta',
  robots: { index: false, follow: false },
};

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientOpsPanel companyId={id} />;
}
