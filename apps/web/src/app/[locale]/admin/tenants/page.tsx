import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { DietitiansTable } from '@/components/admin/DietitiansTable';
import type { AdminDietitian } from '@/types/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.dietitians');
  return { title: t('title') };
}

const LIMIT = 20;

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; sortBy?: string; sortOrder?: string; hideDeleted?: string }>;
}

export default async function AdminDietitiansPage({ searchParams }: PageProps) {
  const session = await auth();
  const t = await getTranslations('admin.dietitians');
  const params = await searchParams;

  const token = await getBackendToken() ?? '';

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const search = params.search ?? '';
  const sortBy = params.sortBy || undefined;
  const sortOrder = params.sortOrder || undefined;
  const hideDeleted = params.hideDeleted === 'true';

  let dietitians: AdminDietitian[] = [];
  let total = 0;

  try {
    const res = await api.admin.listDietitians({ page, limit: LIMIT, search, sortBy, sortOrder, hideDeleted }, token);
    dietitians = res.dietitians;
    total = res.total;
  } catch {
    // show empty state on error
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <DietitiansTable
        initialDietitians={dietitians}
        initialTotal={total}
        initialPage={page}
        limit={LIMIT}
      />
    </div>
  );
}
