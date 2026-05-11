'use client';

import type { AiProcessingReport } from '@/types/api';
import { AlertTriangle, Info, AlertCircle, ChefHat, Package, Clock } from 'lucide-react';

interface Props {
  report: AiProcessingReport;
}

function IssueAlert({ type, details, count }: { type: string; details: string[]; count: number }) {
  switch (type) {
    case 'MISSING_RECIPES':
      return (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <ChefHat className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              AI nie wygenerował przepisów dla {count} posiłków
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
              Wygenerowano podstawowe przepisy zastępcze.
            </p>
          </div>
        </div>
      );

    case 'UNMATCHED_PRODUCTS':
      return (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
          <Package className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-300">
              {count} produktów nierozpoznanych w bazie
            </p>
            {details.length > 0 && (
              <p className="text-blue-700 dark:text-blue-400 text-xs mt-0.5">
                {details.slice(0, 5).join(', ')}{details.length > 5 ? ` i ${details.length - 5} więcej` : ''}
              </p>
            )}
          </div>
        </div>
      );

    case 'KCAL_DEVIATION':
      return (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-red-800 dark:text-red-300">
              Odchylenie kaloryczne
            </p>
            {details[0] && (
              <p className="text-red-700 dark:text-red-400 text-xs mt-0.5">{details[0]}</p>
            )}
          </div>
        </div>
      );

    case 'HARD_FLOOR':
      return (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-red-800 dark:text-red-300">
              Plan poniżej minimalnego progu kalorycznego (1000 kcal/dzień)
            </p>
            {details[0] && (
              <p className="text-red-700 dark:text-red-400 text-xs mt-0.5">{details[0]}</p>
            )}
          </div>
        </div>
      );

    case 'MACRO_DEVIATION':
      return (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Odchylenie makroskładników
            </p>
            {details[0] && (
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">{details[0]}</p>
            )}
          </div>
        </div>
      );

    case 'COOKING_TIME':
      return (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-300">
              {count} posiłków przekracza limit czasu przygotowania
            </p>
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function AiReportBanner({ report }: Props) {
  if (report.issues.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          Raport przetwarzania AI
          {report.autoAdjusted && ' — automatycznie skorygowano kalorie'}
        </span>
        {report.aiModel && (
          <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5">
            {report.aiModel}
          </span>
        )}
      </div>
      {report.issues.map((issue, i) => (
        <IssueAlert key={i} type={issue.type} details={issue.details} count={issue.count} />
      ))}
    </div>
  );
}
