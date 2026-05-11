import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { DietPlanStatus, ProgressData, DietitianNote } from '@/types/api';
import { User, ClipboardList, Leaf, History, CheckCircle2, Clock, Send, CircleDashed, Loader2, TrendingDown, Target, AlertCircle, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WeightProgressBar } from '@/components/dashboard/WeightProgressBar';
import { Milestones } from '@/components/dashboard/Milestones';
import { DietitianMessages } from '@/components/dashboard/DietitianMessages';
import { DashboardTour } from '@/components/dashboard/DashboardTour';
import { ReferralCard } from '@/components/dashboard/ReferralCard';
import { SubscriptionStatusCard } from '@/components/dashboard/SubscriptionStatusCard';
import { CheckInReminder } from '@/components/dashboard/CheckInReminder';
import { TodayMealsCard } from '@/components/dashboard/TodayMealsCard';
import { PatientEmptyState } from '@/components/dashboard/PatientEmptyState';
import { PlanPreviewSummary } from '@/components/dashboard/PlanPreviewSummary';
import { GiReportWidget } from '@/components/dashboard/GiReportWidget';

async function getLatestPlanStatus(
  patientId: string | null | undefined,
  backendToken: string | undefined
): Promise<DietPlanStatus | null> {
  if (!patientId || !backendToken) return null;
  try {
    const res = await api.dietPlans.getLatest(patientId, backendToken);
    return res.dietPlan?.status ?? null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    return null;
  }
}

function PlanStatusBadge({ status, t }: { status: DietPlanStatus | null; t: (key: string) => string }) {
  if (!status) return null;

  const map: Record<DietPlanStatus, { label: string; className: string; Icon: React.ElementType }> = {
    AI_DRAFT: {
      label: t('planAiDraft'),
      className: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
      Icon: Loader2,
    },
    GENERATED: {
      label: t('planGenerated'),
      className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
      Icon: Clock,
    },
    REVIEWED: {
      label: t('planReviewed'),
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
      Icon: CheckCircle2,
    },
    SENT: {
      label: t('planSent'),
      className: 'bg-sage-100 text-sage-800 hover:bg-sage-100',
      Icon: Send,
    },
    PUBLISHED: {
      label: t('planPublished'),
      className: 'bg-teal-100 text-teal-800 hover:bg-teal-100',
      Icon: CheckCircle2,
    },
    MANUAL_REVIEW_REQUIRED: {
      label: t('planManualReview'),
      className: 'bg-amber-50 text-amber-600 hover:bg-amber-50',
      Icon: AlertCircle,
    },
    GENERATION_FAILED: {
      label: t('planGenerationFailed'),
      className: 'bg-red-50 text-red-600 hover:bg-red-50',
      Icon: AlertCircle,
    },
  };

  const { label, className, Icon } = map[status];
  const isSpinning = status === 'AI_DRAFT';

  return (
    <Badge className={`gap-1.5 px-3 py-1 text-sm font-medium ${className}`}>
      <Icon className={`h-3.5 w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const t = await getTranslations('dashboard');

  const displayName = session?.user?.name ?? session?.user?.email ?? '';
  const patientId = session?.user?.patientId;
  const backendToken = await getBackendToken();

  const planStatus = await getLatestPlanStatus(patientId, backendToken);

  let progress: ProgressData | null = null;
  let dietitianNotes: DietitianNote[] = [];
  let dietitianUserId: string | null = null;

  if (backendToken) {
    const [progressResult, notesResult, profileResult] = await Promise.allSettled([
      api.checkIns.progress(backendToken),
      api.notes.listMy(backendToken),
      api.profile.get(backendToken),
    ]);

    if (progressResult.status === 'fulfilled') {
      progress = progressResult.value;
    }
    if (notesResult.status === 'fulfilled') {
      dietitianNotes = notesResult.value.notes;
    }
    if (profileResult.status === 'fulfilled') {
      dietitianUserId = profileResult.value.patient?.dietitian?.id ?? null;
    }
  }

  const shortcuts = [
    {
      href: '/dashboard/profil',
      icon: User,
      title: t('shortcutProfile'),
      desc: t('shortcutProfileDesc'),
    },
    {
      href: '/dashboard/wywiad',
      icon: ClipboardList,
      title: t('shortcutInterview'),
      desc: t('shortcutInterviewDesc'),
    },
    {
      href: '/dashboard/plan',
      icon: Leaf,
      title: t('shortcutPlan'),
      desc: t('shortcutPlanDesc'),
    },
    {
      href: '/dashboard/historia',
      icon: History,
      title: t('shortcutHistory'),
      desc: t('shortcutHistoryDesc'),
    },
  ] as const;

  return (
    <div className="space-y-8 max-w-3xl">
      <DashboardTour />
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('greeting', { name: displayName })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('greetingSubtitle')}</p>
      </div>

      {/* Smart empty state — shows checklist if not all steps completed */}
      {backendToken && (
        <PatientEmptyState token={backendToken} hasPlan={!!planStatus} />
      )}

      {/* Plan preview — visible when interview done but no plan yet */}
      {!planStatus && backendToken && patientId && (
        <PlanPreviewSummary token={backendToken} patientId={patientId} />
      )}

      {/* Plan status card */}
      <Card className="border-border bg-card" data-tour="patient-plan-status">
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('planStatus')}</p>
            <div className="mt-1.5">
              {planStatus ? (
                <PlanStatusBadge status={planStatus} t={t} />
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CircleDashed className="h-4 w-4" />
                  <span className="text-sm">{t('planNone')}</span>
                </div>
              )}
            </div>
            {!planStatus && (
              <p className="mt-1 text-xs text-muted-foreground">{t('planNoneDesc')}</p>
            )}
          </div>
          <Link
            href="/dashboard/plan"
            className="text-sm font-medium text-sage-700 hover:underline shrink-0"
          >
            {t('shortcutPlan')} →
          </Link>
        </CardContent>
      </Card>

      {/* Subscription status (67.3) */}
      <div data-tour="pt-subscription-status">
        <SubscriptionStatusCard />
      </div>

      {/* Check-in reminder (67.1) */}
      <div data-tour="pt-checkin-reminder">
        <CheckInReminder />
      </div>

      {/* Today's meals (67.2) */}
      <div data-tour="pt-today-meals">
        <TodayMealsCard />
      </div>

      {/* 84.1: GI report widget */}
      {patientId && backendToken && (
        <GiReportWidget patientId={patientId} token={backendToken} />
      )}

      {/* Weight progress */}
      {progress && progress.startWeightKg != null && progress.currentWeightKg != null && (
        <div className="space-y-4" data-tour="pt-weight-progress">
          <WeightProgressBar progress={progress} />
          {progress.milestones.filter((m) => m.achieved).length > 0 && (
            <div data-tour="pt-milestones">
              <Milestones milestones={progress.milestones} />
            </div>
          )}
        </div>
      )}

      {/* Write to dietitian */}
      {dietitianUserId && (
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sage-50 text-sage-600">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Napisz do dietetyka</p>
                <p className="text-sm text-muted-foreground">Wyślij wiadomość do swojego dietetyka</p>
              </div>
            </div>
            <Link
              href={`/dashboard/wiadomosci?startWith=${dietitianUserId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-green/90 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Napisz
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Messages from dietitian */}
      <div data-tour="pt-dietitian-messages">
      <DietitianMessages
        notes={dietitianNotes}
        labels={{
          title: t('dietitianMessages'),
          empty: t('dietitianMessagesEmpty'),
        }}
      />
      </div>

      {/* Shortcuts */}
      <div data-tour="patient-shortcuts">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('shortcuts')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shortcuts.map(({ href, icon: Icon, title, desc }) => (
            <Link key={href} href={href} className="group block">
              <Card className="h-full border-border transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-4 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sage-50 text-sage-600 group-hover:bg-sage-100 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Referral */}
      <Card className="border-border bg-card" data-tour="pt-referral">
        <CardContent className="py-5">
          <ReferralCard />
        </CardContent>
      </Card>
    </div>
  );
}
