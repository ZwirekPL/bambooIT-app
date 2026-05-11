'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import type { PlanQualityData, SoftValidation, SoftValidationStatus, PlanQualityGrade, WeeklyMetrics } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, BarChart3, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

const GRADE_STYLES: Record<PlanQualityGrade, { label: string; bg: string; text: string }> = {
  A: { label: 'Doskonały', bg: 'bg-green-500', text: 'text-white' },
  B: { label: 'Bardzo dobry', bg: 'bg-green-400', text: 'text-white' },
  C: { label: 'Dobry', bg: 'bg-amber-400', text: 'text-white' },
  D: { label: 'Wymaga uwagi', bg: 'bg-orange-500', text: 'text-white' },
  E: { label: 'Wymaga przerobienia', bg: 'bg-red-500', text: 'text-white' },
};

const STATUS_ICON: Record<SoftValidationStatus, React.ReactNode> = {
  OK: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  WARNING: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  FAIL: <XCircle className="h-3.5 w-3.5 text-red-500" />,
};

const DAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

// ─── sub-components ───────────────────────────────────────────────────────────

function GradeBadge({ grade, score }: { grade: PlanQualityGrade; score: number }) {
  const style = GRADE_STYLES[grade];
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-lg ${style.bg} ${style.text}`}>
        {grade}
      </span>
      <div>
        <p className="text-sm font-medium">{style.label}</p>
        <p className="text-xs text-muted-foreground">{score}/100 pkt</p>
      </div>
    </div>
  );
}

function ValidationRow({ v }: { v: SoftValidation }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {STATUS_ICON[v.status]}
      <span className="w-28 truncate">{v.label}</span>
      <span className="font-mono">
        {v.actual}{v.unit === '% energii' ? '%' : v.unit}
      </span>
      <span className="text-muted-foreground">
        / {v.metric === 'sodium' ? '≤' : '≥'}{v.target}{v.unit === '% energii' ? '%' : v.unit}
      </span>
    </div>
  );
}

function DayValidations({ dayIndex, validations }: { dayIndex: number; validations: SoftValidation[] }) {
  const [expanded, setExpanded] = useState(false);
  const failCount = validations.filter((v) => v.status === 'FAIL').length;
  const warnCount = validations.filter((v) => v.status === 'WARNING').length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="text-xs font-medium">{DAY_NAMES[dayIndex] ?? `Dzień ${dayIndex + 1}`}</span>
        <div className="flex gap-1 ml-auto">
          {failCount > 0 && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700">{failCount} problem</Badge>}
          {warnCount > 0 && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">{warnCount} uwaga</Badge>}
          {failCount === 0 && warnCount === 0 && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">OK</Badge>}
        </div>
      </button>
      {expanded && (
        <div className="border-t p-2.5 space-y-1.5 bg-muted/20">
          {validations.map((v) => (
            <ValidationRow key={v.metric} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyMetricsCard({ metrics }: { metrics: WeeklyMetrics }) {
  const items = [
    { label: 'Śr. kcal/dzień', value: metrics.avgKcalPerDay, unit: '' },
    { label: 'Źródła białka', value: metrics.proteinSourceCount, unit: ' rodzajów', ok: metrics.proteinSourceCount >= 4 },
    { label: 'Ryby/tydzień', value: metrics.fishMealsCount, unit: 'x', ok: metrics.fishMealsCount >= 2 },
    { label: 'Strączki/tydzień', value: metrics.legumeMealsCount, unit: 'x', ok: metrics.legumeMealsCount >= 2 },
    { label: 'Powtórki', value: metrics.recipeRepeatCount, unit: '', ok: metrics.recipeRepeatCount === 0 },
    { label: 'Śr. sód', value: metrics.avgSodiumMg, unit: 'mg', ok: metrics.avgSodiumMg <= 2000 },
    { label: 'Śr. błonnik', value: metrics.avgFiberG, unit: 'g', ok: metrics.avgFiberG >= 25 },
    { label: 'Śr. warzywa', value: metrics.avgVegetablesG, unit: 'g', ok: metrics.avgVegetablesG >= 400 },
    { label: 'Śr. owoce', value: metrics.avgFruitsG, unit: 'g', ok: metrics.avgFruitsG >= 200 },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="border rounded-lg p-2 text-center">
          <p className="text-[10px] text-muted-foreground">{item.label}</p>
          <p className="text-sm font-mono font-medium">
            {item.value}{item.unit}
          </p>
          {'ok' in item && (
            <span className={`text-[10px] ${item.ok ? 'text-green-600' : 'text-amber-500'}`}>
              {item.ok ? '✓' : '✗'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── main panel ───────────────────────────────────────────────────────────────

export function PlanQualityPanel({ planId }: { planId: string }) {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);
  const [quality, setQuality] = useState<PlanQualityData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (visible) {
      setVisible(false);
      return;
    }

    if (!quality) {
      setLoading(true);
      try {
        const result = await api.dietPlans.getPlanQuality(planId, '');
        setQuality(result.planQuality);
      } catch {
        setQuality(null);
      } finally {
        setLoading(false);
      }
    }

    setVisible(true);
  };

  return (
    <div className="border rounded-xl bg-card shadow-sm">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors rounded-xl"
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 text-violet-700 shrink-0">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Raport jakości planu</p>
          <p className="text-xs text-muted-foreground">Ocena A-E, walidacja dzienna, metryki tygodniowe</p>
        </div>
        {visible ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {visible && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Ładowanie...</p>}

          {!loading && !quality && (
            <p className="text-sm text-muted-foreground">
              Brak danych o jakości — plan wygenerowany przed wdrożeniem Fazy 74.
            </p>
          )}

          {quality && (
            <>
              {/* Grade + Score */}
              <GradeBadge grade={quality.grade} score={quality.score} />

              {/* Weekly metrics */}
              <div>
                <p className="text-xs font-medium mb-2">Metryki tygodniowe</p>
                <WeeklyMetricsCard metrics={quality.weeklyMetrics} />
              </div>

              {/* Per-day validations */}
              <div>
                <p className="text-xs font-medium mb-2">Walidacja dzienna</p>
                <div className="space-y-1.5">
                  {quality.softValidations.map((dayValidations, i) => (
                    <DayValidations key={i} dayIndex={i} validations={dayValidations} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
