'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Flame, Drumstick, Droplets, Wheat } from 'lucide-react';

interface PlanPreviewSummaryProps {
  token: string;
  patientId: string;
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Redukcja masy ciała',
  gain_weight: 'Przybranie masy ciała',
  maintain_weight: 'Utrzymanie masy ciała',
  muscle_gain: 'Budowa masy mięśniowej',
  health_improvement: 'Poprawa zdrowia',
};

const DIET_LABELS: Record<string, string> = {
  STANDARD: 'Standardowa',
  VEGE: 'Wegetariańska',
  VEGAN: 'Wegańska',
  GLUTEN_FREE: 'Bezglutenowa',
  LACTOSE_FREE: 'Bez laktozy',
};

export function PlanPreviewSummary({ token, patientId }: PlanPreviewSummaryProps) {
  const t = useTranslations('dashboard.planPreview');
  const [targets, setTargets] = useState<{
    targetKcal: number;
    targetProteinG: number;
    targetFatG: number;
    targetCarbsG: number;
    goal: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dietToolkit
      .get(patientId, token)
      .then((res) => {
        if (res.toolkit.nutritionTargets) {
          setTargets(res.toolkit.nutritionTargets);
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [patientId, token]);

  if (loading || !targets) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">
            {t('title') ?? 'Na podstawie Twojego wywiadu'}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t('desc') ?? 'Przygotowujemy plan dopasowany do Twoich potrzeb:'}
        </p>

        {targets.goal && (
          <p className="text-sm font-medium mb-3">
            {t('goal') ?? 'Cel'}: {GOAL_LABELS[targets.goal] ?? targets.goal}
          </p>
        )}

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-md border bg-background p-2">
            <Flame className="h-4 w-4 mx-auto text-orange-500 mb-1" />
            <div className="text-lg font-bold tabular-nums">{targets.targetKcal}</div>
            <div className="text-[10px] text-muted-foreground">kcal</div>
          </div>
          <div className="rounded-md border bg-background p-2">
            <Drumstick className="h-4 w-4 mx-auto text-red-500 mb-1" />
            <div className="text-lg font-bold tabular-nums">{targets.targetProteinG}g</div>
            <div className="text-[10px] text-muted-foreground">{t('protein') ?? 'Białko'}</div>
          </div>
          <div className="rounded-md border bg-background p-2">
            <Droplets className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
            <div className="text-lg font-bold tabular-nums">{targets.targetFatG}g</div>
            <div className="text-[10px] text-muted-foreground">{t('fat') ?? 'Tłuszcze'}</div>
          </div>
          <div className="rounded-md border bg-background p-2">
            <Wheat className="h-4 w-4 mx-auto text-amber-700 mb-1" />
            <div className="text-lg font-bold tabular-nums">{targets.targetCarbsG}g</div>
            <div className="text-[10px] text-muted-foreground">{t('carbs') ?? 'Węgle'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
