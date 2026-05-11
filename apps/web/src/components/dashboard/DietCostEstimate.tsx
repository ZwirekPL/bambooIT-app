'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { DollarSign, ChevronDown, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface CostBreakdownItem {
  ingredientName: string;
  totalGrams: number;
  pricePer100g: number | null;
  estimatedCostPln: number;
  source: string;
}

interface CategoryBreakdownItem {
  category: string;
  totalPln: number;
  pct: number;
}

interface CostEstimate {
  weeklyTotalPln: number;
  dailyAveragePln: number;
  confidencePct: number;
  breakdown: CostBreakdownItem[];
  categoryBreakdown: CategoryBreakdownItem[];
}

interface DietCostEstimateProps {
  planId: string;
  token: string;
}

export function DietCostEstimate({ planId, token }: DietCostEstimateProps) {
  const t = useTranslations('dietCost');
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    api.dietPlans.getCostEstimate(planId, token)
      .then(res => {
        if (!cancelled) setEstimate(res.estimate);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [planId, token]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !estimate) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('error')}</span>
        </CardContent>
      </Card>
    );
  }

  const confidenceColor =
    estimate.confidencePct >= 70
      ? 'bg-green-500'
      : estimate.confidencePct >= 40
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main cost display */}
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">
            ~{estimate.weeklyTotalPln.toFixed(0)} {t('currency')}
            <span className="text-base font-normal text-muted-foreground">/{t('week')}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            (~{estimate.dailyAveragePln.toFixed(0)} {t('currency')}/{t('day')})
          </p>
        </div>

        {/* Confidence bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('confidence')}</span>
            <span>{estimate.confidencePct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${confidenceColor}`}
              style={{ width: `${estimate.confidencePct}%` }}
            />
          </div>
        </div>

        {/* Category breakdown */}
        {estimate.categoryBreakdown.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between px-0 hover:bg-transparent"
              onClick={() => setExpanded(!expanded)}
            >
              <span className="text-sm font-medium">{t('breakdown')}</span>
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>

            {expanded && (
              <div className="space-y-2">
                {estimate.categoryBreakdown.map(cat => (
                  <div key={cat.category} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span>{cat.category}</span>
                        <span className="font-medium">
                          {cat.totalPln.toFixed(0)} {t('currency')} ({cat.pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all"
                          style={{ width: `${cat.pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground italic">
          {t('disclaimer')}
        </p>
      </CardContent>
    </Card>
  );
}
