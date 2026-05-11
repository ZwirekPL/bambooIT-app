import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { CheckInForm } from '@/components/dashboard/CheckInForm';
import { CheckInHistory } from '@/components/dashboard/CheckInHistory';
import { CheckInTrends } from '@/components/dashboard/CheckInTrends';
import { WeightProgressBar } from '@/components/dashboard/WeightProgressBar';
import { Milestones } from '@/components/dashboard/Milestones';
import type { CheckInTrends as CheckInTrendsData, ProgressData } from '@/types/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.checkin');
  return { title: t('title') };
}

export default async function CheckInPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations('dashboard.checkin');

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const token = await getBackendToken();

  const patientId = session?.user?.patientId;

  let checkIns: Awaited<ReturnType<typeof api.checkIns.list>>['checkIns'] = [];
  let latestCheckIn: Awaited<ReturnType<typeof api.checkIns.latest>>['checkIn'] = null;
  let trends: CheckInTrendsData | null = null;
  let progress: ProgressData | null = null;
  let hasGiCondition = false;

  if (token) {
    try {
      const [listRes, latestRes, trendsRes, progressRes] = await Promise.all([
        api.checkIns.list({ limit: 10 }, token),
        api.checkIns.latest(token),
        api.checkIns.trends(token).catch(() => null),
        api.checkIns.progress(token).catch(() => null),
      ]);
      checkIns = listRes.checkIns;
      latestCheckIn = latestRes.checkIn;
      trends = trendsRes;
      progress = progressRes;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        console.error('[checkin] Failed to fetch check-ins:', err);
      }
    }

    // 79.2: Detect GI conditions from latest interview
    if (patientId) {
      try {
        const interviewRes = await api.interviews.getLatest(patientId, token);
        const answers = interviewRes.interview?.answers as Record<string, unknown> | undefined;
        const digestiveIssues = Array.isArray(answers?.digestiveIssues) ? answers.digestiveIssues as string[] : [];
        const GI_CONDITIONS = ['gerd', 'ibs_c', 'ibs_d', 'ibs_m'];
        hasGiCondition = digestiveIssues.some((d) => GI_CONDITIONS.includes(d));
      } catch {
        // No interview yet — GI section stays hidden
      }
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="border-border">
        <CardContent className="py-6">
          <CheckInForm lastWeight={latestCheckIn?.weightKg ?? null} hasGiCondition={hasGiCondition} />
        </CardContent>
      </Card>

      {/* Progress & Milestones */}
      {progress && (
        <div className="space-y-4">
          <WeightProgressBar progress={progress} />
          {progress.milestones.length > 0 && (
            <Milestones milestones={progress.milestones} />
          )}
        </div>
      )}

      {trends && trends.totalCheckIns >= 2 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('trendsTitle')}</h2>
          <CheckInTrends trends={trends} goalWeightKg={progress?.goalWeightKg} />
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">{t('history')}</h2>
        <CheckInHistory checkIns={checkIns} />
      </div>
    </div>
  );
}
