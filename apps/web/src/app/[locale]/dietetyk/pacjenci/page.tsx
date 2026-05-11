import { Suspense } from 'react';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import type { PatientWithLatestPlan } from '@/types/api';
import { PatientTabs } from '@/components/dietitian/PatientTabs';

export default async function PacjenciPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const t = await getTranslations('dietitian');
  const token = await getBackendToken() ?? '';
  const params = await searchParams;

  const search = typeof params.search === 'string' ? params.search : undefined;
  const planStatus = typeof params.planStatus === 'string' ? params.planStatus : undefined;
  const interviewFilter = typeof params.interviewFilter === 'string' ? params.interviewFilter : undefined;

  let minePatients: PatientWithLatestPlan[] = [];
  let mineTotal = 0;
  let unassignedPatients: PatientWithLatestPlan[] = [];
  let unassignedTotal = 0;

  const [mineResult, unassignedResult] = await Promise.allSettled([
    api.patients.list({ page: 1, limit: 20, search, planStatus, interviewFilter, scope: 'mine' }, token),
    api.patients.list({ page: 1, limit: 20, search, planStatus, interviewFilter, scope: 'unassigned' }, token),
  ]);

  if (mineResult.status === 'fulfilled') {
    minePatients = mineResult.value.patients;
    mineTotal = mineResult.value.total;
  }

  if (unassignedResult.status === 'fulfilled') {
    unassignedPatients = unassignedResult.value.patients;
    unassignedTotal = unassignedResult.value.total;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('patients.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('patients.subtitle')}</p>
      </div>

      <Suspense fallback={null}>
        <PatientTabs
          token={token}
          initialMine={minePatients}
          initialMineTotal={mineTotal}
          initialUnassigned={unassignedPatients}
          initialUnassignedTotal={unassignedTotal}
        />
      </Suspense>
    </div>
  );
}
