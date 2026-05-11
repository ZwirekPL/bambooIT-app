'use client';

import { useState } from 'react';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { PlanComparisonSide } from '@/types/api';

interface ComparisonResult {
  planA: PlanComparisonSide;
  planB: PlanComparisonSide;
  diff: {
    kcalDiff: number;
    proteinDiff: number;
    fatDiff: number;
    carbsDiff: number;
    diversityDiff: number;
    commonRecipes: number;
    onlyInA: number;
    onlyInB: number;
    recipeOverlap: string[];
    uniqueToA: string[];
    uniqueToB: string[];
  };
}

function DiffBadge({ value, unit, inverted }: { value: number; unit: string; inverted?: boolean }) {
  if (value === 0) return <Badge variant="outline" className="text-[10px]"><Minus className="h-3 w-3 mr-0.5" />{unit}</Badge>;
  const positive = inverted ? value < 0 : value > 0;
  return (
    <Badge variant="outline" className={`text-[10px] ${positive ? 'text-green-700 border-green-300 bg-green-50' : 'text-red-700 border-red-300 bg-red-50'}`}>
      {positive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
      {value > 0 ? '+' : ''}{value}{unit}
    </Badge>
  );
}

function MetricRow({ label, valA, valB, diff, unit, inverted }: {
  label: string; valA: number | string | null; valB: number | string | null; diff?: number; unit: string; inverted?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 items-center py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-center">{valA ?? '-'}{typeof valA === 'number' ? unit : ''}</span>
      <span className="text-xs font-medium text-center">{valB ?? '-'}{typeof valB === 'number' ? unit : ''}</span>
      <div className="flex justify-center">
        {diff !== undefined ? <DiffBadge value={diff} unit={unit} inverted={inverted} /> : null}
      </div>
    </div>
  );
}

interface PlanComparisonViewProps {
  patientPlans: Array<{ id: string; createdAt: string; status: string }>;
  token: string;
}

export function PlanComparisonView({ patientPlans, token }: PlanComparisonViewProps) {
  const [planAId, setPlanAId] = useState(patientPlans[0]?.id ?? '');
  const [planBId, setPlanBId] = useState(patientPlans[1]?.id ?? '');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare() {
    if (!planAId || !planBId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.dietPlans.comparePlans(planAId, planBId, token);
      if (res.ok) setResult(res);
    } catch (err) {
      setError('Nie udalo sie porownac planow');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          Porownanie planow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground block mb-1">Plan A</label>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              value={planAId}
              onChange={(e) => setPlanAId(e.target.value)}
            >
              {patientPlans.map(p => (
                <option key={p.id} value={p.id}>
                  {new Date(p.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions)} — {p.status}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground block mb-1">Plan B</label>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              value={planBId}
              onChange={(e) => setPlanBId(e.target.value)}
            >
              {patientPlans.map(p => (
                <option key={p.id} value={p.id}>
                  {new Date(p.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions)} — {p.status}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={handleCompare} disabled={loading || !planAId || !planBId || planAId === planBId}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Porownaj'}
          </Button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {result && (
          <div className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-4 gap-2 border-b border-border pb-2">
              <span className="text-xs font-medium text-muted-foreground">Metryka</span>
              <span className="text-xs font-medium text-center">Plan A</span>
              <span className="text-xs font-medium text-center">Plan B</span>
              <span className="text-xs font-medium text-center">Roznica</span>
            </div>

            {/* Metrics */}
            <MetricRow label="Avg kcal/dzien" valA={result.planA.metrics.avgKcal} valB={result.planB.metrics.avgKcal} diff={result.diff.kcalDiff} unit="" />
            <MetricRow label="Avg bialko" valA={result.planA.metrics.avgProtein} valB={result.planB.metrics.avgProtein} diff={result.diff.proteinDiff} unit="g" />
            <MetricRow label="Avg tluszcze" valA={result.planA.metrics.avgFat} valB={result.planB.metrics.avgFat} diff={result.diff.fatDiff} unit="g" />
            <MetricRow label="Avg weglowodany" valA={result.planA.metrics.avgCarbs} valB={result.planB.metrics.avgCarbs} diff={result.diff.carbsDiff} unit="g" />
            <MetricRow label="Diversity" valA={result.planA.metrics.diversityScore} valB={result.planB.metrics.diversityScore} diff={result.diff.diversityDiff} unit="" />
            <MetricRow label="Unik. przepisy" valA={result.planA.metrics.uniqueRecipes} valB={result.planB.metrics.uniqueRecipes} unit="" />
            <MetricRow label="Ocena jakosci" valA={result.planA.quality.grade} valB={result.planB.quality.grade} unit="" />
            <MetricRow label="Avg fit score" valA={result.planA.quality.avgFitScore} valB={result.planB.quality.avgFitScore} unit="" />
            <MetricRow label="Avg total score" valA={result.planA.quality.avgTotalScore} valB={result.planB.quality.avgTotalScore} unit="" />
            <MetricRow label="Soft violations" valA={result.planA.quality.softViolations} valB={result.planB.quality.softViolations} unit="" inverted />

            {/* Recipe overlap */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium mb-2">Przepisy</p>
              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Wspolne:</span>{' '}
                  <span className="font-medium">{result.diff.commonRecipes}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tylko A:</span>{' '}
                  <span className="font-medium">{result.diff.onlyInA}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tylko B:</span>{' '}
                  <span className="font-medium">{result.diff.onlyInB}</span>
                </div>
              </div>
              {result.diff.uniqueToB.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Nowe w planie B:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.diff.uniqueToB.map((name, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
