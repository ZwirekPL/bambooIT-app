'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import {
  DragDropPlanEditor,
  type PlanContent,
} from '@/components/dietitian/DragDropPlanEditor';

export default function DragDropPlanPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;
  const t = useTranslations('dietitian.planEditor');

  const [targets, setTargets] = useState<{
    targetKcal: number;
    targetProteinG: number;
    targetFatG: number;
    targetCarbsG: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const token = '';
      if (!token) return;

      try {
        const res = await api.dietitian.getNutritionTargets(patientId, token);
        setTargets({
          targetKcal: res.targets.targetKcal,
          targetProteinG: res.targets.targetProteinG,
          targetFatG: res.targets.targetFatG,
          targetCarbsG: res.targets.targetCarbsG,
        });
      } catch {
        // Fallback to default targets if none set
        setTargets({
          targetKcal: 2000,
          targetProteinG: 75,
          targetFatG: 67,
          targetCarbsG: 250,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, ['', patientId]);

  async function handleSave(plan: PlanContent) {
    const token = '';

    // Calculate average daily macros from the plan
    let totalKcal = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    let filledDays = 0;

    for (const day of plan.days) {
      let dayHas = false;
      for (const meal of day.meals) {
        if (meal.recipe) {
          dayHas = true;
          const sf = meal.recipe.scaleFactor;
          totalKcal += meal.recipe.kcal * sf;
          totalProtein += meal.recipe.protein * sf;
          totalFat += meal.recipe.fat * sf;
          totalCarbs += meal.recipe.carbs * sf;
        }
      }
      if (dayHas) filledDays++;
    }

    const divisor = filledDays || 1;

    try {
      await api.dietPlans.createManual(
        patientId,
        {
          kcal: Math.round(totalKcal / divisor),
          proteinG: Math.round(totalProtein / divisor),
          fatG: Math.round(totalFat / divisor),
          carbsG: Math.round(totalCarbs / divisor),
          content: plan as unknown as Record<string, unknown>,
        },
        token
      );

      router.push(`/dietetyk/pacjenci/${patientId}`);
      router.refresh();
    } catch {
      setError(t('loadError'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/dietetyk/pacjenci/${patientId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToPatient')}
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {targets && (
        <DragDropPlanEditor
          patientId={patientId}
          targets={targets}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
