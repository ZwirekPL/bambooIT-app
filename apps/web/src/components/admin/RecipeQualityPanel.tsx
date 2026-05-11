'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, BarChart2, AlertTriangle, CheckCircle } from 'lucide-react';

interface RecipeQualityPanelProps {
  token: string;
}

type RecomputeMode = 'missing' | 'broken' | 'missing_micro' | 'all';

const MODE_LABELS: Record<RecomputeMode, string> = {
  missing: 'Brakujące snapshoty',
  broken: 'Zerowe kcal/białko',
  missing_micro: 'Brak mikroskładników',
  all: 'Wszystkie',
};

export function RecipeQualityPanel({ token }: RecipeQualityPanelProps) {
  const [report, setReport] = useState<{
    totalRecipes: number;
    withSnapshot: number;
    withoutSnapshot: number;
    zeroKcal: number;
    missingMicronutrients: number;
    noInstructionSteps: number;
    ingredients: { total: number; unmatchedToCleanProduct: number; matchRate: number };
    recipesWithUnmatchedIngredients: number;
    categories: Array<{ category: string | null; count: number }>;
    categorization?: {
      activeTotal: number;
      nullCounts: { mealType: number; category: number; dishCompleteness: number };
      mealTypeCounts: Array<{ mealType: string; count: number }>;
      dishCompletenessCounts: Array<{ dishCompleteness: string | null; count: number }>;
    };
    cuisineCoverage?: {
      activeTotal: number;
      nullCount: number;
      counts: Array<{ cuisineType: string | null; count: number }>;
      nonCanonical: Array<{ cuisineType: string; count: number }>;
    };
  } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<{
    total: number; success: number; failed: number; improved: number;
  } | null>(null);
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<RecomputeMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setReportLoading(true);
    setError(null);
    try {
      const res = await api.adminRecipes.dataQualityReport(token);
      setReport(res.report);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd ładowania raportu');
    } finally {
      setReportLoading(false);
    }
  };

  const triggerRecompute = async (mode: RecomputeMode) => {
    if (!confirm(`Przelicz ${MODE_LABELS[mode].toLowerCase()}? Może potrwać kilka minut.`)) return;
    setRecomputeLoading(true);
    setActiveMode(mode);
    setRecomputeResult(null);
    setError(null);
    try {
      const res = await api.adminRecipes.bulkRecomputeNutrition(mode, token);
      setRecomputeResult({ total: res.total, success: res.success, failed: res.failed, improved: res.improved });
      // Refresh report if it was loaded
      if (report) await loadReport();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd przeliczania');
    } finally {
      setRecomputeLoading(false);
      setActiveMode(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart2 className="h-5 w-5" />
          Jakość danych przepisów
        </h2>
        <Button variant="outline" size="sm" onClick={loadReport} disabled={reportLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${reportLoading ? 'animate-spin' : ''}`} />
          {reportLoading ? 'Ładowanie...' : 'Załaduj raport'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Wszystkich przepisów</p>
              <p className="text-2xl font-bold">{report.totalRecipes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Bez snapshotu</p>
              <p className="text-2xl font-bold text-amber-600">{report.withoutSnapshot}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Zerowe kcal/białko</p>
              <p className="text-2xl font-bold text-red-600">{report.zeroKcal}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Match składników</p>
              <p className="text-2xl font-bold text-green-600">{report.ingredients.matchRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Brak mikroskładników</p>
              <p className="text-2xl font-bold text-amber-600">{report.missingMicronutrients}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Bez kroków instrukcji</p>
              <p className="text-2xl font-bold text-amber-600">{report.noInstructionSteps}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Niezmatched ingredienty</p>
              <p className="text-2xl font-bold">{report.ingredients.unmatchedToCleanProduct}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Ze snapshotem</p>
              <p className="text-2xl font-bold text-green-600">{report.withSnapshot}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {report && report.categories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Kategorie przepisów</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {report.categories.slice(0, 30).map(({ category, count }) => (
                <Badge key={category ?? '_null'} variant="secondary" className="text-xs">
                  {category ?? '(brak)'}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report?.categorization && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Pokrycie kategoryzacji (aktywne: {report.categorization.activeTotal})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ['mealType', report.categorization.nullCounts.mealType],
                  ['category', report.categorization.nullCounts.category],
                  ['dishCompleteness', report.categorization.nullCounts.dishCompleteness],
                ] as const
              ).map(([dim, n]) => {
                const tone = n === 0 ? 'text-green-600' : n <= 5 ? 'text-amber-600' : 'text-red-600';
                return (
                  <div key={dim} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{dim} NULL</p>
                    <p className={`text-2xl font-bold ${tone}`}>{n}</p>
                  </div>
                );
              })}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">mealType</p>
              <div className="flex flex-wrap gap-2">
                {report.categorization.mealTypeCounts.map(({ mealType, count }) => (
                  <Badge key={mealType} variant="outline" className="text-xs">
                    {mealType}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">dishCompleteness</p>
              <div className="flex flex-wrap gap-2">
                {report.categorization.dishCompletenessCounts.map(({ dishCompleteness, count }) => (
                  <Badge
                    key={dishCompleteness ?? '_null'}
                    variant={dishCompleteness === null ? 'destructive' : 'outline'}
                    className="text-xs"
                  >
                    {dishCompleteness ?? '(NULL)'}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {report?.cuisineCoverage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Pokrycie kuchni (aktywne: {report.cuisineCoverage.activeTotal})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">cuisineType NULL</p>
                <p className={`text-2xl font-bold ${report.cuisineCoverage.nullCount === 0
                  ? 'text-green-600'
                  : report.cuisineCoverage.nullCount <= 50
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}>
                  {report.cuisineCoverage.nullCount}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Poza canonical 9 PL</p>
                <p className={`text-2xl font-bold ${report.cuisineCoverage.nonCanonical.length === 0
                  ? 'text-green-600'
                  : 'text-red-600'
                }`}>
                  {report.cuisineCoverage.nonCanonical.reduce((acc, n) => acc + n.count, 0)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">cuisineType</p>
              <div className="flex flex-wrap gap-2">
                {report.cuisineCoverage.counts.map(({ cuisineType, count }) => (
                  <Badge
                    key={cuisineType ?? '_null'}
                    variant={cuisineType === null ? 'destructive' : 'outline'}
                    className="text-xs"
                  >
                    {cuisineType ?? '(NULL)'}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {report.cuisineCoverage.nonCanonical.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1">
                  Wartości poza canonical (do normalizacji)
                </p>
                <div className="flex flex-wrap gap-2">
                  {report.cuisineCoverage.nonCanonical.map(({ cuisineType, count }) => (
                    <Badge key={cuisineType} variant="destructive" className="text-xs">
                      {cuisineType}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Przelicz snapshoty odżywcze
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Przelicza wartości odżywcze na podstawie składników i produktów w bazie.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODE_LABELS) as RecomputeMode[]).map((mode) => (
              <Button
                key={mode}
                variant="outline"
                size="sm"
                disabled={recomputeLoading}
                onClick={() => triggerRecompute(mode)}
                className="gap-2"
              >
                {recomputeLoading && activeMode === mode && (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                {MODE_LABELS[mode]}
              </Button>
            ))}
          </div>

          {recomputeResult && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-md p-3">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Przeliczono {recomputeResult.total} przepisów —
              sukces: {recomputeResult.success},
              błędy: {recomputeResult.failed},
              poprawa: {recomputeResult.improved}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
