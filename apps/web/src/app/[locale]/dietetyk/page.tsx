import { Suspense } from 'react';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { PatientWithLatestPlan, DietPlanStatus, DietitianStats, DietitianAlert, AlertType, AlertSeverity } from '@/types/api';
import { Users, Clock, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PatientSearchForm } from '@/components/dietitian/PatientSearchForm';
import { AlertsSection } from '@/components/dietitian/AlertsSection';
import { ActionItems } from '@/components/dietitian/ActionItems';
import { InvitePatientButton } from '@/components/dietitian/InvitePatientButton';
import { GettingStartedChecklist } from '@/components/dietitian/GettingStartedChecklist';

const PLAN_STATUS_STYLES: Record<
  DietPlanStatus,
  { label: string; className: string }
> = {
  AI_DRAFT:   { label: 'Szkic AI',              className: 'bg-violet-100 text-violet-800' },
  GENERATED:  { label: 'Oczekuje weryfikacji',  className: 'bg-amber-100 text-amber-800' },
  REVIEWED:   { label: 'Zweryfikowany',         className: 'bg-blue-100 text-blue-800' },
  SENT:       { label: 'Wysłany',               className: 'bg-teal-100 text-teal-800' },
  PUBLISHED:  { label: 'Opublikowany',          className: 'bg-sage-100 text-sage-800' },
  MANUAL_REVIEW_REQUIRED: { label: 'Wymaga przeglądu', className: 'text-amber-600 bg-amber-50' },
  GENERATION_FAILED: { label: 'Błąd generowania',      className: 'text-red-600 bg-red-50' },
};

function PlanStatusBadge({ status }: { status: DietPlanStatus | undefined }) {
  if (!status) return null;
  const style = PLAN_STATUS_STYLES[status];
  if (!style) return null;
  return (
    <Badge className={`text-xs font-medium pointer-events-none ${style.className}`}>
      {style.label}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PatientRow({
  patient,
  noPlanLabel,
  viewLabel,
}: {
  patient: PatientWithLatestPlan;
  noPlanLabel: string;
  viewLabel: string;
}) {
  const displayName =
    patient.firstName && patient.lastName
      ? `${patient.firstName} ${patient.lastName}`
      : patient.user.email;

  const latestPlan = patient.dietPlans[0];
  const joinedDate = new Date(patient.createdAt).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{displayName}</p>
        {patient.firstName && patient.lastName && (
          <p className="text-xs text-muted-foreground">{patient.user.email}</p>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-sm text-muted-foreground">{patient.user.email}</span>
      </td>
      <td className="px-4 py-3">
        {latestPlan ? (
          <PlanStatusBadge status={latestPlan.status} />
        ) : (
          <span className="text-xs text-muted-foreground">{noPlanLabel}</span>
        )}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-sm text-muted-foreground">{joinedDate}</span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/dietetyk/pacjenci/${patient.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-sage-600 hover:text-sage-800 transition-colors"
        >
          {viewLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}

export default async function DietitianPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const t = await getTranslations('dietitian');

  const token = await getBackendToken() ?? '';

  // Check dietitian onboarding status — redirect if incomplete
  try {
    const onboardingStatus = await api.onboarding.getDietitianStatus(token);
    if (!onboardingStatus.onboardingDone) {
      redirect('/dietetyk/onboarding');
    }
  } catch {
    // If endpoint fails, don't block dashboard access
  }

  const params = await searchParams;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const planStatus = typeof params.planStatus === 'string' ? params.planStatus : undefined;

  const displayName = session?.user?.name ?? session?.user?.email ?? '';

  let stats: DietitianStats = { totalPatients: 0, awaitingReview: 0, aiDraft: 0, published: 0 };
  let patients: PatientWithLatestPlan[] = [];
  let total = 0;
  let alerts: DietitianAlert[] = [];

  const [statsResult, patientsResult, alertsResult] = await Promise.allSettled([
    api.patients.stats(token),
    api.patients.list({ page: 1, limit: 20, search, planStatus }, token),
    api.patients.alerts(token),
  ]);

  if (statsResult.status === 'fulfilled') {
    const { ok: _ok, ...rest } = statsResult.value;
    stats = rest as DietitianStats;
  }

  if (patientsResult.status === 'fulfilled') {
    patients = patientsResult.value.patients;
    total = patientsResult.value.total;
  }

  if (alertsResult.status === 'fulfilled') {
    alerts = alertsResult.value.alerts;
  }

  const statCards = [
    { key: 'totalPatients', value: stats.totalPatients, icon: Users,        iconClass: 'bg-sage-50 text-sage-600' },
    { key: 'awaitingReview', value: stats.awaitingReview, icon: Clock,       iconClass: 'bg-amber-50 text-amber-600' },
    { key: 'aiDraft',        value: stats.aiDraft,        icon: Sparkles,    iconClass: 'bg-violet-50 text-violet-600' },
    { key: 'published',      value: stats.published,      icon: CheckCircle2, iconClass: 'bg-teal-50 text-teal-600' },
  ] as const;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-4 flex-wrap" data-tour="dt-greeting">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('greeting', { name: displayName })}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('greetingSubtitle')}</p>
        </div>
        <div data-tour="invite-patient">
          <InvitePatientButton token={token} />
        </div>
      </div>

      {/* Getting started checklist */}
      <div data-tour="dt-getting-started">
        <GettingStartedChecklist
          hasPatients={stats.totalPatients > 0}
          dietitianCode=""
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stats-cards">
        {statCards.map(({ key, value, icon, iconClass }) => (
          <StatCard
            key={key}
            label={t(`stats.${key}`)}
            value={value}
            icon={icon}
            iconClass={iconClass}
          />
        ))}
      </div>

      {/* Alerts */}
      <div data-tour="dt-alerts">
        <AlertsSection
          alerts={alerts}
          labels={{
            title: t('alerts.title'),
            noAlerts: t('alerts.noAlerts'),
            types: {
              plans_awaiting_review: t('alerts.types.plansAwaitingReview'),
              red_flag_plans: t('alerts.types.redFlagPlans'),
              dropout_risk: t('alerts.types.dropoutRisk'),
              rapid_weight_loss: t('alerts.types.rapidWeightLoss'),
              micronutrient_deficiency: t('alerts.types.micronutrientDeficiency'),
            },
            severities: {
              critical: t('alerts.severities.critical'),
              high: t('alerts.severities.high'),
              moderate: t('alerts.severities.moderate'),
              info: t('alerts.severities.info'),
            },
            viewPatient: t('alerts.viewPatient'),
          }}
        />
      </div>

      {/* Action items (60.1) */}
      <div data-tour="dt-action-items">
        <ActionItems />
      </div>

      {/* Patient list */}
      <div className="space-y-4" data-tour="patient-list">
        <h2 className="text-lg font-semibold">
          {t('patients.title')}
          {total > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({total})</span>
          )}
        </h2>

        <div data-tour="dt-search-filter">
          <Suspense fallback={null}>
            <PatientSearchForm />
          </Suspense>
        </div>

        {patients.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t('patients.noResults')}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('patients.colName')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      {t('patients.colEmail')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('patients.colPlanStatus')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      {t('patients.colCreated')}
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <PatientRow
                      key={patient.id}
                      patient={patient}
                      noPlanLabel={t('patients.noPlan')}
                      viewLabel={t('patients.viewDetails')}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
