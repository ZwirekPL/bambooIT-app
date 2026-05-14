import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBackendToken } from '@/lib/server-token';
import { api, ApiError } from '@/lib/api';
import { LeadDetail } from '@/components/admin/leads/LeadDetail';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = (await getBackendToken()) ?? '';

  try {
    const res = await api.admin.leads.getById(id, token);
    return <LeadDetail initialLead={res.lead} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
