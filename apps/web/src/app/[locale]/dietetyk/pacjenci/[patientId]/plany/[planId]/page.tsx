import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { DietPlan, DietPlanRevision, DietPlanStatus } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { DietPlanEditor } from '@/components/dietitian/DietPlanEditor';
import { DietPlanStatusActions } from '@/components/dietitian/DietPlanStatusActions';
import { RevisionHistory } from '@/components/dietitian/RevisionHistory';
import { RecommendedProductsCard } from '@/components/dietitian/RecommendedProductsCard';
import { PlanWithToolkit } from '@/components/dietitian/PlanWithToolkit';
import { SlotDecisionPanel } from '@/components/dietitian/SlotDecisionPanel';
import { PlanQualityPanel } from '@/components/dietitian/PlanQualityPanel';
import { PlanComparisonView } from '@/components/dietitian/PlanComparisonView';
import { MedicationInteractionsPanel } from '@/components/dietitian/MedicationInteractionsPanel';

// ─── status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  AI_DRAFT:                { label: 'Szkic AI',                  className: 'bg-violet-100 text-violet-800' },
  GENERATED:               { label: 'Oczekuje weryfikacji',      className: 'bg-amber-100 text-amber-800' },
  MANUAL_REVIEW_REQUIRED:  { label: 'Wymaga ręcznej weryfikacji', className: 'bg-red-100 text-red-800' },
  REVIEWED:                { label: 'Zweryfikowany',             className: 'bg-blue-100 text-blue-800' },
  SENT:                    { label: 'Wysłany',                   className: 'bg-teal-100 text-teal-800' },
  PUBLISHED:               { label: 'Opublikowany',              className: 'bg-green-100 text-green-800' },
};

function PlanStatusBadge({ status }: { status: DietPlanStatus }) {
  const style = STATUS_STYLES[status];
  if (!style) return null;
  return (
    <Badge className={`text-xs font-medium pointer-events-none ${style.className}`}>
      {style.label}
    </Badge>
  );
}

// ─── cuisine match badge (Faza D D1 revisited) ───────────────────────────────

function CuisineMatchBadge({
  matchCount,
  total,
  label,
  tooltip,
}: {
  matchCount: number;
  total: number;
  label: string;
  tooltip: string;
}) {
  if (total <= 0) return null;
  const pct = matchCount / total;
  // Thresholds align with CUISINE_TARGET_PCT=0.6 in weekSolver.service.ts:
  //   ≥80% → green (target comfortably met)
  //   60-79% → amber (at the soft target)
  //   <60% → red (below target — solver couldn't honour the preference)
  let cls = 'bg-red-100 text-red-800';
  if (pct >= 0.8) cls = 'bg-green-100 text-green-800';
  else if (pct >= 0.6) cls = 'bg-amber-100 text-amber-800';
  return (
    <Badge
      className={`text-xs font-medium pointer-events-none ${cls}`}
      title={tooltip}
    >
      {label}: {matchCount}/{total} ({Math.round(pct * 100)}%)
    </Badge>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ patientId: string; planId: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('dietitian.planDetail');
  const { patientId, planId } = await params;

  const token = await getBackendToken() ?? '';

  let plan: DietPlan | null = null;
  let revisions: DietPlanRevision[] = [];
  let patientPlans: Array<{ id: string; createdAt: string; status: string }> = [];

  try {
    const result = await api.dietPlans.getById(planId, token);
    plan = result.plan;
    const [revResult, plansResult] = await Promise.all([
      api.dietPlans.getRevisions(planId, token),
      api.dietPlans.listByPatient(patientId, token),
    ]);
    revisions = revResult.revisions;
    patientPlans = (plansResult.dietPlans ?? []).map((p) => ({ id: p.id, createdAt: p.createdAt, status: p.status }));
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <div className="space-y-4 max-w-4xl">
          <Link
            href={`/dietetyk/pacjenci/${patientId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToPatient')}
          </Link>
          <p className="text-muted-foreground">{t('accessDenied')}</p>
        </div>
      );
    }
  }

  if (!plan) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Link
          href={`/dietetyk/pacjenci/${patientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToPatient')}
        </Link>
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 max-w-7xl">
      <PlanWithToolkit plan={plan} patientId={patientId} token={token}>
        {/* Back link */}
        <Link
          href={`/dietetyk/pacjenci/${patientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToPatient')}
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
              <PlanStatusBadge status={plan.status} />
              <span>
                {plan.source === 'AI' ? t('sourceAi') : t('sourceManual')}
              </span>
              <span>
                {t('createdAt')}: {new Date(plan.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions)}
              </span>
              {plan.policyMetadata?.solverReport?.cuisineMainTotal != null
                && plan.policyMetadata.solverReport.cuisineMainTotal > 0 && (
                <CuisineMatchBadge
                  matchCount={plan.policyMetadata.solverReport.cuisineMatchCount ?? 0}
                  total={plan.policyMetadata.solverReport.cuisineMainTotal}
                  label={t('cuisineMatchLabel')}
                  tooltip={t('cuisineMatchTooltip')}
                />
              )}
            </div>
          </div>

          {/* Status action buttons */}
          <DietPlanStatusActions planId={plan.id} status={plan.status} />
        </div>

        {/* Recommended products for this patient (visible when editing plan) */}
        <RecommendedProductsCard patientId={patientId} token={token} />

        {/* Medication interactions (79.5) */}
        <MedicationInteractionsPanel patientId={patientId} token={token} />

        {/* Editor (view + edit) with top-level regeneration */}
        <DietPlanEditor plan={plan} showRegenerateButton />

        {/* Plan quality report — soft validations + grade (Faza 74) */}
        <PlanQualityPanel planId={plan.id} />

        {/* Slot decision audit trail — trace mode for dietitian (Faza 72) */}
        <SlotDecisionPanel planId={plan.id} />

        {/* Plan comparison — only if patient has multiple plans (Faza 76c) */}
        {patientPlans.length >= 2 && (
          <PlanComparisonView patientPlans={patientPlans} token={token} />
        )}

        {/* Revision history */}
        <RevisionHistory revisions={revisions} token={token} />
      </PlanWithToolkit>
    </div>
  );
}
