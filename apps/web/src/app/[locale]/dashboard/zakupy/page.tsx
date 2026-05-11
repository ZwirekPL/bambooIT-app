import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ShoppingCart, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { ShoppingList } from '@/components/dashboard/ShoppingList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.shopping');
  return { title: t('title') };
}

export default async function ShoppingListPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations('dashboard.shopping');

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const token = await getBackendToken();
  const patientId = session?.user?.patientId;

  let planId: string | null = null;

  if (token && patientId) {
    try {
      const res = await api.dietPlans.getLatest(patientId, token);
      const plan = res.dietPlan;
      if (plan && (plan.status === 'PUBLISHED' || plan.status === 'SENT')) {
        planId = plan.id;
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        // unexpected error — fallback to no plan
      }
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShoppingCart className="h-5 w-5 text-sage-500" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {planId && token ? (
        <ShoppingList planId={planId} token={token} />
      ) : (
        <Card className="border-border">
          <CardContent className="py-12 flex flex-col items-center text-center gap-4">
            <div className="rounded-full bg-sage-50 p-4">
              <Clock className="h-8 w-8 text-sage-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{t('noPlan')}</h2>
              <p className="text-sm text-muted-foreground max-w-sm">{t('noPlanDesc')}</p>
            </div>
            <Button asChild variant="sage-outline" size="sm" className="gap-2">
              <Link href="/dashboard/plan">
                <ShoppingCart className="h-4 w-4" />
                {t('noPlanCta')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
