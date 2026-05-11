'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { MicronutrientReport, NutrientAssessment, NutrientStatus } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Beaker, AlertTriangle, CheckCircle2, ChevronDown, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MicronutrientPanelProps {
  planId: string;
  token: string;
  role?: string;
}

const STATUS_CONFIG: Record<NutrientStatus, { color: string; bgColor: string; label: string }> = {
  DEFICIENT: { color: 'text-red-600', bgColor: 'bg-red-50', label: 'Niedobór' },
  SUBOPTIMAL: { color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Poniżej normy' },
  ADEQUATE: { color: 'text-green-600', bgColor: 'bg-green-50', label: 'OK' },
  EXCESSIVE: { color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'Nadmiar' },
};

export function MicronutrientPanel({ planId, token, role }: MicronutrientPanelProps) {
  const t = useTranslations('dashboard.plan');
  const [report, setReport] = useState<MicronutrientReport | null>(null);
  const [interactions, setInteractions] = useState<Array<{ medication: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showSupplements, setShowSupplements] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.dietPlans.getMicronutrients(planId, token);
      setReport(res.report);
      if (res.medicationInteractions) {
        setInteractions(res.medicationInteractions);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {t('microLoading')}
        </CardContent>
      </Card>
    );
  }

  if (!report || !report.assessments?.length) return null;

  const deficiencies = report.deficiencies ?? [];
  const supplements = report.supplementRecommendations ?? [];

  const scoreColor = report.overallScore >= 80 ? 'text-green-600' : report.overallScore >= 50 ? 'text-amber-600' : 'text-red-600';
  const progressColor = report.overallScore >= 80 ? '[&>div]:bg-green-600' : report.overallScore >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500';

  const isPatient = role === 'PATIENT';

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Beaker className="h-4 w-4 text-violet-500" />
            {t('microTitle')}
          </span>
          <span className={cn('text-sm font-bold', scoreColor)}>
            {report.overallScore}%
          </span>
        </CardTitle>
        <Progress value={report.overallScore} className={cn('h-2', progressColor)} />
        <p className="text-xs text-muted-foreground mt-1">
          {t('microAnalyzedDays', { count: report.analyzedDays })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deficiencies summary */}
        {deficiencies.length > 0 && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {t('microDeficiencies', { count: deficiencies.length })}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {deficiencies.map((d) => (
                <Badge key={d.nutrientKey} variant="destructive" className="text-xs">
                  {d.label} ({d.percentOfTarget}%)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {deficiencies.length === 0 && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {t('microNoDeficiencies')}
          </div>
        )}

        {/* Full nutrient table (expandable) */}
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
          {t('microShowAll')}
        </button>

        {expanded && (
          <div className="space-y-1.5">
            {report.assessments.map((a: NutrientAssessment, idx: number) => {
              const cfg = STATUS_CONFIG[a.status];
              return (
                <div key={`${a.nutrientKey}-${idx}`} className={cn('flex items-center justify-between rounded-md px-3 py-2 text-sm', cfg.bgColor)}>
                  <span className="font-medium">{a.label}</span>
                  <div className="flex items-center gap-3">
                    {!isPatient && a.dailyAvgIntake != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {a.dailyAvgIntake} {a.unit}
                        {a.target != null && ` / ${a.target} ${a.unit}`}
                      </span>
                    )}
                    {a.percentOfTarget != null && (
                      <span className={cn('text-xs font-semibold tabular-nums', cfg.color)}>
                        {a.percentOfTarget}%
                      </span>
                    )}
                    <Badge variant="outline" className={cn('text-[10px]', cfg.color)}>
                      {cfg.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Supplement recommendations (admin/dietitian only) */}
        {!isPatient && supplements.length > 0 && (
          <div>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium"
              onClick={() => setShowSupplements(!showSupplements)}
            >
              <Pill className="h-4 w-4 text-blue-500" />
              {t('microSupplements', { count: supplements.length })}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showSupplements && 'rotate-180')} />
            </button>
            {showSupplements && (
              <div className="mt-2 space-y-2">
                {supplements.map((s) => (
                  <div key={s.nutrientKey} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.label}</span>
                      <Badge variant={s.priority === 'HIGH' ? 'destructive' : s.priority === 'MEDIUM' ? 'secondary' : 'outline'} className="text-[10px]">
                        {s.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{s.suggestedDose}</p>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground italic">
                  {t('microDisclaimer')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Medication interactions (admin/dietitian only) */}
        {!isPatient && interactions.length > 0 && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-1.5">
            <p className="text-sm font-medium text-amber-700">{t('microMedInteractions')}</p>
            {interactions.map((int, i) => (
              <p key={i} className="text-xs text-amber-800">
                <span className="font-medium">{int.medication}:</span> {int.description}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
