'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Types (mirror backend scraperStats.service) ──────────────────────────────

interface DomainStats {
  domain: string;
  total: number;
  withNutrition: number;
  withCookTime: number;
  withImage: number;
  avgQualityScore: number;
  avgRating: number | null;
  ratingCount: number;
  nonScalableGuess: number;
  missingIngredients: number;
  missingSteps: number;
}

interface ScraperStats {
  generatedAt: string;
  perDomain: DomainStats[];
  totals: {
    recipes: number;
    withNutrition: number;
    withCookTime: number;
    withImage: number;
    avgQualityScore: number;
  };
  trend: Array<{ month: string; count: number }>;
  flagCounts: Array<{ flagCode: string; count: number }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pctCell(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((100 * n) / total)}%`;
}

function alertClass(rejectRate: number): string {
  // Roadmap S-12 spec: auto-alert at >30% reject rate.
  if (rejectRate > 30) return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
  if (rejectRate > 15) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return '';
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  token: string;
}

export function ScraperStatsManager(_props: Props) {
  const [stats, setStats] = useState<ScraperStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ ok: boolean; stats: ScraperStats }>('/admin/scraper-stats');
        setStats(data.stats);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Błąd pobierania statystyk');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">Ładowanie statystyk scrapera…</div>;
  if (error) return <div className="p-6 text-destructive">Błąd: {error}</div>;
  if (!stats) return null;

  const maxTrend = Math.max(1, ...stats.trend.map((t) => t.count));
  const totalCombinedIssues = (d: DomainStats) =>
    d.nonScalableGuess + d.missingIngredients + d.missingSteps;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Statystyki scrapera</h1>
        <span className="text-sm text-muted-foreground">
          Aktualizacja: {new Date(stats.generatedAt).toLocaleString('pl-PL')}
        </span>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recipes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.recipes.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Z nutrition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pctCell(stats.totals.withNutrition, stats.totals.recipes)}
            </div>
            <div className="text-xs text-muted-foreground">{stats.totals.withNutrition}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Z czasem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pctCell(stats.totals.withCookTime, stats.totals.recipes)}
            </div>
            <div className="text-xs text-muted-foreground">{stats.totals.withCookTime}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ze zdjęciem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pctCell(stats.totals.withImage, stats.totals.recipes)}
            </div>
            <div className="text-xs text-muted-foreground">{stats.totals.withImage}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Śr. quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.avgQualityScore}/100</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-domain table */}
      <Card>
        <CardHeader>
          <CardTitle>Per domena</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domena</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Z makro</TableHead>
                <TableHead className="text-right">Z czasem</TableHead>
                <TableHead className="text-right">Ze zdjęciem</TableHead>
                <TableHead className="text-right">Śr. quality</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Non-scalable</TableHead>
                <TableHead className="text-right">Brak ingr.</TableHead>
                <TableHead className="text-right">Brak kroków</TableHead>
                <TableHead className="text-right">% issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.perDomain.map((d) => {
                const issues = totalCombinedIssues(d);
                const issueRate = d.total > 0 ? (100 * issues) / d.total : 0;
                return (
                  <TableRow key={d.domain} className={alertClass(issueRate)}>
                    <TableCell className="font-medium">{d.domain}</TableCell>
                    <TableCell className="text-right">{d.total}</TableCell>
                    <TableCell className="text-right">{pctCell(d.withNutrition, d.total)}</TableCell>
                    <TableCell className="text-right">{pctCell(d.withCookTime, d.total)}</TableCell>
                    <TableCell className="text-right">{pctCell(d.withImage, d.total)}</TableCell>
                    <TableCell className="text-right">{d.avgQualityScore}/100</TableCell>
                    <TableCell className="text-right">
                      {d.avgRating != null ? `${d.avgRating.toFixed(2)} (${d.ratingCount})` : '-'}
                    </TableCell>
                    <TableCell className="text-right">{d.nonScalableGuess}</TableCell>
                    <TableCell className="text-right">{d.missingIngredients}</TableCell>
                    <TableCell className="text-right">{d.missingSteps}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {Math.round(issueRate)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">
            Kolor czerwony: &gt;30% issues (blocker), bursztynowy: 15-30% (review). Issues liczy
            sumę recept niespełniających REQUIRED S-3 + heurystyki NON_SCALABLE.
          </p>
        </CardContent>
      </Card>

      {/* Trend chart — pure HTML bar */}
      <Card>
        <CardHeader>
          <CardTitle>Ingestacja (ostatnie 12 mies.)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-2">
            {stats.trend.map((t) => {
              const h = Math.round((t.count / maxTrend) * 100);
              return (
                <div key={t.month} className="flex flex-1 flex-col items-center">
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{ height: `${Math.max(2, h)}%` }}
                    title={`${t.month}: ${t.count} recipes`}
                  />
                  <span className="mt-1 text-[10px] text-muted-foreground">
                    {t.month.slice(2)}
                  </span>
                  <span className="text-xs font-medium">{t.count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Diet flags */}
      <Card>
        <CardHeader>
          <CardTitle>Diet flags (rozkład w DB)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag</TableHead>
                <TableHead className="text-right">Recipes z flagą</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.flagCounts.map((f) => (
                <TableRow key={f.flagCode}>
                  <TableCell className="font-medium">{f.flagCode}</TableCell>
                  <TableCell className="text-right">{f.count}</TableCell>
                  <TableCell className="text-right">
                    {pctCell(f.count, stats.totals.recipes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
