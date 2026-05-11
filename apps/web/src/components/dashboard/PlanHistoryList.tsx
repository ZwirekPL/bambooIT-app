'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FileText, Flame, Beef, Droplet, Wheat, ClipboardList, Pill } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DietPlanSummary, DietPlanStatus } from '@/types/api';
import { api } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

function StatusBadge({ status }: { status: DietPlanStatus }) {
  const t = useTranslations('dashboard');

  const config: Record<DietPlanStatus, { label: string; variant: 'default' | 'sage-outline' | 'outline' }> = {
    AI_DRAFT:  { label: t('planAiDraft'),   variant: 'outline' },
    GENERATED: { label: t('planGenerated'), variant: 'outline' },
    REVIEWED:  { label: t('planReviewed'),  variant: 'sage-outline' },
    SENT:      { label: t('planSent'),      variant: 'sage-outline' },
    PUBLISHED: { label: t('planPublished'), variant: 'default' },
    MANUAL_REVIEW_REQUIRED: { label: t('planManualReview'), variant: 'outline' },
    GENERATION_FAILED: { label: t('planGenerationFailed'), variant: 'outline' },
  };

  const { label, variant } = config[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={variant}>{label}</Badge>;
}

function PlanCard({ plan, token }: { plan: DietPlanSummary; token: string }) {
  const t = useTranslations('dashboard');
  const th = useTranslations('dashboard.historia');
  const [loading, setLoading] = useState(false);

  const canDownload = plan.status === 'PUBLISHED' || plan.status === 'SENT';

  async function handleDownload() {
    setLoading(true);
    try {
      const blob = await api.dietPlans.exportPdf(plan.id, token);
      downloadBlob(blob, `plan-diety-${plan.createdAt.slice(0, 10)}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  const hasMacros = plan.kcal || plan.proteinG || plan.fatG || plan.carbsG;

  return (
    <Card className="border-border">
      <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={plan.status} />
            <span className="text-xs text-muted-foreground">
              {plan.source === 'AI' ? t('plan.sourceAi') : t('plan.sourceManual')}
            </span>
            <span className="text-xs text-muted-foreground">
              {th('createdAt')}: {new Date(plan.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions)}
            </span>
          </div>

          {hasMacros && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {plan.kcal && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-sage-500" />
                  {plan.kcal} kcal
                </span>
              )}
              {plan.proteinG && (
                <span className="flex items-center gap-1">
                  <Beef className="h-3 w-3 text-sage-500" />
                  {plan.proteinG}g B
                </span>
              )}
              {plan.fatG && (
                <span className="flex items-center gap-1">
                  <Droplet className="h-3 w-3 text-sage-500" />
                  {plan.fatG}g T
                </span>
              )}
              {plan.carbsG && (
                <span className="flex items-center gap-1">
                  <Wheat className="h-3 w-3 text-sage-500" />
                  {plan.carbsG}g W
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap">
          {canDownload && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/dashboard/plan/${plan.id}`}>
                <ClipboardList className="h-4 w-4" />
                {th('viewPlan')}
              </Link>
            </Button>
          )}
          {canDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={loading}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {loading ? '...' : th('downloadPdf')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface PlanHistoryListProps {
  plans: DietPlanSummary[];
  token: string;
}

export function PlanHistoryList({ plans, token }: PlanHistoryListProps) {
  const t = useTranslations('dashboard.historia');

  if (plans.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="py-12 flex flex-col items-center text-center gap-4">
          <div className="rounded-full bg-sage-50 p-4">
            <ClipboardList className="h-8 w-8 text-sage-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t('noPlans')}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">{t('noPlansDesc')}</p>
          </div>
          <Button asChild variant="sage-outline" size="sm">
            <Link href="/dashboard/wywiad">{t('noPlansBack')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} token={token} />
      ))}
    </div>
  );
}
