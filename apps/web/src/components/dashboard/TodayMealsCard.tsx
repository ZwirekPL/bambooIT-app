'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Utensils } from 'lucide-react';

interface Meal {
  name?: string;
  mealName?: string;
  items?: Array<{ name?: string; grams?: number }>;
  ingredients?: Array<{ name?: string; grams?: number }>;
  kcal?: number;
  totalKcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
}

interface TodayData {
  dayName: string;
  meals: Meal[];
}

export function TodayMealsCard() {
  const t = useTranslations('dashboard.todayMeals');
  const { data: session } = useSession();
  const token = '';

  const [today, setToday] = useState<TodayData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.dietPlans.getToday(token)
      .then((res) => { setToday(res.today); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [token]);

  if (!loaded || !today) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Utensils className="h-4 w-4 text-sage-600" />
          {t('title', { day: today.dayName })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {today.meals.map((meal, i) => {
          const name = meal.name ?? meal.mealName ?? `${t('meal')} ${i + 1}`;
          const items = meal.items ?? meal.ingredients ?? [];
          const kcal = meal.kcal ?? meal.totalKcal;
          const summary = items.slice(0, 3).map((it) => it.name).filter(Boolean).join(', ');

          return (
            <div key={i} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
              <p className="text-sm font-medium">{name}</p>
              {summary && <p className="text-xs text-muted-foreground truncate">{summary}</p>}
              {kcal != null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {Math.round(kcal)} kcal
                  {meal.proteinG != null && ` · B${Math.round(meal.proteinG)}g`}
                  {meal.fatG != null && ` · T${Math.round(meal.fatG)}g`}
                  {meal.carbsG != null && ` · W${Math.round(meal.carbsG)}g`}
                </p>
              )}
            </div>
          );
        })}
        <Link href="/dashboard/plan" className="text-sm font-medium text-sage-700 hover:underline">
          {t('seeFullPlan')} →
        </Link>
      </CardContent>
    </Card>
  );
}
