'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CheckInTrends as CheckInTrendsData } from '@/types/api';

interface CheckInTrendsProps {
  trends: CheckInTrendsData;
  goalWeightKg?: number | null;
}

export function CheckInTrends({ trends, goalWeightKg }: CheckInTrendsProps) {
  const t = useTranslations('dashboard.checkin.trends');

  if (trends.totalCheckIns < 2) {
    return (
      <p className="text-sm text-muted-foreground">{t('notEnoughData')}</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Weight trend card */}
      <WeightTrendCard trends={trends} t={t} />

      {/* Alerts */}
      <AlertsCard trends={trends} t={t} />

      {/* Weight chart */}
      {trends.weightHistory.length >= 2 && (
        <WeightChart history={trends.weightHistory} goalWeightKg={goalWeightKg} t={t} />
      )}

      {/* Metric averages */}
      <MetricAveragesCard trends={trends} t={t} />
    </div>
  );
}

// ── Weight trend ───────────────────────────────────────────────

function WeightTrendCard({
  trends,
  t,
}: {
  trends: CheckInTrendsData;
  t: ReturnType<typeof useTranslations>;
}) {
  const { weightTrend } = trends;

  const directionLabel: Record<string, string> = {
    losing: t('losing'),
    gaining: t('gaining'),
    stable: t('stable'),
    insufficient_data: t('insufficientData'),
  };

  const directionColor: Record<string, string> = {
    losing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    gaining: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    stable: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    insufficient_data: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  };

  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t('weightTrend')}</h3>
          <Badge className={directionColor[weightTrend.direction]} variant="secondary">
            {directionLabel[weightTrend.direction]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {weightTrend.currentKg != null && (
            <StatBlock label={t('current')} value={`${weightTrend.currentKg} kg`} />
          )}
          {weightTrend.startKg != null && (
            <StatBlock label={t('start')} value={`${weightTrend.startKg} kg`} />
          )}
          {weightTrend.totalChangeKg != null && (
            <StatBlock
              label={t('totalChange')}
              value={`${weightTrend.totalChangeKg > 0 ? '+' : ''}${weightTrend.totalChangeKg} kg`}
              highlight={weightTrend.totalChangeKg !== 0}
            />
          )}
          {weightTrend.weeklyRateKg != null && (
            <StatBlock
              label={t('weeklyRate')}
              value={`${weightTrend.weeklyRateKg > 0 ? '+' : ''}${weightTrend.weeklyRateKg} kg`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Alerts ─────────────────────────────────────────────────────

function AlertsCard({
  trends,
  t,
}: {
  trends: CheckInTrendsData;
  t: ReturnType<typeof useTranslations>;
}) {
  const alerts: Array<{ type: 'warning' | 'info'; message: string }> = [];

  if (trends.rapidLoss.isRapidLoss) {
    alerts.push({
      type: 'warning',
      message: t('rapidLossAlert', { rate: trends.rapidLoss.weeklyLossKg }),
    });
  }

  if (trends.plateau.isPlateauDetected) {
    alerts.push({
      type: 'info',
      message: t('plateauAlert', { weeks: trends.plateau.plateauWeeks }),
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`rounded-lg border px-4 py-3 text-sm ${
            alert.type === 'warning'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
              : 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
          }`}
        >
          <span className="mr-2">{alert.type === 'warning' ? '⚠' : 'ℹ'}</span>
          {alert.message}
        </div>
      ))}
    </div>
  );
}

// ── Weight chart (pure CSS, no dependencies) ───────────────────

function WeightChart({
  history,
  goalWeightKg,
  t,
}: {
  history: CheckInTrendsData['weightHistory'];
  goalWeightKg?: number | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const weights = history.map((p) => p.weightKg);
  const allValues = goalWeightKg != null ? [...weights, goalWeightKg] : weights;
  const min = Math.floor(Math.min(...allValues) - 1);
  const max = Math.ceil(Math.max(...allValues) + 1);
  const range = max - min || 1;
  const chartHeight = 160;

  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <h3 className="text-sm font-semibold mb-3">{t('weightChart')}</h3>

        <div className="relative" style={{ height: chartHeight }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-10 flex flex-col justify-between text-xs text-muted-foreground">
            <span>{max} kg</span>
            <span>{Math.round((max + min) / 2)} kg</span>
            <span>{min} kg</span>
          </div>

          {/* Goal weight label on Y-axis */}
          {goalWeightKg != null && (
            <div
              className="absolute left-0 text-[10px] font-medium text-red-500 dark:text-red-400"
              style={{
                top: `${((max - goalWeightKg) / range) * 100}%`,
                transform: 'translateY(-50%)',
              }}
            >
              {t('goalLine')}
            </div>
          )}

          {/* Chart area */}
          <div className="ml-10 sm:ml-12 h-full relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border-t border-border" />
              ))}
            </div>

            {/* SVG line chart */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${(history.length - 1) * 100} ${chartHeight}`}
              preserveAspectRatio="none"
            >
              {/* Goal line */}
              {goalWeightKg != null && (
                <line
                  x1="0"
                  y1={chartHeight - ((goalWeightKg - min) / range) * chartHeight}
                  x2={(history.length - 1) * 100}
                  y2={chartHeight - ((goalWeightKg - min) / range) * chartHeight}
                  stroke="hsl(var(--destructive, 0 84% 60%))"
                  strokeWidth="2"
                  strokeDasharray="8,4"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.6"
                />
              )}
              {/* Line */}
              <polyline
                points={history
                  .map((p, i) => {
                    const x = history.length === 1 ? 0 : i * ((history.length - 1) * 100) / (history.length - 1);
                    const y = chartHeight - ((p.weightKg - min) / range) * chartHeight;
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
              {/* Dots */}
              {history.map((p, i) => {
                const x = history.length === 1 ? 0 : i * ((history.length - 1) * 100) / (history.length - 1);
                const y = chartHeight - ((p.weightKg - min) / range) * chartHeight;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="hsl(var(--primary))"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {/* X-axis labels */}
            <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-xs text-muted-foreground">
              {history.length <= 8
                ? history.map((p, i) => (
                    <span key={i}>{formatShortDate(p.date)}</span>
                  ))
                : [history[0], history[Math.floor(history.length / 2)], history[history.length - 1]].map(
                    (p, i) => <span key={i}>{formatShortDate(p.date)}</span>
                  )}
            </div>
          </div>
        </div>

        {/* Bottom padding for x-axis labels */}
        <div className="h-6" />
      </CardContent>
    </Card>
  );
}

// ── Metric averages ────────────────────────────────────────────

function MetricAveragesCard({
  trends,
  t,
}: {
  trends: CheckInTrendsData;
  t: ReturnType<typeof useTranslations>;
}) {
  const { averages, recentAverages } = trends;

  const metrics = [
    { key: 'compliance', label: t('avgCompliance'), unit: '%', max: 100 },
    { key: 'hunger', label: t('avgHunger'), unit: '/10', max: 10 },
    { key: 'energy', label: t('avgEnergy'), unit: '/10', max: 10 },
    { key: 'sleep', label: t('avgSleep'), unit: '/10', max: 10 },
    { key: 'activity', label: t('avgActivity'), unit: '/10', max: 10 },
  ] as const;

  const hasAnyData = metrics.some(
    (m) => averages[m.key] != null
  );

  if (!hasAnyData) return null;

  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <h3 className="text-sm font-semibold mb-3">{t('metricAverages')}</h3>

        <div className="space-y-3">
          {metrics.map((m) => {
            const allVal = averages[m.key];
            const recentVal = recentAverages[m.key];
            if (allVal == null) return null;

            const pct = (allVal / m.max) * 100;
            const recentPct = recentVal != null ? (recentVal / m.max) * 100 : null;

            // Trend indicator: compare recent to overall
            let trendArrow = '';
            if (recentVal != null && allVal != null) {
              const diff = recentVal - allVal;
              if (Math.abs(diff) > 0.3) {
                trendArrow = diff > 0 ? '↑' : '↓';
              }
            }

            return (
              <div key={m.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-medium">
                    {allVal}{m.unit}
                    {recentVal != null && recentVal !== allVal && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({t('recent')}: {recentVal}{m.unit} {trendArrow})
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function StatBlock({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}
