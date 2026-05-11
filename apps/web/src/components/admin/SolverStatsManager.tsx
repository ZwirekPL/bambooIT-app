'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ─── Types (mirror backend solverStats.service) ───────────────────────────────

interface SolverStats {
  windowStart: string;
  windowEnd: string;
  totalPlans: number;
  plansWithoutSolverReport: number;
  statusHistogram: Record<string, number>;
  durationMs: {
    count: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  composeMode: {
    activeCount: number;
    activeRate: number;
    avgComposeSlotsCount: number;
    avgMultiItemSlotCount: number;
    failuresInComposeMode: number;
  };
  cuisine: {
    plansEvaluated: number;
    totalMatched: number;
    totalMain: number;
    coveragePercent: number;
    plansBelowTarget: number;
    coverageHistogram: Array<{ bin: string; count: number }>;
  };
  perPatient?: Array<{
    patientId: string;
    plans: number;
    composeRuns: number;
    statusBreakdown: Record<string, number>;
    medianDurationMs: number;
  }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Master plan §performance criteria:
 *   * P50 ≤ 5s, P95 ≤ 15s, P99 ≤ 30s
 * Color rows that exceed these thresholds.
 */
function durationAlertClass(p99Ms: number): string {
  if (p99Ms > 30000) return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
  if (p99Ms > 20000) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return '';
}

/**
 * Master plan §performance criteria: INFEASIBLE rate ≤ 2% on production traffic.
 * Combine TIMEOUT + INFEASIBLE + ERROR as "failure rate" for the alert.
 */
function failureRate(stats: SolverStats): number {
  const histogram = stats.statusHistogram;
  const failures = (histogram.INFEASIBLE ?? 0) + (histogram.TIMEOUT ?? 0) + (histogram.ERROR ?? 0);
  return stats.totalPlans > 0 ? failures / stats.totalPlans : 0;
}

function failureAlertClass(rate: number): string {
  if (rate > 0.05) return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
  if (rate > 0.02) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return '';
}

/**
 * Cuisine coverage threshold mirrors solver's CUISINE_TARGET_PCT=0.6:
 *   ≥80% → green (target comfortably met)
 *   60-79% → amber (sitting on the soft target)
 *   <60% → red (solver routinely failing the patient preference signal)
 */
function cuisineAlertClass(coveragePct: number): string {
  if (coveragePct >= 80) return '';
  if (coveragePct >= 60) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props { token: string }

export function SolverStatsManager(_props: Props) {
  const [stats, setStats] = useState<SolverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [patientFilter, setPatientFilter] = useState('');
  const [appliedPatientFilter, setAppliedPatientFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const params = new URLSearchParams({ days: String(days) });
        if (appliedPatientFilter) params.set('patientId', appliedPatientFilter);
        const data = await apiFetch<{ ok: boolean; stats: SolverStats }>(
          `/admin/solver-stats?${params.toString()}`,
        );
        if (!cancelled) setStats(data.stats);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd pobierania statystyk solvera');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [days, appliedPatientFilter]);

  if (loading && !stats) return <div className="p-6 text-muted-foreground">Ładowanie statystyk solvera…</div>;
  if (error) return <div className="p-6 text-destructive">Błąd: {error}</div>;
  if (!stats) return null;

  const fRate = failureRate(stats);
  const totalStatuses = Object.values(stats.statusHistogram).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Statystyki solvera (Faza D)</h1>
          <p className="text-sm text-muted-foreground">
            Okno: {new Date(stats.windowStart).toLocaleString('pl-PL')} → {new Date(stats.windowEnd).toLocaleString('pl-PL')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm">
            Dni:
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="ml-2 rounded border bg-background px-2 py-1 text-sm"
            >
              {[1, 3, 7, 14, 30, 90].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedPatientFilter(patientFilter.trim());
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              placeholder="patientId (opcjonalnie)"
              className="rounded border bg-background px-2 py-1 text-sm w-64"
            />
            <button
              type="submit"
              className="rounded border bg-primary px-3 py-1 text-sm text-primary-foreground hover:opacity-90"
            >
              Filtruj
            </button>
            {appliedPatientFilter && (
              <button
                type="button"
                onClick={() => { setPatientFilter(''); setAppliedPatientFilter(''); }}
                className="text-sm text-muted-foreground underline"
              >
                Wyczyść
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Top stats grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plany w oknie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlans.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              z DB-solver. Bez raportu solvera: {stats.plansWithoutSolverReport}
            </div>
          </CardContent>
        </Card>
        <Card className={failureAlertClass(fRate)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">% niepowodzeń</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtPct(fRate)}</div>
            <div className="text-xs text-muted-foreground">
              INFEASIBLE + TIMEOUT + ERROR (target ≤2%)
            </div>
          </CardContent>
        </Card>
        <Card className={durationAlertClass(stats.durationMs.p99)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">P99 duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtMs(stats.durationMs.p99)}</div>
            <div className="text-xs text-muted-foreground">
              P50: {fmtMs(stats.durationMs.p50)} · P95: {fmtMs(stats.durationMs.p95)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compose mode aktywny</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.composeMode.activeCount} <span className="text-base font-normal text-muted-foreground">({fmtPct(stats.composeMode.activeRate)})</span>
            </div>
            <div className="text-xs text-muted-foreground">
              ⌀ multi-item slotów: {stats.composeMode.avgMultiItemSlotCount} · niepowodzenia: {stats.composeMode.failuresInComposeMode}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status histogram + duration breakdown */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status histogram</CardTitle>
          </CardHeader>
          <CardContent>
            {totalStatuses === 0 ? (
              <p className="text-sm text-muted-foreground">Brak danych</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Liczba</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(stats.statusHistogram)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, n]) => (
                      <TableRow key={status}>
                        <TableCell className="font-medium">{status}</TableCell>
                        <TableCell className="text-right">{n}</TableCell>
                        <TableCell className="text-right">{((100 * n) / totalStatuses).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Duration percentiles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Wartość</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Min</TableCell>
                  <TableCell className="text-right">{fmtMs(stats.durationMs.min)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>P50 (median)</TableCell>
                  <TableCell className="text-right">{fmtMs(stats.durationMs.p50)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>P95</TableCell>
                  <TableCell className="text-right">{fmtMs(stats.durationMs.p95)}</TableCell>
                </TableRow>
                <TableRow className={durationAlertClass(stats.durationMs.p99)}>
                  <TableCell>P99</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMs(stats.durationMs.p99)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Max</TableCell>
                  <TableCell className="text-right">{fmtMs(stats.durationMs.max)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Liczba samples</TableCell>
                  <TableCell className="text-right text-muted-foreground">{stats.durationMs.count}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Master plan §perf: P50 ≤ 5s, P95 ≤ 15s, P99 ≤ 30s
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compose-mode breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Compose-mode szczegóły</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Wartość</TableHead>
                <TableHead className="text-muted-foreground">Komentarz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Plany z compose=true</TableCell>
                <TableCell className="text-right">{stats.composeMode.activeCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtPct(stats.composeMode.activeRate)} całości
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>⌀ compose slotów</TableCell>
                <TableCell className="text-right">{stats.composeMode.avgComposeSlotsCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  oczekiwane 2 (LUNCH + DINNER ≥18%)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>⌀ multi-item slotów per plan</TableCell>
                <TableCell className="text-right">{stats.composeMode.avgMultiItemSlotCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  proxy dla "compose path faktycznie zadziałał"
                </TableCell>
              </TableRow>
              <TableRow className={stats.composeMode.failuresInComposeMode > 0 ? 'bg-red-50 dark:bg-red-950/40' : ''}>
                <TableCell>Niepowodzenia w compose</TableCell>
                <TableCell className="text-right font-semibold">{stats.composeMode.failuresInComposeMode}</TableCell>
                <TableCell className="text-muted-foreground">
                  INFEASIBLE / TIMEOUT / ERROR (target = 0)
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cuisine coverage (Faza D D1 revisited) */}
      {stats.cuisine.plansEvaluated > 0 && (
        <Card className={cuisineAlertClass(stats.cuisine.coveragePercent)}>
          <CardHeader>
            <CardTitle>Dopasowanie kuchni (cuisine soft-constraint)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Plany z aktywną preferencją</TableCell>
                    <TableCell className="text-right font-semibold">
                      {stats.cuisine.plansEvaluated}
                      <span className="ml-1 text-xs text-muted-foreground">
                        z {stats.totalPlans} ogółem
                      </span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Zsumowane sloty match</TableCell>
                    <TableCell className="text-right">
                      {stats.cuisine.totalMatched} / {stats.cuisine.totalMain}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Średnie pokrycie</TableCell>
                    <TableCell className="text-right text-xl font-bold">
                      {stats.cuisine.coveragePercent.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Plany poniżej 60% targetu</TableCell>
                    <TableCell className="text-right font-semibold">
                      {stats.cuisine.plansBelowTarget}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">Histogram pokrycia per plan</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bin</TableHead>
                      <TableHead className="text-right">Plany</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.cuisine.coverageHistogram.map((b) => (
                      <TableRow key={b.bin} className={b.bin === '0-20%' && b.count > 0 ? 'bg-red-50 dark:bg-red-950/40' : ''}>
                        <TableCell>{b.bin}</TableCell>
                        <TableCell className="text-right">{b.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              SC22 target: ≥60% slotów-głównych w preferowanej kuchni. Karę -200 stosujemy per brakujący slot.
              Plany w binie 0-20% to potencjalny sygnał problemu (np. rzadka kuchnia z &lt;15 receptur w bazie).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Per-patient (only when no patient filter) */}
      {stats.perPatient && stats.perPatient.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Per pacjent</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>patientId</TableHead>
                  <TableHead className="text-right">Plany</TableHead>
                  <TableHead className="text-right">Compose runs</TableHead>
                  <TableHead className="text-right">Median duration</TableHead>
                  <TableHead>Status breakdown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.perPatient.slice(0, 50).map((p) => (
                  <TableRow key={p.patientId}>
                    <TableCell className="font-mono text-xs">{p.patientId}</TableCell>
                    <TableCell className="text-right">{p.plans}</TableCell>
                    <TableCell className="text-right">{p.composeRuns}</TableCell>
                    <TableCell className="text-right">{fmtMs(p.medianDurationMs)}</TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {Object.entries(p.statusBreakdown)
                          .map(([s, n]) => `${s}: ${n}`)
                          .join(' · ')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {stats.perPatient.length > 50 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Pokazano top 50 z {stats.perPatient.length} pacjentów. Zfiltruj po patientId żeby zobaczyć detale.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
