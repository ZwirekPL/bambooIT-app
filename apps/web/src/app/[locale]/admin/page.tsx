import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

// TODO(K9-cleanup): Full admin dashboard placeholder after K5b drop.
// Original page used ~30 diet-domain types (DietCacheStats, DietitianStats,
// AiCostsListResponse, plan status rows, recipe quality widget, AI cost panel).
// Rebuild bambooIT admin overview in faza 4 — likely KPIs: active companies,
// MRR/ARR, ticket volume, support hours used per package, churn rate.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return {
    title: `${t('title')} — Admin`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminPage() {
  const t = await getTranslations('admin');

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Panel administratora bambooIT — w przebudowie. Pełny dashboard z KPI
            (MRR, churn, aktywne firmy, wolumen ticketów) wracający w fazie 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
