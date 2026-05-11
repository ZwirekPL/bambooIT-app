import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import type { SubscriptionStats, SubscriptionItem } from '@/types/api';
import SubscriptionStatsCards from '@/components/admin/SubscriptionStatsCards';
import SubscriptionTable from '@/components/admin/SubscriptionTable';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.subscriptions');
  return { title: t('title') };
}

export default async function AdminSubscriptionsPage() {
  const session = await auth();
  const t = await getTranslations('admin.subscriptions');
  const token = await getBackendToken() ?? '';

  const defaultStats: SubscriptionStats = {
    mrr: 0,
    activeSubscriptions: { total: 0, monthly: 0, yearly: 0 },
    trials: { active: 0, expired: 0 },
    oneTime: { plan2w: 0, plan4w: 0, consultation: 0 },
    churnRate: 0,
  };

  let stats = defaultStats;
  let items: SubscriptionItem[] = [];
  let total = 0;

  try {
    const [statsRes, listRes] = await Promise.all([
      api.admin.getSubscriptionStats(token),
      api.admin.listSubscriptions({ page: 1, limit: 100 }, token),
    ]);
    stats = statsRes.stats;
    items = listRes.items;
    total = listRes.total;
  } catch {
    // show defaults on error
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <SubscriptionStatsCards stats={stats} token={token} />

      <SubscriptionTable initialItems={items} initialTotal={total} token={token} />
    </div>
  );
}
