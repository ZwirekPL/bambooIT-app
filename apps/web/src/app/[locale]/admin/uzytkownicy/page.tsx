import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { UsersTable } from '@/components/admin/UsersTable';
import type { AdminUser } from '@/types/api';
import type { UserRole } from '@/types/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.users');
  return { title: t('title') };
}

const LIMIT = 20;

interface PageProps {
  searchParams: Promise<{ search?: string; role?: string; page?: string; hideDeleted?: string; inactiveMonths?: string; sortBy?: string; sortOrder?: string; createdFrom?: string; createdTo?: string; subscriptionStatus?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await auth();
  const t = await getTranslations('admin.users');
  const params = await searchParams;

  const token = await getBackendToken() ?? '';
  const currentUserId = session?.user?.id ?? '';

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const search = params.search ?? '';
  const role = (params.role as UserRole) || undefined;
  const hideDeleted = params.hideDeleted === 'true';
  const inactiveMonths = params.inactiveMonths ? parseInt(params.inactiveMonths, 10) || undefined : undefined;
  const sortBy = params.sortBy || undefined;
  const sortOrder = params.sortOrder || undefined;
  const createdFrom = params.createdFrom || undefined;
  const createdTo = params.createdTo || undefined;
  const subscriptionStatus = params.subscriptionStatus || undefined;

  let users: AdminUser[] = [];
  let total = 0;

  try {
    const res = await api.admin.listUsers({ page, limit: LIMIT, search, role, excludeRole: 'DIETITIAN', hideDeleted, inactiveMonths, sortBy, sortOrder, createdFrom, createdTo, subscriptionStatus }, token);
    users = res.users;
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

      <UsersTable
        initialUsers={users}
        initialTotal={total}
        initialPage={page}
        limit={LIMIT}
        currentUserId={currentUserId}
      />
    </div>
  );
}
