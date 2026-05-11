'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import type { ProgressData } from '@/types/api';

interface WeightProgressBarProps {
  progress: ProgressData;
}

export function WeightProgressBar({ progress }: WeightProgressBarProps) {
  const t = useTranslations('dashboard.progress');
  const { startWeightKg, currentWeightKg, goalWeightKg, progressPercent, totalChangeKg } = progress;

  if (startWeightKg == null || currentWeightKg == null) {
    return null;
  }

  const hasGoal = goalWeightKg != null;
  const pct = progressPercent ?? 0;

  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <h3 className="text-sm font-semibold mb-3">{t('title')}</h3>

        {/* Weight values row */}
        <div className="flex items-end justify-between mb-2 text-sm">
          <div className="text-muted-foreground">
            <span className="block text-xs">{t('start')}</span>
            <span className="font-medium text-foreground">{startWeightKg} kg</span>
          </div>
          <div className="text-center">
            <span className="block text-xs text-muted-foreground">{t('current')}</span>
            <span className="text-lg font-bold text-primary">{currentWeightKg} kg</span>
            {totalChangeKg != null && totalChangeKg !== 0 && (
              <span
                className={`block text-xs font-medium ${
                  totalChangeKg < 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}
              >
                {totalChangeKg > 0 ? '+' : ''}{totalChangeKg} kg
              </span>
            )}
          </div>
          {hasGoal && (
            <div className="text-right text-muted-foreground">
              <span className="block text-xs">{t('goal')}</span>
              <span className="font-medium text-foreground">{goalWeightKg} kg</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {hasGoal && (
          <>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sage-400 to-sage-600 transition-all duration-500"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
              {/* Current position marker */}
              {pct > 0 && pct < 100 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white bg-sage-600 shadow-sm"
                  style={{ left: `calc(${Math.min(pct, 100)}% - 8px)` }}
                />
              )}
            </div>
            <div className="mt-1 text-center text-xs text-muted-foreground">
              {pct >= 100 ? t('goalReached') : t('progressPercent', { percent: pct })}
            </div>
          </>
        )}

        {!hasGoal && (
          <p className="text-xs text-muted-foreground">{t('setGoalHint')}</p>
        )}
      </CardContent>
    </Card>
  );
}
