import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { PatientPlanView } from '@/components/dashboard/PatientPlanView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.plan');
  return { title: t('title') };
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const session = await auth();

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const token = await getBackendToken();
  const patientId = session?.user?.patientId;
  const t = await getTranslations('dashboard.plan');
  const th = await getTranslations('dashboard.historia');

  let plan = null;
  if (token) {
    try {
      const res = await api.dietPlans.getById(id, token);
      plan = res.plan;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        redirect({ href: '/dashboard/historia', locale });
      }
    }
  }

  if (!plan) {
    return redirect({ href: '/dashboard/historia', locale });
  }

  const resolvedPlan = plan;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/historia">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {th('title')}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(resolvedPlan.createdAt).toLocaleDateString('pl-PL', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          } as Intl.DateTimeFormatOptions)}
        </p>
      </div>

      <PatientPlanView
        plan={resolvedPlan}
        token={token ?? ''}
        patientId={patientId ?? ''}
      />
    </div>
  );
}
