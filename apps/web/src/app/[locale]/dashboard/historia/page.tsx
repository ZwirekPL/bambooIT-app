import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { api, ApiError } from '@/lib/api';
import { PlanHistoryList } from '@/components/dashboard/PlanHistoryList';
import type { DietPlanSummary } from '@/types/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.historia');
  return { title: t('title') };
}

export default async function HistoriaPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations('dashboard.historia');

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const token = await getBackendToken();
  const patientId = session?.user?.patientId;

  let plans: DietPlanSummary[] = [];

  if (token && patientId) {
    try {
      const res = await api.dietPlans.listByPatient(patientId, token);
      plans = res.dietPlans ?? [];
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        // unexpected error — show empty list
      }
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <PlanHistoryList plans={plans} token={token ?? ''} />
    </div>
  );
}
