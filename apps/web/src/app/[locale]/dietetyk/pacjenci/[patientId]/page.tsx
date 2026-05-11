import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { PatientDetail, InterviewSummary, DietPlanSummary, DietPlanStatus, DietitianNote, MeasurementTrends } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight, MessageCircle, Plus, Ruler, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { PatientProfileCard } from '@/components/dietitian/PatientProfileCard';
import { DietitianNotes } from '@/components/dietitian/DietitianNotes';
import { MatchedProtocolsCard } from '@/components/dietitian/MatchedProtocolsCard';
import { RecommendedProductsCard } from '@/components/dietitian/RecommendedProductsCard';
import { MedicationInteractionsPanel } from '@/components/dietitian/MedicationInteractionsPanel';
import { SupplementsPanel } from '@/components/dietitian/SupplementsPanel';
import { InterviewAnswersCard } from '@/components/dietitian/InterviewAnswersCard';
import type { Interview } from '@/types/api';

// ─── plan status badge ────────────────────────────────────────────────────────

const PLAN_STATUS_STYLES: Record<DietPlanStatus, { label: string; className: string }> = {
  AI_DRAFT:  { label: 'Szkic AI',             className: 'bg-violet-100 text-violet-800' },
  GENERATED: { label: 'Oczekuje weryfikacji', className: 'bg-amber-100 text-amber-800' },
  REVIEWED:  { label: 'Zweryfikowany',        className: 'bg-blue-100 text-blue-800' },
  SENT:      { label: 'Wysłany',              className: 'bg-teal-100 text-teal-800' },
  PUBLISHED: { label: 'Opublikowany',         className: 'bg-sage-100 text-sage-800' },
  MANUAL_REVIEW_REQUIRED: { label: 'Wymaga przeglądu', className: 'text-amber-600 bg-amber-50' },
  GENERATION_FAILED: { label: 'Błąd generowania',      className: 'text-red-600 bg-red-50' },
};

function PlanStatusBadge({ status }: { status: DietPlanStatus }) {
  const style = PLAN_STATUS_STYLES[status];
  if (!style) return null;
  return (
    <Badge className={`text-xs font-medium pointer-events-none ${style.className}`}>
      {style.label}
    </Badge>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const t = await getTranslations('dietitian.patientDetail');
  const { patientId } = await params;
  const sp = await searchParams;
  const isReadOnly = sp.readonly === '1';

  const token = await getBackendToken() ?? '';

  let patient: PatientDetail | null = null;
  let interviews: InterviewSummary[] = [];
  let latestInterview: Interview | null = null;
  let dietPlans: DietPlanSummary[] = [];
  let notes: DietitianNote[] = [];
  let measurementTrends: MeasurementTrends | null = null;

  const [patientResult, interviewsResult, latestInterviewResult, dietPlansResult, notesResult, measurementsResult] = await Promise.allSettled([
    api.patients.getById(patientId, token),
    api.interviews.listByPatient(patientId, token),
    api.interviews.getLatest(patientId, token),
    api.dietPlans.listByPatient(patientId, token),
    api.notes.list(patientId, token),
    api.measurements.trendsByPatient(patientId, token),
  ]);

  if (patientResult.status === 'fulfilled') {
    patient = patientResult.value.patient;
  }
  if (interviewsResult.status === 'fulfilled') {
    interviews = interviewsResult.value.interviews;
  }
  if (latestInterviewResult.status === 'fulfilled') {
    latestInterview = latestInterviewResult.value.interview;
  }
  if (dietPlansResult.status === 'fulfilled') {
    dietPlans = dietPlansResult.value.dietPlans;
  }
  if (notesResult.status === 'fulfilled') {
    notes = notesResult.value.notes;
  }
  if (measurementsResult.status === 'fulfilled') {
    measurementTrends = measurementsResult.value;
  }

  if (!patient) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Link
          href="/dietetyk/pacjenci"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Back link + message button */}
      <div className="flex items-center justify-between">
        <Link
          href="/dietetyk/pacjenci"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
        {!isReadOnly && (
          <Link
            href={`/dietetyk/wiadomosci?startWith=${patient.userId}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-green/90 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Napisz wiadomość
          </Link>
        )}
      </div>

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('readOnlyBanner')}
        </div>
      )}

      {/* Profile card (editable only if not read-only) */}
      <PatientProfileCard initialPatient={patient} token={token} readOnly={isReadOnly} />

      {/* Interview history + answers (IW-18) + request update (IW-19) */}
      <InterviewAnswersCard
        patientId={patientId}
        latestInterview={latestInterview}
        token={token}
      />
      {interviews.length > 1 && (
        <p className="text-xs text-muted-foreground px-1">
          Łącznie wywiadów: {interviews.length} (pokazywany najnowszy)
        </p>
      )}

      {/* Matched protocols (30.7) */}
      <MatchedProtocolsCard patientId={patientId} token={token} />

      {/* Recommended products for this patient */}
      <RecommendedProductsCard patientId={patientId} token={token} />

      {/* Diet plan history */}
      <Card className="border-border">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {t('dietPlansTitle')}
            {dietPlans.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({dietPlans.length})
              </span>
            )}
          </CardTitle>
          {!isReadOnly && (
            <Link
              href={`/dietetyk/pacjenci/${patientId}/plany/nowy`}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('createManualPlan')}
            </Link>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {dietPlans.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">{t('dietPlansEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colPlanSource')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colPlanStatus')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      {t('colPlanMacros')}
                    </th>
                    {session?.user?.role === 'ADMIN' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                      Model
                    </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colPlanDate')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colPlanActions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dietPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium">
                          {plan.source === 'AI' ? t('planSourceAi') : t('planSourceManual')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PlanStatusBadge status={plan.status} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {plan.kcal ? (
                          <span className="text-xs text-muted-foreground">
                            {plan.kcal} {t('kcal')}
                            {plan.proteinG && ` · ${t('protein')} ${plan.proteinG}g`}
                            {plan.fatG && ` · ${t('fat')} ${plan.fatG}g`}
                            {plan.carbsG && ` · ${t('carbs')} ${plan.carbsG}g`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      {session?.user?.role === 'ADMIN' && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {plan.aiModel ? (
                          <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5">
                            {plan.aiModel}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(plan.createdAt).toLocaleDateString('pl-PL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        } as Intl.DateTimeFormatOptions)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dietetyk/pacjenci/${patientId}/plany/${plan.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {t('viewPlan')}
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drug-food interactions (79.5) */}
      <MedicationInteractionsPanel patientId={patientId} token={token} />

      {/* Supplements (79.6) */}
      {!isReadOnly && <SupplementsPanel patientId={patientId} token={token} />}

      {/* Body measurements (79.3) */}
      {measurementTrends && measurementTrends.summaries.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              Pomiary ciała
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {measurementTrends.summaries.map((s) => {
                const LABELS: Record<string, string> = {
                  waistCm: 'Talia',
                  hipCm: 'Biodra',
                  chestCm: 'Klatka',
                  thighCm: 'Udo',
                  armCm: 'Ramię',
                  bodyFatPct: 'Tłuszcz',
                };
                const Icon = s.direction === 'down' ? TrendingDown : s.direction === 'up' ? TrendingUp : Minus;
                const iconColor = s.field === 'bodyFatPct'
                  ? (s.direction === 'down' ? 'text-green-600' : s.direction === 'up' ? 'text-red-500' : 'text-muted-foreground')
                  : (s.direction === 'down' ? 'text-green-600' : s.direction === 'up' ? 'text-amber-500' : 'text-muted-foreground');
                return (
                  <div key={s.field} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">{LABELS[s.field] ?? s.field}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold">
                        {s.last != null ? `${s.last} ${s.field === 'bodyFatPct' ? '%' : 'cm'}` : '—'}
                      </span>
                      {s.direction !== 'insufficient' && s.change != null && (
                        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                      )}
                    </div>
                    {s.change != null && s.direction !== 'insufficient' && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.change > 0 ? '+' : ''}{s.change} {s.field === 'bodyFatPct' ? '%' : 'cm'}
                        {s.changePct != null && ` (${s.changePct > 0 ? '+' : ''}${s.changePct}%)`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {measurementTrends.whrInterpretation && (
              <div className={`mt-3 rounded-md px-3 py-2 text-sm ${
                measurementTrends.whrInterpretation.level === 'healthy' ? 'bg-green-50 text-green-800' :
                measurementTrends.whrInterpretation.level === 'moderate' ? 'bg-amber-50 text-amber-800' :
                'bg-red-50 text-red-800'
              }`}>
                WHR: <strong>{measurementTrends.whrInterpretation.whr.toFixed(2)}</strong> — {measurementTrends.whrInterpretation.label}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dietitian notes */}
      <DietitianNotes
        patientId={patientId}
        initialNotes={notes}
        token={token}
        readOnly={isReadOnly}
        labels={{
          title: t('notesTitle'),
          empty: t('notesEmpty'),
          placeholder: t('notesPlaceholder'),
          send: t('notesSend'),
          sending: t('notesSending'),
          success: t('notesSuccess'),
          error: t('notesError'),
          insertTemplate: t('notesInsertTemplate'),
          noTemplates: t('notesNoTemplates'),
        }}
      />
    </div>
  );
}
