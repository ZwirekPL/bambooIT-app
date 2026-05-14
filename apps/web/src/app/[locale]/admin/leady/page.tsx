import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import type { LeadsStats } from '@/types/api';
import { LeadsStatsCards } from '@/components/admin/leads/LeadsStatsCards';
import { LeadsTable } from '@/components/admin/leads/LeadsTable';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.leads');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

const defaultStats: LeadsStats = {
  total: 0,
  byStatus: { NEW: 0, CONTACTED: 0, QUALIFIED: 0, CONVERTED: 0, REJECTED: 0 },
  byType: { AUDIT: 0, CONTACT: 0 },
  last7Days: 0,
};

export default async function AdminLeadsPage() {
  const t = await getTranslations('admin.leads');
  const token = (await getBackendToken()) ?? '';

  let stats = defaultStats;
  try {
    const res = await api.admin.leads.getStats(token);
    stats = res.stats;
  } catch {
    // show defaults on error — table component fetches list independently
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <LeadsStatsCards stats={stats} />

      <LeadsTable />
    </div>
  );
}
