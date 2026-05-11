import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ClipboardList, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { PatientPlanView } from '@/components/dashboard/PatientPlanView';
import { PlanGeneratingStatus } from '@/components/dashboard/PlanGeneratingStatus';
import { PaywallGate } from '@/components/dashboard/PaywallGate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.plan');
  return { title: t('title') };
}

export default async function PlanPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations('dashboard.plan');

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const token = await getBackendToken();
  const patientId = session?.user?.patientId;
  const role = session?.user?.role;

  // Check paywall access
  let hasAccess = true;
  let swapsRemaining: number | undefined;
  if (token && role === 'PATIENT') {
    try {
      const accessStatus = await api.access.status(token);
      hasAccess = accessStatus.hasAccess;
      if (accessStatus.weeklyUsage && accessStatus.planLimits) {
        swapsRemaining = Math.max(0, accessStatus.planLimits.maxSwapsPerWeek - accessStatus.weeklyUsage.swapsUsed);
      }
    } catch {
      // If access check fails, allow through (fail-open)
    }
  }

  let plan = null;
  if (token && patientId) {
    try {
      const res = await api.dietPlans.getLatest(patientId, token);
      plan = res.dietPlan;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        // unexpected error — show pending state
      }
    }
  }

  const isVisible = plan && (plan.status === 'PUBLISHED' || plan.status === 'SENT');
  const isGenerating = plan && plan.status === 'AI_DRAFT';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <PaywallGate hasAccess={hasAccess}>
        {isVisible ? (
          <PatientPlanView
            plan={plan!}
            token={token ?? ''}
            patientId={patientId ?? ''}
            swapEnabled={role === 'PATIENT'}
            swapsRemaining={swapsRemaining}
          />
        ) : isGenerating && token && patientId ? (
          <PlanGeneratingStatus patientId={patientId} backendToken={token} />
        ) : (
          <Card className="border-border">
            <CardContent className="py-12 flex flex-col items-center text-center gap-4">
              <div className="rounded-full bg-sage-50 p-4">
                <Clock className="h-8 w-8 text-sage-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t('pendingTitle')}</h2>
                <p className="text-sm text-muted-foreground max-w-sm">{t('pendingDesc')}</p>
              </div>
              <Button asChild variant="sage-outline" size="sm" className="gap-2">
                <Link href="/dashboard/wywiad">
                  <ClipboardList className="h-4 w-4" />
                  {t('pendingCta')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </PaywallGate>
    </div>
  );
}
